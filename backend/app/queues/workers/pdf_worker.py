"""
Tarefa da fila (ARQ) que gera o PDF oficial do laudo.

Usa exatamente a mesma geração da emissão (app.pdf.laudo_pdf): hoje a API gera o PDF na hora
de emitir; esta tarefa fica para reprocessar pela fila, se um dia o worker for publicado.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)


async def task_generate_pdf(ctx: dict, *, laudo_id: str, tenant_id: str) -> dict[str, Any]:
    from supabase import create_client

    from app.core.config import settings
    from app.pdf.laudo_pdf import ErroPdf, gerar_pdf_oficial

    sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    try:
        return await asyncio.to_thread(gerar_pdf_oficial, sb, laudo_id, tenant_id, settings.QR_BASE_URL)
    except ErroPdf as exc:
        logger.error("[pdf] Laudo %s sem PDF oficial: %s", laudo_id, exc)
        return {"status": "erro", "detail": str(exc), "laudo_id": laudo_id}
