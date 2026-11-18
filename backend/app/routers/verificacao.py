"""
Verificação pública do laudo emitido (destino do QR impresso no PDF oficial).

Sem login: responde só o necessário para conferir autenticidade (situação, número, revisão,
método, data, empresa emissora e os SHA-256). Não expõe nomes de pessoas, cliente nem obra.
Rascunhos e laudos em revisão não existem para esta rota.
"""
from __future__ import annotations

import hashlib
import logging
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Request, Response, status
from redis.exceptions import RedisError
from supabase import create_client

from app.core.config import settings
from app.core.redis import get_redis
from app.pdf.laudo_pdf import CAMPOS

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/verificar", tags=["Verificação pública"])

LIMITE_POR_HORA = 120  # consultas por origem; o QR é aberto poucas vezes por laudo


def _supabase_admin() -> Any:
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


async def _limitar(request: Request) -> None:
    """Limita por origem sem guardar o endereço (só o resumo SHA-256 dele, por 1 hora)."""
    encaminhado = request.headers.get("x-forwarded-for", "").split(",")[-1].strip()
    origem = encaminhado or (request.client.host if request.client else "desconhecida")
    chave = f"axos:verificar:{hashlib.sha256(origem.encode()).hexdigest()}"
    try:
        redis = await get_redis()
        total = await redis.incr(chave)
        if total == 1:
            await redis.expire(chave, 3600)
    except (RedisError, OSError) as erro:
        logger.warning("Limite da verificação indisponível: %s", type(erro).__name__)
        return
    if total > LIMITE_POR_HORA:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Muitas consultas. Tente novamente mais tarde.")


@router.get("/{document_id}/{revision}", summary="Confere a autenticidade de um laudo emitido")
async def verificar_laudo(document_id: str, revision: int, request: Request, response: Response) -> dict[str, Any]:
    nao_encontrado = HTTPException(status.HTTP_404_NOT_FOUND, "Laudo não encontrado. Confira o código QR ou o endereço.")
    try:
        uuid.UUID(document_id)
    except ValueError:
        raise nao_encontrado
    if revision < 0:
        raise nao_encontrado
    await _limitar(request)

    sb = _supabase_admin()
    revisoes = sb.table("reports").select("id, revision, status").eq("document_id", document_id).execute().data or []
    alvo = next((r for r in revisoes if r.get("revision") == revision and r.get("status") in ("issued", "superseded")), None)
    if not alvo:
        raise nao_encontrado

    laudo = (
        sb.table("reports").select("report_number, revision, status, issued_at, data_hash, header_snapshot, template_id, administrative_data")
        .eq("id", alvo["id"]).execute().data or [{}]
    )[0]
    metodo = ((laudo.get("administrative_data") or {}).get("laudo") or {}).get("method")
    if laudo.get("template_id"):
        tpl = sb.table("report_templates").select("method").eq("id", laudo["template_id"]).execute().data or []
        metodo = (tpl[0].get("method") if tpl else None) or metodo
    pdf = sb.table("report_pdfs").select("sha256").eq("report_id", alvo["id"]).execute().data or []
    emitidas = [r["revision"] for r in revisoes if r.get("status") in ("issued", "superseded")]
    vigente = next((r["revision"] for r in revisoes if r.get("status") == "issued"), max(emitidas))
    cab = laudo.get("header_snapshot") or {}

    response.headers["Cache-Control"] = "no-store"
    return {
        "situacao": "valido" if laudo.get("status") == "issued" else "substituido",
        "numero": laudo.get("report_number"),
        "revisao": laudo.get("revision"),
        "revisao_vigente": vigente,
        "metodo": CAMPOS["metodos"].get(metodo or "", {}).get("full", metodo),
        "emitido_em": laudo.get("issued_at"),
        "emissora": {"nome": cab.get("legal_name") or cab.get("trade_name"), "cnpj": cab.get("cnpj")},
        "sha256_conteudo": laudo.get("data_hash"),
        "sha256_pdf": pdf[0]["sha256"] if pdf else None,
    }
