export type ENDMethod =
  | 'VT' | 'PT' | 'MT' | 'UT' | 'RT' | 'ET' | 'LT' | 'LT_VACUO'
  | 'PAUT' | 'TOFD' | 'CRDR' | 'ECA' | 'EA' | 'IRT' | 'ACFM' | 'TFM'

export type ReportStatus = 'rascunho' | 'enviado' | 'aprovado' | 'reprovado' | 'issued' | 'devolvido' | 'substituido'

export interface InspectionReport {
  id: string
  code: string // Ex: END-VT-2026-0042
  method: ENDMethod
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
  // Qualificação SNQC do inspetor usada no laudo (exigida para enviar à revisão)
  qualificationId?: string | null
  // Vínculo com escopo de obra (opcional)
  linhaId?: string | null
  quantidadeInspecionada?: number
  quantidadeAprovada?: number
  quantidadeReprovada?: number
}

export const METHOD_LABELS: Record<ENDMethod, { label: string; full: string; code: string }> = {
  VT: { label: 'VT', full: 'Ensaio Visual', code: 'ASME V Art. 9' },
  PT: { label: 'PT', full: 'Líquidos Penetrantes', code: 'ASME V Art. 6 / Petrobras N-1596' },
  MT: { label: 'MT', full: 'Partículas Magnéticas', code: 'Petrobras N-1598 / ASME VIII Ap. 6' },
  UT: { label: 'UT', full: 'Ultrassom Convencional', code: 'ASME V Art. 4 / Petrobras N-1594' },
  RT: { label: 'RT', full: 'Radiografia Industrial', code: 'ASME V Art. 2 / 3' },
  ET: { label: 'ET', full: 'Correntes Parasitas Convencional', code: 'ASME V Art. 7' },
  LT: { label: 'LT', full: 'Ensaio de Estanqueidade', code: 'ASME V Art. 10' },
  LT_VACUO: { label: 'LT Vácuo', full: 'Estanqueidade por Caixa de Vácuo', code: 'ASME V Art. 10' },
  PAUT: { label: 'PAUT', full: 'Ultrassom Phased Array', code: 'ASME V Art. 4 / ISO 13588' },
  TOFD: { label: 'ToFD', full: 'Time of Flight Diffraction', code: 'ASME V Art. 4' },
  CRDR: { label: 'CR/DR', full: 'Radiografia Computadorizada/Digital', code: 'ASTM E1742 / ISO 17636-2' },
  ECA: { label: 'ECA', full: 'Eddy Current Array', code: 'ASME V Art. 8 / ISO 15548' },
  EA: { label: 'EA', full: 'Emissão Acústica', code: 'ASME V Art. 12' },
  IRT: { label: 'IRT', full: 'Termografia Infravermelha', code: 'ISO 18434-1 / ASTM E1934' },
  ACFM: { label: 'ACFM', full: 'Alternating Current Field Measurement', code: '' },
  TFM: { label: 'TFM', full: 'TFM / FMC', code: 'ISO 18563-3' },
}
