import React, { useState } from 'react'
import { Wrench, ArrowLeft, Printer, Save, CheckCircle2, ShieldAlert, Camera, ShieldCheck } from 'lucide-react'

interface EVSPageProps {
  onBack: () => void
  tenantName: string
}

export const EVSPage: React.FC<EVSPageProps> = ({ onBack, tenantName }) => {
  const [tag, setTag] = useState('LIN-HP-401')
  const [jointNumber, setJointNumber] = useState('J-04 (Topo a Topo)')
  const [wps, setWps] = useState('EPS-014/2025 (Processo GTAW+SMAW)')
  const [welderSinete, setWelderSinete] = useState('W-082 (Marcos Antunes - Qualificado ASME IX)')
  const [norm, setNorm] = useState('ASME B31.3 Categoria D / Normal Fluid Service')

  const [checklist, setChecklist] = useState([
    { item: 'Mordedura contínua no cordão', maxAllowable: '< 1.0 mm e < 15% espessura', found: '1.4 mm contínua', status: 'Reprovado' },
    { item: 'Porosidade agrupada visível', maxAllowable: 'Nenhuma em soldas de alta pressão', found: '3 poros diâm. 2.0 mm', status: 'Reprovado' },
    { item: 'Reforço excessivo de solda', maxAllowable: 'Max 3.0 mm', found: '2.2 mm', status: 'Aprovado' },
    { item: 'Falta de preenchimento / concavidade', maxAllowable: 'Não admissível', found: 'Isento', status: 'Aprovado' },
    { item: 'Respingo de solda e mordedura de arco', maxAllowable: 'Remoção obrigatória', found: 'Removido mecanicamente', status: 'Aprovado' },
    { item: 'Desalinhamento visual (High-Low)', maxAllowable: 'Max 1.5 mm', found: '0.8 mm', status: 'Aprovado' },
  ])

  const [verdict, setVerdict] = useState<'reprovado' | 'aprovado'>('reprovado')

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Topo do Modelo */}
      <div className="bg-white border border-[#E2E8F0] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs" style={{ borderRadius: '3px' }}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] border border-[#CBD5E1] transition-colors cursor-pointer"
            style={{ borderRadius: '3px' }}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#0B0F17] text-white tracking-wider uppercase" style={{ borderRadius: '3px' }}>
                MODELO EVS-03
              </span>
              <h2 className="text-base font-bold text-[#0F172A] tracking-tight uppercase">
                Inspeção Visual de Solda (EVS) — ASME B31.3 / AWS D1.1
              </h2>
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Auditoria dimensional e descontinuidades superficiais de juntas soldadas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => alert('Salvo offline!')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#F8FAFC] text-[#334155] text-xs font-semibold border border-[#CBD5E1] transition-colors cursor-pointer"
            style={{ borderRadius: '3px' }}
          >
            <Save className="w-3.5 h-3.5 text-[#64748B]" />
            <span>Salvar Rascunho</span>
          </button>
          <button
            type="button"
            onClick={() => alert(`Gerando Relatório EVS da ${tenantName}...`)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#0B0F17] hover:bg-[#1E293B] text-white text-xs font-bold tracking-wide uppercase transition-colors cursor-pointer shadow-xs"
            style={{ borderRadius: '3px' }}
          >
            <Printer className="w-3.5 h-3.5 text-[#34D399]" />
            <span>EMITIR LAUDO EVS EM PDF</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {/* Dados da Junta */}
          <div className="bg-white border border-[#E2E8F0] p-5 shadow-2xs" style={{ borderRadius: '3px' }}>
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-3 pb-2 border-b border-[#F1F5F9]">
              Identificação da Junta Soldada &amp; Procedimento de Soldagem
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Linha / Spool</label>
                <input type="text" value={tag} onChange={(e) => setTag(e.target.value)} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] font-bold text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Número da Junta</label>
                <input type="text" value={jointNumber} onChange={(e) => setJointNumber(e.target.value)} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">EPS / WPS Qualificada</label>
                <input type="text" value={wps} onChange={(e) => setWps(e.target.value)} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Soldador / Sinete</label>
                <input type="text" value={welderSinete} onChange={(e) => setWelderSinete(e.target.value)} className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>
            </div>
          </div>

          {/* Checklist Dimensional */}
          <div className="bg-white border border-[#E2E8F0] p-5 shadow-2xs" style={{ borderRadius: '3px' }}>
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-3 pb-2 border-b border-[#F1F5F9]">
              Critérios Dimensionais e Inspeção Visual de Descontinuidades
            </h3>
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] text-[#64748B] text-[10px] font-bold uppercase tracking-wider border-b border-[#E2E8F0]">
                  <th className="py-2.5 px-3">Parâmetro / Descontinuidade</th>
                  <th className="py-2.5 px-3">Critério Máximo Norma</th>
                  <th className="py-2.5 px-3">Constatado em Campo</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {checklist.map((c, i) => (
                  <tr key={i} className="hover:bg-[#F8FAFC]">
                    <td className="py-2 px-3 font-medium text-[#0F172A]">{c.item}</td>
                    <td className="py-2 px-3 text-[#64748B]">{c.maxAllowable}</td>
                    <td className="py-2 px-3 font-mono font-bold text-[#0F172A]">{c.found}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 text-[10px] font-bold border ${
                        c.status === 'Aprovado' ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]' : 'bg-[#FFF1F2] text-[#E11D48] border-[#FECDD3]'
                      }`} style={{ borderRadius: '3px' }}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Veredito e Ação */}
        <div className="space-y-5">
          <div className="bg-white border border-[#E2E8F0] p-5 shadow-2xs space-y-4" style={{ borderRadius: '3px' }}>
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider pb-2 border-b border-[#F1F5F9]">
              Conclusão da Inspeção
            </h3>
            <div className="p-3 bg-[#FFF1F2] border border-[#FECDD3] text-[#E11D48] text-xs" style={{ borderRadius: '3px' }}>
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <ShieldAlert className="w-4 h-4" />
                <span>NÃO CONFORMIDADE REGISTRADA</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Junta reprovada devido a mordedura de 1.4 mm e poros agrupados na margem do passe de acabamento. Exigido reparo por esmerilhamento/goivagem e ressoldagem.
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                Ação Corretiva Exigida (RNC)
              </label>
              <textarea
                rows={3}
                defaultValue="Emitida RNC Nº 2026-EVS-042. A ressoldagem deverá ser reinspecionada por EVS e Líquido Penetrante após liberação da supervisão de solda."
                className="w-full p-2.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]"
                style={{ borderRadius: '3px' }}
              />
            </div>
          </div>

          <div className="bg-[#0B0F17] text-white p-5 shadow-2xs space-y-3" style={{ borderRadius: '3px' }}>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase tracking-wider border-b border-[#1E293B] pb-2">
              <ShieldCheck className="w-4 h-4 text-[#34D399]" />
              <span>Inspetor Qualificado EVS</span>
            </div>
            <p className="text-xs text-slate-300">
              Roberto Nogueira — Inspetor Visual de Solda N2 (SNQC #11204)
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
