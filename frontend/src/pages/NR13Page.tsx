import React, { useState } from 'react'
import { ShieldAlert, ArrowLeft, Printer, Save, CheckCircle2, ShieldCheck, FileCheck, AlertTriangle } from 'lucide-react'

interface NR13PageProps {
  onBack: () => void
  tenantName: string
}

export const NR13Page: React.FC<NR13PageProps> = ({ onBack, tenantName }) => {
  const [tag, setTag] = useState('TQ-501-A')
  const [fluidType, setFluidType] = useState('Classe A (Hidrogênio / Hidrocarboneto Inflamável)')
  const [riskCategory, setRiskCategory] = useState('Categoria II (P.V entre 2.5 e 100)')
  const [pmta, setPmta] = useState('18.5 kgf/cm² (1.81 MPa)')
  const [hydroPressure, setHydroPressure] = useState('24.1 kgf/cm²')
  const [volume, setVolume] = useState('8.4 m³')
  const [fabricante, setFabricante] = useState('CONFAB Industrial S.A. (Ano 2014)')
  
  // Válvula de Segurança (PSV)
  const [psvTag, setPsvTag] = useState('PSV-501-A')
  const [psvPressure, setPsvPressure] = useState('18.5 kgf/cm²')
  const [psvCert, setPsvCert] = useState('CERT-CAL-PSV-2026/049 (Bancada Aferida)')

  // Engenheiro PH
  const [phEngineer, setPhEngineer] = useState('Eng. Paulo Mendes, M.Sc.')
  const [creaPh, setCreaPh] = useState('CREA-SP 50619283 / CONFEA')
  const [artNumber, setArtNumber] = useState('ART-SP-2026-0819203')
  const [nextInspectionDate, setNextInspectionDate] = useState('21/10/2028 (Prazo 24 meses)')

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Topo do Modelo NR-13 */}
      <div className="bg-white border border-[#E2E8F0] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs" style={{ borderRadius: '3px' }}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] border border-[#CBD5E1] transition-colors cursor-pointer"
            style={{ borderRadius: '3px' }}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[12px] font-bold bg-[#0B0F17] text-white tracking-wider uppercase" style={{ borderRadius: '3px' }}>
                MODELO NR-13
              </span>
              <h2 className="text-[19px] font-bold text-[#0F172A] tracking-tight uppercase">
                Prontuário &amp; Relatório de Inspeção de Vaso de Pressão (NR-13)
              </h2>
            </div>
            <p className="text-[14px] text-[#64748B] mt-0.5">
              Consolidação de integridade mecânica, cálculo de PMTA e parecer técnico do Profissional Habilitado (PH).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => alert('Salvo offline!')}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-[#F8FAFC] text-[#334155] text-[15px] font-semibold border border-[#CBD5E1] transition-colors cursor-pointer"
            style={{ borderRadius: '3px' }}
          >
            <Save className="w-4 h-4 text-[#64748B]" />
            <span>Salvar Rascunho</span>
          </button>
          <button
            type="button"
            onClick={() => alert(`Gerando Relatório Oficial NR-13 com ART da ${tenantName}...`)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0B0F17] hover:bg-[#1E293B] text-white text-[15px] font-bold tracking-wide uppercase transition-colors cursor-pointer shadow-xs"
            style={{ borderRadius: '3px' }}
          >
            <Printer className="w-4 h-4 text-[#34D399]" />
            <span>EMITIR LAUDO NR-13 EM PDF</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {/* Dados do Vaso e Prontuário */}
          <div className="bg-white border border-[#E2E8F0] p-5 shadow-2xs" style={{ borderRadius: '3px' }}>
            <h3 className="text-[15px] font-bold text-[#0F172A] uppercase tracking-wider mb-3 pb-2 border-b border-[#F1F5F9]">
              1. Dados Cadastrais do Vaso de Pressão e Classificação NR-13
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-[13px] font-bold text-[#64748B] uppercase tracking-wider mb-1">TAG do Vaso</label>
                <input type="text" value={tag} onChange={(e) => setTag(e.target.value)} className="w-full px-3 py-2 text-[15px] bg-[#F8FAFC] border border-[#CBD5E1] font-bold text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Categoria NR-13</label>
                <input type="text" value={riskCategory} onChange={(e) => setRiskCategory(e.target.value)} className="w-full px-3 py-2 text-[15px] bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Classe de Fluido</label>
                <input type="text" value={fluidType} onChange={(e) => setFluidType(e.target.value)} className="w-full px-3 py-2 text-[15px] bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#64748B] uppercase tracking-wider mb-1">PMTA Vigente</label>
                <input type="text" value={pmta} onChange={(e) => setPmta(e.target.value)} className="w-full px-3 py-2 text-[15px] bg-[#F8FAFC] border border-[#CBD5E1] font-bold text-[#059669]" style={{ borderRadius: '3px' }} />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Pressão Teste Hidrostático</label>
                <input type="text" value={hydroPressure} onChange={(e) => setHydroPressure(e.target.value)} className="w-full px-3 py-2 text-[15px] bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Volume Interno</label>
                <input type="text" value={volume} onChange={(e) => setVolume(e.target.value)} className="w-full px-3 py-2 text-[15px] bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[13px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Fabricante &amp; Prontuário</label>
                <input type="text" value={fabricante} onChange={(e) => setFabricante(e.target.value)} className="w-full px-3 py-2 text-[15px] bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>
            </div>
          </div>

          {/* Válvula de Segurança e Instrumentação */}
          <div className="bg-white border border-[#E2E8F0] p-5 shadow-2xs" style={{ borderRadius: '3px' }}>
            <h3 className="text-[15px] font-bold text-[#0F172A] uppercase tracking-wider mb-3 pb-2 border-b border-[#F1F5F9]">
              2. Dispositivos de Segurança (PSV) e Estanqueidade
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-[13px] font-bold text-[#64748B] uppercase tracking-wider mb-1">TAG da Válvula PSV</label>
                <input type="text" value={psvTag} onChange={(e) => setPsvTag(e.target.value)} className="w-full px-3 py-2 text-[15px] bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Pressão de Abertura / Ajuste</label>
                <input type="text" value={psvPressure} onChange={(e) => setPsvPressure(e.target.value)} className="w-full px-3 py-2 text-[15px] bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Certificado de Calibração PSV</label>
                <input type="text" value={psvCert} onChange={(e) => setPsvCert(e.target.value)} className="w-full px-3 py-2 text-[15px] bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Parecer do PH e ART */}
        <div className="space-y-5">
          <div className="bg-white border border-[#E2E8F0] p-5 shadow-2xs space-y-3.5" style={{ borderRadius: '3px' }}>
            <h3 className="text-[15px] font-bold text-[#0F172A] uppercase tracking-wider pb-2 border-b border-[#F1F5F9]">
              Profissional Habilitado (PH) &amp; ART
            </h3>
            <div>
              <label className="block text-[13px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Engenheiro Responsável</label>
              <input type="text" value={phEngineer} onChange={(e) => setPhEngineer(e.target.value)} className="w-full px-3 py-2 text-[15px] bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] font-bold" style={{ borderRadius: '3px' }} />
            </div>
            <div>
              <label className="block text-[13px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Registro CREA</label>
              <input type="text" value={creaPh} onChange={(e) => setCreaPh(e.target.value)} className="w-full px-3 py-2 text-[15px] bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]" style={{ borderRadius: '3px' }} />
            </div>
            <div>
              <label className="block text-[13px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Número da ART (CREA)</label>
              <input type="text" value={artNumber} onChange={(e) => setArtNumber(e.target.value)} className="w-full px-3 py-2 text-[15px] bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] font-mono" style={{ borderRadius: '3px' }} />
            </div>
            <div>
              <label className="block text-[13px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Próxima Inspeção Periódica</label>
              <input type="text" value={nextInspectionDate} onChange={(e) => setNextInspectionDate(e.target.value)} className="w-full px-3 py-2 text-[15px] bg-[#ECFDF5] border border-[#A7F3D0] text-[#059669] font-bold" style={{ borderRadius: '3px' }} />
            </div>
          </div>

          <div className="bg-[#0B0F17] text-white p-5 shadow-2xs space-y-3" style={{ borderRadius: '3px' }}>
            <div className="flex items-center gap-2 text-[15px] font-bold text-slate-200 uppercase tracking-wider border-b border-[#1E293B] pb-2">
              <FileCheck className="w-4 h-4 text-[#34D399]" />
              <span>Parecer Conclusivo NR-13</span>
            </div>
            <p className="text-[15px] text-slate-300 leading-relaxed">
              O Vaso de Pressão {tag} foi inspecionado em seus exames interno e externo, encontrando-se em{' '}
              <strong className="text-white">plenas condições de segurança operacional</strong> para trabalhar na PMTA de {pmta}.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
