# ─────────────────────────────────────────────────────────
# AXOS Backend – Dockerfile
# Imagem única usada para 2 serviços no EasyPanel:
#   1. API FastAPI  → CMD: uvicorn app.main:app --host 0.0.0.0 --port 8000
#   2. Worker ARQ   → CMD: python -m arq app.queues.worker.WorkerSettings
# ─────────────────────────────────────────────────────────

FROM python:3.12-slim AS base

# Dependências de sistema para WeasyPrint (geração de PDF)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libcairo2 \
    libffi-dev \
    libjpeg-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia e instala dependências Python primeiro (cache Docker)
COPY pyproject.toml .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir .

# Copia o código da aplicação
COPY app/ ./app/

# Usuário não-root por segurança
RUN useradd -m -u 1001 axos && chown -R axos:axos /app
USER axos

# Porta padrão da API (Worker não precisa expor porta)
EXPOSE 8000

# Default: API. Para o worker, sobrescreva no EasyPanel:
#   Command: python -m arq app.queues.worker.WorkerSettings
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
