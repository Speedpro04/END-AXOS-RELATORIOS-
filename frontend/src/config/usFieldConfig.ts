export interface UsFieldConfig {
  key: string
  label: string
  required: boolean
  type: 'text' | 'number' | 'date' | 'select' | 'textarea'
  options?: string[]
}

export const US_FIELD_CONFIG: UsFieldConfig[] = [
  // Peça e ensaio (obrigatórios por padrão)
  { key: 'contractor', label: 'Contratante', required: true, type: 'text' },
  { key: 'drawingNumber', label: 'Nº do Desenho', required: true, type: 'text' },
  { key: 'partDescription', label: 'Descrição da Peça', required: true, type: 'text' },
  { key: 'material', label: 'Material', required: true, type: 'text' },
  { key: 'opOrOsNumber', label: 'Nº da OP ou OS', required: true, type: 'text' },
  { key: 'surfaceCondition', label: 'Condição da Superfície', required: false, type: 'text' },
  { key: 'temperature', label: 'Temperatura (°C)', required: false, type: 'number' },
  { key: 'procedureNumber', label: 'Procedimento (nº e revisão)', required: true, type: 'text' },
  { key: 'referenceNorm', label: 'Norma de Referência', required: true, type: 'text' },
  { key: 'acceptanceLevel', label: 'Nível de Aceitação', required: true, type: 'text' },
  { key: 'examDate', label: 'Data do Ensaio', required: true, type: 'date' },
  { key: 'technique', label: 'Técnica', required: true, type: 'select', options: ['feixe_angular', 'feixe_normal'] },
  { key: 'referenceBlock', label: 'Bloco de Referência', required: true, type: 'text' },
  { key: 'couplant', label: 'Acoplante', required: true, type: 'text' },

  // Transdutores (ao menos 1 obrigatório)
  { key: 'transducers', label: 'Transdutores', required: true, type: 'text' },

  // Veredito (obrigatório)
  { key: 'verdict', label: 'Veredito', required: true, type: 'select', options: ['A', 'R', 'NEC', 'AC'] },

  // Assinatura (obrigatórios)
  { key: 'signature.executorName', label: 'Executante', required: true, type: 'text' },
  { key: 'signature.level', label: 'Nível', required: true, type: 'select', options: ['N1', 'N2', 'N3'] },
  { key: 'signature.certificateNumber', label: 'Nº do Certificado', required: true, type: 'text' },
  { key: 'signature.qualificationValidity', label: 'Validade da Qualificação', required: true, type: 'date' },

  // Condicional (obrigatório quando veredito = AC)
  { key: 'conditionalRelease.approverName', label: 'Responsável pela Aprovação (condicional)', required: false, type: 'text' },
  { key: 'conditionalRelease.reason', label: 'Motivo da Liberação (condicional)', required: false, type: 'text' },
]

export const isFieldRequired = (key: string): boolean => {
  const field = US_FIELD_CONFIG.find((f) => f.key === key)
  return field?.required ?? false
}
