import React, { useState, useEffect } from 'react'
import { ArrowLeft, Save, FileText } from 'lucide-react'
import { METHOD_LABELS, type InspectionReport, type ENDMethod } from '../types/inspection'
import { buildReportCode } from '../utils/buildReportCode'
import { useAuth } from '../contexts/AuthContext'

const METHOD: ENDMethod = 'TFM'

interface LaudoPageProps {
  onBack: () => void
  onSave: (report: Partial<InspectionReport>) => Promise<void>
  tenant: { tradeName?: string | null; reportPrefix?: string | null; logoPath?: string | null }
  tenantName: string | null
}

export const TFMPage: React.FC<LaudoPageProps> = ({ onBack, onSave, tenant, tenantName }) => {
  const { user, profile } = useAuth()
  const [equipmentTag, setEquipmentTag] = useState('')
  const [title, setTitle] = useState('')
  const [unitArea, setUnitArea] = useState('')
  const [inspectorName, setInspectorName] = useState('')
  const [inspectorSNQC, setInspectorSNQC] = useState('')
  const [normProcedure, setNormProcedure] = useState(METHOD_LABELS[METHOD].code)
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('')
  const [status, setStatus] = useState<'rascunho' | 'enviado' | 'aprovado' | 'reprovado'>('rascunho')
  const [findingsCount, setFindingsCount] = useState('')
  const [summary, setSummary] = useState('')
  const [saving, setSaving] = useState(false)

  // Parâmetros específicos do VT
  const [modalidade, setModalidade] = useState('direta') // direta | remota
  const [iluminacao, setIluminacao] = useState('')
  const [distancia, setDistancia] = useState('')
  const [angulo, setAngulo] = useState('')
  const [instrumentos, setInstrumentos] = useState('')
  const [checklist, setChecklist] = useState('')

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const report: Partial<InspectionReport> = {
        method: METHOD,
        title: title || `${METHOD_LABELS[METHOD].label}: Inspeção em ${equipmentTag || 'Equipamento'}`,
        equipmentTag: equipmentTag ? equipmentTag.toUpperCase() : 'TAG-PENDENTE',
        unitArea: unitArea || 'Área Industrial',
        inspectorName: inspectorName || 'Inspetor Responsável',
        inspectorSNQC: inspectorSNQC || 'SNQC',
        normProcedure: normProcedure || METHOD_LABELS[METHOD].code,
        acceptanceCriteria: acceptanceCriteria || 'Critério Normativo',
        status,
        findingsCount: findingsCount === '' ? 0 : Number(findingsCount),
        summary: summary || '',
        date: new Date().toISOString().split('T')[0],
        technicalData: {
          metodo: 'Visual',
          modalidade,
          iluminacao,
          distancia,
          angulo,
          instrumentos,
          checklist,
        },
      }
      await onSave(report)
      onBack()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 32px', minHeight: 'calc(100vh - 200px)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '5px', border: '1px solid var(--border)',
            background: 'var(--bg-surface)', color: 'var(--text-primary)',
            fontFamily: 'Archivo, system-ui, sans-serif', fontSize: '14px', fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={16} strokeWidth={1.75} /> Voltar ao Catálogo
        </button>
        <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-surface-alt)', padding: '2px 8px', borderRadius: '5px' }}>
          {METHOD_LABELS[METHOD].label}
        </span>
      </div>

      <h1 style={{ fontSize: '22px', fontWeight: 600, marginBottom: '24px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
        Novo Laudo — {METHOD_LABELS[METHOD].full}
      </h1>

      <form onSubmit={handleSave} className="laudo-grid">
        {/* Coluna esquerda: Identificação + Parâmetros Técnicos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              1. Identificação do Ativo
            </h2>
            <div className="campos-2">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>TAG do Equipamento</label>
                <input type="text" required placeholder="Ex: V-2104 / SP-08" value={equipmentTag} onChange={(e) => setEquipmentTag(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'Archivo, sans-serif', fontSize: '14px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Título da Inspeção</label>
                <input type="text" placeholder="Ex: Ensaio Visual de Junta de Solda" value={title} onChange={(e) => setTitle(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'Archivo, sans-serif', fontSize: '14px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Área / Unidade</label>
                <input type="text" required placeholder="Ex: Unidade U-2100" value={unitArea} onChange={(e) => setUnitArea(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'Archivo, sans-serif', fontSize: '14px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Norma / Procedimento</label>
                <input type="text" value={normProcedure} onChange={(e) => setNormProcedure(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'Archivo, sans-serif', fontSize: '14px' }} />
              </div>
            </div>
          </section>

          <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              2. Parâmetros Técnicos — {METHOD_LABELS[METHOD].label}
            </h2>
            <div className="campos-2">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Modalidade</label>
                <select value={modalidade} onChange={(e) => setModalidade(e.target.value as 'direta' | 'remota')}
                  style={{ padding: '8px 10px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'Archivo, sans-serif', fontSize: '14px' }}>
                  <option value="direta">Direta</option>
                  <option value="remota">Remota (Boroscópio / Drone)</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Iluminação (lux)</label>
                <input type="text" placeholder="Ex: 500 lux" value={iluminacao} onChange={(e) => setIluminacao(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'Archivo, sans-serif', fontSize: '14px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Distância / Ângulo</label>
                <input type="text" placeholder="Ex: 300 mm / 90°" value={distancia} onChange={(e) => setDistancia(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'Archivo, sans-serif', fontSize: '14px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Instrumentos Auxiliares</label>
                <input type="text" placeholder="Ex: Lupa, espelho, calibre" value={instrumentos} onChange={(e) => setInstrumentos(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'Archivo, sans-serif', fontSize: '14px' }} />
              </div>
              <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Checklist de Itens Verificados</label>
                <textarea rows={3} placeholder="Reforço, mordedura, desalinhamento, trinca superficial, respingos, corrosão, deformação..." value={checklist} onChange={(e) => setChecklist(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'Archivo, sans-serif', fontSize: '14px', resize: 'vertical' }} />
              </div>
            </div>
          </section>
        </div>

        {/* Coluna direita: Responsável + Veredito + Ações */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              3. Responsável Técnico
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Inspetor Executor</label>
                <input type="text" required placeholder="Nome completo" value={inspectorName} onChange={(e) => setInspectorName(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'Archivo, sans-serif', fontSize: '14px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Registro SNQC</label>
                <input type="text" required placeholder="Ex: SNQC 14892 (N2-TFM)" value={inspectorSNQC} onChange={(e) => setInspectorSNQC(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'Archivo, sans-serif', fontSize: '14px' }} />
              </div>
            </div>
          </section>

          <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              4. Veredito & Parecer
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Veredito</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as any)}
                  style={{ padding: '8px 10px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'Archivo, sans-serif', fontSize: '14px' }}>
                  <option value="rascunho">Rascunho (Campo)</option>
                  <option value="enviado">Em Revisão (Supervisor)</option>
                  <option value="aprovado">Conforme / Qualificado</option>
                  <option value="reprovado">Não Conforme / Reparo</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Descontinuidades</label>
                <input type="number" min={0} placeholder="0" value={findingsCount} onChange={(e) => setFindingsCount(String(e.target.value === "" ? "" : parseInt(e.target.value) || 0))}
                  style={{ padding: '8px 10px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'Archivo, sans-serif', fontSize: '14px' }} />
              </div>
              <div style={{ gridColumn: 'span 1', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Parecer Técnico</label>
                <textarea rows={4} placeholder="Descreva o parecer técnico conclusivo..." value={summary} onChange={(e) => setSummary(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'Archivo, sans-serif', fontSize: '14px', resize: 'vertical' }} />
              </div>
            </div>
          </section>

          <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'flex-end' }}>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onBack}
                style={{
                  padding: '10px 20px', borderRadius: '5px', border: '1px solid var(--border)',
                  background: 'var(--bg-base)', color: 'var(--text-primary)',
                  fontFamily: 'Archivo, system-ui, sans-serif', fontSize: '14px', fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '10px 24px', borderRadius: '5px', border: 'none',
                  background: 'var(--card-met-azul)', color: 'var(--card-met-azul-texto)',
                  fontFamily: 'Archivo, system-ui, sans-serif', fontSize: '14px', fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Salvando...' : 'Registrar Laudo'}
              </button>
            </div>
          </section>
        </div>
      </form>
    </div>
  )
}
