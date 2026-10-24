"""Worker de geração de PDF para laudos aprovados."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


async def task_generate_pdf(ctx: dict, *, laudo_id: str, tenant_id: str) -> dict[str, Any]:
    """Tarefa ARQ: gera PDF do laudo e armazena no Supabase Storage.

    Fluxo:
      1. Busca o laudo completo no Supabase.
      2. Renderiza o template HTML via Jinja2.
      3. Converte para PDF via WeasyPrint.
      4. Faz upload para o Supabase Storage (bucket: 'laudos-pdf').
      5. Atualiza o campo 'pdf_url' na tabela 'laudos'.
    """
    from supabase import create_client
    from app.core.config import settings

    logger.info("[pdf] Iniciando geração de PDF para laudo %s", laudo_id)
    sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    # 1. Busca o laudo
    res = sb.table("laudos").select("*").eq("id", laudo_id).single().execute()
    if not res.data:
        logger.error("[pdf] Laudo %s não encontrado no banco.", laudo_id)
        return {"status": "erro", "detail": "Laudo não encontrado"}

    laudo = res.data
    logger.info("[pdf] Laudo recuperado: %s", laudo.get("title"))

    # 2 & 3. TODO: Renderizar HTML + converter para PDF (WeasyPrint)
    # pdf_bytes = render_pdf(laudo, tenant_id)

    # 4 & 5. TODO: Upload para Supabase Storage + atualizar campo pdf_url
    # sb.storage.from_("laudos-pdf").upload(f"{laudo_id}.pdf", pdf_bytes)

    logger.info("[pdf] PDF do laudo %s gerado com sucesso (stub).", laudo_id)
    return {"status": "ok", "laudo_id": laudo_id, "pdf_url": f"laudos-pdf/{laudo_id}.pdf"}
