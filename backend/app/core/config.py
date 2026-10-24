from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    APP_NAME: str = "AXOS"
    DEBUG: bool = False
    FRONTEND_URL: str = "http://localhost:5173"

    # Supabase
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str  # Nunca exposta ao cliente
    SUPABASE_JWT_SECRET: str

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""

    # PDF
    QR_BASE_URL: str = "https://axos.app/verificar"

    # Redis / Fila de Processamento
    REDIS_URL: str = "redis://localhost:6379/0"   # Troque por Redis Cloud em produção
    WORKER_CONCURRENCY: int = 10                  # Tarefas paralelas por worker
    QUEUE_SYNC_LAUDO: str = "axos:sync:laudos"    # Nome da fila principal de laudos
    QUEUE_PDF: str = "axos:pdf:generation"        # Fila separada p/ geração de PDF
    QUEUE_EMAIL: str = "axos:notify:email"        # Fila de notificações


settings = Settings()  # type: ignore[call-arg]
