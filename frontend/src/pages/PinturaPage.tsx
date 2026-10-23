import React, { useState } from 'react'
import { HardHat, ArrowLeft, Printer, Save, CheckCircle2, ShieldCheck, Thermometer } from 'lucide-react'

interface PinturaPageProps {
  onBack: () => void
  tenantName: string
}

export const PinturaPage: React.FC<PinturaPageProps> = ({ onBack, tenantName }) => {
  const [tag, setTag] = useState('Costado Externo do Tanque TQ-04')
  const [airTemp, setAirTemp] = useState('26.0 °C')
  const [steelTemp, setSteelTemp] = useState('29.4 °C')
  const [humidity, setHumidity] = useState('68% (Permitido < 85%)')
  const [dewPoint, setDewPoint] = useState('19.8 °C (Delta > 3°C atendido)')
  const [roughness, setRoughness] = useState('65 a 85 µm (Padrão ISO 8503 G)')
  const [epsNominal, setEpsNominal] = useState('320 µm (Epóxi Alta Espessura + Poliuretano)')
  const [epsMeasured, setEpsMeasured] = useState('345 µm (Média de 30 leituras)')
  const [adherenceTest, setAdherenceTest] = useState('Corte em X (ASTM D3359 Método A) - Grau 4A/5A Conforme')

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
                MODELO PINT-06
              </span>
              <h2 className="text-base font-bold text-[#0F172A] tracking-tight uppercase">
                Pintura Industrial — Psicrometria, EPS &amp; Teste de Aderência
              </h2>
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Inspeção de preparação de superfície, condições ambientais, espessura de película seca e ancoragem.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => alert('Salvo offline!')} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#F8FAFC] text-[#334155] text-xs font-semibold border border-[#CBD5E1] transition-colors cursor-pointer" style={{ borderRadius: '3px' }}>
            <Save className="w-3.5 h-3.5 text-[#64748B]" />
            <span>Salvar Rascunho</span>
          </button>
          <button type="button" onClick={() => alert(`Gerando Relatório de Pintura da ${tenantName}...`)} className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#0B0F17] hover:bg-[#1E293B] text-white text-xs font-bold tracking-wide uppercase transition-colors cursor-pointer shadow-xs" style={{ borderRadius: '3px' }}>
            <Printer className="w-3.5 h-3.5 text-[#34D399]" />
            <span>EMITIR LAUDO PINTURA EM PDF</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white border border-[#E2E8F0] p-5 shadow-2xs" style={{ borderRadius: '3px' }}>
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-3 pb-2 border-b border-[#F1F5F9]">
              Condições Ambientais e Perfil de Rugosidade
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Superfície / Área</label>
                <input type="text" value={tag} onChange={(e) => setTag(e.target.value)} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] font-bold text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Temperatura Aço / Ar</label>
                <input type="text" value={`${steelTemp} / ${airTemp}`} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Umidade Relativa do Ar</label>
                <input type="text" value={humidity} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Ponto de Orvalho (Delta T)</label>
                <input type="text" value={dewPoint} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#059669] font-bold" style={{ borderRadius: '3px' }} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Perfil de Rugosidade</label>
                <input type="text" value={roughness} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Espessura Película Seca (EPS)</label>
                <input type="text" value={epsMeasured} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] font-bold" style={{ borderRadius: '3px' }} />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-[#0B0F17] text-white p-5 shadow-2xs space-y-3" style={{ borderRadius: '3px' }}>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase tracking-wider border-b border-[#1E293B] pb-2">
              <ShieldCheck className="w-4 h-4 text-[#34D399]" />
              <span>Inspetor de Pintura N2</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Esquema de pintura aplicado em conformidade com a norma Petrobras N-13. Aderência aprovada no teste de corte em X com nota 5A.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
