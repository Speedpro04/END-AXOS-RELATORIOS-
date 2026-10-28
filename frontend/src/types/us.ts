export type UsVerdict = 'A' | 'R' | 'NEC' | 'AC'

export interface UsTransducer {
  id: string
  identification: string
  angle: number // ° real
  frequency: number // MHz
  dimension: string
  gp: number // dB
  pt: number // dB
  gc: number // dB
}

export interface UsCalibrationPoint {
  depth: number // mm
  amplitude: number // % da altura de tela
  gain: number // dB
}

export interface UsCalibrationCheck {
  moment: 'inicio' | 'troca_cabecote' | 'intervalo' | 'fim'
  dateTime: string
  result: 'conforme' | 'nao_conforme'
  observation: string
}

export interface UsDiscontinuity {
  id: string
  number: number
  location: string
  length: number // mm Comp.
  depth: number // mm Prof.
  amplitudePercent: number // %
  amplitudeDb: number // dB
  transducerId: string // seleção entre linhas da tabela de transdutores
  observation: string
  classification?: 'planar' | 'volumetrica' // coluna avançada
  evaluation?: 'aceita' | 'rejeitada' // coluna avançada
  action?: 'nenhuma' | 'reparo' | 'reensaio' // coluna avançada
}

export interface UsCroquiMark {
  id: string
  x: number // coordenada normalizada 0-1
  y: number // coordenada normalizada 0-1
  type: 'indicacao' | 'traco'
}

export interface UsTechnicalData {
  // Peça e ensaio
  contractor: string
  drawingNumber: string
  partDescription: string
  material: string
  opOrOsNumber: string
  surfaceCondition: string
  temperature: number // °C
  procedureNumber: string
  procedureRevision: string
  referenceNorm: string
  acceptanceLevel: string // nível de aceitação
  examDate: string
  technique: 'feixe_angular' | 'feixe_normal' // 'paut' e 'tofd' desabilitados
  referenceBlock: string
  couplant: string

  // Transdutores (1 a 5 linhas)
  transducers: UsTransducer[]

  // Calibração (seção recolhida, opcional)
  calibration?: {
    deviceManufacturer: string
    deviceModel: string
    deviceSerial: string
    calibrationValidity: string
    blocks: Array<{ type: string; serial: string }>
    velocityOrDistance: string
    referenceGain: number // dB
    transferCorrection: number // dB
    scanGain: number // dB
    recordingLevel: string
    referenceHoleDiameter: number // mm, sem valor padrão
    dacPoints: UsCalibrationPoint[]
    calibrationChecks: UsCalibrationCheck[]
  }

  // Croqui
  croquiMarks: UsCroquiMark[]

  // Descontinuidades
  discontinuities: UsDiscontinuity[]
  advancedColumnsVisible: boolean

  // Evidências
  evidence: Array<{ id: string; url: string; caption: string }>

  // Conclusão
  observations: string
  accessLimitations: string
  verdict: UsVerdict | null
  conditionalRelease: {
    approverName: string
    approverRole: string
    approverDate: string
    reason: string
  }

  // Assinatura
  signature: {
    executorName: string
    level: 'N1' | 'N2' | 'N3'
    certificateNumber: string
    certifyingBody: string // campo livre, sem valor padrão
    qualificationValidity: string
    emissionDate: string
    optionalViews: {
      responsible: string | null
      contractor: string | null
    }
  }
}
