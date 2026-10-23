import React, { useState } from 'react'
import { Activity, ArrowLeft, Printer, Save, CheckCircle2, ShieldCheck } from 'lucide-react'

interface USPageProps {
  onBack: () => void
  tenantName: string
}

export const USPage: React.FC<USPageProps> = ({ onBack, tenantName }) => {
  const [tag, setTag] = useState('J-02 (Solda Longitudinal)')
  const [block, setBlock] = useState('Bloco Padrão V1 / V2 e Bloco Básico ASME')
  const [transducerAngle, setTransducerAngle] = useState('Transdutor Angular 45° e 60° (4.0 MHz)')
  const [dacCurve, setDacCurve] = useState('Curva DAC traçada com furos de 1.5 mm de diâmetro')

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
                MODELO US-05
              </span>
              <h2 className="text-base font-bold text-[#0F172A] tracking-tight uppercase">
                Ultrassom Industrial (US) — Varredura Angular &amp; Curva DAC
              </h2>
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Ensaio volumétrico de integridade de soldas de alta espessura e componentes forjados.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => alert('Salvo offline!')} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#F8FAFC] text-[#334155] text-xs font-semibold border border-[#CBD5E1] transition-colors cursor-pointer" style={{ borderRadius: '3px' }}>
            <Save className="w-3.5 h-3.5 text-[#64748B]" />
            <span>Salvar Rascunho</span>
          </button>
          <button type="button" onClick={() => alert(`Gerando Relatório de Ultrassom da ${tenantName}...`)} className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#0B0F17] hover:bg-[#1E293B] text-white text-xs font-bold tracking-wide uppercase transition-colors cursor-pointer shadow-xs" style={{ borderRadius: '3px' }}>
            <Printer className="w-3.5 h-3.5 text-[#34D399]" />
            <span>EMITIR LAUDO US EM PDF</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white border border-[#E2E8F0] p-5 shadow-2xs" style={{ borderRadius: '3px' }}>
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-3 pb-2 border-b border-[#F1F5F9]">
              Parâmetros Acústicos &amp; Calibração do Feixe
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Componente / Junta</label>
                <input type="text" value={tag} onChange={(e) => setTag(e.target.value)} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] font-bold text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Blocos Padrão</label>
                <input type="text" value={block} onChange={(e) => setBlock(e.target.value)} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Transdutor Angular</label>
                <input type="text" value={transducerAngle} onChange={(e) => setTransducerAngle(e.target.value)} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Sensibilidade / Curva de Referência</label>
                <input type="text" value={dacCurve} onChange={(e) => setDacCurve(e.target.value)} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-[#0B0F17] text-white p-5 shadow-2xs space-y-3" style={{ borderRadius: '3px' }}>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase tracking-wider border-b border-[#1E293B] pb-2">
              <ShieldCheck className="w-4 h-4 text-[#34D399]" />
              <span>Inspetor Ultrassom N2</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Varredura de 100% da junta longitudinal realizada sem ecodivulgadores ou descontinuidades volumétricas superiores ao nível de registro (DAC 50%).
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
