import React, { useState } from 'react'
import { X, Check, ShieldAlert, FileSpreadsheet, Eye, Gauge, Layers, Wrench, HardHat } from 'lucide-react'
import { METHOD_LABELS, type InspectionReport, type NDTMethod, type ReportStatus } from '../types/inspection'

interface InspectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (report: Partial<InspectionReport>) => void
  initialReport?: InspectionReport | null
}

export const InspectionModal: React.FC<InspectionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialReport,
}) => {
  const [method, setMethod] = useState<NDTMethod>(initialReport?.method || 'LP')
  const [equipmentTag, setEquipmentTag] = useState(initialReport?.equipmentTag || '')
  const [title, setTitle] = useState(initialReport?.title || '')
  const [unitArea, setUnitArea] = useState(initialReport?.unitArea || 'Unidade U-2100 / Tubulações de Processo')
  const [inspectorName, setInspectorName] = useState(initialReport?.inspectorName || 'Carlos Eduardo Silva')
  const [inspectorSNQC, setInspectorSNQC] = useState(initialReport?.inspectorSNQC || 'SNQC 14892 (N2-LP/PM/EVS)')
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(
    initialReport?.acceptanceCriteria || 'ASME Sec. VIII Div. 1 Ap. 8 / Petrobras N-1596'
  )
  const [status, setStatus] = useState<ReportStatus>(initialReport?.status || 'rascunho')
  const [findingsCount, setFindingsCount] = useState<number>(initialReport?.findingsCount || 0)
  const [summary, setSummary] = useState(
    initialReport?.summary ||
      'Inspeção executada conforme procedimento qualificado. Não foram detectadas descontinuidades inaceitáveis.'
  )

  const [techLP, setTechLP] = useState({
    penetrantBrand: 'Metal-Chek VP-30 (Lote 24K819)',
    developerBrand: 'Metal-Chek D-70 (Lote 24J102)',
    cleanerBrand: 'Metal-Chek E-59',
    dwellTime: '20 min',
    developerTime: '15 min',
    lightIntensity: '1250 Lux (Luz Branca Visível)',
    surfaceTemp: '28°C',
    indications: 'Nenhuma indicação linear relevante detectada.',
  })

  const [techME, setTechME] = useState({
    deviceModel: 'Olympus 38DL Plus (Cal. Válida)',
    transducerType: 'D790-SM (5 MHz)',
    couplant: 'Glicerina industrial',
    nominalThickness: '12.7 mm',
    minFoundThickness: '11.8 mm',
    calculatedCorrosion: '0.9 mm',
    allowableMinThickness: '9.2 mm',
    meshPoints: '48 pontos inspecionados nos quadrantes A, B, C e D',
  })

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const reportData: Partial<InspectionReport> = {
      method,
      title: title || `${METHOD_LABELS[method].label}: Inspeção em ${equipmentTag || 'Equipamento'}`,
      equipmentTag: equipmentTag.toUpperCase(),
      unitArea,
      inspectorName,
      inspectorSNQC,
      normProcedure: METHOD_LABELS[method].code,
      acceptanceCriteria,
      status,
      findingsCount: Number(findingsCount),
      summary,
      date: initialReport?.date || new Date().toISOString().split('T')[0],
      technicalData: method === 'LP' ? techLP : method === 'ME' ? techME : {},
    }
    onSave(reportData)
    onClose()
  }

  const methodIcons: Record<NDTMethod, React.ComponentType<{ className?: string }>> = {
    LP: Eye,
    PM: Gauge,
    EVS: Wrench,
    ME: Layers,
    US: Gauge,
    PINTURA: HardHat,
    NR13_VASO: ShieldAlert,
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-100">
      <div
        className="bg-white dark:bg-[#1C1E21] text-[#0F172A] dark:text-[#E6E8EA] w-full max-w-[1210px] border border-[#CBD5E1] dark:border-[#34383D] shadow-2xl my-6 overflow-hidden flex flex-col"
        style={{ maxWidth: '1210px', width: '100%', borderRadius: '3px' }}
      >
        {/* Cabeçalho do Modal no padrão Suíço */}
        <div className="bg-[#0B0F17] dark:bg-[#0B0C0D] text-white px-6 py-4 flex items-center justify-between border-b border-[#1E293B] dark:border-[#34383D]">
          <div className="flex items-center gap-3">
            <span
              className="px-2.5 py-0.5 bg-[#1E293B] dark:bg-[#24272B] text-[#34D399] font-bold text-[11px] uppercase tracking-wider border border-[#334155]/60 dark:border-[#34383D]"
              style={{ borderRadius: '3px' }}
            >
              {initialReport ? 'REVISÃO TÉCNICA' : 'NOVO LAUDO'}
            </span>
            <h2 className="text-sm font-bold tracking-wide uppercase text-slate-100 dark:text-[#E6E8EA]">
              {initialReport ? initialReport.code : 'Registro de Ensaio Não Destrutivo & NR-13'}
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
          
          {/* Seletor de Método NDT */}
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
              {(Object.keys(METHOD_LABELS) as NDTMethod[]).map((m) => {
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
                )
              })}
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

            {method === 'LP' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[#475569] dark:text-[#9AA0A6] uppercase tracking-wider mb-1">
                    Lote Penetrante (Tipo II)
                  </label>
                  <input
                    type="text"
                    value={techLP.penetrantBrand}
                    onChange={(e) => setTechLP({ ...techLP, penetrantBrand: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#121315] border border-[#CBD5E1] dark:border-[#34383D] text-[#0F172A] dark:text-[#E6E8EA]"
                    style={{ borderRadius: '3px' }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#475569] dark:text-[#9AA0A6] uppercase tracking-wider mb-1">
                    Lote Revelador (Forma d)
                  </label>
                  <input
                    type="text"
                    value={techLP.developerBrand}
                    onChange={(e) => setTechLP({ ...techLP, developerBrand: e.target.value })}
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
                    value={`${techLP.dwellTime} / ${techLP.developerTime}`}
                    onChange={(e) => {
                      const [d, r] = e.target.value.split('/')
                      setTechLP({ ...techLP, dwellTime: d?.trim() || '20 min', developerTime: r?.trim() || '15 min' })
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
                    value={techLP.lightIntensity}
                    onChange={(e) => setTechLP({ ...techLP, lightIntensity: e.target.value })}
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
                    value={techLP.indications}
                    onChange={(e) => setTechLP({ ...techLP, indications: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#121315] border border-[#CBD5E1] dark:border-[#34383D] text-[#0F172A] dark:text-[#E6E8EA]"
                    style={{ borderRadius: '3px' }}
                  />
                </div>
              </div>
            )}

            {method === 'ME' && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-[#475569] dark:text-[#9AA0A6] uppercase tracking-wider mb-1">
                    Instrumento de Medição
                  </label>
                  <input
                    type="text"
                    value={techME.deviceModel}
                    onChange={(e) => setTechME({ ...techME, deviceModel: e.target.value })}
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
                    value={techME.nominalThickness}
                    onChange={(e) => setTechME({ ...techME, nominalThickness: e.target.value })}
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
                    value={techME.minFoundThickness}
                    onChange={(e) => setTechME({ ...techME, minFoundThickness: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#121315] border border-[#CBD5E1] dark:border-[#34383D] text-[#0F172A] dark:text-[#E6E8EA] font-bold text-[#E11D48] dark:text-[#FF6B6B]"
                    style={{ borderRadius: '3px' }}
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-bold text-[#475569] dark:text-[#9AA0A6] uppercase tracking-wider mb-1">
                    Malha de Pontos & Quadrantes
                  </label>
                  <input
                    type="text"
                    value={techME.meshPoints}
                    onChange={(e) => setTechME({ ...techME, meshPoints: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-[#121315] border border-[#CBD5E1] dark:border-[#34383D] text-[#0F172A] dark:text-[#E6E8EA]"
                    style={{ borderRadius: '3px' }}
                  />
                </div>
              </div>
            )}

            {method !== 'LP' && method !== 'ME' && (
              <div className="p-3 bg-white dark:bg-[#121315] text-xs text-[#64748B] dark:text-[#9AA0A6] border border-dashed border-[#CBD5E1] dark:border-[#34383D]" style={{ borderRadius: '3px' }}>
                <p>
                  Parâmetros de <strong>{METHOD_LABELS[method].full}</strong> pré-configurados conforme{' '}
                  <strong className="text-[#0284c7] dark:text-[#7CB7FF]">{METHOD_LABELS[method].code}</strong>.
                </p>
              </div>
            )}
          </div>

          {/* Veredito */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[#0F172A] dark:text-[#E6E8EA] uppercase tracking-wider mb-1">
                4. Parecer Técnico Conclusivo
              </label>
              <textarea
                rows={3}
                required
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-[#121315] border border-[#CBD5E1] dark:border-[#34383D] text-[#0F172A] dark:text-[#E6E8EA] focus:border-[#0284c7] dark:focus:border-[#7CB7FF] transition-colors leading-relaxed"
                style={{ borderRadius: '3px' }}
              />
            </div>

            <div className="space-y-3">
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
                  value={findingsCount}
                  onChange={(e) => setFindingsCount(parseInt(e.target.value) || 0)}
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
