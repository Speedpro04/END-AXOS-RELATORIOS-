"""
Contratação pela página inicial.

POST /api/contratacao/pedido     grava o pedido de quem ainda não tem conta e abre o pagamento.
POST /api/contratacao/pagamento  abre o pagamento do pedido de quem já tem conta (administrador).
POST /api/stripe/webhook         recebe o aviso da Stripe e libera o plano.

O servidor cria a página de pagamento da Stripe (Checkout) para cada pedido: cartão
obrigatório e 30 dias grátis só na primeira vez de cada CPF ou CNPJ, e-mail ou empresa.
A cobrança começa no 31º dia. O cliente nunca recebe um link fixo.

A conta só nasce depois do pagamento: o servidor cria o acesso e a pessoa recebe
um e-mail para criar a senha. O plano só é liberado aqui, com aviso assinado pela
Stripe e valor conferido. Dados pessoais não vão para o log.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
from typing import Any, Literal
from urllib.parse import quote
from uuid import UUID

import httpx
import stripe
from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field
from redis.exceptions import RedisError

from app.core.config import settings
from app.core.redis import get_redis
from app.core.security import CurrentUserDep

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Contratação"])

LIMITE_PEDIDOS_POR_HORA = 10
STRIPE_API = "https://api.stripe.com/v1"
SITUACOES_ENCERRADAS = {"canceled", "unpaid", "incomplete_expired"}

# Valor mensal de cada plano, em centavos: quem paga menos não recebe plano maior
PRECOS_CENTAVOS = {
    "individual": 14700,
    "equipe_3": 39700,
    "equipe_5": 59700,
    "equipe_10": 99700,
}

TESTE_GRATIS_DIAS = 30  # cobrança a partir do 31º dia

# Links de pagamento criados na Stripe (públicos). O servidor só usa cada link para achar
# o preço do plano; o cliente recebe uma página de pagamento própria, criada a cada pedido.
LINKS_PAGAMENTO = {
    "individual": "https://buy.stripe.com/cNicN50uF3nu2Sd4Eo1wY0e",
    "equipe_3": "https://buy.stripe.com/7sY7sLa5f2jqakFdaU1wY0f",
    "equipe_5": "https://buy.stripe.com/00w14n2CN0bi50l9YI1wY0g",
    "equipe_10": "https://buy.stripe.com/fZu7sL2CN0bi50l9YI1wY0h",
}
_precos_por_plano: dict[str, str] = {}


class PedidoSemConta(BaseModel):
    plano: Literal["individual", "equipe_3", "equipe_5", "equipe_10"]
    razao_social: str = Field(min_length=1, max_length=200)
    documento: str = Field(min_length=11, max_length=20)
    responsavel: str = Field(min_length=1, max_length=200)
    email: str = Field(min_length=3, max_length=254)
    aceite_versao: str = Field(default="", max_length=40)
    telefone: str | None = Field(default=None, max_length=40)
    endereco: str | None = Field(default=None, max_length=300)


async def _requisitar(metodo: str, url: str, **opcoes: Any) -> httpx.Response:
    async with httpx.AsyncClient(timeout=15.0) as cliente:
        return await cliente.request(metodo, url, **opcoes)


def _cabecalhos_supabase() -> dict[str, str]:
    return {
        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
    }


def _url_supabase(caminho: str) -> str:
    return f"{settings.SUPABASE_URL.rstrip('/')}{caminho}"


def _tentar_de_novo(motivo: str) -> HTTPException:
    """Resposta de erro: a Stripe repete o aviso mais tarde."""
    logger.error("Webhook da Stripe não concluído: %s", motivo)
    return HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Tente novamente.")


async def _rpc(funcao: str, parametros: dict[str, Any]) -> httpx.Response:
    return await _requisitar(
        "POST",
        _url_supabase(f"/rest/v1/rpc/{funcao}"),
        headers=_cabecalhos_supabase(),
        json=parametros,
    )


async def _limitar_pedidos(request: Request) -> None:
    """Formulário público: limita por origem. O endereço de IP não é guardado."""
    # O proxy acrescenta o endereço real no fim da lista; o início pode ser forjado
    encaminhado = request.headers.get("x-forwarded-for", "").split(",")[-1].strip()
    origem = encaminhado or (request.client.host if request.client else "desconhecida")
    chave = f"axos:contratacao:{hashlib.sha256(origem.encode()).hexdigest()}"
    try:
        redis = await get_redis()
        total = await redis.incr(chave)
        if total == 1:
            await redis.expire(chave, 3600)
    except (RedisError, OSError) as erro:
        logger.warning("Limite de pedidos indisponível: %s", type(erro).__name__)
        return
    if total > LIMITE_PEDIDOS_POR_HORA:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Muitas tentativas. Tente novamente mais tarde.",
        )


def _cabecalhos_stripe() -> dict[str, str]:
    return {"Authorization": f"Bearer {settings.STRIPE_SECRET_KEY}"}


def _sem_pagamento(motivo: str) -> HTTPException:
    logger.error("Página de pagamento não criada: %s", motivo)
    return HTTPException(
        status.HTTP_502_BAD_GATEWAY,
        "Não foi possível abrir o pagamento agora. Tente de novo em alguns minutos.",
    )


async def _preco_do_plano(plano: str) -> str:
    """Acha, pelo link de pagamento do plano, o preço cadastrado na Stripe e confere o valor."""
    if plano in _precos_por_plano:
        return _precos_por_plano[plano]
    if not settings.STRIPE_SECRET_KEY:
        raise _sem_pagamento("chave da Stripe não configurada")

    link_id: str | None = None
    parametros: dict[str, Any] = {"limit": 100}
    while link_id is None:
        resposta = await _requisitar("GET", f"{STRIPE_API}/payment_links", headers=_cabecalhos_stripe(), params=parametros)
        if resposta.status_code != 200:
            raise _sem_pagamento(f"lista de links, status {resposta.status_code}")
        corpo = resposta.json()
        links = corpo.get("data", [])
        link_id = next((link["id"] for link in links if link.get("url") == LINKS_PAGAMENTO[plano]), None)
        if link_id is None:
            if not corpo.get("has_more") or not links:
                raise _sem_pagamento(f"link do plano {plano} não encontrado")
            parametros = {"limit": 100, "starting_after": links[-1]["id"]}

    resposta = await _requisitar("GET", f"{STRIPE_API}/payment_links/{link_id}/line_items", headers=_cabecalhos_stripe())
    if resposta.status_code != 200:
        raise _sem_pagamento(f"itens do link, status {resposta.status_code}")
    itens = resposta.json().get("data", [])
    preco = (itens[0].get("price") or {}) if len(itens) == 1 else {}
    if (
        preco.get("unit_amount") != PRECOS_CENTAVOS[plano]
        or preco.get("currency") != "brl"
        or (preco.get("recurring") or {}).get("interval") != "month"
    ):
        raise _sem_pagamento(f"preço do plano {plano} diferente do esperado")
    _precos_por_plano[plano] = preco["id"]
    return preco["id"]


async def _ja_usou_teste(pedido_id: str, documento: str, email: str | None, tenant_id: str | None) -> bool:
    """Teste grátis só uma vez: CPF ou CNPJ, e-mail ou empresa que já passou pela Stripe."""
    filtros: list[dict[str, str]] = [{"documento": f"eq.{documento}"}]
    if email:
        filtros.append({"email": f"eq.{email.strip().lower()}"})
    if tenant_id:
        filtros.append({"tenant_id": f"eq.{tenant_id}"})
    for filtro in filtros:
        resposta = await _requisitar(
            "GET",
            _url_supabase("/rest/v1/pedidos_contratacao"),
            headers=_cabecalhos_supabase(),
            params={
                "select": "id",
                "id": f"neq.{pedido_id}",
                "or": "(pago_em.not.is.null,stripe_session_id.not.is.null)",
                "limit": "1",
                **filtro,
            },
        )
        if resposta.status_code != 200:
            raise _sem_pagamento(f"consulta de teste anterior, status {resposta.status_code}")
        if resposta.json():
            return True
    return False


async def _criar_pagina_de_pagamento(pedido_id: str, plano: str, email: str | None, teste_gratis: bool) -> str:
    """Página da Stripe só deste pedido: cartão obrigatório, mesmo com R$ 0,00 no dia."""
    preco = await _preco_do_plano(plano)
    base = settings.FRONTEND_URL.rstrip("/")
    dados = {
        "mode": "subscription",
        "line_items[0][price]": preco,
        "line_items[0][quantity]": "1",
        "client_reference_id": pedido_id,
        "success_url": f"{base}/?pagamento=ok",
        "cancel_url": f"{base}/#valores",
        "payment_method_collection": "always",
        "locale": "pt-BR",
        "subscription_data[metadata][pedido]": pedido_id,
    }
    if teste_gratis:
        dados["subscription_data[trial_period_days]"] = str(TESTE_GRATIS_DIAS)
    if email:
        dados["customer_email"] = email.strip()
    resposta = await _requisitar("POST", f"{STRIPE_API}/checkout/sessions", headers=_cabecalhos_stripe(), data=dados)
    if resposta.status_code != 200:
        raise _sem_pagamento(f"criação da página, status {resposta.status_code}")
    return resposta.json()["url"]


@router.post("/contratacao/pedido", summary="Grava o pedido de quem ainda não tem conta e abre o pagamento")
async def registrar_pedido(pedido: PedidoSemConta, request: Request) -> dict[str, Any]:
    await _limitar_pedidos(request)
    resposta = await _rpc(
        "registrar_pedido_sem_conta",
        {
            "p_plano": pedido.plano,
            "p_razao_social": pedido.razao_social,
            "p_documento": pedido.documento,
            "p_responsavel": pedido.responsavel,
            "p_email": pedido.email,
            "p_aceite_versao": pedido.aceite_versao,
            "p_telefone": pedido.telefone,
            "p_endereco": pedido.endereco,
        },
    )
    if resposta.status_code == 200:
        pedido_id = resposta.json()
        documento = re.sub(r"\D", "", pedido.documento)
        email = pedido.email.strip().lower()
        teste_gratis = not await _ja_usou_teste(pedido_id, documento, email, None)
        url = await _criar_pagina_de_pagamento(pedido_id, pedido.plano, email, teste_gratis)
        return {"pedido_id": pedido_id, "pagamento_url": url, "teste_gratis": teste_gratis}

    erro = resposta.json() if resposta.content else {}
    if erro.get("code") == "P0001":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, erro.get("message"))
    logger.error("Falha ao gravar pedido: status %s", resposta.status_code)
    raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Não foi possível enviar o pedido.")


async def _ler_pedido(pedido_id: str) -> dict[str, Any] | None:
    resposta = await _requisitar(
        "GET",
        _url_supabase("/rest/v1/pedidos_contratacao"),
        headers=_cabecalhos_supabase(),
        params={"id": f"eq.{pedido_id}", "select": "id,plano,email,tenant_id,pago_em,documento"},
    )
    if resposta.status_code != 200:
        raise _tentar_de_novo(f"leitura do pedido, status {resposta.status_code}")
    linhas = resposta.json()
    return linhas[0] if linhas else None


class PagamentoDaConta(BaseModel):
    pedido_id: UUID


@router.post("/contratacao/pagamento", summary="Abre o pagamento do pedido da conta logada")
async def abrir_pagamento_da_conta(dados: PagamentoDaConta, usuario: CurrentUserDep) -> dict[str, Any]:
    if not usuario.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Só o administrador da conta pode contratar um plano.")
    pedido_id = str(dados.pedido_id)
    pedido = await _ler_pedido(pedido_id)
    if pedido is None or pedido.get("tenant_id") != usuario.tenant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pedido não encontrado.")
    if pedido.get("pago_em"):
        raise HTTPException(status.HTTP_409_CONFLICT, "Este pedido já foi pago.")
    if pedido["plano"] not in PRECOS_CENTAVOS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Este plano é sob consulta: a AXOS entra em contato.")
    teste_gratis = not await _ja_usou_teste(pedido_id, pedido["documento"], pedido.get("email"), usuario.tenant_id)
    url = await _criar_pagina_de_pagamento(pedido_id, pedido["plano"], pedido.get("email"), teste_gratis)
    return {"pagamento_url": url, "teste_gratis": teste_gratis}


async def _valor_confere(session_id: str, plano: str) -> bool:
    """O número do pedido viaja no endereço: o valor pago é que decide o plano."""
    resposta = await _requisitar(
        "GET",
        f"{STRIPE_API}/checkout/sessions/{session_id}/line_items",
        headers={"Authorization": f"Bearer {settings.STRIPE_SECRET_KEY}"},
    )
    if resposta.status_code != 200:
        raise _tentar_de_novo(f"consulta à Stripe, status {resposta.status_code}")
    itens = resposta.json().get("data", [])
    if len(itens) != 1:
        return False
    preco = itens[0].get("price") or {}
    return (
        preco.get("unit_amount") == PRECOS_CENTAVOS.get(plano)
        and preco.get("currency") == "brl"
    )


async def _enviar_para_analise(pedido_id: str, motivo: str, session: dict[str, Any]) -> None:
    """Pagou, mas a liberação automática não é segura: fica para a AXOS resolver."""
    logger.error("Pedido %s pago e em análise: %s", pedido_id, motivo)
    resposta = await _requisitar(
        "PATCH",
        _url_supabase("/rest/v1/pedidos_contratacao"),
        headers={**_cabecalhos_supabase(), "Prefer": "return=minimal"},
        params={"id": f"eq.{pedido_id}"},
        json={
            "situacao": "em_andamento",
            "observacao": motivo,
            "stripe_session_id": session.get("id"),
            "stripe_customer_id": session.get("customer"),
            "stripe_subscription_id": session.get("subscription"),
        },
    )
    if resposta.status_code not in (200, 204):
        raise _tentar_de_novo(f"registro da análise, status {resposta.status_code}")


def _link_de_senha() -> str:
    destino = f"{settings.FRONTEND_URL.rstrip('/')}/redefinir-senha"
    return f"redirect_to={quote(destino, safe='')}"


async def _criar_acesso(email: str) -> str:
    """Cria o usuário e envia o e-mail para criar a senha. Abrir o link confirma o e-mail."""
    resposta = await _requisitar(
        "POST",
        _url_supabase(f"/auth/v1/invite?{_link_de_senha()}"),
        headers=_cabecalhos_supabase(),
        json={"email": email},
    )
    if resposta.status_code != 200:
        raise _tentar_de_novo(f"criação do acesso, status {resposta.status_code}")
    return resposta.json()["id"]


async def _reenviar_link_de_senha(email: str) -> None:
    resposta = await _requisitar(
        "POST",
        _url_supabase(f"/auth/v1/recover?{_link_de_senha()}"),
        headers=_cabecalhos_supabase(),
        json={"email": email},
    )
    if resposta.status_code != 200:
        raise _tentar_de_novo(f"envio do link de senha, status {resposta.status_code}")


async def _processar_checkout(session: dict[str, Any]) -> None:
    pago = session.get("payment_status") in ("paid", "no_payment_required")
    if session.get("status") != "complete" or not pago:
        return

    referencia = session.get("client_reference_id") or ""
    try:
        pedido_id = str(UUID(referencia))
    except ValueError:
        logger.error("Pagamento %s sem número de pedido válido", session.get("id"))
        return

    pedido = await _ler_pedido(pedido_id)
    if pedido is None:
        logger.error("Pagamento %s de pedido inexistente", session.get("id"))
        return
    if pedido["pago_em"]:
        return

    if not await _valor_confere(session["id"], pedido["plano"]):
        await _enviar_para_analise(pedido_id, "VALOR_DIFERENTE_DO_PLANO", session)
        return

    usuario: str | None = None
    usuario_sem_empresa = False
    if pedido["tenant_id"] is None:
        conferencia = await _rpc("conferir_pedido_pago", {"p_pedido": pedido_id})
        if conferencia.status_code != 200:
            raise _tentar_de_novo(f"conferência, status {conferencia.status_code}")
        resultado = conferencia.json()[0]
        if resultado["impedimento"]:
            await _enviar_para_analise(pedido_id, resultado["impedimento"], session)
            return
        usuario = resultado["usuario"]
        usuario_sem_empresa = usuario is not None
        if usuario is None:
            usuario = await _criar_acesso(pedido["email"])

    liberacao = await _rpc(
        "liberar_pedido_pago",
        {
            "p_pedido": pedido_id,
            "p_session": session["id"],
            "p_customer": session.get("customer"),
            "p_subscription": session.get("subscription"),
            "p_usuario": usuario,
        },
    )
    if liberacao.status_code != 200:
        mensagem = (liberacao.json() if liberacao.content else {}).get("message", "")
        if mensagem in ("CONTA_JA_EXISTE", "CNPJ_JA_CADASTRADO"):
            await _enviar_para_analise(pedido_id, mensagem, session)
            return
        raise _tentar_de_novo(f"liberação, status {liberacao.status_code}")
    logger.info("Plano liberado para o pedido %s", pedido_id)

    # O usuário já existia sem empresa: nunca recebeu o e-mail de criar a senha
    if usuario_sem_empresa:
        await _reenviar_link_de_senha(pedido["email"])


async def _encerrar_assinatura(assinatura_id: str) -> None:
    resposta = await _rpc("encerrar_assinatura", {"p_subscription": assinatura_id})
    if resposta.status_code != 200:
        raise _tentar_de_novo(f"encerramento, status {resposta.status_code}")


@router.post("/stripe/webhook", summary="Recebe o aviso assinado da Stripe")
async def receber_aviso_da_stripe(request: Request) -> dict[str, bool]:
    if not settings.STRIPE_WEBHOOK_SECRET or not settings.STRIPE_SECRET_KEY:
        raise _tentar_de_novo("chaves da Stripe não configuradas")

    corpo = (await request.body()).decode("utf-8", errors="replace")
    try:
        stripe.WebhookSignature.verify_header(
            corpo,
            request.headers.get("stripe-signature", ""),
            settings.STRIPE_WEBHOOK_SECRET,
            stripe.Webhook.DEFAULT_TOLERANCE,
        )
    except stripe.SignatureVerificationError as erro:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Assinatura inválida.") from erro

    evento = json.loads(corpo)
    tipo = evento.get("type")
    objeto = evento.get("data", {}).get("object", {})

    if tipo == "checkout.session.completed":
        await _processar_checkout(objeto)
    elif tipo == "customer.subscription.deleted":
        await _encerrar_assinatura(objeto["id"])
    elif tipo == "customer.subscription.updated" and objeto.get("status") in SITUACOES_ENCERRADAS:
        await _encerrar_assinatura(objeto["id"])

    return {"recebido": True}
