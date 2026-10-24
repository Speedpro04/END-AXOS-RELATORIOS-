"""
╔══════════════════════════════════════════════════════════════╗
║        WORKER PRINCIPAL ARQ – Axos Relatórios               ║
╠══════════════════════════════════════════════════════════════╣
║  Registro de todas as tarefas e configuração do worker.      ║
║                                                              ║
║  Inicializar com:                                            ║
║    python -m arq app.queues.worker.WorkerSettings            ║
╚══════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import logging

from arq.connections import RedisSettings

from app.core.config import settings
from app.queues.enqueue import get_arq_redis_settings

# Workers
from app.queues.workers.sync_worker import task_sync_laudo
from app.queues.workers.pdf_worker import task_generate_pdf
from app.queues.workers.email_worker import task_send_email

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────
# Hooks de ciclo de vida do Worker
# ─────────────────────────────────────────────────────────

async def on_startup(ctx: dict) -> None:
    """Inicializa recursos compartilhados (pool Supabase, etc.)."""
    logger.info("🚀  Worker ARQ AXOS iniciado. Aguardando tarefas...")
    ctx["started"] = True


async def on_shutdown(ctx: dict) -> None:
    """Libera recursos ao encerrar o worker graciosamente."""
    logger.info("🛑  Worker ARQ AXOS encerrado.")


# ─────────────────────────────────────────────────────────
# Configuração ARQ (WorkerSettings)
# ─────────────────────────────────────────────────────────

class WorkerSettings:
    """Configuração do worker ARQ.
    Pode ser lida pelo CLI: python -m arq app.queues.worker.WorkerSettings
    """

    # Tarefas registradas neste worker
    functions = [
        task_sync_laudo,
        task_generate_pdf,
        task_send_email,
    ]

    # Conexão Redis
    redis_settings: RedisSettings = get_arq_redis_settings()

    # Filas que este worker consome (em ordem de prioridade)
    queue_read_limit = settings.WORKER_CONCURRENCY

    # Hooks
    on_startup = on_startup
    on_shutdown = on_shutdown

    # Timeout máximo por tarefa (segundos)
    max_jobs = settings.WORKER_CONCURRENCY
    job_timeout = 300       # 5 minutos – PDFs podem demorar
    keep_result = 3600      # Mantém resultados por 1 hora
    max_tries = 3           # Número máximo de tentativas por tarefa

    # Filas consumidas (prioridade: laudos > pdf > email)
    queue_name = settings.QUEUE_SYNC_LAUDO
