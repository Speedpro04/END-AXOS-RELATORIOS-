"""Worker de geração de PDF para laudos emitidos.

Gera apenas o cabeçalho e rodapé do laudo (corpo do modelo fica para tarefas seguintes),
alimentados pelo header_snapshot congelado no servidor no momento da emissão.

Fluxo:
  1. Busca o laudo completo no Supabase (inclui header_snapshot).
  2. Busca a logo no Supabase Storage pelo logo_path.
  3. Confere o SHA-256 da logo contra o header_snapshot; se divergir, falha e registra no log.
  4. Renderiza cabeçalho e rodapé via Jinja2 + WeasyPrint.
  5. Gera QR code apontando para axosrelatorios.com/verificar/{documento}/{revisao}.
  6. Faz upload do PDF para o Supabase Storage (bucket: 'report-pdfs').
  7. Registra em report_pdfs (apenas inserção).
"""

from __future__ import annotations

import hashlib
import io
import logging
from typing import Any

import qrcode
from jinja2 import BaseLoader, Environment
from weasyprint import HTML

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────
# Template Jinja2 — cabeçalho e rodapé do laudo (base)
# O corpo de cada modelo (US, LP, PM, etc.) é preenchido em tarefas seguintes.
# ─────────────────────────────────────────────────────────

HEADER_FOOTER_TEMPLATE = """
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <style>
    @page {
      size: A4 portrait;
      margin: 22mm 16mm 18mm 16mm;
      @bottom-center {
        content: "Página " counter(page) " de " counter(pages);
        font-family: 'DM Mono', monospace;
        font-size: 10px;
        color: #64748b;
      }
    }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif; font-size: 11px; color: #14171f; margin: 0; }
    .header {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 16px;
      align-items: start;
      border-bottom: 1px solid #cbd2dd;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .header .brand { display: flex; gap: 14px; align-items: start; flex-wrap: wrap; }
    .header .brand img.logo { max-height: 64px; max-width: 200px; object-fit: contain; display: block; }
    .header .brand .identity { min-width: 0; }
    .header .brand .name {
      font-size: 16px; font-weight: 600; color: #14171f; line-height: 1.25; margin: 0 0 2px 0;
    }
    .header .brand .legal { font-size: 12px; color: #566074; margin-bottom: 4px; }
    .header .brand .cnpj {
      font-size: 12px; font-family: 'DM Mono', monospace; color: #566074; margin-bottom: 2px;
    }
    .header .brand .address {
      font-size: 12px; color: #566074; margin-bottom: 2px;
    }
    .header .brand .contact {
      font-size: 12px; color: #566074; display: flex; gap: 10px; align-items: center;
    }
    .header .brand .incomplete {
      font-size: 11px; color: #c4262e; font-weight: 600; margin-top: 6px;
    }
    .header .meta { text-align: right; }
    .header .meta .model {
      font-size: 13px; font-weight: 600; color: #14171f; margin-bottom: 4px;
      text-transform: uppercase; letter-spacing: 0.05em;
    }
    .header .meta .code {
      font-family: 'DM Mono', monospace; font-size: 14px; font-weight: 700;
      color: #14171f; margin-bottom: 4px;
    }
    .header .meta .folio {
      font-family: 'DM Mono', monospace; font-size: 12px; color: #566074;
    }
    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #999;
      font-size: 11px;
      color: #000;
      font-family: 'DM Mono', monospace;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .footer .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .footer .hash { font-size: 10px; color: #333; }
    .footer .qr-note { font-size: 9px; color: #666; text-align: center; }
    .content { min-height: 200px; }
  </style>
</head>
<body>
  <header class="header">
    <div class="brand">
      {% if logo_data_url %}
        <img class="logo" src="{{ logo_data_url }}" alt="Logo da empresa emissora">
      {% endif %}
      <div class="identity">
        {% if issuer_name %}
          <div class="name">{% if issuer_trade_name %}{{ issuer_trade_name }}{% else %}{{ issuer_name }}{% endif %}</div>
        {% else %}
          <div class="name incomplete">Complete em Configurações</div>
        {% endif %}
        {% if issuer_legal_name and issuer_legal_name != issuer_trade_name %}
          <div class="legal">{{ issuer_legal_name }}</div>
        {% endif %}
        {% if issuer_cnpj %}<div class="cnpj">CNPJ {{ issuer_cnpj }}</div>{% endif %}
        {% if issuer_address %}<div class="address">{{ issuer_address }}</div>{% endif %}
        {% if issuer_phone or issuer_email %}
          <div class="contact">
            {% if issuer_phone %}<span>☎ {{ issuer_phone }}</span>{% endif %}
            {% if issuer_email %}<span>✉ {{ issuer_email }}</span>{% endif %}
          </div>
        {% endif %}
      </div>
    </div>
    <div class="meta">
      {% if model_title %}<div class="model">{{ model_title }}</div>{% endif %}
      {% if report_code %}<div class="code">{{ report_code }}</div>{% endif %}
      {% if folio %}<div class="folio">Folha {{ folio }}</div>{% endif %}
    </div>
  </header>

  <div class="content">
    {% block body %}{% endblock %}
  </div>

  <footer class="footer">
    <div class="row">
      <span>Gerado por Axos Relatórios • axosrelatorios.com</span>
      <span>Página <span class="page-number"></span> de <span class="total-pages"></span></span>
      {% if hash_fragment %}<span class="hash">Hash {{ hash_fragment }}</span>{% endif %}
    </div>
    {% if qr_url %}
      <div class="qr-note">
        Verificação pública: {{ qr_url }}
      </div>
    {% endif %}
  </footer>
</body>
</html>
"""

# ─────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────

def _fmt_cnpj(cnpj: str | None) -> str:
    if not cnpj:
        return ""
    digits = "".join(ch for ch in cnpj if ch.isdigit())
    if len(digits) != 14:
        return cnpj
    return f"{digits[:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:14]}"


def _fmt_address(s: dict[str, Any] | None) -> str | None:
    if not s:
        return None
    parts = [
        s.get("address_street"),
        s.get("address_number"),
        s.get("address_complement"),
        s.get("address_neighborhood"),
        s.get("address_city"),
        s.get("address_uf"),
        s.get("address_cep"),
    ]
    parts = [p for p in parts if p]
    return ", ".join(parts) or None


def _sha256_file(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _make_qr_png(url: str) -> bytes:
    img = qrcode.make(url)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ─────────────────────────────────────────────────────────
# Tarefa ARQ (entry-point do worker)
# ─────────────────────────────────────────────────────────

async def task_generate_pdf(ctx: dict, *, laudo_id: str, tenant_id: str) -> dict[str, Any]:
    """Gera PDF do laudo (cabeçalho + rodapé) e armazena no Supabase Storage.

    Requer que o laudo já esteja com status 'issued' e header_snapshot preenchido.
    """
    from supabase import create_client
    from app.core.config import settings

    logger.info("[pdf] Iniciando geração de PDF para laudo %s", laudo_id)
    sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    # 1. Busca o laudo completo
    res = (
        sb.table("reports")
        .select("*")
        .eq("id", laudo_id)
        .eq("tenant_id", tenant_id)
        .single()
        .execute()
    )
    if not res.data:
        logger.error("[pdf] Laudo %s não encontrado no tenant %s.", laudo_id, tenant_id)
        return {"status": "erro", "detail": "Laudo não encontrado"}

    report = res.data
    header_snapshot = report.get("header_snapshot") or {}
    document_id = report.get("document_id")
    revision = report.get("revision", 0)

    # 2. Busca a logo no Storage pelo logo_path
    logo_path = header_snapshot.get("logo_path")
    logo_bytes: bytes | None = None
    logo_data_url: str | None = None

    if logo_path:
        try:
            storage_res = sb.storage.from_("tenant-assets").download(logo_path)
            if storage_res:
                logo_bytes = storage_res
        except Exception as exc:
            logger.warning("[pdf] Não foi possível baixar a logo %s: %s", logo_path, exc)

    # 3. Confere SHA-256 da logo contra o snapshot
    if logo_bytes is not None and header_snapshot.get("logo_sha256"):
        actual_hash = _sha256_file(logo_bytes)
        expected_hash = header_snapshot["logo_sha256"]
        if actual_hash != expected_hash:
            logger.error(
                "[pdf] SHA-256 da logo diverge do snapshot para laudo %s: "
                "esperado=%s obtido=%s",
                laudo_id, expected_hash, actual_hash,
            )
            return {
                "status": "erro",
                "detail": "SHA-256 da logo diverge do snapshot",
                "laudo_id": laudo_id,
            }
        # Data URL para embutir no HTML (PNG)
        import base64
        logo_data_url = "data:image/png;base64," + base64.b64encode(logo_bytes).decode("ascii")

    # 4. Dados para o template
    issuer = {
        "issuer_name": header_snapshot.get("legal_name") or header_snapshot.get("trade_name"),
        "issuer_trade_name": header_snapshot.get("trade_name"),
        "issuer_legal_name": header_snapshot.get("legal_name"),
        "issuer_cnpj": _fmt_cnpj(header_snapshot.get("cnpj")),
        "issuer_address": _fmt_address(header_snapshot),
        "issuer_phone": header_snapshot.get("phone"),
        "issuer_email": header_snapshot.get("email"),
    }

    # Número do laudo: usa report_number se existir no header_snapshot, senão constrói
    report_code = (
        report.get("report_number")
        or header_snapshot.get("report_code")
        or f"{header_snapshot.get('report_prefix', 'END')}-{report.get('method', 'US')}-{report.get('inspection_date', '')[:4]}-000"
    )

    folio = "1 de 1"  # corpo de página única nesta versão base
    model_title = "Relatório Técnico de Inspeção"

    # Hash fragment (trecho do data_hash para exibição no rodapé)
    data_hash = report.get("data_hash") or ""
    hash_fragment = data_hash[:16] if data_hash else ""

    # QR code apontando para verificação pública em axosrelatorios.com
    qr_base = settings.QR_BASE_URL.rstrip("/")
    qr_url = f"{qr_base}/verificar/{document_id}/{revision}"
    qr_png = _make_qr_png(qr_url)
    import base64 as _b64
    qr_data_url = "data:image/png;base64," + _b64.b64encode(qr_png).decode("ascii")

    # 5. Renderiza HTML via Jinja2
    env = Environment(loader=BaseLoader())
    template = env.from_string(HEADER_FOOTER_TEMPLATE)
    html = template.render(
        logo_data_url=logo_data_url,
        qr_data_url=qr_data_url,
        qr_url=qr_url,
        model_title=model_title,
        report_code=report_code,
        folio=folio,
        hash_fragment=hash_fragment,
        **issuer,
    )

    # 6. Converte para PDF via WeasyPrint
    try:
        pdf_bytes = HTML(string=html).write_pdf()
    except Exception as exc:
        logger.exception("[pdf] Falha ao renderizar PDF para laudo %s: %s", laudo_id, exc)
        return {"status": "erro", "detail": f"Falha na renderização: {exc}"}

    pdf_sha256 = _sha256_file(pdf_bytes)

    # 7. Upload para o Supabase Storage (bucket: report-pdfs)
    storage_path = f"report-pdfs/{tenant_id}/{laudo_id}.pdf"
    try:
        sb.storage.from_("report-pdfs").upload(
            storage_path,
            pdf_bytes,
            file_options={"content-type": "application/pdf", "upsert": "false"},
        )
    except Exception as exc:
        logger.exception("[pdf] Falha ao fazer upload do PDF para laudo %s: %s", laudo_id, exc)
        return {"status": "erro", "detail": f"Falha no upload: {exc}"}

    # 8. Registra em report_pdfs (apenas inserção)
    try:
        sb.table("report_pdfs").insert(
            {
                "tenant_id": tenant_id,
                "report_id": laudo_id,
                "storage_path": storage_path,
                "sha256": pdf_sha256,
            }
        ).execute()
    except Exception as exc:
        logger.exception(
            "[pdf] Falha ao registrar report_pdfs para laudo %s: %s", laudo_id, exc
        )
        return {"status": "erro", "detail": f"Falha ao registrar PDF: {exc}"}

    logger.info(
        "[pdf] PDF do laudo %s gerado com sucesso: %s (sha256=%s)",
        laudo_id, storage_path, pdf_sha256,
    )
    return {
        "status": "ok",
        "laudo_id": laudo_id,
        "storage_path": storage_path,
        "sha256": pdf_sha256,
        "qr_url": qr_url,
    }
