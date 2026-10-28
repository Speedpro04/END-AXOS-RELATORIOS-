import React, { useCallback, useMemo, useState } from 'react'
import { ArrowLeft, Printer, Save } from 'lucide-react'
import { buildReportCode } from '../utils/buildReportCode'
import { Croqui } from '../components/laudo/Croqui'
import { DocumentFooter } from '../components/laudo/DocumentFooter'
import { DocumentHeader } from '../components/laudo/DocumentHeader'
import { EvidenceBlock } from '../components/laudo/EvidenceBlock'
import { SignatureCard } from '../components/laudo/SignatureCard'
import { ValidityBadge } from '../components/laudo/ValidityBadge'
import { VerdictBlock } from '../components/laudo/VerdictBlock'
import type { UsTechnicalData, UsVerdict } from '../types/us'

interface USPageProps {
  onBack: () => void
  tenantName: string
  tenant?: {
    tradeName?: string | null
    name?: string | null
    cnpj?: string | null
    addressStreet?: string | null
    addressNumber?: string | null
    addressComplement?: string | null
    addressNeighborhood?: string | null
    addressCity?: string | null
    addressUf?: string | null
    addressCep?: string | null
    phone?: string | null
    email?: string | null
    logoUrl?: string | null
    logoPath?: string | null
    reportPrefix?: string | null
  }
}

const REPORT_METHOD = 'US'
const DRAFT_KEY = 'axos_us_draft'

const freshDraft = (tenantPrefix: string): UsTechnicalData => ({
  contractor: '',
  drawingNumber: '',
  partDescription: '',
  material: '',
  opOrOsNumber: '',
  surfaceCondition: '',
  temperature: 24,
  procedureNumber: '',
  procedureRevision: '',
  referenceNorm: '',
  acceptanceLevel: '',
  examDate: new Date().toISOString().slice(0, 10),
  technique: 'feixe_angular',
  referenceBlock: '',
  couplant: '',
  transducers: [],
  croquiMarks: [],
  discontinuities: [],
  advancedColumnsVisible: false,
  evidence: [],
  observations: '',
  accessLimitations: '',
  verdict: null,
  conditionalRelease: {
    approverName: '',
    approverRole: '',
    approverDate: '',
    reason: '',
  },
  signature: {
    executorName: '',
    level: 'N2',
    certificateNumber: '',
    certifyingBody: '',
    qualificationValidity: '',
    emissionDate: new Date().toISOString().slice(0, 10),
    optionalViews: { responsible: null, contractor: null },
  },
})

export const USPage: React.FC<USPageProps> = ({
  onBack,
  tenantName,
  tenant,
}) => {
  const tenantPrefix = tenant?.reportPrefix ?? 'END'
  const [draft, setDraft] = useState<UsTechnicalData>(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<UsTechnicalData>
        return { ...freshDraft(tenantPrefix), ...parsed }
      }
    } catch {
      // ignore
    }
    return freshDraft(tenantPrefix)
  })

  const saveDraft = useCallback((next: UsTechnicalData) => {
    setDraft(next)
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next))
    } catch {
      // ignore storage errors
    }
  }, [])

  // Calcular código do laudo (provisório: RASCUNHO até sincronizar)
  const now = new Date()
  const reportCode = `RASCUNHO`
  const reportCodePreview = buildReportCode(tenantPrefix, REPORT_METHOD, now.getFullYear(), 1)

  // Veredito
  const [verdict, setVerdict] = useState<UsVerdict | null>(draft.verdict ?? null)
  const [conditionalData, setConditionalData] = useState({
    approverName: '',
    approverRole: '',
    approverDate: '',
    reason: '',
  })

  // Calcular rejeitadas
  const rejectedCount = draft.discontinuities.filter((d) => d.evaluation === 'rejeitada').length
  const hasRejectedAndApproved = rejectedCount > 0 && verdict === 'A'

  // Verificar validade da qualificação
  const qualificationValidity = draft.signature.qualificationValidity
  const isQualificationValid = qualificationValidity ? new Date(qualificationValidity) > now : false

  // Pendências para emissão
  const missing: string[] = []
  if (!draft.contractor) missing.push('Contratante')
  if (!draft.drawingNumber) missing.push('Nº do desenho')
  if (!draft.partDescription) missing.push('Descrição da peça')
  if (!draft.material) missing.push('Material')
  if (!draft.opOrOsNumber) missing.push('Nº da OP ou OS')
  if (!draft.procedureNumber) missing.push('Procedimento')
  if (!draft.referenceNorm) missing.push('Norma de referência')
  if (!draft.acceptanceLevel) missing.push('Nível de aceitação')
  if (!draft.examDate) missing.push('Data do ensaio')
  if (!draft.referenceBlock) missing.push('Bloco de referência')
  if (!draft.couplant) missing.push('Acoplante')
  if (draft.transducers.length === 0) missing.push('Ao menos um transdutor')
  if (!verdict) missing.push('Veredito')
  if (verdict === 'AC' && !conditionalData.reason) missing.push('Responsável e motivo da liberação')
  if (qualificationValidity && !isQualificationValid) missing.push('Qualificação vencida')

  const canEmit = missing.length === 0

  const handleFieldChange = useCallback((key: string, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleNumberChange = useCallback((key: string, value: number) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }, [])

  const addTransducer = useCallback(() => {
    if (draft.transducers.length >= 5) return
    setDraft((prev) => ({
      ...prev,
      transducers: [
        ...prev.transducers,
        {
          id: crypto.randomUUID(),
          identification: '',
          angle: 45,
          frequency: 4,
          dimension: '',
          gp: 0,
          pt: 0,
          gc: 0,
        },
      ],
    }))
  }, [draft.transducers.length])

  const removeTransducer = useCallback((id: string) => {
    setDraft((prev) => ({
      ...prev,
      transducers: prev.transducers.filter((t) => t.id !== id),
    }))
  }, [])

  const updateTransducer = useCallback((id: string, updates: Partial<UsTechnicalData['transducers'][0]>) => {
    setDraft((prev) => ({
      ...prev,
      transducers: prev.transducers.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }))
  }, [])

  const addDiscontinuity = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      discontinuities: [
        ...prev.discontinuities,
        {
          id: crypto.randomUUID(),
          number: prev.discontinuities.length + 1,
          location: '',
          length: 0,
          depth: 0,
          amplitudePercent: 0,
          amplitudeDb: 0,
          transducerId: '',
          observation: '',
        },
      ],
    }))
  }, [draft.discontinuities.length])

  const removeDiscontinuity = useCallback((id: string) => {
    setDraft((prev) => ({
      ...prev,
      discontinuities: prev.discontinuities.filter((d) => d.id !== id),
    }))
  }, [])

  const toggleAdvancedColumns = useCallback(() => {
    setDraft((prev) => ({ ...prev, advancedColumnsVisible: !prev.advancedColumnsVisible }))
  }, [])

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <DocumentHeader
        tenant={{
          tradeName: tenantName,
          name: tenant?.name ?? null,
          cnpj: tenant?.cnpj ?? null,
          addressStreet: tenant?.addressStreet ?? null,
          addressNumber: tenant?.addressNumber ?? null,
          addressComplement: tenant?.addressComplement ?? null,
          addressNeighborhood: tenant?.addressNeighborhood ?? null,
          addressCity: tenant?.addressCity ?? null,
          addressUf: tenant?.addressUf ?? null,
          addressCep: tenant?.addressCep ?? null,
          phone: tenant?.phone ?? null,
          email: tenant?.email ?? null,
          logoUrl: tenant?.logoUrl ?? null,
          logoPath: tenant?.logoPath ?? null,
          reportPrefix: tenant?.reportPrefix ?? null,
        }}
        modelTitle="Ultrassom Industrial (US) — Feixe Angular"
        reportCode={reportCodePreview}
        folio="1 de 1"
        service={{
          clientName: draft.contractor || null,
          siteName: null,
          siteAddress: null,
          contractRef: null,
          workOrderCode: draft.opOrOsNumber || null,
        }}
      />
      <div className="flex items-center justify-between gap-3" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] border border-[#CBD5E1] transition-colors cursor-pointer" style={{ borderRadius: '3px' }}>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => alert('Salvo offline!')} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#F8FAFC] text-[#334155] text-xs font-semibold border border-[#CBD5E1] transition-colors cursor-pointer" style={{ borderRadius: '3px' }}>
            <Save className="w-3.5 h-3.5 text-[#64748B]" />
            <span>Salvar Rascunho</span>
          </button>
          <button
            type="button"
            onClick={() => alert(`Gerando Relatório de Ultrassom da ${tenantName}...`)}
            disabled={!canEmit}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#0B0F17] hover:bg-[#1E293B] text-white text-xs font-bold tracking-wide uppercase transition-colors cursor-pointer shadow-xs" style={{ borderRadius: '3px', opacity: canEmit ? 1 : 0.5 }}
          >
            <Printer className="w-3.5 h-3.5 text-[#34D399]" />
            <span>EMITIR LAUDO US EM PDF</span>
          </button>
        </div>
      </div>

      {/* 1. Peça e ensaio */}
      <div className="bg-white border border-[#E2E8F0] p-5 shadow-2xs" style={{ borderRadius: '3px' }}>
        <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-3 pb-2 border-b border-[#F1F5F9]">
          1. Peça e Ensaio
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Contratante <span className="text-[#c4262e]">*</span></label>
            <input type="text" value={draft.contractor} onChange={(e) => handleFieldChange('contractor', e.target.value)} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] font-bold text-[#0F172A]" style={{ borderRadius: '3px' }} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Nº do Desenho <span className="text-[#c4262e]">*</span></label>
            <input type="text" value={draft.drawingNumber} onChange={(e) => handleFieldChange('drawingNumber', e.target.value)} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Descrição da Peça <span className="text-[#c4262e]">*</span></label>
            <input type="text" value={draft.partDescription} onChange={(e) => handleFieldChange('partDescription', e.target.value)} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Material <span className="text-[#c4262e]">*</span></label>
            <input type="text" value={draft.material} onChange={(e) => handleFieldChange('material', e.target.value)} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Nº da OP ou OS <span className="text-[#c4262e]">*</span></label>
            <input type="text" value={draft.opOrOsNumber} onChange={(e) => handleFieldChange('opOrOsNumber', e.target.value)} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Condição da Superfície</label>
            <input type="text" value={draft.surfaceCondition} onChange={(e) => handleFieldChange('surfaceCondition', e.target.value)} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Temperatura (°C)</label>
            <input type="number" value={draft.temperature} onChange={(e) => handleNumberChange('temperature', parseInt(e.target.value) || 0)} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Procedimento (nº e revisão) <span className="text-[#c4262e]">*</span></label>
            <input type="text" value={draft.procedureNumber} onChange={(e) => handleFieldChange('procedureNumber', e.target.value)} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Norma de Referência <span className="text-[#c4262e]">*</span></label>
            <input type="text" value={draft.referenceNorm} onChange={(e) => handleFieldChange('referenceNorm', e.target.value)} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Nível de Aceitação <span className="text-[#c4262e]">*</span></label>
            <input type="text" value={draft.acceptanceLevel} onChange={(e) => handleFieldChange('acceptanceLevel', e.target.value)} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Data do Ensaio <span className="text-[#c4262e]">*</span></label>
            <input type="date" value={draft.examDate} onChange={(e) => handleFieldChange('examDate', e.target.value)} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Técnica <span className="text-[#c4262e]">*</span></label>
            <select value={draft.technique} onChange={(e) => handleFieldChange('technique', e.target.value as 'feixe_angular' | 'feixe_normal')} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }}>
              <option value="feixe_angular">Feixe Angular</option>
              <option value="feixe_normal">Feixe Normal</option>
              <option disabled>PAUT (em breve)</option>
              <option disabled>TOFD (em breve)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Bloco de Referência <span className="text-[#c4262e]">*</span></label>
            <input type="text" value={draft.referenceBlock} onChange={(e) => handleFieldChange('referenceBlock', e.target.value)} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Acoplante <span className="text-[#c4262e]">*</span></label>
            <input type="text" value={draft.couplant} onChange={(e) => handleFieldChange('couplant', e.target.value)} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
          </div>
        </div>
      </div>

      {/* 2. Transdutores */}
      <div className="bg-white border border-[#E2E8F0] p-5 shadow-2xs" style={{ borderRadius: '3px' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">2. Equipamento e Transdutores</h3>
          <button type="button" onClick={addTransducer} disabled={draft.transducers.length >= 5} className="px-3 py-1.5 text-xs border border-[#CBD5E1] rounded bg-[#F8FAFC] hover:bg-[#F1F5F9] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            {draft.transducers.length >= 5 ? 'Máximo (5)' : 'Adicionar Transdutor'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse" style={{ borderRadius: '3px', overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase">Identificação</th>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase">Ângulo Real (°)</th>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase">Frequência (MHz)</th>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase">Dimensão</th>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase">GP (dB)</th>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase">PT (dB)</th>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase">GC (dB)</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold text-[#64748B] uppercase"></th>
              </tr>
            </thead>
            <tbody>
              {draft.transducers.map((t, i) => (
                <tr key={t.id} className="border-t border-[#E2E8F0]">
                  <td className="px-3 py-2">
                    <input type="text" value={t.identification} onChange={(e) => updateTransducer(t.id, { identification: e.target.value })} className="w-full bg-transparent border-none text-xs text-[#0F172A] focus:ring-0" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={t.angle} onChange={(e) => updateTransducer(t.id, { angle: parseInt(e.target.value) || 0 })} className="w-full bg-transparent border-none text-xs text-[#0F172A] focus:ring-0" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={t.frequency} onChange={(e) => updateTransducer(t.id, { frequency: parseInt(e.target.value) || 0 })} className="w-full bg-transparent border-none text-xs text-[#0F172A] focus:ring-0" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="text" value={t.dimension} onChange={(e) => updateTransducer(t.id, { dimension: e.target.value })} className="w-full bg-transparent border-none text-xs text-[#0F172A] focus:ring-0" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={t.gp} onChange={(e) => updateTransducer(t.id, { gp: parseInt(e.target.value) || 0 })} className="w-full bg-transparent border-none text-xs text-[#0F172A] focus:ring-0" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={t.pt} onChange={(e) => updateTransducer(t.id, { pt: parseInt(e.target.value) || 0 })} className="w-full bg-transparent border-none text-xs text-[#0F172A] focus:ring-0" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={t.gc} onChange={(e) => updateTransducer(t.id, { gc: parseInt(e.target.value) || 0 })} className="w-full bg-transparent border-none text-xs text-[#0F172A] focus:ring-0" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => removeTransducer(t.id)} className="text-xs text-[#c4262e] hover:text-[#991b1b]">Remover</button>
                  </td>
                </tr>
              ))}
              {draft.transducers.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-xs text-[#64748B]">Nenhum transdutor adicionado</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-[#64748B] mt-2">Rótulos GP, PT e GC conforme formulário de referência. Significado a ser confirmado pelo dono do produto.</p>
      </div>

      {/* 3. Croqui */}
      <div className="bg-white border border-[#E2E8F0] p-5 shadow-2xs" style={{ borderRadius: '3px' }}>
        <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-3">3. Croqui da Junta</h3>
        <Croqui marks={draft.croquiMarks} onChange={(marks) => setDraft((prev) => ({ ...prev, croquiMarks: marks }))} />
      </div>

      {/* 4. Descontinuidades */}
      <div className="bg-white border border-[#E2E8F0] p-5 shadow-2xs" style={{ borderRadius: '3px' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">4. Descontinuidades</h3>
          <div className="flex items-center gap-2">
            <button type="button" onClick={addDiscontinuity} className="px-3 py-1.5 text-xs border border-[#CBD5E1] rounded bg-[#F8FAFC] hover:bg-[#F1F5F9] cursor-pointer">
              Registrar Indicação
            </button>
            <label className="flex items-center gap-2 cursor-pointer text-[10px] font-bold text-[#64748B]">
              <input type="checkbox" checked={draft.advancedColumnsVisible} onChange={toggleAdvancedColumns} className="w-4 h-4" />
              Mostrar colunas avançadas
            </label>
          </div>
          <span className="text-xs text-[#64748B]">{draft.discontinuities.length} indicação(ões), {rejectedCount} rejeitada(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse" style={{ borderRadius: '3px', overflow: 'hidden' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th className="px-3 py-2 text-center text-[10px] font-bold text-[#64748B] uppercase">Nº</th>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase">Local</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold text-[#64748B] uppercase">Comp. (mm)</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold text-[#64748B] uppercase">Prof. (mm)</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold text-[#64748B] uppercase">Amplitude (%)</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold text-[#64748B] uppercase">Amplitude (dB)</th>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase">Transdutor</th>
                <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase">Obs.</th>
                {draft.advancedColumnsVisible && (
                  <>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase">Classificação</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase">Avaliação</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase">Ação</th>
                  </>
                )}
                <th className="px-3 py-2 text-right text-[10px] font-bold text-[#64748B] uppercase"></th>
              </tr>
            </thead>
            <tbody>
              {draft.discontinuities.map((d) => (
                <tr key={d.id} className="border-t border-[#E2E8F0]">
                  <td className="px-3 py-2 text-center font-bold text-xs">{d.number}</td>
                  <td className="px-3 py-2">
                    <input type="text" value={d.location} onChange={(e) => { d.location = e.target.value; setDraft({ ...draft }) }} className="w-full bg-transparent border-none text-xs text-[#0F172A] focus:ring-0" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input type="number" value={d.length} onChange={(e) => { d.length = parseFloat(e.target.value) || 0; setDraft({ ...draft }) }} className="w-full bg-transparent border-none text-xs text-[#0F172A] focus:ring-0" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input type="number" value={d.depth} onChange={(e) => { d.depth = parseFloat(e.target.value) || 0; setDraft({ ...draft }) }} className="w-full bg-transparent border-none text-xs text-[#0F172A] focus:ring-0" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input type="number" value={d.amplitudePercent} onChange={(e) => { d.amplitudePercent = parseInt(e.target.value) || 0; setDraft({ ...draft }) }} className="w-full bg-transparent border-none text-xs text-[#0F172A] focus:ring-0" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input type="number" value={d.amplitudeDb} onChange={(e) => { d.amplitudeDb = parseInt(e.target.value) || 0; setDraft({ ...draft }) }} className="w-full bg-transparent border-none text-xs text-[#0F172A] focus:ring-0" />
                  </td>
                  <td className="px-3 py-2">
                    <select value={d.transducerId} onChange={(e) => { d.transducerId = e.target.value; setDraft({ ...draft }) }} className="w-full bg-transparent border-none text-xs text-[#0F172A] focus:ring-0">
                      <option value="">—</option>
                      {draft.transducers.map((t, idx) => (
                        <option key={t.id} value={t.id}>{idx + 1} - {t.identification}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input type="text" value={d.observation} onChange={(e) => { d.observation = e.target.value; setDraft({ ...draft }) }} className="w-full bg-transparent border-none text-xs text-[#0F172A] focus:ring-0" />
                  </td>
                  {draft.advancedColumnsVisible && (
                    <>
                      <td className="px-3 py-2">
                        <select value={d.classification || ''} onChange={(e) => { d.classification = e.target.value as 'planar' | 'volumetrica'; setDraft({ ...draft }) }} className="w-full bg-transparent border-none text-xs text-[#0F172A] focus:ring-0">
                          <option value="">—</option>
                          <option value="planar">Planar</option>
                          <option value="volumetrica">Volumétrica</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select value={d.evaluation || ''} onChange={(e) => { d.evaluation = e.target.value as 'aceita' | 'rejeitada'; setDraft({ ...draft }) }} className="w-full bg-transparent border-none text-xs text-[#0F172A] focus:ring-0">
                          <option value="">—</option>
                          <option value="aceita">Aceita</option>
                          <option value="rejeitada">Rejeitada</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select value={d.action || ''} onChange={(e) => { d.action = e.target.value as 'nenhuma' | 'reparo' | 'reensaio'; setDraft({ ...draft }) }} className="w-full bg-transparent border-none text-xs text-[#0F172A] focus:ring-0">
                          <option value="">—</option>
                          <option value="nenhuma">Nenhuma</option>
                          <option value="reparo">Reparo</option>
                          <option value="reensaio">Reensaio</option>
                        </select>
                      </td>
                    </>
                  )}
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => removeDiscontinuity(d.id)} className="text-xs text-[#c4262e] hover:text-[#991b1b]">×</button>
                  </td>
                </tr>
              ))}
              {draft.discontinuities.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-3 py-4 text-center text-xs text-[#64748B]">Nenhuma indicação registrada</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Evidências */}
      <EvidenceBlock
        evidence={draft.evidence}
        onAdd={(item) => setDraft((prev) => ({ ...prev, evidence: [...prev.evidence, item] }))}
        onRemove={(id) => setDraft((prev) => ({ ...prev, evidence: prev.evidence.filter((e) => e.id !== id) }))}
        onCaptionChange={(id, caption) => setDraft((prev) => ({ ...prev, evidence: prev.evidence.map((e) => e.id === id ? { ...e, caption } : e) }))}
      />

      {/* 6. Conclusão */}
      <div className="bg-white border border-[#E2E8F0] p-5 shadow-2xs" style={{ borderRadius: '3px' }}>
        <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-3">6. Conclusão</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Observações e Limitações de Acesso</label>
            <textarea value={draft.accessLimitations} onChange={(e) => handleFieldChange('accessLimitations', e.target.value)} rows={3} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px', resize: 'vertical' }} />
          </div>
        </div>

        <VerdictBlock
          verdict={verdict}
          onChange={(v) => {
            setVerdict(v)
            setDraft((prev) => ({ ...prev, verdict: v }))
          }}
          conditionalData={conditionalData}
          onConditionalChange={(key, value) => {
            setConditionalData((prev) => ({ ...prev, [key]: value }))
            setDraft((prev) => ({
              ...prev,
              conditionalRelease: { ...prev.conditionalRelease, [key]: value },
            }))
          }}
          hasRejectedIndication={rejectedCount > 0}
        />

        {rejectedCount > 0 && verdict === 'A' && (
          <div className="mt-3 p-3 rounded bg-[#fef2f2] border border-[#fca5a5]" style={{ fontSize: '12px', fontWeight: 600, color: '#991b1b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ⚠️ Há indicação rejeitada e o veredito está como Aprovado. Revise antes de emitir.
          </div>
        )}

        {verdict === 'AC' && (
          <div className="mt-3 p-3 rounded bg-[#f8fafc] border border-[#E2E8F0]">
            <h4 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Liberação Condicional</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Responsável pela Aprovação</label>
                <input type="text" value={conditionalData.approverName} onChange={(e) => { setConditionalData((prev) => ({ ...prev, approverName: e.target.value })); setDraft((prev) => ({ ...prev, conditionalRelease: { ...prev.conditionalRelease, approverName: e.target.value } })) }} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Cargo</label>
                <input type="text" value={conditionalData.approverRole} onChange={(e) => { setConditionalData((prev) => ({ ...prev, approverRole: e.target.value })); setDraft((prev) => ({ ...prev, conditionalRelease: { ...prev.conditionalRelease, approverRole: e.target.value } })) }} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Data</label>
                <input type="date" value={conditionalData.approverDate} onChange={(e) => { setConditionalData((prev) => ({ ...prev, approverDate: e.target.value })); setDraft((prev) => ({ ...prev, conditionalRelease: { ...prev.conditionalRelease, approverDate: e.target.value } })) }} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Motivo (obrigatório)</label>
                <input type="text" value={conditionalData.reason} onChange={(e) => { setConditionalData((prev) => ({ ...prev, reason: e.target.value })); setDraft((prev) => ({ ...prev, conditionalRelease: { ...prev.conditionalRelease, reason: e.target.value } })) }} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>
            </div>
          </div>
        )}

        {/* Pendências para emissão */}
        <div className="mt-4 p-3 rounded border" style={{ background: canEmit ? '#dcfce7' : '#fef2f2', borderColor: canEmit ? '#86efac' : '#fca5a5' }}>
          <div className="flex items-center gap-2 mb-1">
            <span style={{ fontWeight: 600, fontSize: '11px', color: canEmit ? '#166534' : '#991b1b' }}>
              {canEmit ? 'Pronto para emitir' : `Pendências (${missing.length})`}
            </span>
          </div>
          {canEmit ? (
            <p className="text-[11px] text-[#166534]">Todos os campos obrigatórios preenchidos.</p>
          ) : (
            <p className="text-[11px] text-[#991b1b]">{missing.slice(0, 5).join(', ')}{missing.length > 5 ? '…' : ''}</p>
          )}
        </div>
      </div>

      {/* 7. Assinatura */}
      <div className="bg-white border border-[#E2E8F0] p-5 shadow-2xs" style={{ borderRadius: '3px' }}>
        <SignatureCard
          signature={draft.signature}
          onChange={(key, value) => setDraft((prev) => ({ ...prev, signature: { ...prev.signature, [key]: value } }))}
        />
        <div className="mt-3 p-3 rounded bg-[#f8fafc] border border-[#E2E8F0]" style={{ fontSize: '11px', color: '#64748b', textAlign: 'center' }}>
          Espaço reservado para hash e QR de verificação pública
        </div>
        <ValidityBadge qualificationValidity={draft.signature.qualificationValidity} onBlockEmission={!canEmit} />
      </div>

      <DocumentFooter
        page={1}
        totalPages={1}
        hashFragment={reportCodePreview.replace(/[^A-Z0-9]/gi, '')}
      />
    </div>
  )
}
