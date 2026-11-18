"""Verificação pública do laudo (destino do QR do PDF oficial)."""
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from tests.test_pdf import FakeSupabase, TENANT, _laudo

DOC = "11111111-2222-3333-4444-555555555555"


@pytest.fixture
def banco():
    from app.routers import verificacao as mod

    sb = FakeSupabase(_laudo(id="rev-0", document_id=DOC, revision=0, status="superseded", report_number="END-MT-2026-001"))
    sb.banco["reports"].append(_laudo(id="rev-1", document_id=DOC, revision=1, status="issued", report_number="END-MT-2026-001", data_hash="b" * 64))
    sb.banco["reports"].append(_laudo(id="rev-2", document_id=DOC, revision=2, status="draft"))
    sb.banco["report_pdfs"].append({"report_id": "rev-1", "tenant_id": TENANT, "sha256": "c" * 64})
    with patch("app.main.ping_redis", new_callable=AsyncMock, return_value=True), \
         patch("app.main.close_redis", new_callable=AsyncMock), \
         patch.object(mod, "_supabase_admin", lambda: sb), \
         patch.object(mod, "_limitar", new=AsyncMock(return_value=None)):
        yield sb


async def _get(caminho):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        return await c.get(caminho)


@pytest.mark.asyncio
async def test_revisao_vigente_e_valida(banco):
    r = await _get(f"/api/verificar/{DOC}/1")
    assert r.status_code == 200
    d = r.json()
    assert d["situacao"] == "valido" and d["revisao"] == 1 and d["revisao_vigente"] == 1
    assert d["numero"] == "END-MT-2026-001" and d["metodo"] == "Partículas Magnéticas"
    assert d["sha256_conteudo"] == "b" * 64 and d["sha256_pdf"] == "c" * 64
    assert d["emissora"] == {"nome": "Empresa Teste Ltda", "cnpj": "11.222.333/0001-44"}
    assert r.headers["cache-control"] == "no-store"


@pytest.mark.asyncio
async def test_revisao_antiga_aparece_como_substituida(banco):
    d = (await _get(f"/api/verificar/{DOC}/0")).json()
    assert d["situacao"] == "substituido" and d["revisao_vigente"] == 1
    assert d["sha256_pdf"] is None  # a revisão antiga deste teste não tem PDF registrado


@pytest.mark.asyncio
async def test_rascunho_e_endereco_invalido_nao_existem(banco):
    assert (await _get(f"/api/verificar/{DOC}/2")).status_code == 404
    assert (await _get("/api/verificar/nao-e-uuid/0")).status_code == 404
    assert (await _get(f"/api/verificar/{DOC}/9")).status_code == 404


@pytest.mark.asyncio
async def test_nao_expoe_pessoas_cliente_nem_obra(banco):
    texto = (await _get(f"/api/verificar/{DOC}/1")).text
    for dado in ["Ana Inspetora", "Rui Revisor", "Cliente X", "Obra Y", "12345"]:
        assert dado not in texto, dado
