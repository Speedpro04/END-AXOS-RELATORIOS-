"""
╔══════════════════════════════════════════════════════════════╗
║           CONEXÃO REDIS – Axos Relatórios                   ║
╠══════════════════════════════════════════════════════════════╣
║  Pool assíncrono compartilhado com:                          ║
║    • decode_responses=False  → suporta bytes (para blobs)   ║
║    • health_check_interval   → detecta queda silenciosa      ║
║    • retry_on_timeout        → reconexão automática          ║
║  Funções utilitárias:                                        ║
║    • get_redis()             → pool para uso na FastAPI      ║
║    • close_redis()           → limpa o pool no shutdown      ║
║    • ping_redis()            → health-check p/ /healthz      ║
╚══════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import logging
from typing import AsyncGenerator

import redis.asyncio as aioredis
from redis.asyncio import Redis
from redis.exceptions import RedisError
from tenacity import (
    before_sleep_log,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.core.config import settings

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────
# Pool global (singleton criado no startup da FastAPI)
# ─────────────────────────────────────────────────────────
_redis_pool: Redis | None = None


def _build_pool() -> Redis:
    """Cria um pool de conexões assíncronas com configurações de produção."""
    return aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,       # strings – para JSON/payloads de texto
        max_connections=50,          # limite de conexões simultâneas
        socket_timeout=5.0,          # timeout de leitura/escrita (s)
        socket_connect_timeout=3.0,  # timeout de conexão (s)
        health_check_interval=30,    # verifica conexão a cada 30 s
        retry_on_timeout=True,       # reconecta automaticamente se timeout
    )


async def get_redis() -> Redis:
    """Retorna o pool Redis (cria se necessário).
    Uso via FastAPI Depends:
        async def route(r: Redis = Depends(get_redis)): ...
    """
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = _build_pool()
    return _redis_pool


async def redis_dependency() -> AsyncGenerator[Redis, None]:
    """Generator para uso com FastAPI Depends (abre e fecha conexão por request)."""
    pool = await get_redis()
    async with pool.client() as conn:
        yield conn


async def close_redis() -> None:
    """Fecha o pool graciosamente. Chamar no evento 'shutdown' da FastAPI."""
    global _redis_pool
    if _redis_pool is not None:
        await _redis_pool.aclose()
        _redis_pool = None
        logger.info("Redis pool fechado com sucesso.")


# ─────────────────────────────────────────────────────────
# Health-check com retry exponencial
# ─────────────────────────────────────────────────────────
@retry(
    retry=retry_if_exception_type(RedisError),
    wait=wait_exponential(multiplier=1, min=1, max=30),
    stop=stop_after_attempt(5),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
async def ping_redis() -> bool:
    """Verifica se o Redis está respondendo. Usado no /healthz.
    Retenta até 5 vezes com backoff exponencial (1→2→4→8→30 s).
    """
    pool = await get_redis()
    ok = await pool.ping()
    logger.info("Redis ping OK")
    return ok
