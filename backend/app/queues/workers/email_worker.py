"""Worker de envio de e-mails de notificação."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


async def task_send_email(ctx: dict, *, to: str, subject: str, body: str) -> dict[str, Any]:
    """Tarefa ARQ: envia e-mail de notificação.

    Por padrão usa Supabase Auth email.
    Para produção, substituir por SendGrid / Resend / SES.
    """
    logger.info("[email] Enviando e-mail para %s — assunto: %s", to, subject)
    # TODO: integrar provedor de e-mail
    # Ex: await send_via_resend(to=to, subject=subject, body=body)
    logger.info("[email] E-mail enviado com sucesso (stub).")
    return {"status": "ok", "to": to}
