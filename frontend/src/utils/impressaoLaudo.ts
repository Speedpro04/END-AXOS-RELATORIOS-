// Monta as seções técnicas do laudo para a impressão em PDF.
import type { InspectionReport } from '../types/inspection'
import {
  CAMPOS_POR_METODO,
  TIPOS_DEFEITO,
  resumirMedicoes,
  type AparelhoEnsaio,
  type DadosPadrao,
  type DadosPaut,
  type DadosUt,
  type FotoLaudo,
  type IdentificacaoEnsaio,
} from '../types/laudoEnsaio'
import { lerAnexo } from '../services/anexos'

type Esc = (texto: string | null | undefined) => string

export const ESTILO_TECNICO = `
h2 { font-size: 12px; margin: 16px 0 4px; }
.colunas td { width: 25%; }
.rotulo { display: block; color: #555; font-size: 9px; }
.medicoes { display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px 8px; font-size: 10px; margin-top: 6px; }
.baixa { font-weight: bold; text-decoration: underline; }
.fotos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 6px; }
.fotos figure { margin: 0; break-inside: avoid; }
.fotos img { width: 100%; max-height: 260px; object-fit: contain; border: 1px solid #ccc; }
.fotos figcaption { font-size: 10px; margin-top: 2px; }
.assinaturas td { height: 60px; vertical-align: top; width: 33%; }
.larga { table-layout: fixed; }
.larga th, .larga td { font-size: 8px; padding: 2px 3px; overflow-wrap: anywhere; }
tr, .medicoes { break-inside: avoid; }
`

const paraDataUrl = (arquivo: Blob) =>
  new Promise<string>((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => resolve(String(leitor.result))
    leitor.onerror = () => reject(leitor.error)
    leitor.readAsDataURL(arquivo)
  })

function grade(pares: Array<[string, string | undefined]>, esc: Esc): string {
  const preenchidos = pares.filter(([, v]) => v && v.trim())
  if (preenchidos.length === 0) return ''
  const linhas: string[] = []
  for (let i = 0; i < preenchidos.length; i += 4) {
    const celulas = preenchidos.slice(i, i + 4).map(([r, v]) => `<td><span class="rotulo">${esc(r)}</span>${esc(v)}</td>`)
    while (celulas.length < 4) celulas.push('<td></td>')
    linhas.push(`<tr>${celulas.join('')}</tr>`)
  }
  return `<table class="colunas">${linhas.join('')}</table>`
}

function tabela(cabecalho: string[], linhas: Array<Array<string | undefined>>, esc: Esc): string {
  const topo = cabecalho.map((c) => `<th>${esc(c)}</th>`).join('')
  const corpo = linhas.map((l) => `<tr>${l.map((v) => `<td>${esc(v) || '—'}</td>`).join('')}</tr>`).join('')
  return `<table class="larga"><thead><tr>${topo}</tr></thead><tbody>${corpo}</tbody></table>`
}

const defeito = (codigo: string) => TIPOS_DEFEITO.find((t) => t.valor === codigo)?.rotulo ?? ''
const resultado = (r: string) => (r === 'A' ? 'Aprovada' : r === 'R' ? 'Reprovada' : '')

function identificacao(t: Partial<IdentificacaoEnsaio & AparelhoEnsaio>, esc: Esc): string {
  return grade([
    ['Cliente', t.cliente],
    ['Obra ou fabricante', t.obra],
    ['Item ensaiado', t.itemEnsaiado],
    ['Desenho de referência', t.desenho],
    ['Material', t.material],
    ['Procedimento', [t.procedimento, t.revisaoProcedimento && `rev. ${t.revisaoProcedimento}`].filter(Boolean).join(' ')],
    ['Plano de inspeção e teste', t.planoInspecao],
    ['Aparelho', [t.aparelhoFabricante, t.aparelhoModelo].filter(Boolean).join(' ')],
    ['Número de série do aparelho', t.aparelhoSerie],
  ], esc)
}

function secoesUt(t: Partial<DadosUt>, esc: Esc): string {
  const termico = { antes: 'Antes do tratamento', depois: 'Depois do tratamento', nao_houve: 'Não houve', '': '' }[t.tratamentoTermico ?? '']
  let html = '<h2>Condições do ensaio</h2>' + grade([
    ['Temperatura da superfície', t.temperatura && `${t.temperatura} °C`],
    ['Condição da superfície', t.condicaoSuperficie],
    ['Acoplante', t.acoplante],
    ['Técnica', t.tecnica],
    ['Bloco padrão', t.blocoPadrao],
    ['Bloco de referência', t.blocoReferencia],
    ['Tipo de junta', t.tipoJunta],
    ['Tratamento térmico', termico],
  ], esc)
  if (t.cabecotes?.length) {
    html += '<h2>Cabeçotes e calibração</h2>' + tabela(
      ['Fabricante', 'Modelo', 'Série', 'Dimensões', 'Ângulo', 'Freq.', 'Esp. peça', 'Esp. bloco', 'GR', 'GA', 'GC', 'GV', 'Superfície'],
      t.cabecotes.map((c) => [c.fabricante, c.modelo, c.serie, c.dimensoes, c.angulo, c.frequencia, c.espessuraPeca, c.espessuraBloco, c.ganhoReferencia, c.ganhoAuxiliar, c.ganhoCorrigido, c.ganhoVarredura, c.superficie]),
      esc,
    )
  }
  html += '<h2>Registro dos resultados</h2>'
  html += t.indicacoes?.length
    ? tabela(
        ['Item', 'Peça ou junta', 'Tipo provável', 'Compr.', 'Prof.', 'Percurso', 'Dist. borda', 'Local.', 'Sup.', 'A', 'B', 'C', 'D', 'Cabeçote', 'Raiz', 'Ench.', 'Defeito', 'Resultado'],
        t.indicacoes.map((i, n) => [String(n + 1), i.identificacao, i.tipoProvavel, i.comprimento, i.profundidade, i.percursoSonico, i.distanciaBorda, i.localizacao, i.superficie, i.nivelIndicacao, i.nivelReferencia, i.fatorAtenuacao, i.nivelDescontinuidade, i.cabecote, i.soldadorRaiz, i.soldadorEnchimento, i.tipoDefeito, resultado(i.resultado)]),
        esc,
      )
    : '<p>Nenhuma indicação registrada.</p>'
  html += grade([
    ['Recomendação de ensaio complementar', t.recomendacao],
    ['SIT nº', t.sit],
    ['RNC nº', t.rnc],
  ], esc)
  return html
}

function secoesPaut(t: Partial<DadosPaut>, esc: Esc): string {
  let html = '<h2>Calibração</h2>' + grade([
    ['Sonda', t.sonda],
    ['Cunha', t.cunha],
    ['Ganho primário', t.ganhoPrimario && `${t.ganhoPrimario} dB`],
    ['Ganho de varredura', t.ganhoVarredura && `${t.ganhoVarredura} dB`],
    ['Ganho de avaliação', t.ganhoAvaliacao && `${t.ganhoAvaliacao} dB`],
  ], esc)
  if (t.modo === 'espessura') {
    const medicoes = t.medicoes ?? []
    const resumo = resumirMedicoes(medicoes, t.espessuraMinima ?? '')
    const baixos = new Set(resumo.abaixoDoLimite)
    const num = (n: number | null) => (n === null ? '' : `${n.toFixed(2).replace('.', ',')} mm`)
    html += '<h2>Peça</h2>' + grade([
      ['Tubo ou diâmetro', t.tubo],
      ['Espessura nominal', t.espessuraNominal && `${t.espessuraNominal} mm`],
      ['Comprimento de varredura', t.comprimentoVarredura && `${t.comprimentoVarredura} mm`],
      ['Espessura mínima aceita', t.espessuraMinima && `${t.espessuraMinima} mm`],
    ], esc)
    html += '<h2>Medições de espessura</h2>' + grade([
      ['Pontos', String(resumo.total)],
      ['Mínima', num(resumo.minimo)],
      ['Máxima', num(resumo.maximo)],
      ['Média', num(resumo.media)],
    ], esc)
    if (baixos.size > 0) html += `<p><strong>Pontos abaixo da espessura mínima:</strong> ${[...baixos].join(', ')}.</p>`
    html += `<div class="medicoes">${medicoes.map((m, i) => `<span class="${baixos.has(i + 1) ? 'baixa' : ''}">${i + 1} - ${esc(m)} mm</span>`).join('')}</div>`
  } else {
    const junta = t.tipoJunta === 'longitudinal' ? 'Longitudinal' : t.tipoJunta === 'circunferencial' ? 'Circunferencial' : ''
    html += '<h2>Junta</h2>' + grade([
      ['Tipo de junta', junta],
      ['Diâmetro externo', t.diametroExterno && `${t.diametroExterno} mm`],
      ['Espessura', t.espessura && `${t.espessura} mm`],
    ], esc)
    html += '<h2>Registro dos resultados</h2>'
    html += t.indicacoes?.length
      ? tabela(
          ['Item', 'Junta', 'Posição', 'Compr.', 'Prof.', 'Defeito', 'Resultado'],
          t.indicacoes.map((i, n) => [String(n + 1), i.identificacao, i.posicao, i.comprimento, i.profundidade, defeito(i.tipoDefeito), resultado(i.resultado)]),
          esc,
        )
      : '<p>Nenhuma descontinuidade registrada.</p>'
  }
  return html
}

function secoesPadrao(t: Partial<DadosPadrao> & Record<string, unknown>, metodo: InspectionReport['method'], esc: Esc): string {
  const extras = (CAMPOS_POR_METODO[metodo] ?? []).map(({ chave, rotulo, opcoes }): [string, string | undefined] => {
    const valor = typeof t[chave] === 'string' ? (t[chave] as string) : ''
    return [rotulo, opcoes?.find((o) => o.valor === valor)?.rotulo ?? valor]
  })
  let html = '<h2>Condições do ensaio</h2>' + grade([
    ['Temperatura da superfície', t.temperatura && `${t.temperatura} °C`],
    ['Condição da superfície', t.condicaoSuperficie],
    ['Técnica', t.tecnica],
    ...extras,
  ], esc)
  html += '<h2>Registro dos resultados</h2>'
  html += t.indicacoes?.length
    ? tabela(
        ['Item', 'Peça ou junta', 'Localização', 'Tipo de indicação', 'Dimensões (mm)', 'Resultado'],
        t.indicacoes.map((i, n) => [String(n + 1), i.identificacao, i.localizacao, i.tipo, i.dimensoes, resultado(i.resultado)]),
        esc,
      )
    : '<p>Nenhuma indicação registrada.</p>'
  html += grade([
    ['Recomendação de ensaio complementar', t.recomendacao],
    ['SIT nº', t.sit],
    ['RNC nº', t.rnc],
  ], esc)
  return html
}

async function secaoFotos(fotos: FotoLaudo[] | undefined, esc: Esc): Promise<string> {
  if (!fotos?.length) return ''
  const itens: string[] = []
  for (const f of fotos) {
    try {
      const url = await paraDataUrl(await lerAnexo(f.anexoId))
      itens.push(`<figure><img src="${url}" alt="${esc(f.legenda)}"><figcaption>${esc(f.legenda)}</figcaption></figure>`)
    } catch {
      itens.push(`<figure><figcaption>${esc(f.legenda)} (imagem indisponível)</figcaption></figure>`)
    }
  }
  return `<h2>Evidências</h2><div class="fotos">${itens.join('')}</div>`
}

const LEGENDA = 'AP: aprovado. RP: reprovado. FP: falta de penetração. FF: falta de fusão. PO: poro ou porosidade. TL: trinca longitudinal. TT: trinca transversal. IE: inclusão de escória. GR: ganho de referência. GA: ganho auxiliar. GC: ganho corrigido. GV: ganho de varredura.'

/** Seções técnicas do laudo: UT e PAUT com formulário próprio, os demais no formulário padrão. */
export async function htmlTecnico(report: InspectionReport, esc: Esc): Promise<string> {
  const t = report.technicalData ?? {}
  if (t.esquema !== 'ut-solda-v1' && t.esquema !== 'paut-v1' && t.esquema !== 'padrao-v1') return ''
  const especifico =
    t.esquema === 'ut-solda-v1' ? secoesUt(t as DadosUt, esc)
      : t.esquema === 'paut-v1' ? secoesPaut(t as DadosPaut, esc)
        : secoesPadrao(t as Partial<DadosPadrao> & Record<string, unknown>, report.method, esc)
  const observacoes = t.observacoes ? `<h2>Observações</h2><p>${esc(t.observacoes as string)}</p>` : ''
  return `
    <h2>Identificação do ensaio</h2>
    ${identificacao(t as DadosUt, esc)}
    ${t.conclusao === 'aprovado' || t.conclusao === 'reprovado' ? `<p><strong>Laudo:</strong> ${t.conclusao === 'aprovado' ? 'Aprovado' : 'Reprovado'}</p>` : ''}
    ${especifico}
    ${observacoes}
    ${await secaoFotos(t.fotos as FotoLaudo[] | undefined, esc)}
    ${t.esquema === 'padrao-v1' ? '' : `<p style="font-size:9px;color:#555;margin-top:10px">${LEGENDA}</p>`}
    <table class="assinaturas" style="margin-top:12px">
      <tr>
        <td><span class="rotulo">Inspetor</span>${esc(report.inspectorName)}<br>${esc(report.inspectorSNQC)}</td>
        <td><span class="rotulo">Controle da qualidade</span></td>
        <td><span class="rotulo">Fiscalização</span></td>
      </tr>
    </table>
  `
}
