"""
╔══════════════════════════════════════════════════════════════╗
║            AXOS RELATÓRIOS – FastAPI Main                   ║
╠══════════════════════════════════════════════════════════════╣
║  Ponto de entrada da API. Registra:                          ║
║    • Routers (sync, laudos, pdf...)                          ║
║    • Lifespan: inicia/fecha pool Redis                       ║
║    • Middleware CORS (frontend PWA)                          ║
║    • Health-check (/healthz)                                 ║
╚══════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.redis import close_redis, ping_redis

# Routers
from app.routers.sync import router as sync_router

logger = logging.getLogger(__name__)

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s: %(message)s",
)


# ─────────────────────────────────────────────────────────
# Lifespan: startup / shutdown
# ─────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("🚀  Iniciando AXOS API...")
    # Verifica conexão Redis na inicialização
    try:
        await ping_redis()
        logger.info("✅  Redis conectado.")
    except Exception as e:
        logger.warning("⚠️  Redis indisponível na inicialização: %s", e)

    yield  # ← API fica disponível aqui

    # Shutdown
    logger.info("🛑  Encerrando AXOS API...")
    await close_redis()
    logger.info("✅  Pool Redis fechado.")


# ─────────────────────────────────────────────────────────
# Criação da aplicação
# ─────────────────────────────────────────────────────────

app = FastAPI(
    title="AXOS Relatórios API",
    description="API de laudos de inspeção técnica – offline-first com Redis",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ─────────────────────────────────────────────────────────
# CORS – permite que o PWA acesse a API
# ─────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────
# Routers
# ─────────────────────────────────────────────────────────

app.include_router(sync_router)

# ─────────────────────────────────────────────────────────
# Health-check
# ─────────────────────────────────────────────────────────

@app.get("/healthz", tags=["Infra"], summary="Health-check da API e do Redis")
async def healthz() -> dict:
    redis_ok = False
    try:
        redis_ok = await ping_redis()
    except Exception:
        pass
    return {
        "api": "ok",
        "redis": "ok" if redis_ok else "degraded",
        "version": "1.0.0",
    }
