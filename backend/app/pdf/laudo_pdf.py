"""
PDF oficial do laudo, gerado no servidor no momento da emissão.

Só usa dados do servidor: o laudo emitido (travado pelo banco), os dados congelados na
emissão (header_snapshot e client_snapshot) e as fotos do Storage, conferidas pelo SHA-256
registrado em report_attachments. O PDF guarda o SHA-256 do conteúdo (data_hash) e um QR
para a página pública de verificação. O SHA-256 do próprio PDF fica em report_pdfs.

O HTML é montado em Python puro (testável sem WeasyPrint); a conversão para PDF só roda no
servidor, onde o WeasyPrint e as fontes estão instalados.
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
import logging
from html import escape
from pathlib import Path
from typing import Any, Callable

logger = logging.getLogger(__name__)

CAMPOS = json.loads((Path(__file__).parent / "campos_metodo.json").read_text(encoding="utf-8"))

FOTO_LADO_MAX = 1200  # px no PDF; o original fica intacto no Storage
FOTO_QUALIDADE = 82

AVISO_AUTENTICIDADE = (
    "A verificação confirma que este documento é idêntico ao registrado no sistema AXOS Relatórios. "
    "Este documento não contém assinatura digital ICP-Brasil."
)


class ErroPdf(Exception):
    """Falha que impede gerar o PDF oficial (dado ausente ou divergente)."""


# ─────────────────────────────────────────────────────────
# Auxiliares de texto
# ─────────────────────────────────────────────────────────

def _e(valor: Any) -> str:
    return escape("" if valor is None else str(valor))


def _data(iso: str | None) -> str:
    if not iso:
        return ""
    data = str(iso)[:10]
    partes = data.split("-")
    return "/".join(reversed(partes)) if len(partes) == 3 else data


def _data_hora(iso: str | None) -> str:
    if not iso:
        return ""
    texto = str(iso)
    hora = texto[11:16] if len(texto) >= 16 else ""
    return f"{_data(texto)} {hora} (UTC)".strip()


def _grade(pares: list[tuple[str, Any]]) -> str:
    preenchidos = [(r, v) for r, v in pares if v not in (None, "") and str(v).strip()]
    if not preenchidos:
        return ""
    linhas = []
    for i in range(0, len(preenchidos), 3):
        celulas = [f'<td><span class="rotulo">{_e(r)}</span>{_e(v)}</td>' for r, v in preenchidos[i:i + 3]]
        celulas += ["<td></td>"] * (3 - len(celulas))
        linhas.append(f"<tr>{''.join(celulas)}</tr>")
    return f'<table class="grade">{"".join(linhas)}</table>'


def _tabela(cabecalho: list[str], linhas: list[list[Any]]) -> str:
    topo = "".join(f"<th>{_e(c)}</th>" for c in cabecalho)
    corpo = "".join(
        "<tr>" + "".join(f"<td>{_e(v) if v not in (None, '') else '—'}</td>" for v in linha) + "</tr>"
        for linha in linhas
    )
    return f'<table class="lista"><thead><tr>{topo}</tr></thead><tbody>{corpo}</tbody></table>'


def _resultado(r: str | None) -> str:
    return {"A": "Aprovada", "R": "Reprovada"}.get(r or "", "")


def _defeito(codigo: str | None) -> str:
    return next((t["rotulo"] for t in CAMPOS["tiposDefeito"] if t["valor"] == codigo), codigo or "")


# ─────────────────────────────────────────────────────────
# Corpo técnico por formato de laudo
# ─────────────────────────────────────────────────────────

def _secoes_padrao(t: dict[str, Any], metodo: str) -> str:
    extras = []
    for campo in CAMPOS["campos"].get(metodo, []):
        valor = t.get(campo["chave"])
        if not isinstance(valor, str):
            continue
        opcao = next((o["rotulo"] for o in campo.get("opcoes", []) if o["valor"] == valor), None)
        extras.append((campo["rotulo"], opcao or valor))
    html = "<h2>Condições do ensaio</h2>" + _grade([
        ("Temperatura da superfície", f"{t['temperatura']} °C" if t.get("temperatura") else ""),
        ("Condição da superfície", t.get("condicaoSuperficie")),
        ("Técnica", t.get("tecnica")),
        *extras,
    ])
    colunas = CAMPOS["colunas"].get(metodo) or [
        {"chave": "localizacao", "rotulo": "Localização"}, {"chave": "dimensoes", "rotulo": "Dimensões (mm)"},
    ]
    indicacoes = t.get("indicacoes") or []
    html += "<h2>Registro dos resultados</h2>"
    html += _tabela(
        ["Item", "Peça ou junta", *[c["rotulo"] for c in colunas], "Tipo de indicação", "Resultado"],
        [[n + 1, i.get("identificacao"), *[i.get(c["chave"]) for c in colunas], i.get("tipo"), _resultado(i.get("resultado"))]
         for n, i in enumerate(indicacoes)],
    ) if indicacoes else "<p>Nenhuma indicação registrada.</p>"
    return html + _grade([
        ("Recomendação de ensaio complementar", t.get("recomendacao")), ("SIT nº", t.get("sit")), ("RNC nº", t.get("rnc")),
    ])


def _secoes_ut(t: dict[str, Any]) -> str:
    termico = {"antes": "Antes do tratamento", "depois": "Depois do tratamento", "nao_houve": "Não houve"}.get(t.get("tratamentoTermico") or "", "")
    html = "<h2>Condições do ensaio</h2>" + _grade([
        ("Temperatura da superfície", f"{t['temperatura']} °C" if t.get("temperatura") else ""),
        ("Condição da superfície", t.get("condicaoSuperficie")), ("Acoplante", t.get("acoplante")),
        ("Técnica", t.get("tecnica")), ("Bloco padrão", t.get("blocoPadrao")), ("Bloco de referência", t.get("blocoReferencia")),
        ("Tipo de junta", t.get("tipoJunta")), ("Tratamento térmico", termico),
    ])
    cabecotes = t.get("cabecotes") or []
    if cabecotes:
        html += "<h2>Cabeçotes e calibração</h2>" + _tabela(
            ["Fabricante", "Modelo", "Série", "Dimensões", "Ângulo", "Freq.", "Esp. peça", "Esp. bloco", "GR", "GA", "GC", "GV", "Superfície"],
            [[c.get(k) for k in ("fabricante", "modelo", "serie", "dimensoes", "angulo", "frequencia", "espessuraPeca",
                                 "espessuraBloco", "ganhoReferencia", "ganhoAuxiliar", "ganhoCorrigido", "ganhoVarredura", "superficie")]
             for c in cabecotes],
        )
    indicacoes = t.get("indicacoes") or []
    html += "<h2>Registro dos resultados</h2>"
    html += _tabela(
        ["Item", "Peça ou junta", "Tipo provável", "Compr.", "Prof.", "Percurso", "Dist. borda", "Local.", "Sup.", "A", "B", "C", "D",
         "Cabeçote", "Raiz", "Ench.", "Defeito", "Resultado"],
        [[n + 1, *[i.get(k) for k in ("identificacao", "tipoProvavel", "comprimento", "profundidade", "percursoSonico", "distanciaBorda",
                                      "localizacao", "superficie", "nivelIndicacao", "nivelReferencia", "fatorAtenuacao",
                                      "nivelDescontinuidade", "cabecote", "soldadorRaiz", "soldadorEnchimento")],
          i.get("tipoDefeito"), _resultado(i.get("resultado"))] for n, i in enumerate(indicacoes)],
    ) if indicacoes else "<p>Nenhuma indicação registrada.</p>"
    html += _grade([("Recomendação de ensaio complementar", t.get("recomendacao")), ("SIT nº", t.get("sit")), ("RNC nº", t.get("rnc"))])
    return html + ('<p class="nota">GR: ganho de referência. GA: ganho auxiliar. GC: ganho corrigido. GV: ganho de varredura. '
                   'FP: falta de penetração. FF: falta de fusão. PO: poro ou porosidade. TL: trinca longitudinal. '
                   'TT: trinca transversal. IE: inclusão de escória.</p>')


def _secoes_paut(t: dict[str, Any]) -> str:
    db = lambda v: f"{v} dB" if v else ""  # noqa: E731
    mm = lambda v: f"{v} mm" if v else ""  # noqa: E731
    html = "<h2>Calibração</h2>" + _grade([
        ("Sonda", t.get("sonda")), ("Cunha", t.get("cunha")), ("Ganho primário", db(t.get("ganhoPrimario"))),
        ("Ganho de varredura", db(t.get("ganhoVarredura"))), ("Ganho de avaliação", db(t.get("ganhoAvaliacao"))),
    ])
    if t.get("modo") == "espessura":
        medicoes = [m for m in (t.get("medicoes") or []) if str(m).strip()]
        html += "<h2>Peça</h2>" + _grade([
            ("Tubo ou diâmetro", t.get("tubo")), ("Espessura nominal", mm(t.get("espessuraNominal"))),
            ("Comprimento de varredura", mm(t.get("comprimentoVarredura"))), ("Espessura mínima aceita", mm(t.get("espessuraMinima"))),
        ])
        html += "<h2>Medições de espessura</h2>"
        html += _tabela(["Ponto", "Espessura (mm)"], [[n + 1, m] for n, m in enumerate(medicoes)]) if medicoes else "<p>Sem medições.</p>"
        return html
    junta = {"longitudinal": "Longitudinal", "circunferencial": "Circunferencial"}.get(t.get("tipoJunta") or "", "")
    html += "<h2>Junta</h2>" + _grade([("Tipo de junta", junta), ("Diâmetro externo", mm(t.get("diametroExterno"))), ("Espessura", mm(t.get("espessura")))])
    indicacoes = t.get("indicacoes") or []
    html += "<h2>Registro dos resultados</h2>"
    return html + (_tabela(
        ["Item", "Junta", "Posição", "Compr.", "Prof.", "Defeito", "Resultado"],
        [[n + 1, i.get("identificacao"), i.get("posicao"), i.get("comprimento"), i.get("profundidade"),
          _defeito(i.get("tipoDefeito")), _resultado(i.get("resultado"))] for n, i in enumerate(indicacoes)],
    ) if indicacoes else "<p>Nenhuma descontinuidade registrada.</p>")


def _corpo_tecnico(t: dict[str, Any], metodo: str) -> str:
    esquema = t.get("esquema")
    if esquema == "ut-solda-v1":
        return _secoes_ut(t)
    if esquema == "paut-v1":
        return _secoes_paut(t)
    return _secoes_padrao(t, metodo)


# ─────────────────────────────────────────────────────────
# Documento completo
# ─────────────────────────────────────────────────────────

ESTILO = """
@page {
  size: A4; margin: 16mm 14mm 20mm 14mm;
  @bottom-left { content: "__RODAPE__"; font-size: 8px; color: #555; }
  @bottom-right { content: "Página " counter(page) " de " counter(pages); font-size: 8px; color: #555; }
}
* { box-sizing: border-box; }
body { font-family: "DejaVu Sans", sans-serif; font-size: 9.5px; color: #111; line-height: 1.35; margin: 0; }
h1 { font-size: 15px; margin: 0 0 2px; }
h2 { font-size: 11px; margin: 14px 0 4px; padding-bottom: 2px; border-bottom: 1px solid #999; text-transform: uppercase; letter-spacing: 0.03em; }
.cabecalho { border-bottom: 2px solid #111; margin: 0 0 4px; }
.cabecalho td { vertical-align: top; padding: 0 0 8px; }
.empresa img { max-height: 54px; max-width: 150px; margin-right: 8px; }
.empresa .nome { font-size: 12px; font-weight: bold; }
.empresa div { font-size: 8.5px; color: #333; }
.identidade { text-align: right; font-size: 9px; }
.identidade .numero { font-size: 13px; font-weight: bold; }
table { width: 100%; border-collapse: collapse; margin-top: 4px; }
.grade td { width: 33%; border: 1px solid #bbb; padding: 3px 5px; vertical-align: top; }
.rotulo { display: block; font-size: 7.5px; color: #555; text-transform: uppercase; }
.lista th, .lista td { border: 1px solid #bbb; padding: 2px 3px; font-size: 7.5px; text-align: left; }
.lista th { background: #eee; }
tr, figure, .autenticidade, .responsaveis td { page-break-inside: avoid; }
.conclusao { font-size: 11px; font-weight: bold; margin: 4px 0; }
.fotos td { width: 50%; vertical-align: top; padding: 4px; }
.fotos figure { margin: 0; }
.fotos img { width: 100%; max-height: 230px; object-fit: contain; border: 1px solid #ccc; }
.fotos figcaption { font-size: 8px; margin-top: 2px; }
.responsaveis td { width: 33%; border: 1px solid #bbb; padding: 4px 6px; height: 64px; vertical-align: top; font-size: 8.5px; }
.autenticidade { border: 1px solid #111; margin-top: 12px; }
.autenticidade td { padding: 8px; vertical-align: middle; }
.autenticidade .qr { width: 104px; }
.autenticidade img { width: 92px; height: 92px; }
.autenticidade .hash { font-family: "DejaVu Sans Mono", monospace; font-size: 7.5px; word-break: break-all; }
.nota { font-size: 7.5px; color: #555; }
"""


def montar_html(contexto: dict[str, Any]) -> str:
    """HTML completo do laudo oficial. Não acessa rede nem banco."""
    r = contexto["report"]
    metodo = contexto["metodo"]
    t: dict[str, Any] = r.get("technical_data") or {}
    laudo: dict[str, Any] = (r.get("administrative_data") or {}).get("laudo") or {}
    cab: dict[str, Any] = r.get("header_snapshot") or {}
    cli: dict[str, Any] = r.get("client_snapshot") or {}
    nome_metodo = CAMPOS["metodos"].get(metodo, {}).get("full", metodo)
    numero = r.get("report_number") or "SEM NÚMERO"
    revisao = r.get("revision") or 0

    endereco = ", ".join(str(cab[k]) for k in ("address_street", "address_number", "address_complement", "address_neighborhood",
                                               "address_city", "address_uf", "address_cep") if cab.get(k))
    contato = " · ".join(str(cab[k]) for k in ("phone", "email") if cab.get(k))
    logo = f'<img src="{contexto["logo_data_url"]}" alt="">' if contexto.get("logo_data_url") else ""

    cabecalho = f"""
    <table class="cabecalho"><tr>
      <td class="empresa">{logo}<div>
        <div class="nome">{_e(cab.get('trade_name') or cab.get('legal_name'))}</div>
        <div>{_e(cab.get('legal_name'))}{f" · CNPJ {_e(cab.get('cnpj'))}" if cab.get('cnpj') else ''}</div>
        <div>{_e(endereco)}</div><div>{_e(contato)}</div>
      </div></td>
      <td class="identidade">
        <h1>Laudo técnico de {_e(nome_metodo)}</h1>
        <div class="numero">{_e(numero)}</div>
        <div>Revisão {revisao}{f" · substitui a revisão {revisao - 1}" if revisao > 0 else ""}</div>
        <div>Emitido em {_e(_data_hora(r.get('issued_at')))}</div>
      </td>
    </tr></table>"""

    identificacao = "<h2>Identificação</h2>" + _grade([
        ("Cliente", (cli.get("client") or {}).get("legal_name") or cab.get("client_name") or t.get("cliente")),
        ("Obra", cab.get("site_name") or t.get("obra")), ("Contrato", cab.get("contract_ref")),
        ("Ordem de serviço", cab.get("work_order_code")), ("Equipamento ou tubulação", r.get("equipment_tag")),
        ("Item ensaiado", t.get("itemEnsaiado")), ("Local do ensaio", laudo.get("unitArea") or cab.get("site_address")),
        ("Desenho de referência", t.get("desenho")), ("Material", t.get("material")),
        ("Data do ensaio", _data(r.get("inspection_date"))),
        ("Procedimento", " rev. ".join(x for x in (t.get("procedimento"), t.get("revisaoProcedimento")) if x)),
        ("Norma de referência", laudo.get("normProcedure")), ("Critério de aceitação", laudo.get("acceptanceCriteria")),
        ("Plano de inspeção e teste", t.get("planoInspecao")),
        ("Aparelho", " ".join(x for x in (t.get("aparelhoFabricante"), t.get("aparelhoModelo")) if x)),
        ("Nº de série do aparelho", t.get("aparelhoSerie")),
    ])

    instrumentos = cli.get("instruments") or []
    if instrumentos:
        identificacao += "<h2>Instrumentos</h2>" + _tabela(
            ["Instrumento", "Nº de série", "Certificado de calibração", "Calibração válida até"],
            [[i.get("name"), i.get("serial_number"), i.get("calibration_certificate"), _data(i.get("calibration_valid_until"))] for i in instrumentos],
        )

    conclusao_txt = {"aprovado": "APROVADO", "reprovado": "REPROVADO"}.get(t.get("conclusao") or "", "")
    conclusao = "<h2>Conclusão</h2>"
    if conclusao_txt:
        conclusao += f'<p class="conclusao">Laudo: {conclusao_txt}</p>'
    if laudo.get("summary"):
        conclusao += f"<p><strong>Parecer técnico:</strong> {_e(laudo.get('summary'))}</p>"
    if t.get("observacoes"):
        conclusao += f"<p><strong>Observações:</strong> {_e(t.get('observacoes'))}</p>"

    figuras = []
    rastreio = []
    for n, a in enumerate(contexto.get("anexos") or [], start=1):
        legenda = f"Figura {n}" + (f": {a['legenda']}" if a.get("legenda") else "")
        imagem = f'<img src="{a["data_url"]}" alt="">' if a.get("data_url") else "<p>Imagem não encontrada no servidor.</p>"
        figuras.append(f"<figure>{imagem}<figcaption>{_e(legenda)}</figcaption></figure>")
        rastreio.append([f"Figura {n}", a.get("legenda"), a.get("sha256")])
    pares = ["<tr>" + "".join(f"<td>{f}</td>" for f in figuras[i:i + 2]) + ("<td></td>" if len(figuras[i:i + 2]) == 1 else "") + "</tr>"
             for i in range(0, len(figuras), 2)]
    evidencias = ("<h2>Evidências (fotos, croqui e esboço)</h2>" + f'<table class="fotos">{"".join(pares)}</table>') if figuras else ""

    q = cli.get("qualification") or {}
    qualificacao = _e(" · ".join(x for x in (
        f"SNQC {q['cert_number']}" if q.get("cert_number") else "", f"Nível {q['level']}" if q.get("level") else "",
        str(q.get("issuer") or ""), f"válida até {_data(q.get('valid_until'))}" if q.get("valid_until") else "",
    ) if x))
    nomes = contexto.get("nomes") or {}
    responsaveis = f"""
    <h2>Responsáveis</h2>
    <table class="responsaveis"><tr>
      <td><span class="rotulo">Inspetor</span>{_e((cli.get('inspector') or {}).get('full_name') or laudo.get('inspectorName'))}<br>{qualificacao}</td>
      <td><span class="rotulo">Aprovado por</span>{_e(nomes.get('aprovador'))}<br>{_e(_data_hora(r.get('approved_at')))}</td>
      <td><span class="rotulo">Emitido por</span>{_e(nomes.get('emissor'))}<br>{_e(_data_hora(r.get('issued_at')))}
        {f"<br>Responsável técnico: {_e(cab.get('responsible_name'))} {_e(cab.get('responsible_register') or '')}" if cab.get('responsible_name') else ''}</td>
    </tr></table>"""

    rastreabilidade = ("<h2>Rastreabilidade das evidências</h2>" + _tabela(["Figura", "Legenda", "SHA-256 do arquivo original"], rastreio)) if rastreio else ""

    qr = f'<img src="{contexto["qr_data_url"]}" alt="">' if contexto.get("qr_data_url") else ""
    autenticidade = f"""
    <table class="autenticidade"><tr><td class="qr">{qr}</td><td>
      <strong>Autenticidade</strong><br>
      Confira este laudo em {_e(contexto.get('verificar_url'))}<br>
      Documento {_e(r.get('document_id'))} · Revisão {revisao}<br>
      SHA-256 do conteúdo: <span class="hash">{_e(r.get('data_hash'))}</span><br>
      <span class="nota">{_e(AVISO_AUTENTICIDADE)}</span>
    </td></tr></table>"""

    rodape = f"{numero} · Rev. {revisao} · AXOS Relatórios".replace("\\", "").replace('"', "")
    estilo = ESTILO.replace("__RODAPE__", rodape)
    return f"""<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><style>{estilo}</style></head><body>
    {cabecalho}{identificacao}{_corpo_tecnico(t, metodo)}{conclusao}{evidencias}{responsaveis}{rastreabilidade}{autenticidade}
    </body></html>"""


# ─────────────────────────────────────────────────────────
# Imagens e QR
# ─────────────────────────────────────────────────────────

def sha256_hex(dados: bytes) -> str:
    return hashlib.sha256(dados).hexdigest()


def foto_para_pdf(dados: bytes) -> str:
    """Reduz a foto para caber no PDF (o original fica no Storage) e devolve como data URL."""
    from PIL import Image

    with Image.open(io.BytesIO(dados)) as img:
        img = img.convert("RGB")
        img.thumbnail((FOTO_LADO_MAX, FOTO_LADO_MAX))
        saida = io.BytesIO()
        img.save(saida, format="JPEG", quality=FOTO_QUALIDADE, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(saida.getvalue()).decode("ascii")


def qr_para_pdf(url: str) -> str:
    import qrcode

    img = qrcode.make(url, box_size=6, border=2)
    saida = io.BytesIO()
    img.save(saida, format="PNG")
    return "data:image/png;base64," + base64.b64encode(saida.getvalue()).decode("ascii")


def renderizar_pdf(html: str) -> bytes:
    from weasyprint import HTML  # só existe no servidor

    return HTML(string=html).write_pdf()


# ─────────────────────────────────────────────────────────
# Geração completa (servidor)
# ─────────────────────────────────────────────────────────

def _nome(sb: Any, user_id: str | None) -> str:
    if not user_id:
        return ""
    res = sb.table("profiles").select("full_name").eq("id", user_id).execute()
    return (res.data or [{}])[0].get("full_name") or ""


def gerar_pdf_oficial(
    sb: Any,
    report_id: str,
    tenant_id: str,
    verificar_base: str,
    renderizar: Callable[[str], bytes] = renderizar_pdf,
) -> dict[str, Any]:
    """Gera, guarda e registra o PDF oficial. `sb` usa a chave de serviço. Só uma vez por revisão."""
    existente = sb.table("report_pdfs").select("storage_path, sha256").eq("report_id", report_id).eq("tenant_id", tenant_id).execute()
    if existente.data:
        return {"status": "ja_existe", **existente.data[0]}

    res = sb.table("reports").select("*").eq("id", report_id).eq("tenant_id", tenant_id).execute()
    if not res.data:
        raise ErroPdf("Laudo não encontrado.")
    report = res.data[0]
    if report.get("status") not in ("issued", "superseded"):
        raise ErroPdf("Só laudo emitido tem PDF oficial.")
    if not report.get("data_hash") or not report.get("report_number"):
        raise ErroPdf("Laudo emitido sem número ou sem código SHA-256.")

    metodo = ((report.get("administrative_data") or {}).get("laudo") or {}).get("method")
    if report.get("template_id"):
        tpl = sb.table("report_templates").select("method").eq("id", report["template_id"]).execute()
        metodo = (tpl.data or [{}])[0].get("method") or metodo
    metodo = metodo or ""

    # Fotos, croqui e esboço: na ordem do laudo, conferidas pelo SHA-256 registrado
    anexos_db = {a["id"]: a for a in (sb.table("report_attachments").select("id, storage_path, sha256").eq("report_id", report_id).execute().data or [])}
    anexos = []
    for foto in (report.get("technical_data") or {}).get("fotos") or []:
        linha = anexos_db.get(foto.get("anexoId"))
        if not linha:
            anexos.append({"legenda": foto.get("legenda"), "data_url": None, "sha256": "não enviado ao servidor"})
            continue
        original = sb.storage.from_("report-files").download(linha["storage_path"])
        if sha256_hex(original) != linha["sha256"]:
            raise ErroPdf(f"A imagem '{foto.get('legenda') or linha['id']}' não confere com o SHA-256 registrado.")
        anexos.append({"legenda": foto.get("legenda"), "data_url": foto_para_pdf(original), "sha256": linha["sha256"]})

    cab = report.get("header_snapshot") or {}
    logo_data_url = None
    if cab.get("logo_path"):
        try:
            logo = sb.storage.from_("tenant-assets").download(cab["logo_path"])
            if cab.get("logo_sha256") and sha256_hex(logo) != cab["logo_sha256"]:
                raise ErroPdf("O logotipo não confere com o SHA-256 congelado na emissão.")
            logo_data_url = "data:image/png;base64," + base64.b64encode(logo).decode("ascii")
        except ErroPdf:
            raise
        except Exception as exc:  # logotipo é opcional
            logger.warning("[pdf] Logotipo indisponível para o laudo %s: %s", report_id, exc)

    verificar_url = f"{verificar_base.rstrip('/')}/{report['document_id']}/{report.get('revision') or 0}"
    html = montar_html({
        "report": report,
        "metodo": metodo,
        "anexos": anexos,
        "logo_data_url": logo_data_url,
        "qr_data_url": qr_para_pdf(verificar_url),
        "verificar_url": verificar_url,
        "nomes": {"aprovador": _nome(sb, report.get("approved_by")), "emissor": _nome(sb, report.get("issued_by"))},
    })
    pdf = renderizar(html)
    pdf_sha = sha256_hex(pdf)

    caminho = f"{tenant_id}/{report_id}.pdf"
    sb.storage.from_("report-pdfs").upload(caminho, pdf, file_options={"content-type": "application/pdf", "upsert": "false"})
    sb.table("report_pdfs").insert({"tenant_id": tenant_id, "report_id": report_id, "storage_path": caminho, "sha256": pdf_sha}).execute()
    logger.info("[pdf] PDF oficial do laudo %s gerado (sha256=%s, %d bytes)", report_id, pdf_sha, len(pdf))
    return {"status": "gerado", "storage_path": caminho, "sha256": pdf_sha}
