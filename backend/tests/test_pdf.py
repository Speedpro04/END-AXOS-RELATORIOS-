"""PDF oficial: conteúdo do laudo, conferência das fotos, geração única e download conferido."""
import hashlib
import io
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from jose import jwt
from PIL import Image

from app.core.config import settings
from app.main import app
from app.pdf.laudo_pdf import ErroPdf, gerar_pdf_oficial, montar_html


def _png() -> bytes:
    saida = io.BytesIO()
    Image.new("RGB", (40, 30), (200, 30, 30)).save(saida, format="PNG")
    return saida.getvalue()


FOTO = _png()
FOTO_SHA = hashlib.sha256(FOTO).hexdigest()
TENANT = "tenant-uuid-5678"


def _laudo(**extra):
    base = {
        "id": "laudo-1", "tenant_id": TENANT, "document_id": "doc-1", "revision": 0, "status": "issued",
        "report_number": "END-MT-2026-001", "equipment_tag": "V-2104", "inspection_date": "2026-11-18",
        "issued_at": "2026-11-18T15:00:00+00:00", "approved_at": "2026-11-18T14:00:00+00:00",
        "approved_by": "u-revisor", "issued_by": "u-revisor", "template_id": "tpl-mt", "data_hash": "a" * 64,
        "header_snapshot": {"legal_name": "Empresa Teste Ltda", "trade_name": "Empresa Teste", "cnpj": "11.222.333/0001-44",
                            "client_name": "Cliente X", "site_name": "Obra Y", "work_order_code": "OS-1"},
        "client_snapshot": {"inspector": {"full_name": "Ana Inspetora"},
                            "qualification": {"cert_number": "12345", "level": 2, "issuer": "SNQC", "valid_until": "2028-05-31"}},
        "administrative_data": {"laudo": {"method": "MT", "normProcedure": "ASME V Art. 7", "summary": "Sem indicações relevantes."}},
        "technical_data": {
            "esquema": "padrao-v1", "conclusao": "aprovado", "temperatura": "28",
            "tecnicaMagnetizacao": "yoke", "tipoCorrente": "ca",
            "indicacoes": [{"identificacao": "J-01", "localizacao": "120 mm", "tipo": "Linear", "dimensoes": "8", "resultado": "A"}],
            "fotos": [{"anexoId": "anexo-1", "legenda": "Croqui da junta"}],
        },
    }
    base.update(extra)
    return base


def _contexto(report, metodo="MT", anexos=None):
    return {"report": report, "metodo": metodo, "anexos": anexos or [], "logo_data_url": None,
            "qr_data_url": "data:image/png;base64,QR", "verificar_url": "https://axosrelatorios.com/verificar/doc-1/0",
            "nomes": {"aprovador": "Rui Revisor", "emissor": "Rui Revisor"}}


# ── Conteúdo ──

def test_html_padrao_tem_campos_do_metodo_e_autenticidade():
    html = montar_html(_contexto(_laudo(), anexos=[{"legenda": "Croqui da junta", "data_url": "data:image/jpeg;base64,X", "sha256": FOTO_SHA}]))
    for trecho in ["Partículas Magnéticas", "END-MT-2026-001", "Revisão 0", "Técnica de magnetização", "Yoke", "Alternada (CA)",
                   "J-01", "Aprovada", "Laudo: APROVADO", "Sem indicações relevantes.", "Figura 1: Croqui da junta",
                   FOTO_SHA, "a" * 64, "https://axosrelatorios.com/verificar/doc-1/0", "data:image/png;base64,QR",
                   "Ana Inspetora", "SNQC 12345", "Rui Revisor", "não contém assinatura digital ICP-Brasil"]:
        assert trecho in html, trecho


def test_html_protege_texto_digitado():
    laudo = _laudo(equipment_tag="<script>alert(1)</script>")
    html = montar_html(_contexto(laudo))
    assert "<script>" not in html
    assert "&lt;script&gt;" in html


def test_html_revisao_indica_substituicao():
    html = montar_html(_contexto(_laudo(revision=2)))
    assert "Revisão 2" in html and "substitui a revisão 1" in html


def test_html_ut_e_paut():
    ut = _laudo(technical_data={"esquema": "ut-solda-v1", "acoplante": "Gel", "cabecotes": [{"fabricante": "Olympus"}],
                                "indicacoes": [{"identificacao": "J-2", "tipoDefeito": "FF", "resultado": "R"}]})
    html = montar_html(_contexto(ut, metodo="UT"))
    assert "Ultrassom Convencional" in html and "Cabeçotes e calibração" in html and "Olympus" in html and "Reprovada" in html
    paut = _laudo(technical_data={"esquema": "paut-v1", "modo": "espessura", "medicoes": ["4,9", "5,1"], "sonda": "5L64"})
    html = montar_html(_contexto(paut, metodo="PAUT"))
    assert "Medições de espessura" in html and "4,9" in html and "5L64" in html


# ── Geração no servidor (banco e Storage simulados) ──

class _Consulta:
    def __init__(self, banco, tabela):
        self.banco, self.tabela, self.filtros, self.novo = banco, tabela, [], None

    def select(self, *_):
        return self

    def eq(self, coluna, valor):
        self.filtros.append((coluna, valor))
        return self

    def insert(self, linha):
        self.novo = dict(linha)
        return self

    def execute(self):
        linhas = self.banco.setdefault(self.tabela, [])
        if self.novo is not None:
            linhas.append(self.novo)
            return type("R", (), {"data": [self.novo]})()
        return type("R", (), {"data": [l for l in linhas if all(l.get(c) == v for c, v in self.filtros)]})()


class _Balde:
    def __init__(self, arquivos, nome):
        self.arquivos, self.nome = arquivos, nome

    def download(self, caminho):
        return self.arquivos[(self.nome, caminho)]

    def upload(self, caminho, dados, file_options=None):
        assert (self.nome, caminho) not in self.arquivos, "PDF oficial não pode ser sobrescrito"
        self.arquivos[(self.nome, caminho)] = dados


class _Storage:
    def __init__(self, arquivos):
        self.arquivos = arquivos

    def from_(self, nome):
        return _Balde(self.arquivos, nome)


class FakeSupabase:
    def __init__(self, laudo):
        self.banco = {
            "reports": [laudo],
            "report_templates": [{"id": "tpl-mt", "method": "MT"}],
            "report_attachments": [{"id": "anexo-1", "report_id": "laudo-1", "storage_path": f"{TENANT}/laudo-1/foto.png", "sha256": FOTO_SHA}],
            "profiles": [{"id": "u-revisor", "full_name": "Rui Revisor"}],
            "report_pdfs": [],
        }
        self.arquivos = {("report-files", f"{TENANT}/laudo-1/foto.png"): FOTO}
        self.storage = _Storage(self.arquivos)

    def table(self, nome):
        return _Consulta(self.banco, nome)


def test_gera_guarda_e_registra_uma_vez():
    sb = FakeSupabase(_laudo())
    htmls = []
    renderizar = lambda html: (htmls.append(html), b"%PDF-1.7 teste")[1]  # noqa: E731
    r = gerar_pdf_oficial(sb, "laudo-1", TENANT, "https://axosrelatorios.com/verificar", renderizar)
    assert r["status"] == "gerado"
    assert sb.arquivos[("report-pdfs", f"{TENANT}/laudo-1.pdf")] == b"%PDF-1.7 teste"
    assert sb.banco["report_pdfs"][0]["sha256"] == hashlib.sha256(b"%PDF-1.7 teste").hexdigest()
    assert "data:image/jpeg;base64," in htmls[0] and "Rui Revisor" in htmls[0]
    # Segunda vez não gera de novo (PDF oficial é único por revisão)
    assert gerar_pdf_oficial(sb, "laudo-1", TENANT, "https://x", renderizar)["status"] == "ja_existe"
    assert len(htmls) == 1


def test_foto_alterada_impede_o_pdf():
    sb = FakeSupabase(_laudo())
    sb.arquivos[("report-files", f"{TENANT}/laudo-1/foto.png")] = _png()[:-10] + b"alterada!!"
    with pytest.raises(ErroPdf, match="não confere"):
        gerar_pdf_oficial(sb, "laudo-1", TENANT, "https://x", lambda h: b"%PDF")
    assert sb.banco["report_pdfs"] == []


def test_so_laudo_emitido_tem_pdf():
    sb = FakeSupabase(_laudo(status="approved"))
    with pytest.raises(ErroPdf, match="emitido"):
        gerar_pdf_oficial(sb, "laudo-1", TENANT, "https://x", lambda h: b"%PDF")


# ── Rotas ──

PERFIL_REVISOR = {"id": "u-revisor", "tenant_id": TENANT, "role": "supervisor", "can_inspect": True, "active": True, "full_name": "Rui Revisor"}


@pytest.fixture(autouse=True)
def _sem_redis():
    with patch("app.main.ping_redis", new_callable=AsyncMock, return_value=True), patch("app.main.close_redis", new_callable=AsyncMock):
        yield


@pytest.fixture
def cliente_http():
    from app.routers import sync as sync_mod

    sb = FakeSupabase(_laudo())
    sb.banco["report_pdfs"].append({"report_id": "laudo-1", "tenant_id": TENANT, "storage_path": f"{TENANT}/laudo-1.pdf",
                                    "sha256": hashlib.sha256(b"%PDF-original").hexdigest()})
    sb.arquivos[("report-pdfs", f"{TENANT}/laudo-1.pdf")] = b"%PDF-original"
    token = jwt.encode({"sub": "u-revisor", "aud": "authenticated"}, settings.SUPABASE_JWT_SECRET, algorithm="HS256")
    with patch.object(sync_mod, "_supabase_user_client", lambda t: sb), patch.object(sync_mod, "_supabase_admin", lambda: sb), \
         patch("app.core.security.fetch_user_profile", new=AsyncMock(return_value=PERFIL_REVISOR)):
        yield sb, token


@pytest.mark.asyncio
async def test_baixar_pdf_oficial(cliente_http):
    sb, token = cliente_http
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/sync/pdf/laudo-1", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.content == b"%PDF-original"
    assert r.headers["content-type"] == "application/pdf"
    assert 'filename="END-MT-2026-001-rev0.pdf"' in r.headers["content-disposition"]


@pytest.mark.asyncio
async def test_pdf_adulterado_nao_e_entregue(cliente_http):
    sb, token = cliente_http
    sb.arquivos[("report-pdfs", f"{TENANT}/laudo-1.pdf")] = b"%PDF-trocado"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/sync/pdf/laudo-1", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 409
