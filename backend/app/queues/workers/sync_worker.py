"""Worker de sincronização de laudos do campo → banco de dados.

Responsabilidades:
  1. Recebe o payload do laudo (proveniente do PWA offline via Dexie.js).
  2. Valida o schema com Pydantic.
  3. Mapeia campos para o schema real da tabela `reports` no Supabase.
  4. Mapeia status do frontend para o banco (draft/submitted/approved/issued/returned).
  5. Grava via função SQL RPC que respeita triggers e regras de inspetor.
  6. Dispara a fila de geração de PDF quando o laudo estiver 'issued'.
  7. Em caso de falha definitiva, move para a Dead Letter Queue (DLQ).
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
# Mapa de status: frontend ↔ banco (ISO 9001 - rastreabilidade)
# ─────────────────────────────────────────────────────────

STATUS_MAP_FRONT_TO_DB = {
    "rascunho": "draft",
    "enviado": "submitted",
    "aprovado": "approved",
    "reprovado": "draft",  # não há status de reprovado no banco; retorna para rascunho
}

STATUS_DB_TO_FRONT = {
    "draft": "rascunho",
    "submitted": "enviado",
    "approved": "aprovado",
    "issued": "emitido",
    "returned": "devolvido",
}

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
# Mapeamento de payload frontend → colunas da tabela `reports`
# ─────────────────────────────────────────────────────────

def _map_payload_to_report(laudo: LaudoSyncPayload, user_id: str) -> dict[str, Any]:
    """Mapeia campos do frontend para a tabela `reports` do Supabase.

    Regras:
      - equipmentTag → equipment_tag
      - date → inspection_date
      - title, summary, unitArea, method, norm_procedure, acceptance_criteria,
        findings_count → technical_data ou administrative_data
      - inspector_id = user_id do token (quem assina o laudo)
      - work_order_id e template_id: resolvidos via busca padrão do tenant
    """
    db_status = STATUS_MAP_FRONT_TO_DB.get(laudo.status, "draft")

    technical_data = {
        **laudo.technical_data,
        "method": laudo.method,
        "title": laudo.title,
        "unit_area": laudo.unit_area,
        "norm_procedure": laudo.norm_procedure,
        "acceptance_criteria": laudo.acceptance_criteria,
        "findings_count": laudo.findings_count,
    }

    administrative_data = {
        "summary": laudo.summary,
        "inspector_name": laudo.inspector_name,
        "inspector_snqc": laudo.inspector_snqc,
    }

    return {
        "id": laudo.id,
        "tenant_id": laudo.technical_data.get("tenant_id", ""),
        "work_order_id": laudo.technical_data.get("work_order_id", ""),
        "template_id": laudo.technical_data.get("template_id", ""),
        "inspector_id": user_id,
        "status": db_status,
        "equipment_tag": laudo.equipment_tag,
        "inspection_date": laudo.date,
        "technical_data": technical_data,
        "administrative_data": administrative_data,
    }


# ─────────────────────────────────────────────────────────
# Gravação no Supabase via função SQL RPC (respeita triggers)
# ─────────────────────────────────────────────────────────

@retry(
    retry=retry_if_exception_type(Exception),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    stop=stop_after_attempt(3),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
async def _upsert_laudo_supabase(report_data: dict[str, Any]) -> dict[str, Any]:
    """Grava ou atualiza o laudo na tabela `reports` via função SQL RPC.

    Usa a função `upsert_laudo` que respeita triggers e regras de inspetor
    responsável, em vez de upsert direto com service role.
    """
    from supabase import create_client
    from app.core.config import settings

    sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    result = (
        sb.rpc("upsert_laudo", report_data)
        .execute()
    )

    if not result.data:
        raise RuntimeError(f"Supabase não retornou dados após upsert_laudo: {result}")

    logger.info("Laudo %s gravado na tabela reports.", report_data.get("id"))
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
      2. Mapeia campos para tabela `reports`
      3. Grava via função SQL RPC (respeita triggers)
      4. Se issued → dispara geração de PDF
      5. Falha definitiva → DLQ
    """
    logger.info("[sync_laudo] Iniciando processamento do laudo: %s", payload.get("id"))

    # 1. Validação
    try:
        laudo = LaudoSyncPayload(**payload)
    except Exception as e:
        logger.error("[sync_laudo] Payload inválido: %s", e)
        await _move_to_dlq(ctx, payload, str(e))
        return {"status": "erro_validacao", "detail": str(e)}

    user_id = payload.get("user_id", "")

    # 2. Mapeamento de campos para tabela `reports`
    try:
        report_data = _map_payload_to_report(laudo, user_id)
    except Exception as e:
        logger.error("[sync_laudo] Falha ao mapear campos: %s", e)
        await _move_to_dlq(ctx, payload, str(e))
        return {"status": "erro_mapeamento", "detail": str(e)}

    # 3. Gravação no Supabase via RPC
    try:
        saved = await _upsert_laudo_supabase(report_data)
    except Exception as e:
        logger.error("[sync_laudo] Falha definitiva ao gravar laudo %s: %s", laudo.id, e)
        await _move_to_dlq(ctx, payload, str(e))
        return {"status": "erro_banco", "detail": str(e)}

    # 4. Dispara geração de PDF se o laudo estiver 'issued'
    db_status = STATUS_MAP_FRONT_TO_DB.get(laudo.status, "draft")
    if db_status == "issued":
        try:
            from app.queues.enqueue import enqueue_generate_pdf
            arq: ArqRedis = ctx["redis"]
            tenant_id = payload.get("tenant_id", "default")
            await enqueue_generate_pdf(arq, laudo_id=laudo.id, tenant_id=tenant_id)
            logger.info("[sync_laudo] PDF enfileirado para laudo %s", laudo.id)
        except Exception as e:
            # Falha no PDF não bloqueia o fluxo principal
            logger.warning("[sync_laudo] Falha ao enfileirar PDF: %s", e)

    logger.info("[sync_laudo] Laudo %s sincronizado com sucesso.", laudo.id)
    return {"status": "ok", "laudo_id": laudo.id, "saved": saved}
