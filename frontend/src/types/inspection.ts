export type NDTMethod =
  | 'LP'
  | 'PM'
  | 'EVS'
  | 'ME'
  | 'US'
  | 'PINTURA'
  | 'NR13_VASO'

export type ReportStatus = 'rascunho' | 'enviado' | 'aprovado' | 'reprovado'

export interface InspectionReport {
  id: string
  code: string // Ex: NDT-LP-2024-0042
  method: NDTMethod
  title: string
  equipmentTag: string
  unitArea: string
  inspectorName: string
  inspectorSNQC: string
  normProcedure: string
  date: string
  status: ReportStatus
  acceptanceCriteria: string
  findingsCount: number
  summary: string
  technicalData: Record<string, any>
  createdAt: string
  updatedAt: string
}

export const METHOD_LABELS: Record<NDTMethod, { label: string; full: string; code: string }> = {
  LP: { label: 'LP', full: 'Líquido Penetrante', code: 'ASME V Art. 6 / Petrobras N-1596' },
  PM: { label: 'PM', full: 'Partícula Magnética', code: 'ASME V Art. 7 / Petrobras N-1598' },
  EVS: { label: 'EVS', full: 'Inspeção Visual de Solda', code: 'AWS D1.1 / ASME V Art. 9' },
  ME: { label: 'ME', full: 'Medição de Espessura (US)', code: 'Petrobras N-1594 / ASME V Art. 5' },
  US: { label: 'US', full: 'Ultrassom Convencional/PA', code: 'ASME V Art. 4 / N-1594' },
  PINTURA: { label: 'PINT', full: 'Pintura Industrial & Aderência', code: 'Petrobras N-13 / ISO 8501' },
  NR13_VASO: { label: 'NR-13', full: 'Vaso de Pressão (NR-13)', code: 'NR-13 / ASME Sec. VIII Div. 1' },
}
