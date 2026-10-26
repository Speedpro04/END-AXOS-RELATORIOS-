"""
╔══════════════════════════════════════════════════════════════╗
║       ROTA /sync – Axos Relatórios                          ║
╠══════════════════════════════════════════════════════════════╣
║  Recebe laudos do PWA (campo offline via Dexie.js)          ║
║  e os enfileira no Redis para processamento assíncrono.     ║
║                                                              ║
║  POST /api/sync/laudos         → sinc. um laudo             ║
║  POST /api/sync/laudos/batch   → sinc. em lote (até 50)     ║
║  GET  /api/sync/status/{job_id}→ consulta status da tarefa  ║
║  GET  /api/sync/dlq            → lista erros da DLQ         ║
╚══════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import logging
from typing import Annotated, Any

from arq import create_pool
from arq.jobs import Job
from fastapi import APIRouter, Body, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.security import CurrentUserDep
from app.queues.enqueue import enqueue_sync_laudo, get_arq_redis_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sync", tags=["Sincronização de Campo"])


# ─────────────────────────────────────────────────────────
# Dependency: pool ARQ reutilizável por request
# ─────────────────────────────────────────────────────────

async def get_arq():
    """Cria um pool ARQ por request. Leve o suficiente para ser criado por chamada."""
    pool = await create_pool(get_arq_redis_settings())
    try:
        yield pool
    finally:
        await pool.aclose()


ArqDep = Annotated[Any, Depends(get_arq)]


# ─────────────────────────────────────────────────────────
# Schemas de entrada
# ─────────────────────────────────────────────────────────

class SyncLaudoRequest(BaseModel):
    """Payload de um único laudo enviado pelo PWA."""
    id: str = Field(..., description="UUID gerado pelo Dexie.js no campo")
    method: str
    title: str
    equipmentTag: str
    unitArea: str
    inspectorName: str
    inspectorSNQC: str
    normProcedure: str
    acceptanceCriteria: str
    date: str
    status: str = "rascunho"
    findingsCount: int = 0
    summary: str = ""
    technicalData: dict[str, Any] = Field(default_factory=dict)
    createdAt: str
    updatedAt: str


class SyncBatchRequest(BaseModel):
    """Lote de laudos para sincronização em massa (máximo 50)."""
    laudos: list[SyncLaudoRequest] = Field(..., max_length=50)


class SyncResponse(BaseModel):
    job_id: str | None
    message: str
    laudo_id: str


class BatchSyncResponse(BaseModel):
    enqueued: int
    skipped: int
    jobs: list[SyncResponse]


# ─────────────────────────────────────────────────────────
# Rotas
# ─────────────────────────────────────────────────────────

@router.post(
    "/laudos",
    response_model=SyncResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Sincroniza um laudo do campo",
    description=(
        "Recebe um laudo capturado offline (Dexie.js) e o enfileira no Redis "
        "para processamento assíncrono. Retorna imediatamente com o job_id."
    ),
)
async def sync_laudo(
    body: SyncLaudoRequest,
    arq: ArqDep,
    current_user: CurrentUserDep,
) -> SyncResponse:
    """Enfileira um laudo individual para sincronização autenticada."""
    try:
        payload = body.model_dump()
        # Injeta tenant_id e user_id verificados do token/perfil, nunca aceitos do cliente
        payload["tenant_id"] = current_user.tenant_id
        payload["user_id"] = current_user.user_id
        job_id = await enqueue_sync_laudo(arq, payload)
    except Exception as exc:
        logger.exception("Erro ao enfileirar laudo %s: %s", body.id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Redis indisponível: {exc}",
        )

    if job_id is None:
        return SyncResponse(
            job_id=None,
            message="Laudo já estava na fila ou sendo processado (idempotente).",
            laudo_id=body.id,
        )

    return SyncResponse(
        job_id=job_id,
        message="Laudo enfileirado com sucesso.",
        laudo_id=body.id,
    )


@router.post(
    "/laudos/batch",
    response_model=BatchSyncResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Sincroniza lote de laudos do campo",
    description=(
        "Aceita até 50 laudos capturados offline e os enfileira individualmente. "
        "Ideal para sincronização em massa ao reconectar à internet no campo."
    ),
)
async def sync_laudo_batch(
    body: SyncBatchRequest,
    arq: ArqDep,
    current_user: CurrentUserDep,
) -> BatchSyncResponse:
    """Enfileira um lote de laudos para sincronização autenticada."""
    jobs: list[SyncResponse] = []
    enqueued = 0
    skipped = 0

    for laudo in body.laudos:
        try:
            payload = laudo.model_dump()
            payload["tenant_id"] = current_user.tenant_id
            payload["user_id"] = current_user.user_id
            job_id = await enqueue_sync_laudo(arq, payload)
            if job_id:
                enqueued += 1
                jobs.append(SyncResponse(
                    job_id=job_id,
                    message="Enfileirado.",
                    laudo_id=laudo.id,
                ))
            else:
                skipped += 1
                jobs.append(SyncResponse(
                    job_id=None,
                    message="Já na fila (idempotente).",
                    laudo_id=laudo.id,
                ))
        except Exception as exc:
            logger.error("Erro ao enfileirar laudo %s: %s", laudo.id, exc)
            skipped += 1
            jobs.append(SyncResponse(
                job_id=None,
                message=f"Erro: {exc}",
                laudo_id=laudo.id,
            ))

    logger.info("Batch sync [tenant=%s]: %d enfileirados, %d ignorados.", current_user.tenant_id, enqueued, skipped)
    return BatchSyncResponse(enqueued=enqueued, skipped=skipped, jobs=jobs)


@router.get(
    "/status/{job_id}",
    summary="Consulta o status de uma tarefa de sincronização",
)
async def get_sync_status(
    job_id: str,
    arq: ArqDep,
    current_user: CurrentUserDep,
) -> dict[str, Any]:
    """Retorna o status atual de uma tarefa ARQ pelo job_id (requer autenticação)."""
    try:
        job = Job(job_id=job_id, redis=arq, _queue_name=settings.QUEUE_SYNC_LAUDO)
        info = await job.info()
        if info is None:
            raise HTTPException(status_code=404, detail=f"Job '{job_id}' não encontrado.")
        return {
            "job_id": job_id,
            "status": info.status,
            "enqueue_time": info.enqueue_time.isoformat() if info.enqueue_time else None,
            "start_time": info.start_time.isoformat() if info.start_time else None,
            "finish_time": info.finish_time.isoformat() if info.finish_time else None,
            "result": info.result,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@router.get(
    "/dlq",
    summary="Lista laudos com falha definitiva (Dead Letter Queue)",
)
async def list_dlq(
    arq: ArqDep,
    current_user: CurrentUserDep,
) -> dict[str, Any]:
    """Retorna os laudos com falha da DLQ filtrados estritamente pelo tenant_id do usuário."""
    import json

    try:
        keys = await arq.keys("dlq:sync:laudos:*")
        items = []
        for key in keys:
            raw = await arq.get(key)
            if raw:
                try:
                    parsed = json.loads(raw)
                    # Filtro estrito de isolamento por tenant: nunca vazar DLQ de outros tenants
                    if parsed.get("tenant_id") == current_user.tenant_id:
                        items.append(parsed)
                except Exception:
                    continue
        return {"total": len(items), "tenant_id": current_user.tenant_id, "items": items}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))
