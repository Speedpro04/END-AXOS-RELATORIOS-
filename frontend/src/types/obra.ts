export type ObraEscopoUnidade = 'junta' | 'ponto_medicao' | 'peca' | 'metro_linear' | 'm2' | 'filme' | 'equipamento'

export interface ObraEscopoLinha {
  id: string
  tenant_id: string
  site_id: string
  method: string // um dos 16 métodos END
  unidade: ObraEscopoUnidade
  quantidade_prevista: number
  referencia_tag?: string | null
  ativo: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface ObraEscopoRevisao {
  id: string
  tenant_id: string
  linha_id: string
  quantidade_anterior?: number | null
  quantidade_nova: number
  motivo: string
  created_by: string
  created_at: string
}

export interface LaudoEscopoVinculo {
  id: string
  tenant_id: string
  laudo_id: string
  linha_id: string
  quantidade_inspecionada: number
  quantidade_aprovada: number
  quantidade_reprovada: number
  laudo_origem_id?: string | null
  created_by: string
  created_at: string
}

export interface SyncObraEscopoLinhaItem {
  linha_id: string
  client_revision: number
  site_id: string
  method: string
  unidade: ObraEscopoUnidade
  quantidade_prevista: number
  referencia_tag?: string | null
  ativo: boolean
}

export interface SyncLaudoEscopoVinculoItem {
  vinculo_id: string
  client_revision: number
  laudo_id: string
  linha_id: string
  quantidade_inspecionada: number
  quantidade_aprovada: number
  quantidade_reprovada: number
  laudo_origem_id?: string | null
}

export interface AvançoObra {
  linha_id: string
  metodo: string
  unidade: ObraEscopoUnidade
  quantidade_prevista: number
  quantidade_inspecionada: number
  quantidade_aprovada: number
  quantidade_reprovada: number
  avancao_aprovado_pct: number   // aprovado / previsto * 100
  avancao_inspecionado_pct: number // inspecionado / previsto * 100
  excesso_escopo: boolean
}

export interface AvançoResumo {
  obra_id: string
  obra_nome: string
  total_previsto: number
  total_inspecionado: number
  total_aprovado: number
  total_reprovado: number
  avancao_aprovado_pct: number
  avancao_inspecionado_pct: number
  excesso_escopo: boolean
  data_atualizacao: string
  metodo?: string | null // filtro de método, se aplicável
}

export interface ProducaoInspetor {
  inspetor_id: string
  inspetor_nome: string
  quantidade_aprovada: number
  quantidade_reprovada: number
  unidade: ObraEscopoUnidade
  meta_periodo?: number | null
}

export interface PendenciaLaudo {
  laudo_id: string
  laudo_codigo: string
  metodo: string
  inspetor_nome: string
  dias_parado: number
  status: string
}

export interface PrevisaoTermino {
  obra_id: string
  saldo_restante: number
  ritmo_medio_semanal: number | null
  semanas_estimadas: number | null
  dados_insuficientes: boolean
  data_estimada?: string | null
}
