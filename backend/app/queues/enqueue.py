"""
╔══════════════════════════════════════════════════════════════╗
║           FILAS REDIS – Axos Relatórios                      ║
╠══════════════════════════════════════════════════════════════╣
║  Módulo central de filas com ARQ + Redis.                    ║
║                                                              ║
║  FILAS DISPONÍVEIS:                                          ║
║    axos:sync:laudos   → sincronização de laudos do campo     ║
║    axos:pdf:generation → geração de relatórios PDF           ║
║    axos:notify:email  → envio de e-mails de notificação      ║
║                                                              ║
║  USO (FastAPI):                                              ║
║    from app.queues.enqueue import enqueue_sync_laudo         ║
║    await enqueue_sync_laudo(payload)                         ║
╚══════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import timedelta
from typing import Any
from uuid import UUID

from arq import ArqRedis
from arq.connections import RedisSettings

from app.core.config import settings

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────
# Configuração ARQ (lida a partir do REDIS_URL do settings)
# ─────────────────────────────────────────────────────────

def get_arq_redis_settings() -> RedisSettings:
    """Converte a REDIS_URL do settings para o formato RedisSettings do ARQ."""
    url = settings.REDIS_URL  # ex: redis://localhost:6379/0
    # redis://[:password@]host[:port][/db]
    url = url.replace("redis://", "")
    password: str | None = None
    if "@" in url:
        password, url = url.split("@", 1)
        if ":" in password:
            _, password = password.split(":", 1)
    host_port, *db_parts = url.split("/")
    db = int(db_parts[0]) if db_parts else 0
    host, *port_parts = host_port.split(":")
    port = int(port_parts[0]) if port_parts else 6379

    return RedisSettings(
        host=host,
        port=port,
        database=db,
        password=password,
        conn_timeout=5,
        conn_retries=5,
        conn_retry_delay=1.0,
    )


# ─────────────────────────────────────────────────────────
# Idempotência: evita processar o mesmo laudo duas vezes
# ─────────────────────────────────────────────────────────

def _idempotency_key(queue: str, payload: dict[str, Any]) -> str:
    """Gera chave de idempotência baseada na fila e no payload.
    Usa o 'id' do laudo se disponível; caso contrário usa SHA-256 do payload.
    """
    laudo_id = payload.get("id") or payload.get("laudo_id")
    if laudo_id:
        return f"idem:{queue}:{laudo_id}"
    content = json.dumps(payload, sort_keys=True, default=str)
    digest = hashlib.sha256(content.encode()).hexdigest()[:16]
    return f"idem:{queue}:{digest}"


# ─────────────────────────────────────────────────────────
# Funções de enfileiramento público
# ─────────────────────────────────────────────────────────

async def enqueue_sync_laudo(
    arq: ArqRedis,
    payload: dict[str, Any],
    *,
    defer_by: timedelta | None = None,
) -> str | None:
    """Enfileira um laudo para sincronização com o banco de dados.

    Args:
        arq:      Instância do ArqRedis (injetada via FastAPI Depends).
        payload:  Dados do laudo no formato dict.
        defer_by: (opcional) Adia a tarefa por um timedelta.

    Returns:
        job_id (str) se enfileirado com sucesso, None se já existia (idempotente).
    """
    from app.queues.workers.sync_worker import task_sync_laudo

    idem_key = _idempotency_key(settings.QUEUE_SYNC_LAUDO, payload)

    # Verifica se já está na fila (lock de 5 min – tempo máximo de processamento)
    locked = await arq.set(idem_key, "1", nx=True, ex=300)
    if not locked:
        logger.info("Laudo já enfileirado ou sendo processado: %s", idem_key)
        return None

    kwargs = {"payload": payload}
    job = await arq.enqueue_job(
        task_sync_laudo.__name__,
        **kwargs,
        _queue_name=settings.QUEUE_SYNC_LAUDO,
        _defer_by=defer_by,
        _job_id=idem_key,            # usa a chave de idem como job_id
    )
    logger.info("Laudo enfileirado → job_id=%s", job.job_id if job else "None")
    return job.job_id if job else None


async def enqueue_generate_pdf(
    arq: ArqRedis,
    laudo_id: str | UUID,
    tenant_id: str | UUID,
    *,
    defer_by: timedelta | None = None,
) -> str | None:
    """Enfileira geração de PDF para um laudo aprovado."""
    from app.queues.workers.pdf_worker import task_generate_pdf

    payload = {"laudo_id": str(laudo_id), "tenant_id": str(tenant_id)}
    idem_key = _idempotency_key(settings.QUEUE_PDF, payload)

    locked = await arq.set(idem_key, "1", nx=True, ex=600)  # PDFs podem demorar até 10min
    if not locked:
        logger.info("PDF já em processamento: %s", idem_key)
        return None

    job = await arq.enqueue_job(
        task_generate_pdf.__name__,
        laudo_id=str(laudo_id),
        tenant_id=str(tenant_id),
        _queue_name=settings.QUEUE_PDF,
        _defer_by=defer_by,
        _job_id=idem_key,
    )
    logger.info("Geração de PDF enfileirada → job_id=%s", job.job_id if job else "None")
    return job.job_id if job else None


async def enqueue_send_email(
    arq: ArqRedis,
    to: str,
    subject: str,
    body: str,
    *,
    defer_by: timedelta | None = None,
) -> str | None:
    """Enfileira envio de e-mail de notificação."""
    from app.queues.workers.email_worker import task_send_email

    payload = {"to": to, "subject": subject}
    idem_key = _idempotency_key(settings.QUEUE_EMAIL, payload)

    locked = await arq.set(idem_key, "1", nx=True, ex=120)
    if not locked:
        return None

    job = await arq.enqueue_job(
        task_send_email.__name__,
        to=to,
        subject=subject,
        body=body,
        _queue_name=settings.QUEUE_EMAIL,
        _defer_by=defer_by,
        _job_id=idem_key,
    )
    return job.job_id if job else None
