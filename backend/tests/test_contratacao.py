import hashlib
import hmac
import json
import time
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from httpx import ASGITransport, AsyncClient
from redis.exceptions import RedisError

from app.core.config import settings
from app.main import app

SEGREDO_WEBHOOK = "segredo-de-teste-local"
PEDIDO = "12345678-1234-4234-8234-123456789012"
USUARIO = "22222222-2222-4222-8222-222222222222"


class Servidores:
    """Imita Supabase e Stripe e guarda as chamadas, em ordem."""

    def __init__(self):
        self.chamadas: list[tuple[str, dict]] = []
        self.pedido = {"id": PEDIDO, "plano": "equipe_3", "email": "novo@empresa.test", "tenant_id": None, "pago_em": None}
        self.conferencia = {"usuario": None, "impedimento": None}
        self.preco = {"unit_amount": 39700, "currency": "brl"}
        self.liberacao = httpx.Response(200, json="tenant-1")
        self.convite = httpx.Response(200, json={"id": USUARIO})
        self.gravacao = httpx.Response(200, json=PEDIDO)

    def nomes(self) -> list[str]:
        return [nome for nome, _ in self.chamadas]

    def corpo(self, nome: str) -> dict:
        return next(corpo for chamada, corpo in self.chamadas if chamada == nome)

    async def __call__(self, metodo: str, url: str, **opcoes) -> httpx.Response:
        caminho = url.split("?")[0]
        if "/line_items" in caminho:
            self.chamadas.append(("stripe_itens", {}))
            return httpx.Response(200, json={"data": [{"price": self.preco}]})
        if caminho.endswith("/rest/v1/pedidos_contratacao") and metodo == "GET":
            return httpx.Response(200, json=[self.pedido] if self.pedido else [])
        if caminho.endswith("/rest/v1/pedidos_contratacao") and metodo == "PATCH":
            self.chamadas.append(("analise", opcoes["json"]))
            return httpx.Response(204)
        if caminho.endswith("/auth/v1/invite"):
            self.chamadas.append(("convite", {**opcoes["json"], "url": url}))
            return self.convite
        if caminho.endswith("/auth/v1/recover"):
            self.chamadas.append(("recuperacao", {**opcoes["json"], "url": url}))
            return httpx.Response(200, json={})
        funcao = caminho.rsplit("/", 1)[-1]
        self.chamadas.append((funcao, opcoes["json"]))
        if funcao == "conferir_pedido_pago":
            return httpx.Response(200, json=[self.conferencia])
        if funcao == "liberar_pedido_pago":
            return self.liberacao
        if funcao == "encerrar_assinatura":
            return httpx.Response(200, json=True)
        if funcao == "registrar_pedido_sem_conta":
            return self.gravacao
        return httpx.Response(404)


@pytest.fixture(autouse=True)
def ambiente():
    with patch("app.main.ping_redis", new_callable=AsyncMock), \
         patch("app.main.close_redis", new_callable=AsyncMock), \
         patch.object(settings, "STRIPE_WEBHOOK_SECRET", SEGREDO_WEBHOOK), \
         patch.object(settings, "STRIPE_SECRET_KEY", "chave-de-teste-local"), \
         patch.object(settings, "FRONTEND_URL", "https://axosrelatorios.com"):
        yield


@pytest.fixture
def servidores():
    falsos = Servidores()
    with patch("app.routers.contratacao._requisitar", new=falsos):
        yield falsos


@pytest.fixture
def redis():
    falso = AsyncMock()
    falso.incr.return_value = 1
    with patch("app.routers.contratacao.get_redis", new=AsyncMock(return_value=falso)):
        yield falso


def assinar(corpo: str, segredo: str = SEGREDO_WEBHOOK) -> dict[str, str]:
    instante = int(time.time())
    assinatura = hmac.new(segredo.encode(), f"{instante}.{corpo}".encode(), hashlib.sha256).hexdigest()
    return {"stripe-signature": f"t={instante},v1={assinatura}"}


def evento_checkout(**campos) -> str:
    sessao = {
        "id": "cs_1",
        "status": "complete",
        "payment_status": "no_payment_required",  # assinatura com 30 dias grátis
        "client_reference_id": PEDIDO,
        "customer": "cus_1",
        "subscription": "sub_1",
        **campos,
    }
    return json.dumps({"type": "checkout.session.completed", "data": {"object": sessao}})


async def enviar_aviso(corpo: str, cabecalhos: dict[str, str] | None = None) -> httpx.Response:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as cliente:
        return await cliente.post(
            "/api/stripe/webhook",
            content=corpo,
            headers=assinar(corpo) if cabecalhos is None else cabecalhos,
        )


async def enviar_pedido(**campos) -> httpx.Response:
    corpo = {
        "plano": "equipe_3",
        "razao_social": "Empresa",
        "documento": "11222333000181",
        "responsavel": "Responsável",
        "email": "novo@empresa.test",
        "aceite_versao": "v1",
        **campos,
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as cliente:
        return await cliente.post("/api/contratacao/pedido", json=corpo, headers={"x-forwarded-for": "9.9.9.9, 1.2.3.4"})


# Pedido pelo formulário público

@pytest.mark.asyncio
async def test_pedido_valido_retorna_so_o_numero(servidores, redis):
    resposta = await enviar_pedido()
    assert resposta.status_code == 200
    assert resposta.json() == {"pedido_id": PEDIDO}
    assert servidores.corpo("registrar_pedido_sem_conta")["p_aceite_versao"] == "v1"


@pytest.mark.asyncio
async def test_regra_do_banco_volta_como_mensagem(servidores, redis):
    servidores.gravacao = httpx.Response(400, json={"code": "P0001", "message": "Informe um e-mail válido."})
    resposta = await enviar_pedido()
    assert resposta.status_code == 400
    assert resposta.json()["detail"] == "Informe um e-mail válido."


@pytest.mark.asyncio
async def test_falha_interna_do_banco_nao_vaza_detalhe(servidores, redis):
    servidores.gravacao = httpx.Response(500, json={"code": "XX000", "message": "detalhe interno"})
    resposta = await enviar_pedido()
    assert resposta.status_code == 502
    assert "detalhe interno" not in resposta.text


@pytest.mark.asyncio
async def test_plano_sob_consulta_nao_entra(servidores, redis):
    resposta = await enviar_pedido(plano="sob_consulta")
    assert resposta.status_code == 422
    assert servidores.chamadas == []


@pytest.mark.asyncio
async def test_excesso_de_pedidos_e_barrado(servidores, redis):
    redis.incr.return_value = 11
    resposta = await enviar_pedido()
    assert resposta.status_code == 429
    assert servidores.chamadas == []
    # Vale o endereço acrescentado pelo proxy, e ele não fica guardado
    chave = redis.incr.call_args.args[0]
    assert chave == f"axos:contratacao:{hashlib.sha256(b'1.2.3.4').hexdigest()}"


@pytest.mark.asyncio
async def test_sem_redis_o_pedido_continua(servidores, redis):
    redis.incr.side_effect = RedisError("fora do ar")
    resposta = await enviar_pedido()
    assert resposta.status_code == 200


# Assinatura do aviso

@pytest.mark.asyncio
async def test_aviso_sem_assinatura_e_recusado(servidores):
    resposta = await enviar_aviso(evento_checkout(), cabecalhos={})
    assert resposta.status_code == 400
    assert servidores.chamadas == []


@pytest.mark.asyncio
async def test_aviso_com_assinatura_errada_e_recusado(servidores):
    corpo = evento_checkout()
    resposta = await enviar_aviso(corpo, cabecalhos=assinar(corpo, "outro-segredo"))
    assert resposta.status_code == 400
    assert servidores.chamadas == []


@pytest.mark.asyncio
async def test_aviso_sem_chaves_configuradas_nao_libera(servidores):
    with patch.object(settings, "STRIPE_WEBHOOK_SECRET", ""):
        resposta = await enviar_aviso(evento_checkout(), cabecalhos={})
    assert resposta.status_code == 503
    assert servidores.chamadas == []


# Pagamento

@pytest.mark.asyncio
async def test_cliente_novo_recebe_acesso_e_plano(servidores):
    resposta = await enviar_aviso(evento_checkout())
    assert resposta.status_code == 200
    assert servidores.nomes() == ["stripe_itens", "conferir_pedido_pago", "convite", "liberar_pedido_pago"]
    assert servidores.corpo("convite")["email"] == "novo@empresa.test"
    assert "https%3A%2F%2Faxosrelatorios.com%2Fredefinir-senha" in servidores.corpo("convite")["url"]
    liberacao = servidores.corpo("liberar_pedido_pago")
    assert liberacao["p_usuario"] == USUARIO
    assert liberacao["p_subscription"] == "sub_1"


@pytest.mark.asyncio
async def test_pagamento_ainda_nao_concluido_nao_libera(servidores):
    resposta = await enviar_aviso(evento_checkout(payment_status="unpaid"))
    assert resposta.status_code == 200
    assert servidores.chamadas == []


@pytest.mark.asyncio
async def test_usuario_sem_empresa_recebe_link_depois_de_liberar(servidores):
    servidores.conferencia = {"usuario": USUARIO, "impedimento": None}
    resposta = await enviar_aviso(evento_checkout())
    assert resposta.status_code == 200
    assert servidores.nomes() == ["stripe_itens", "conferir_pedido_pago", "liberar_pedido_pago", "recuperacao"]


@pytest.mark.asyncio
async def test_conta_logada_recebe_o_plano_sem_novo_acesso(servidores):
    servidores.pedido["tenant_id"] = "tenant-existente"
    resposta = await enviar_aviso(evento_checkout())
    assert resposta.status_code == 200
    assert servidores.nomes() == ["stripe_itens", "liberar_pedido_pago"]
    assert servidores.corpo("liberar_pedido_pago")["p_usuario"] is None


@pytest.mark.asyncio
@pytest.mark.parametrize("motivo", ["CONTA_JA_EXISTE", "CNPJ_JA_CADASTRADO"])
async def test_impedimento_vai_para_analise_sem_criar_acesso(servidores, motivo):
    servidores.conferencia = {"usuario": None, "impedimento": motivo}
    resposta = await enviar_aviso(evento_checkout())
    assert resposta.status_code == 200
    assert servidores.nomes() == ["stripe_itens", "conferir_pedido_pago", "analise"]
    assert servidores.corpo("analise")["observacao"] == motivo


@pytest.mark.asyncio
async def test_valor_menor_nao_libera_plano_maior(servidores):
    servidores.preco = {"unit_amount": 14700, "currency": "brl"}
    resposta = await enviar_aviso(evento_checkout())
    assert resposta.status_code == 200
    assert servidores.nomes() == ["stripe_itens", "analise"]
    assert servidores.corpo("analise")["observacao"] == "VALOR_DIFERENTE_DO_PLANO"


@pytest.mark.asyncio
async def test_aviso_repetido_nao_faz_nada(servidores):
    servidores.pedido["pago_em"] = "2026-11-09T00:00:00Z"
    resposta = await enviar_aviso(evento_checkout())
    assert resposta.status_code == 200
    assert servidores.chamadas == []


@pytest.mark.asyncio
@pytest.mark.parametrize("referencia", [None, "nao-e-numero", PEDIDO])
async def test_pagamento_sem_pedido_nao_libera(servidores, referencia):
    servidores.pedido = None
    resposta = await enviar_aviso(evento_checkout(client_reference_id=referencia))
    assert resposta.status_code == 200
    assert servidores.chamadas == []


@pytest.mark.asyncio
async def test_falha_ao_criar_acesso_pede_nova_tentativa(servidores):
    servidores.convite = httpx.Response(500, json={"msg": "erro"})
    resposta = await enviar_aviso(evento_checkout())
    assert resposta.status_code == 503
    assert "liberar_pedido_pago" not in servidores.nomes()


@pytest.mark.asyncio
async def test_falha_ao_liberar_pede_nova_tentativa(servidores):
    servidores.liberacao = httpx.Response(500, json={"message": "falha"})
    resposta = await enviar_aviso(evento_checkout())
    assert resposta.status_code == 503


# Assinatura

@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("tipo", "situacao", "encerra"),
    [
        ("customer.subscription.deleted", "canceled", True),
        ("customer.subscription.updated", "unpaid", True),
        ("customer.subscription.updated", "active", False),
        ("customer.subscription.updated", "trialing", False),
        ("customer.subscription.updated", "past_due", False),
        ("invoice.paid", "paid", False),
    ],
)
async def test_fim_da_assinatura(servidores, tipo, situacao, encerra):
    corpo = json.dumps({"type": tipo, "data": {"object": {"id": "sub_1", "status": situacao}}})
    resposta = await enviar_aviso(corpo)
    assert resposta.status_code == 200
    assert servidores.nomes() == (["encerrar_assinatura"] if encerra else [])
