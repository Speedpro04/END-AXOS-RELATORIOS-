import React, { useState } from 'react'
import { Gauge, ArrowLeft, Printer, Save, CheckCircle2, ShieldCheck } from 'lucide-react'

interface PMPageProps {
  onBack: () => void
  tenantName: string
}

export const PMPage: React.FC<PMPageProps> = ({ onBack, tenantName }) => {
  const [tag, setTag] = useState('MN-8802 (Munhão da Caldeira)')
  const [yokeModel, setYokeModel] = useState('Yoke Eletromagnético Magnaflux Y-7 (AC/DC)')
  const [technique, setTechnique] = useState('Via Úmida Fluorescente / Luz Negra UV-A (365 nm)')
  const [fieldTest, setFieldTest] = useState('Padrão Cantilever: Elevação de 4.5 kgf em AC atendida')
  const [norm, setNorm] = useState('Petrobras N-1598 / ASME Sec. VIII Div. 1 Apêndice 6')

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="bg-white border border-[#E2E8F0] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs" style={{ borderRadius: '3px' }}>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] border border-[#CBD5E1] transition-colors cursor-pointer" style={{ borderRadius: '3px' }}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#0B0F17] text-white tracking-wider uppercase" style={{ borderRadius: '3px' }}>
                MODELO PM-04
              </span>
              <h2 className="text-base font-bold text-[#0F172A] tracking-tight uppercase">
                Partícula Magnética (PM) — Ensaio Subsuperficial
              </h2>
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Detecção de trincas e descontinuidades ferromagnéticas por indução de campo magnético.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => alert('Salvo offline!')} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#F8FAFC] text-[#334155] text-xs font-semibold border border-[#CBD5E1] transition-colors cursor-pointer" style={{ borderRadius: '3px' }}>
            <Save className="w-3.5 h-3.5 text-[#64748B]" />
            <span>Salvar Rascunho</span>
          </button>
          <button type="button" onClick={() => alert(`Gerando Relatório PM da ${tenantName}...`)} className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#0B0F17] hover:bg-[#1E293B] text-white text-xs font-bold tracking-wide uppercase transition-colors cursor-pointer shadow-xs" style={{ borderRadius: '3px' }}>
            <Printer className="w-3.5 h-3.5 text-[#34D399]" />
            <span>EMITIR LAUDO PM EM PDF</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white border border-[#E2E8F0] p-5 shadow-2xs" style={{ borderRadius: '3px' }}>
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-3 pb-2 border-b border-[#F1F5F9]">
              Parâmetros de Magnetização &amp; Equipamento Yoke
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Equipamento / Componente</label>
                <input type="text" value={tag} onChange={(e) => setTag(e.target.value)} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] font-bold text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Modelo do Yoke</label>
                <input type="text" value={yokeModel} onChange={(e) => setYokeModel(e.target.value)} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Técnica e Partículas</label>
                <input type="text" value={technique} onChange={(e) => setTechnique(e.target.value)} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Teste de Força de Levantamento</label>
                <input type="text" value={fieldTest} onChange={(e) => setFieldTest(e.target.value)} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-[#0B0F17] text-white p-5 shadow-2xs space-y-3" style={{ borderRadius: '3px' }}>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase tracking-wider border-b border-[#1E293B] pb-2">
              <ShieldCheck className="w-4 h-4 text-[#34D399]" />
              <span>Veredito Técnico PM</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Nenhuma indicação linear relevante encontrada nas regiões soldadas do munhão {tag}. 
              Ensaio finalizado com <strong>APROVAÇÃO</strong> total.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
