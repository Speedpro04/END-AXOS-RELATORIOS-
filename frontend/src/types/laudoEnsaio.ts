// Dados técnicos dos laudos de Ultrassom (UT) e Phased Array (PAUT).
// Valores numéricos ficam como texto: o inspetor digita "4,9" e nada se perde ao reabrir.

export interface FotoLaudo {
  anexoId: string
  legenda: string
}

export interface IdentificacaoEnsaio {
  cliente: string
  obra: string
  desenho: string
  itemEnsaiado: string
  material: string
  procedimento: string
  revisaoProcedimento: string
  planoInspecao: string
}

export interface AparelhoEnsaio {
  aparelhoFabricante: string
  aparelhoModelo: string
  aparelhoSerie: string
}

export interface Cabecote {
  id: string
  fabricante: string
  modelo: string
  serie: string
  dimensoes: string
  angulo: string
  frequencia: string
  espessuraPeca: string
  espessuraBloco: string
  ganhoReferencia: string
  ganhoAuxiliar: string
  ganhoCorrigido: string
  ganhoVarredura: string
  superficie: string
}

export type TipoDefeito = '' | 'FP' | 'FF' | 'PO' | 'TL' | 'TT' | 'IE'
export type ResultadoIndicacao = '' | 'A' | 'R'

export interface IndicacaoUt {
  id: string
  identificacao: string
  tipoProvavel: string
  comprimento: string
  profundidade: string
  percursoSonico: string
  distanciaBorda: string
  localizacao: string
  superficie: string
  nivelIndicacao: string
  nivelReferencia: string
  fatorAtenuacao: string
  nivelDescontinuidade: string
  cabecote: string
  soldadorRaiz: string
  soldadorEnchimento: string
  tipoDefeito: TipoDefeito
  resultado: ResultadoIndicacao
}

export interface IndicacaoPaut {
  id: string
  identificacao: string
  posicao: string
  comprimento: string
  profundidade: string
  tipoDefeito: TipoDefeito
  resultado: ResultadoIndicacao
}

export interface DadosUt extends IdentificacaoEnsaio, AparelhoEnsaio {
  esquema: 'ut-solda-v1'
  temperatura: string
  condicaoSuperficie: string
  acoplante: string
  tecnica: string
  blocoPadrao: string
  blocoReferencia: string
  tipoJunta: string
  tratamentoTermico: '' | 'antes' | 'depois' | 'nao_houve'
  cabecotes: Cabecote[]
  indicacoes: IndicacaoUt[]
  recomendacao: string
  sit: string
  rnc: string
  fotos: FotoLaudo[]
}

export interface DadosPaut extends IdentificacaoEnsaio, AparelhoEnsaio {
  esquema: 'paut-v1'
  modo: 'solda' | 'espessura'
  sonda: string
  cunha: string
  ganhoPrimario: string
  ganhoVarredura: string
  ganhoAvaliacao: string
  // Solda
  tipoJunta: '' | 'longitudinal' | 'circunferencial'
  diametroExterno: string
  espessura: string
  indicacoes: IndicacaoPaut[]
  // Espessura
  tubo: string
  espessuraNominal: string
  comprimentoVarredura: string
  espessuraMinima: string
  medicoes: string[]
  fotos: FotoLaudo[]
}

export const TIPOS_DEFEITO: Array<{ valor: TipoDefeito; rotulo: string }> = [
  { valor: 'FP', rotulo: 'FP, falta de penetração' },
  { valor: 'FF', rotulo: 'FF, falta de fusão' },
  { valor: 'PO', rotulo: 'PO, poro ou porosidade' },
  { valor: 'TL', rotulo: 'TL, trinca longitudinal' },
  { valor: 'TT', rotulo: 'TT, trinca transversal' },
  { valor: 'IE', rotulo: 'IE, inclusão de escória' },
]

/** Converte texto digitado ("4,9") em número; vazio ou inválido vira null. */
export function paraNumero(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.')
  if (!limpo) return null
  const n = Number(limpo)
  return Number.isFinite(n) ? n : null
}

export interface ResumoMedicoes {
  total: number
  minimo: number | null
  maximo: number | null
  media: number | null
  abaixoDoLimite: number[]
}

/** Resumo das medições de espessura. abaixoDoLimite traz os números dos pontos, a partir de 1. */
export function resumirMedicoes(medicoes: string[], limite: string): ResumoMedicoes {
  const lim = paraNumero(limite)
  const validos: number[] = []
  const abaixoDoLimite: number[] = []
  medicoes.forEach((m, i) => {
    const n = paraNumero(m)
    if (n === null) return
    validos.push(n)
    if (lim !== null && n < lim) abaixoDoLimite.push(i + 1)
  })
  if (validos.length === 0) return { total: 0, minimo: null, maximo: null, media: null, abaixoDoLimite }
  const soma = validos.reduce((a, b) => a + b, 0)
  return {
    total: validos.length,
    minimo: Math.min(...validos),
    maximo: Math.max(...validos),
    media: soma / validos.length,
    abaixoDoLimite,
  }
}

/** Separa uma lista colada ("4,9 4,8" ou "1 - 4,9mm") nos valores medidos. */
export function separarMedicoes(texto: string): string[] {
  return texto
    .split(/[\n;\t]+|\s{2,}|\s(?=\d)/)
    .map((parte) => parte.trim())
    .filter(Boolean)
    .map((parte) => {
      const comIndice = parte.match(/^\d+\s*-\s*(.+)$/)
      return (comIndice ? comIndice[1] : parte).replace(/mm$/i, '').trim()
    })
    .filter((valor) => paraNumero(valor) !== null)
}
