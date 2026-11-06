import React, { useState, useEffect } from 'react'
import { X, Check, ShieldAlert, FileSpreadsheet, Eye, Gauge, Layers, Wrench, HardHat, HardDrive, Thermometer, ScanEye, Wand2, Barcode, Wifi } from 'lucide-react'
import { METHOD_LABELS, type InspectionReport, type ENDMethod, type ReportStatus } from '../types/inspection'
import { ObraEscopoVinculo } from './laudo/ObraEscopoVinculo'

interface InspectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (report: Partial<InspectionReport>) => void
  initialReport?: InspectionReport | null
  initialMethod?: ENDMethod
  siteId?: string | null
}

export const InspectionModal: React.FC<InspectionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialReport,
  initialMethod,
  siteId,
}) => {
  const [method, setMethod] = useState<ENDMethod>('VT')
  const [equipmentTag, setEquipmentTag] = useState('')
  const [title, setTitle] = useState('')
  const [unitArea, setUnitArea] = useState('')
  const [inspectorName, setInspectorName] = useState('')
  const [inspectorSNQC, setInspectorSNQC] = useState('')
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('')
  const [status, setStatus] = useState<ReportStatus>('rascunho')
  const [findingsCount, setFindingsCount] = useState<number | string>('')
  const [summary, setSummary] = useState('')

  const [techPT, setTechPT] = useState({
    penetrantBrand: '',
    developerBrand: '',
    cleanerBrand: '',
    dwellTime: '',
    developerTime: '',
    lightIntensity: '',
    surfaceTemp: '',
    indications: '',
  })

  const [techUT, setTechUT] = useState({
    deviceModel: '',
    transducerType: '',
    couplant: '',
    nominalThickness: '',
    minFoundThickness: '',
    calculatedCorrosion: '',
    allowableMinThickness: '',
    meshPoints: '',
  })

  const [techRT, setTechRT] = useState({
    sourceTypeRT: '',
    sourceStrengthRT: '',
    filmTypeRT: '',
    screenTypeRT: '',
    exposureTimeRT: '',
    sourceDistanceRT: '',
    iqisRT: '',
  })

  const [techET, setTechET] = useState({
    probeTypeET: '',
    frequencyET: '',
    conductivityET: '',
    thicknessET: '',
    liftOffET: '',
  })

  const [techLT, setTechLT] = useState({
    testMethodLT: '',
    testPressureLT: '',
    testFluidLT: '',
    testTempLT: '',
    leakRateLT: '',
  })

  const [techUS_PhasedArray, setTechUS_PhasedArray] = useState({
    probeModelPA: '',
    numElementsPA: '',
    pitchPA: '',
    frequencyPA: '',
    focalLawPA: '',
    scanTypePA: '',
  })

  const [techET_Array, setTechET_Array] = useState({
    probeArrayTypeEA: '',
    numElementsEA: '',
    pitchEA: '',
    frequencyEA: '',
    coverageEA: '',
  })

  const [techEA, setTechEA] = useState({
    numChannelsEA: '',
    sensorTypeEA: '',
    samplingRateEA: '',
    thresholdEA: '',
  })

  const [techIRT, setTechIRT] = useState({
    cameraModelIR: '',
    resolutionIR: '',
    emissivityIR: '',
    ambientTempIR: '',
    objectTempIR: '',
  })

  const [techACFM, setTechACFM] = useState({
    probeACFM: '',
    frequencyACFM: '',
    coatingThicknessACFM: '',
    bxSignalACFM: '',
    bzSignalACFM: '',
  })

  const [techTFM, setTechTFM] = useState({
    captureConfigTFM: '',
    apertureTFM: '',
    pixelSizeTFM: '',
    propagationModeTFM: '',
  })

  const [techUS_IMAGING, setTechUS_IMAGING] = useState({
    probeModelUS: '',
    freqUS_IMAGING: '',
    probeTypeUS_IMAGING: '',
    dimensionsUS_IMAGING: '',
  })

  const [linhaId, setLinhaId] = useState<string | null>(null)
  const [quantidadeInspecionada, setQuantidadeInspecionada] = useState(0)
  const [quantidadeAprovada, setQuantidadeAprovada] = useState(0)
  const [quantidadeReprovada, setQuantidadeReprovada] = useState(0)

  useEffect(() => {
    if (isOpen) {
      if (initialReport) {
        setMethod(initialReport.method || 'VT')
        setEquipmentTag(initialReport.equipmentTag || '')
        setTitle(initialReport.title || '')
        setUnitArea(initialReport.unitArea || '')
        setInspectorName(initialReport.inspectorName || '')
        setInspectorSNQC(initialReport.inspectorSNQC || '')
        setAcceptanceCriteria(initialReport.acceptanceCriteria || '')
        setStatus(initialReport.status || 'rascunho')
        setFindingsCount(initialReport.findingsCount ?? '')
        setSummary(initialReport.summary || '')
        const tech = (initialReport.technicalData as Record<string, string>) || {}
        setTechPT({
          penetrantBrand: tech.penetrantBrand || '',
          developerBrand: tech.developerBrand || '',
          cleanerBrand: tech.cleanerBrand || '',
          dwellTime: tech.dwellTime || '',
          developerTime: tech.developerTime || '',
          lightIntensity: tech.lightIntensity || '',
          surfaceTemp: tech.surfaceTemp || '',
          indications: tech.indications || '',
        })
        setTechUT({
          deviceModel: tech.deviceModel || '',
          transducerType: tech.transducerType || '',
          couplant: tech.couplant || '',
          nominalThickness: tech.nominalThickness || '',
          minFoundThickness: tech.minFoundThickness || '',
          calculatedCorrosion: tech.calculatedCorrosion || '',
          allowableMinThickness: tech.allowableMinThickness || '',
          meshPoints: tech.meshPoints || '',
        })
        setTechRT({
          sourceTypeRT: tech.sourceTypeRT || '',
          sourceStrengthRT: tech.sourceStrengthRT || '',
          filmTypeRT: tech.filmTypeRT || '',
          screenTypeRT: tech.screenTypeRT || '',
          exposureTimeRT: tech.exposureTimeRT || '',
          sourceDistanceRT: tech.sourceDistanceRT || '',
          iqisRT: tech.iqisRT || '',
        })
        setTechET({
          probeTypeET: tech.probeTypeET || '',
          frequencyET: tech.frequencyET || '',
          conductivityET: tech.conductivityET || '',
          thicknessET: tech.thicknessET || '',
          liftOffET: tech.liftOffET || '',
        })
        setTechLT({
          testMethodLT: tech.testMethodLT || '',
          testPressureLT: tech.testPressureLT || '',
          testFluidLT: tech.testFluidLT || '',
          testTempLT: tech.testTempLT || '',
          leakRateLT: tech.leakRateLT || '',
        })
        setTechUS_PhasedArray({
          probeModelPA: tech.probeModelPA || '',
          numElementsPA: tech.numElementsPA || '',
          pitchPA: tech.pitchPA || '',
          frequencyPA: tech.frequencyPA || '',
          focalLawPA: tech.focalLawPA || '',
          scanTypePA: tech.scanTypePA || '',
        })
        setTechET_Array({
          probeArrayTypeEA: tech.probeArrayTypeEA || '',
          numElementsEA: tech.numElementsEA || '',
          pitchEA: tech.pitchEA || '',
          frequencyEA: tech.frequencyEA || '',
          coverageEA: tech.coverageEA || '',
        })
        setTechEA({
          numChannelsEA: tech.numChannelsEA || '',
          sensorTypeEA: tech.sensorTypeEA || '',
          samplingRateEA: tech.samplingRateEA || '',
          thresholdEA: tech.thresholdEA || '',
        })
        setTechIRT({
          cameraModelIR: tech.cameraModelIR || '',
          resolutionIR: tech.resolutionIR || '',
          emissivityIR: tech.emissivityIR || '',
          ambientTempIR: tech.ambientTempIR || '',
          objectTempIR: tech.objectTempIR || '',
        })
        setTechACFM({
          probeACFM: tech.probeACFM || '',
          frequencyACFM: tech.frequencyACFM || '',
          coatingThicknessACFM: tech.coatingThicknessACFM || '',
          bxSignalACFM: tech.bxSignalACFM || '',
          bzSignalACFM: tech.bzSignalACFM || '',
        })
        setTechTFM({
          captureConfigTFM: tech.captureConfigTFM || '',
          apertureTFM: tech.apertureTFM || '',
          pixelSizeTFM: tech.pixelSizeTFM || '',
          propagationModeTFM: tech.propagationModeTFM || '',
        })
        setTechUS_IMAGING({
          probeModelUS: tech.probeModelUS || '',
          freqUS_IMAGING: tech.freqUS_IMAGING || '',
          probeTypeUS_IMAGING: tech.probeTypeUS_IMAGING || '',
          dimensionsUS_IMAGING: tech.dimensionsUS_IMAGING || '',
        })
        setLinhaId(initialReport.linhaId || null)
        setQuantidadeInspecionada(initialReport.quantidadeInspecionada || 0)
        setQuantidadeAprovada(initialReport.quantidadeAprovada || 0)
        setQuantidadeReprovada(initialReport.quantidadeReprovada || 0)
      } else {
        setMethod(initialMethod ?? 'VT')
        setEquipmentTag('')
        setTitle('')
        setUnitArea('')
        setInspectorName('')
        setInspectorSNQC('')
        setAcceptanceCriteria('')
        setStatus('rascunho')
        setFindingsCount('')
        setSummary('')
        setTechPT({
          penetrantBrand: '',
          developerBrand: '',
          cleanerBrand: '',
          dwellTime: '',
          developerTime: '',
          lightIntensity: '',
          surfaceTemp: '',
          indications: '',
        })
        setTechUT({
          deviceModel: '',
          transducerType: '',
          couplant: '',
          nominalThickness: '',
          minFoundThickness: '',
          calculatedCorrosion: '',
          allowableMinThickness: '',
          meshPoints: '',
        })
        setTechRT({
          sourceTypeRT: '',
          sourceStrengthRT: '',
          filmTypeRT: '',
          screenTypeRT: '',
          exposureTimeRT: '',
          sourceDistanceRT: '',
          iqisRT: '',
        })
        setTechET({
          probeTypeET: '',
          frequencyET: '',
          conductivityET: '',
          thicknessET: '',
          liftOffET: '',
        })
        setTechLT({
          testMethodLT: '',
          testPressureLT: '',
          testFluidLT: '',
          testTempLT: '',
          leakRateLT: '',
        })
        setTechUS_PhasedArray({
          probeModelPA: '',
          numElementsPA: '',
          pitchPA: '',
          frequencyPA: '',
          focalLawPA: '',
          scanTypePA: '',
        })
        setTechET_Array({
          probeArrayTypeEA: '',
          numElementsEA: '',
          pitchEA: '',
          frequencyEA: '',
          coverageEA: '',
        })
        setTechEA({
          numChannelsEA: '',
          sensorTypeEA: '',
          samplingRateEA: '',
          thresholdEA: '',
        })
        setTechIRT({
          cameraModelIR: '',
          resolutionIR: '',
          emissivityIR: '',
          ambientTempIR: '',
          objectTempIR: '',
        })
        setTechACFM({
          probeACFM: '',
          frequencyACFM: '',
          coatingThicknessACFM: '',
          bxSignalACFM: '',
          bzSignalACFM: '',
        })
        setTechTFM({
          captureConfigTFM: '',
          apertureTFM: '',
          pixelSizeTFM: '',
          propagationModeTFM: '',
        })
        setTechUS_IMAGING({
          probeModelUS: '',
          freqUS_IMAGING: '',
          probeTypeUS_IMAGING: '',
          dimensionsUS_IMAGING: '',
        })
        setLinhaId(null)
        setQuantidadeInspecionada(0)
        setQuantidadeAprovada(0)
        setQuantidadeReprovada(0)
      }
    }
  }, [isOpen, initialReport, initialMethod])

  // Não renderiza nada quando fechado; todos os hooks acima já foram chamados
  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const reportData: Partial<InspectionReport> = {
      method,
      title: title || `${METHOD_LABELS[method].label}: Inspeção em ${equipmentTag || 'Equipamento'}`,
      equipmentTag: equipmentTag ? equipmentTag.toUpperCase() : 'TAG-PENDENTE',
      unitArea: unitArea || 'Área Industrial',
      inspectorName: inspectorName || 'Inspetor Responsável',
      inspectorSNQC: inspectorSNQC || 'SNQC',
      normProcedure: METHOD_LABELS[method].code,
      acceptanceCriteria: acceptanceCriteria || 'Critério Normativo',
      status,
      findingsCount: findingsCount === '' ? 0 : Number(findingsCount),
      summary: summary || '',
      date: initialReport?.date || new Date().toISOString().split('T')[0],
      technicalData: method === 'PT' ? techPT : method === 'UT' ? techUT : {},
      linhaId,
      quantidadeInspecionada,
      quantidadeAprovada,
      quantidadeReprovada,
    }
    onSave(reportData)
    onClose()
  }

  const methodIcons: Record<ENDMethod, React.ComponentType<{ className?: string }>> = {
    VT: Eye,
    PT: Eye,
    MT: Gauge,
    UT: Gauge,
    RT: ShieldAlert,
    ET: Wand2,
    LT: HardDrive,
    LT_VACUO: HardDrive,
    PAUT: Layers,
    TOFD: Layers,
    CRDR: ScanEye,
    ECA: Wifi,
    EA: Thermometer,
    IRT: Thermometer,
    ACFM: Barcode,
    TFM: Wifi,
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-100">
      <div
        className="bg-white dark:bg-[#1C1E21] text-[#0F172A] dark:text-[#E6E8EA] w-full max-w-[1210px] border border-[#CBD5E1] dark:border-[#34383D] shadow-2xl my-6 overflow-hidden flex flex-col"
        style={{ maxWidth: '1210px', width: '100%', borderRadius: '3px' }}
      >
        <div className="bg-[#0B0F17] dark:bg-[#0B0C0D] text-white px-6 py-4 flex items-center justify-between border-b border-[#1E293B] dark:border-[#34383D]">
          <div className="flex items-center gap-3">
            <span
              className="px-2.5 py-0.5 bg-[#1E293B] dark:bg-[#24272B] text-[#34D399] font-bold text-[11px] uppercase tracking-wider border border-[#334155]/60 dark:border-[#34383D]"
              style={{ borderRadius: '3px' }}
            >
              {initialReport ? 'REVISÃO TÉCNICA' : 'NOVO LAUDO'}
            </span>
            <h2 className="text-sm font-bold tracking-wide uppercase text-slate-100 dark:text-[#E6E8EA]">
              {initialReport ? initialReport.code : 'Registro de Laudo END'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#94A3B8] hover:text-white p-1 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[82vh] space-y-5">
          {/* SEÇÃO 1: Método e Procedimento Qualificado */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-[#0F172A] dark:text-[#E6E8EA] uppercase tracking-wider">
                1. Método e Procedimento Qualificado
              </label>
              <span className="text-[12px] text-[#64748B] dark:text-[#9AA0A6]">
                Norma Base: <strong className="text-[#0284c7] dark:text-[#7CB7FF] font-semibold">{METHOD_LABELS[method].code}</strong>
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {(Object.keys(METHOD_LABELS) as ENDMethod[]).map((m) => {
                const isSelected = method === m
                const Icon = methodIcons[m]
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`p-2.5 border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#0B0F17] dark:bg-[#24272B] text-white border-[#0B0F17] dark:border-[#7CB7FF] shadow-xs'
                        : 'bg-[#F8FAFC] dark:bg-[#121315] text-[#334155] dark:text-[#9AA0A6] border-[#E2E8F0] dark:border-[#34383D] hover:border-[#CBD5E1] dark:hover:border-[#7CB7FF] hover:bg-white dark:hover:bg-[#1C1E21]'
                    }`}
                    style={{ borderRadius: '3px' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">{METHOD_LABELS[m].label}</span>
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-[#34D399]' : 'text-[#94A3B8]'}`} />
                    </div>
                    <span className="text-[10px] leading-tight opacity-75 mt-1 line-clamp-2">
                      {METHOD_LABELS[m].full}
                    </span>
                  </button>
                )}
              )}
            </div>
          </div>

          {/* Dados Cadastrais */}
          <div className="p-4 bg-[#F8FAFC] dark:bg-[#1C1E21] border border-[#E2E8F0] dark:border-[#34383D]" style={{ borderRadius: '3px' }}>
            <span className="block text-xs font-bold text-[#0F172A] dark:text-[#E6E8EA] uppercase tracking-wider mb-3">
              2. Identificação do Ativo e Responsabilidade
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-[11px] font-bold text-[#475569] dark:text-[#9AA0A6] uppercase tracking-wider mb-1">
                  TAG do Equipamento / Spool
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: V-2104 / SP-08 / TQ-40"
                  value={equipmentTag}
                  onChange={(e) => setEquipmentTag(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#121315] border border-[#CBD5E1] dark:border-[#34383D] text-[#0F172A] dark:text-[#E6E8EA] font-bold focus:border-[#0284c7] dark:focus:border-[#7CB7FF] transition-colors"
                  style={{ borderRadius: '3px' }}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#475569] dark:text-[#9AA0A6] uppercase tracking-wider mb-1">
                  Área / Unidade Operacional
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Unidade U-2100 / Tubulações de Processo"
                  value={unitArea}
                  onChange={(e) => setUnitArea(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#121315] border border-[#CBD5E1] dark:border-[#34383D] text-[#0F172A] dark:text-[#E6E8EA] focus:border-[#0284c7] dark:focus:border-[#7CB7FF] transition-colors"
                  style={{ borderRadius: '3px' }}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#475569] dark:text-[#9AA0A6] uppercase tracking-wider mb-1">
                  Título da Inspeção
                </label>
                <input
                  type="text"
                  placeholder="Ex: Ensaio de Solda / Linha LIN-HP-401"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#121315] border border-[#CBD5E1] dark:border-[#34383D] text-[#0F172A] dark:text-[#E6E8EA] focus:border-[#0284c7] dark:focus:border-[#7CB7FF] transition-colors"
                  style={{ borderRadius: '3px' }}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#475569] dark:text-[#9AA0A6] uppercase tracking-wider mb-1">
                  Inspetor Executor
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nome completo do inspetor executor"
                  value={inspectorName}
                  onChange={(e) => setInspectorName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#121315] border border-[#CBD5E1] dark:border-[#34383D] text-[#0F172A] dark:text-[#E6E8EA] focus:border-[#0284c7] dark:focus:border-[#7CB7FF] transition-colors"
                  style={{ borderRadius: '3px' }}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#475569] dark:text-[#9AA0A6] uppercase tracking-wider mb-1">
                  Certificação / Registro SNQC
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: SNQC 14892 (N2-VT/PT/MT)"
                  value={inspectorSNQC}
                  onChange={(e) => setInspectorSNQC(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#121315] border border-[#CBD5E1] dark:border-[#34383D] text-[#0F172A] dark:text-[#E6E8EA] focus:border-[#0284c7] dark:focus:border-[#7CB7FF] transition-colors"
                  style={{ borderRadius: '3px' }}
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-[#475569] dark:text-[#9AA0A6] uppercase tracking-wider mb-1">
                  Critério de Aceitação
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Ex: ASME Sec. VIII Div. 1 Ap. 8 / Petrobras N-1596"
                  value={acceptanceCriteria}
                  onChange={(e) => setAcceptanceCriteria(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-[#121315] border border-[#CBD5E1] dark:border-[#34383D] text-[#0F172A] dark:text-[#E6E8EA] focus:border-[#0284c7] dark:focus:border-[#7CB7FF] transition-colors leading-relaxed resize-y"
                  style={{ borderRadius: '3px' }}
                />
              </div>
            </div>
          </div>

          {/* Parâmetros Técnicos do Método */}
          <div className="p-4 bg-[#F8FAFC] dark:bg-[#1C1E21] border border-[#E2E8F0] dark:border-[#34383D]" style={{ borderRadius: '3px' }}>
            <span className="block text-xs font-bold text-[#0F172A] dark:text-[#E6E8EA] uppercase tracking-wider mb-3">
              3. Parâmetros de Instrumentação ({METHOD_LABELS[method].label})
            </span>

            {method === 'PT' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#475569] dark:text-[#9AA0A6] uppercase tracking-wider mb-1">
                    Lote Penetrante (Tipo II)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Metal-Chek VP-30 (Lote)"
                    value={techPT.penetrantBrand}
                    onChange={(e) => setTechPT({ ...techPT, penetrantBrand: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#121315] border border-[#CBD5E1] dark:border-[#34383D] text-[#0F172A] dark:text-[#E6E8EA]"
                    style={{ borderRadius: '3px' }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#475569] dark:text-[#9AA0A6] uppercase tracking-wider mb-1">
                    Lote Revelador (Forma D)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Metal-Chek D-70 (Lote)"
                    value={techPT.developerBrand}
                    onChange={(e) => setTechPT({ ...techPT, developerBrand: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#121315] border border-[#CBD5E1] dark:border-[#34383D] text-[#0F172A] dark:text-[#E6E8EA]"
                    style={{ borderRadius: '3px' }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#475569] dark:text-[#9AA0A6] uppercase tracking-wider mb-1">
                    Tempos de Penetração / Revelação
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 20 min / 15 min"
                    value={techPT.dwellTime && techPT.developerTime ? `${techPT.dwellTime} / ${techPT.developerTime}` : (techPT.dwellTime || techPT.developerTime || '')}
                    onChange={(e) => {
                      const [d, r] = e.target.value.split('/')
                      setTechPT({ ...techPT, dwellTime: d?.trim() || '', developerTime: r?.trim() || '' })
                    }}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#121315] border border-[#CBD5E1] dark:border-[#34383D] text-[#0F172A] dark:text-[#E6E8EA]"
                    style={{ borderRadius: '3px' }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#475569] dark:text-[#9AA0A6] uppercase tracking-wider mb-1">
                    Intensidade de Luz
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 1250 Lux (Luz Branca Visível)"
                    value={techPT.lightIntensity}
                    onChange={(e) => setTechPT({ ...techPT, lightIntensity: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#121315] border border-[#CBD5E1] dark:border-[#34383D] text-[#0F172A] dark:text-[#E6E8EA]"
                    style={{ borderRadius: '3px' }}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-[#475569] dark:text-[#9AA0A6] uppercase tracking-wider mb-1">
                    Indicações Observadas
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Nenhuma indicação linear relevante detectada"
                    value={techPT.indications}
                    onChange={(e) => setTechPT({ ...techPT, indications: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#121315] border border-[#CBD5E1] dark:border-[#34383D] text-[#0F172A] dark:text-[#E6E8EA]"
                    style={{ borderRadius: '3px' }}
                  />
                </div>
              </div>
            )}

            {method === 'UT' && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-[#475569] dark:text-[#9AA0A6] uppercase tracking-wider mb-1">
                    Instrumento de Medição
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Olympus 38DL Plus (Cal. Válida)"
                    value={techUT.deviceModel}
                    onChange={(e) => setTechUT({ ...techUT, deviceModel: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#121315] border border-[#CBD5E1] dark:border-[#34383D] text-[#0F172A] dark:text-[#E6E8EA]"
                    style={{ borderRadius: '3px' }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#475569] dark:text-[#9AA0A6] uppercase tracking-wider mb-1">
                    Espessura Nominal
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 12.7 mm"
                    value={techUT.nominalThickness}
                    onChange={(e) => setTechUT({ ...techUT, nominalThickness: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#121315] border border-[#CBD5E1] dark:border-[#34383D] text-[#0F172A] dark:text-[#E6E8EA]"
                    style={{ borderRadius: '3px' }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#475569] dark:text-[#9AA0A6] uppercase tracking-wider mb-1">
                    Mínima Encontrada
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 11.8 mm"
                    value={techUT.minFoundThickness}
                    onChange={(e) => setTechUT({ ...techUT, minFoundThickness: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#121315] border border-[#CBD5E1] dark:border-[#34383D] text-[#0F172A] dark:text-[#E6E8EA] font-bold text-[#E11D48] dark:text-[#FF6B6B]"
                    style={{ borderRadius: '3px' }}
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-bold text-[#475569] dark:text-[#9AA0A6] uppercase tracking-wider mb-1">
                    Malha de Pontos &amp; Quadrantes
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 48 pontos inspecionados nos quadrantes A, B, C e D"
                    value={techUT.meshPoints}
                    onChange={(e) => setTechUT({ ...techUT, meshPoints: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#121315] border border-[#CBD5E1] dark:border-[#34383D] text-[#0F172A] dark:text-[#E6E8EA]"
                    style={{ borderRadius: '3px' }}
                  />
                </div>
              </div>
            )}

            {method !== 'PT' && method !== 'UT' && (
              <div className="p-3 bg-white dark:bg-[#121315] text-xs text-[#64748B] dark:text-[#9AA0A6] border border-dashed border-[#CBD5E1] dark:border-[#34383D]" style={{ borderRadius: '3px' }}>
                <p>
                  Parâmetros de <strong>{METHOD_LABELS[method].full}</strong> pré-configurados conforme{' '}
                  <strong className="text-[#0284c7] dark:text-[#7CB7FF]">{METHOD_LABELS[method].code}</strong>.
                </p>
              </div>
            )}
          </div>

          {/* Vínculo de Escopo de Obra */}
          <div className="p-4 bg-[#F8FAFC] dark:bg-[#1C1E21] border border-[#E2E8F0] dark:border-[#34383D]" style={{ borderRadius: '3px' }}>
            <span className="block text-xs font-bold text-[#0F172A] dark:text-[#E6E8EA] uppercase tracking-wider mb-3">
              4. Vínculo com Escopo de Obra
            </span>
            <ObraEscopoVinculo
              linhaId={linhaId}
              quantidadeInspecionada={quantidadeInspecionada}
              quantidadeAprovada={quantidadeAprovada}
              quantidadeReprovada={quantidadeReprovada}
              onChange={({ linhaId, quantidadeInspecionada, quantidadeAprovada, quantidadeReprovada }) => {
                setLinhaId(linhaId)
                setQuantidadeInspecionada(quantidadeInspecionada)
                setQuantidadeAprovada(quantidadeAprovada)
                setQuantidadeReprovada(quantidadeReprovada)
              }}
              siteId={siteId}
            />
          </div>

          {/* Veredito & Parecer Técnico */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-stretch">
            <div className="sm:col-span-2 flex flex-col">
              <label className="block text-xs font-bold text-[#0F172A] dark:text-[#E6E8EA] uppercase tracking-wider mb-1">
                4. Parecer Técnico Conclusivo
              </label>
              <textarea
                required
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Descreva o parecer técnico conclusivo da inspeção de campo, referenciando procedimentos e critérios aplicados..."
                className="w-full flex-1 px-3 py-2 text-xs bg-white dark:bg-[#121315] border border-[#CBD5E1] dark:border-[#34383D] text-[#0F172A] dark:text-[#E6E8EA] focus:border-[#0284c7] dark:focus:border-[#7CB7FF] transition-colors leading-relaxed resize-none"
                style={{ borderRadius: '3px', minHeight: '94px' }}
              />
            </div>

            <div className="flex flex-col justify-between gap-3">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] dark:text-[#E6E8EA] uppercase tracking-wider mb-1">
                  Veredito da Inspeção
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ReportStatus)}
                  className="w-full px-3 py-2 text-xs font-bold bg-white dark:bg-[#121315] border border-[#CBD5E1] dark:border-[#34383D] text-[#0F172A] dark:text-[#E6E8EA] focus:border-[#0284c7] dark:focus:border-[#7CB7FF] transition-colors"
                  style={{ borderRadius: '3px' }}
                >
                  <option value="rascunho">RASCUNHO (CAMPO)</option>
                  <option value="enviado">EM REVISÃO (SUPERVISOR)</option>
                  <option value="aprovado">CONFORME / QUALIFICADO</option>
                  <option value="reprovado">NÃO CONFORME / REPARO</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] dark:text-[#E6E8EA] uppercase tracking-wider mb-1">
                  Descontinuidades Relevantes
                </label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={findingsCount}
                  onChange={(e) => setFindingsCount(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#121315] border border-[#CBD5E1] dark:border-[#34383D] text-[#0F172A] dark:text-[#E6E8EA]"
                  style={{ borderRadius: '3px' }}
                />
              </div>
            </div>
          </div>

          {/* Rodapé do Modal */}
          <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#34383D] flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-[#94A3B8] dark:text-[#9AA0A6]">
              <FileSpreadsheet className="w-4 h-4 text-[#64748B] dark:text-[#7CB7FF]" />
              <span>Auditoria Digital e Registro Rastreável</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] dark:text-[#9AA0A6] hover:text-[#0F172A] dark:hover:text-white border border-[#CBD5E1] dark:border-[#34383D] bg-white dark:bg-[#1C1E21] hover:bg-[#F8FAFC] dark:hover:bg-[#24272B] cursor-pointer transition-colors"
                style={{ borderRadius: '3px' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#0B0F17] dark:bg-[#24272B] hover:bg-[#1E293B] dark:hover:bg-[#34383D] border border-transparent dark:border-[#34383D] cursor-pointer transition-colors shadow-xs"
                style={{ borderRadius: '3px' }}
              >
                <Check className="w-3.5 h-3.5 text-[#34D399]" />
                <span>Registrar Laudo</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
