"""Worker de sincronização de laudos do campo → banco de dados.

Responsabilidades:
  1. Recebe o payload do laudo (proveniente do PWA offline via Dexie.js).
  2. Valida o schema com Pydantic.
  3. Grava no Supabase com retry exponencial (até 3 tentativas).
  4. Dispara a fila de geração de PDF se o laudo estiver 'aprovado'.
  5. Em caso de falha definitiva, move para a Dead Letter Queue (DLQ).
"""

from __future__ import annotations

import logging
from typing import Any

from arq import ArqRedis
from tenacity import (
    before_sleep_log,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────
# Schemas de validação (Pydantic)
# ─────────────────────────────────────────────────────────
from pydantic import BaseModel, Field
from datetime import datetime


class LaudoSyncPayload(BaseModel):
    """Schema mínimo esperado de um laudo vindo do frontend offline."""
    id: str = Field(..., description="UUID do laudo gerado no frontend (Dexie.js)")
    method: str = Field(..., description="Método END: LP, ME, EVS, NR13, PM, US, PINTURA")
    title: str
    equipment_tag: str = Field(..., alias="equipmentTag")
    unit_area: str = Field(..., alias="unitArea")
    inspector_name: str = Field(..., alias="inspectorName")
    inspector_snqc: str = Field(..., alias="inspectorSNQC")
    norm_procedure: str = Field(..., alias="normProcedure")
    acceptance_criteria: str = Field(..., alias="acceptanceCriteria")
    date: str
    status: str = "rascunho"
    findings_count: int = Field(0, alias="findingsCount")
    summary: str = ""
    technical_data: dict[str, Any] = Field(default_factory=dict, alias="technicalData")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    model_config = {"populate_by_name": True}


# ─────────────────────────────────────────────────────────
# Gravação no Supabase com retry exponencial
# ─────────────────────────────────────────────────────────

@retry(
    retry=retry_if_exception_type(Exception),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    stop=stop_after_attempt(3),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
async def _upsert_laudo_supabase(laudo: LaudoSyncPayload) -> dict[str, Any]:
    """Grava ou atualiza o laudo no Supabase.
    Usa UPSERT para ser idempotente: se o laudo já existir, atualiza.
    """
    from supabase import create_client
    from app.core.config import settings

    sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    data = laudo.model_dump(by_alias=False, mode="json")

    result = (
        sb.table("laudos")
        .upsert(data, on_conflict="id")
        .execute()
    )

    if not result.data:
        raise RuntimeError(f"Supabase não retornou dados após upsert: {result}")

    logger.info("Laudo %s gravado no Supabase.", laudo.id)
    return result.data[0]


# ─────────────────────────────────────────────────────────
# Dead Letter Queue (DLQ) – grava no Redis p/ investigação
# ─────────────────────────────────────────────────────────

async def _move_to_dlq(ctx: dict, payload: dict[str, Any], error: str) -> None:
    """Move payload com falha definitiva para a DLQ no Redis."""
    import json
    arq: ArqRedis = ctx["redis"]
    key = f"dlq:sync:laudos:{payload.get('id', 'unknown')}"
    await arq.set(key, json.dumps({"payload": payload, "error": error}), ex=60 * 60 * 24 * 7)
    logger.error("Laudo %s movido para DLQ: %s", payload.get("id"), error)


# ─────────────────────────────────────────────────────────
# Tarefa ARQ (entry-point do worker)
# ─────────────────────────────────────────────────────────

async def task_sync_laudo(ctx: dict, *, payload: dict[str, Any]) -> dict[str, Any]:
    """Tarefa ARQ: sincroniza um laudo do campo com o banco de dados.

    Fluxo:
      1. Valida schema
      2. Upsert no Supabase (3 tentativas com backoff)
      3. Se aprovado → dispara geração de PDF
      4. Falha definitiva → DLQ
    """
    logger.info("[sync_laudo] Iniciando processamento do laudo: %s", payload.get("id"))

    # 1. Validação
    try:
        laudo = LaudoSyncPayload(**payload)
    except Exception as e:
        logger.error("[sync_laudo] Payload inválido: %s", e)
        await _move_to_dlq(ctx, payload, str(e))
        return {"status": "erro_validacao", "detail": str(e)}

    # 2. Gravação no Supabase
    try:
        saved = await _upsert_laudo_supabase(laudo)
    except Exception as e:
        logger.error("[sync_laudo] Falha definitiva ao gravar laudo %s: %s", laudo.id, e)
        await _move_to_dlq(ctx, payload, str(e))
        return {"status": "erro_banco", "detail": str(e)}

    # 3. Dispara geração de PDF se o laudo estiver aprovado
    if laudo.status == "aprovado":
        try:
            from app.queues.enqueue import enqueue_generate_pdf
            arq: ArqRedis = ctx["redis"]
            # tenant_id pode vir no payload ou ser consultado via Supabase
            tenant_id = payload.get("tenant_id", "default")
            await enqueue_generate_pdf(arq, laudo_id=laudo.id, tenant_id=tenant_id)
            logger.info("[sync_laudo] PDF enfileirado para laudo %s", laudo.id)
        except Exception as e:
            # Falha no PDF não bloqueia o fluxo principal
            logger.warning("[sync_laudo] Falha ao enfileirar PDF: %s", e)

    logger.info("[sync_laudo] Laudo %s sincronizado com sucesso.", laudo.id)
    return {"status": "ok", "laudo_id": laudo.id, "saved": saved}
