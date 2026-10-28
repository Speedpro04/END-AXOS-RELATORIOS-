import React, { useState } from 'react'
import { Eye, CheckCircle2, AlertTriangle, ArrowLeft, Printer, Save, Plus, Trash2, Camera, ShieldCheck, X, FileText, Download } from 'lucide-react'
import type { TenantProfile } from '../types/tenant'
import { buildReportCode } from '../utils/buildReportCode'

interface LPPageProps {
  onBack: () => void
  tenantName?: string
  tenant?: TenantProfile
}

export const LPPage: React.FC<LPPageProps> = ({ onBack, tenantName = 'Empresa Contratante', tenant }) => {
  const [tag, setTag] = useState('SP-2101-J01')
  const [isometric, setIsometric] = useState('ISO-RPBC-U2100-FOLHA-04')
  const [material, setMaterial] = useState('Aço Carbono ASTM A-106 Gr. B (DN 6" Sch 40)')
  const [surfaceState, setSurfaceState] = useState('Escovada mecanicamente / Isenta de carepa e óleo')
  const [procedureCode, setProcedureCode] = useState('PR-END-LP-002 Rev. 04')
  const [acceptanceNorm, setAcceptanceNorm] = useState('ASME Sec. VIII Div. 1 - Apêndice 8')
  
  // Fotos de Evidências em Campo
  const [photos, setPhotos] = useState<Array<{ id: string; url: string; caption: string }>>([
    {
      id: 'photo-1',
      url: '/logo-seal.jpg',
      caption: 'Inspeção da junta com penetrante VP-30 e revelador D-70',
    }
  ])
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false)

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotos((prev) => [
          ...prev,
          {
            id: `photo-${Date.now()}`,
            url: reader.result as string,
            caption: `Evidência fotográfica - ${tag} (${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`,
          }
        ])
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemovePhoto = (id: string) => {
    setPhotos(photos.filter(p => p.id !== id))
  }
  
  // Consumíveis
  const [consumables, setConsumables] = useState({
    penetrantBrand: 'Metal-Chek VP-30 (Tipo II Método A/C)',
    penetrantBatch: '24K819 (Val: 11/2027)',
    cleanerBrand: 'Metal-Chek E-59',
    cleanerBatch: '24J102 (Val: 09/2027)',
    developerBrand: 'Metal-Chek D-70 (Forma d - Não aquoso)',
    developerBatch: '24L004 (Val: 12/2027)',
    dwellTime: '20 minutos',
    devTime: '15 minutos',
    lightLux: '1.250 Lux (Luz Branca Visível calibrada)',
    surfaceTemp: '28.5 °C (Faixa permissível: 10°C a 52°C)',
  })

  // Indicações
  const [indications, setIndications] = useState([
    { id: 1, loc: 'Solda circunferencial 12h às 3h', type: 'Sem indicações', length: '0 mm', result: 'Aprovado' },
    { id: 2, loc: 'Solda circunferencial 3h às 6h', type: 'Sem indicações', length: '0 mm', result: 'Aprovado' },
    { id: 3, loc: 'Solda circunferencial 6h às 9h', type: 'Indicação pontual isolada', length: '0.8 mm', result: 'Aprovado' },
    { id: 4, loc: 'Solda circunferencial 9h às 12h', type: 'Sem indicações', length: '0 mm', result: 'Aprovado' },
  ])

  const [verdict, setVerdict] = useState<'aprovado' | 'reprovado' | 'rascunho'>('aprovado')
  const [notes, setNotes] = useState(
    'Ensaio por Líquido Penetrante executado 100% no cordão de solda e Zona Termicamente Afetada (ZTA). A indicação pontual de 0.8 mm é arredondada e menor que o limite máximo admissível de 1.5 mm pela norma ASME Sec. VIII Div. 1 Ap. 8. Junta qualificada e APROVADA.'
  )

  const handleAddIndication = () => {
    setIndications([
      ...indications,
      { id: Date.now(), loc: 'Nova região / ZTA', type: 'Linear / Redonda', length: '0.0 mm', result: 'Aprovado' }
    ])
  }

  const handleRemoveIndication = (id: number) => {
    setIndications(indications.filter((i) => i.id !== id))
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      
      {/* Barra de Navegação e Ações Rápidas do Modelo */}
      <div className="bg-white border border-[#E2E8F0] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs" style={{ borderRadius: '3px' }}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] border border-[#CBD5E1] transition-colors cursor-pointer"
            style={{ borderRadius: '3px' }}
            title="Voltar ao Catálogo de Modelos"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#0B0F17] text-white tracking-wider uppercase" style={{ borderRadius: '3px' }}>
                MODELO LP-01
              </span>
              <h2 className="text-base font-bold text-[#0F172A] tracking-tight uppercase">
                Líquido Penetrante (LP) — Laudo Técnico Conclusivo
              </h2>
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Formulário oficial de ensaio não destrutivo superficial conforme ASME V Art. 6 e Petrobras N-1596.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => alert('Laudo salvo no buffer offline (IndexedDB)!')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#F8FAFC] text-[#334155] text-xs font-semibold border border-[#CBD5E1] transition-colors cursor-pointer"
            style={{ borderRadius: '3px' }}
          >
            <Save className="w-3.5 h-3.5 text-[#64748B]" />
            <span>Salvar Rascunho</span>
          </button>
          <button
            type="button"
            onClick={() => setIsPdfPreviewOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#0B0F17] hover:bg-[#1E293B] text-white text-xs font-bold tracking-wide uppercase transition-colors cursor-pointer shadow-xs"
            style={{ borderRadius: '3px' }}
          >
            <Printer className="w-3.5 h-3.5 text-[#34D399]" />
            <span>EMITIR LAUDO EM PDF</span>
          </button>
        </div>
      </div>

      {/* Grid Principal do Formulário Técnico de Alta Precisão */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Coluna da Esquerda (2 colunas em telas grandes): Dados Técnicos e Medições */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* Seção 1: Dados do Ativo & Procedimento */}
          <div className="bg-white border border-[#E2E8F0] p-5 shadow-2xs" style={{ borderRadius: '3px' }}>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#F1F5F9]">
              <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 bg-[#0B0F17]" style={{ borderRadius: '1px' }}></span>
                1. Identificação do Componente e Normas
              </h3>
              <span className="text-[11px] text-[#94A3B8]">ENSAIO DE CAMPO</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                  TAG do Equipamento / Spool
                </label>
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] font-bold text-[#0F172A] focus:bg-white focus:border-[#0F172A]"
                  style={{ borderRadius: '3px' }}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                  Isométrico / Desenho de Referência
                </label>
                <input
                  type="text"
                  value={isometric}
                  onChange={(e) => setIsometric(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] focus:bg-white focus:border-[#0F172A]"
                  style={{ borderRadius: '3px' }}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                  Material Base &amp; Dimensional
                </label>
                <input
                  type="text"
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] focus:bg-white focus:border-[#0F172A]"
                  style={{ borderRadius: '3px' }}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                  Condição da Superfície Inspecionada
                </label>
                <input
                  type="text"
                  value={surfaceState}
                  onChange={(e) => setSurfaceState(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] focus:bg-white focus:border-[#0F172A]"
                  style={{ borderRadius: '3px' }}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                  Procedimento de Inspeção Qualificado
                </label>
                <input
                  type="text"
                  value={procedureCode}
                  onChange={(e) => setProcedureCode(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] focus:bg-white focus:border-[#0F172A]"
                  style={{ borderRadius: '3px' }}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                  Critério de Aceitação / Rejeição
                </label>
                <input
                  type="text"
                  value={acceptanceNorm}
                  onChange={(e) => setAcceptanceNorm(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] focus:bg-white focus:border-[#0F172A]"
                  style={{ borderRadius: '3px' }}
                />
              </div>
            </div>
          </div>

          {/* Seção 2: Kit Químico & Parâmetros Operacionais */}
          <div className="bg-white border border-[#E2E8F0] p-5 shadow-2xs" style={{ borderRadius: '3px' }}>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#F1F5F9]">
              <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 bg-[#0B0F17]" style={{ borderRadius: '1px' }}></span>
                2. Kit de Consumíveis Químicos &amp; Calibração
              </h3>
              <span className="text-[11px] text-[#059669] font-semibold">VALIDADE CONFORME</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                  Penetrante (Tipo II Método A/C)
                </label>
                <input
                  type="text"
                  value={consumables.penetrantBrand}
                  onChange={(e) => setConsumables({ ...consumables, penetrantBrand: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]"
                  style={{ borderRadius: '3px' }}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                  Lote &amp; Validade Penetrante
                </label>
                <input
                  type="text"
                  value={consumables.penetrantBatch}
                  onChange={(e) => setConsumables({ ...consumables, penetrantBatch: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]"
                  style={{ borderRadius: '3px' }}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                  Revelador (Forma d - Não aquoso)
                </label>
                <input
                  type="text"
                  value={consumables.developerBrand}
                  onChange={(e) => setConsumables({ ...consumables, developerBrand: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]"
                  style={{ borderRadius: '3px' }}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                  Lote &amp; Validade Revelador
                </label>
                <input
                  type="text"
                  value={consumables.developerBatch}
                  onChange={(e) => setConsumables({ ...consumables, developerBatch: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]"
                  style={{ borderRadius: '3px' }}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                  Tempo de Penetração / Revelação
                </label>
                <input
                  type="text"
                  value={`${consumables.dwellTime} / ${consumables.devTime}`}
                  className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]"
                  style={{ borderRadius: '3px' }}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                  Iluminamento &amp; Temperatura Superficial
                </label>
                <input
                  type="text"
                  value={`${consumables.lightLux} | ${consumables.surfaceTemp}`}
                  className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]"
                  style={{ borderRadius: '3px' }}
                />
              </div>
            </div>
          </div>

          {/* Seção 3: Tabela de Mapeamento de Indicações */}
          <div className="bg-white border border-[#E2E8F0] p-5 shadow-2xs" style={{ borderRadius: '3px' }}>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#F1F5F9]">
              <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 bg-[#0B0F17]" style={{ borderRadius: '1px' }}></span>
                3. Registro de Descontinuidades / Indicações
              </h3>
              <button
                type="button"
                onClick={handleAddIndication}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-[#0B0F17] hover:bg-[#F1F5F9] border border-[#CBD5E1] transition-colors cursor-pointer"
                style={{ borderRadius: '3px' }}
              >
                <Plus className="w-3 h-3 text-[#059669]" />
                <span>Adicionar Ponto</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFC] text-[#64748B] text-[10px] font-bold uppercase tracking-wider border-b border-[#E2E8F0]">
                    <th className="py-2.5 px-3">Região / Solda</th>
                    <th className="py-2.5 px-3">Tipo de Indicação</th>
                    <th className="py-2.5 px-3">Dimensão (mm)</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {indications.map((ind) => (
                    <tr key={ind.id} className="hover:bg-[#F8FAFC]">
                      <td className="py-2 px-3 font-medium text-[#0F172A]">{ind.loc}</td>
                      <td className="py-2 px-3 text-[#475569]">{ind.type}</td>
                      <td className="py-2 px-3 text-[#0F172A] font-mono">{ind.length}</td>
                      <td className="py-2 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]/60" style={{ borderRadius: '3px' }}>
                          {ind.result}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveIndication(ind.id)}
                          className="p-1 text-[#94A3B8] hover:text-[#E11D48] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Coluna da Direita (1 coluna): Parecer, Registro Fotográfico e Assinatura */}
        <div className="space-y-5">
          
          {/* Card de Veredito Técnico */}
          <div className="bg-white border border-[#E2E8F0] p-5 shadow-2xs space-y-4" style={{ borderRadius: '3px' }}>
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider pb-2 border-b border-[#F1F5F9]">
              Conclusão Técnica
            </h3>

            <div>
              <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1.5">
                Veredito Final da Inspeção
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVerdict('aprovado')}
                  className={`py-2 px-3 text-xs font-bold border cursor-pointer transition-all ${
                    verdict === 'aprovado'
                      ? 'bg-[#059669] text-white border-[#059669] shadow-xs'
                      : 'bg-white text-[#059669] border-[#A7F3D0]'
                  }`}
                  style={{ borderRadius: '3px' }}
                >
                  APROVADO
                </button>
                <button
                  type="button"
                  onClick={() => setVerdict('reprovado')}
                  className={`py-2 px-3 text-xs font-bold border cursor-pointer transition-all ${
                    verdict === 'reprovado'
                      ? 'bg-[#E11D48] text-white border-[#E11D48] shadow-xs'
                      : 'bg-white text-[#E11D48] border-[#FECDD3]'
                  }`}
                  style={{ borderRadius: '3px' }}
                >
                  REPROVADO
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                Parecer Conclusivo do Inspetor
              </label>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] focus:bg-white focus:border-[#0F172A] leading-relaxed"
                style={{ borderRadius: '3px' }}
              />
            </div>
          </div>

          {/* Registro Fotográfico de Campo */}
          <div className="bg-white border border-[#E2E8F0] p-5 shadow-2xs space-y-3" style={{ borderRadius: '3px' }}>
            <div className="flex items-center justify-between pb-2 border-b border-[#F1F5F9]">
              <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                Evidências Fotográficas ({photos.length})
              </h3>
              <label className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-white bg-[#059669] hover:bg-[#047857] cursor-pointer transition-colors shadow-2xs" style={{ borderRadius: '3px' }}>
                <Camera className="w-3.5 h-3.5" />
                <span>Anexar Foto</span>
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </label>
            </div>

            <div className="space-y-2">
              {photos.length === 0 ? (
                <div className="bg-[#F8FAFC] border border-dashed border-[#CBD5E1] p-4 text-center flex flex-col items-center justify-center min-h-[90px]" style={{ borderRadius: '3px' }}>
                  <Camera className="w-5 h-5 text-[#94A3B8] mb-1" />
                  <span className="text-[11px] text-[#64748B]">Nenhuma foto anexada ao laudo</span>
                </div>
              ) : (
                photos.map((photo, idx) => (
                  <div
                    key={photo.id}
                    className="flex items-center gap-3 p-2 bg-[#F8FAFC] border border-[#E2E8F0]"
                    style={{ borderRadius: '3px' }}
                  >
                    <img
                      src={photo.url}
                      alt={`Foto ${idx + 1}`}
                      className="w-14 h-14 object-cover border border-[#CBD5E1]"
                      style={{ borderRadius: '2px' }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="block text-[11px] font-bold text-[#0F172A] truncate">
                        Evidência #{idx + 1}
                      </span>
                      <input
                        type="text"
                        value={photo.caption}
                        onChange={(e) => {
                          const newCaption = e.target.value
                          setPhotos(photos.map(p => p.id === photo.id ? { ...p, caption: newCaption } : p))
                        }}
                        className="w-full text-[11px] bg-white border border-[#CBD5E1] px-1.5 py-0.5 text-[#475569] mt-0.5"
                        style={{ borderRadius: '2px' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(photo.id)}
                      className="p-1 text-[#94A3B8] hover:text-[#E11D48] cursor-pointer"
                      title="Remover foto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Carimbo e Assinatura Digital do Inspetor */}
          <div className="bg-[#0B0F17] text-white p-5 shadow-2xs space-y-3" style={{ borderRadius: '3px' }}>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase tracking-wider border-b border-[#1E293B] pb-2">
              <ShieldCheck className="w-4 h-4 text-[#34D399]" />
              <span>Assinatura Técnica Qualificada</span>
            </div>

            <div className="text-xs space-y-1 text-slate-300">
              <p><strong className="text-white">Inspetor:</strong> Carlos Eduardo Silva</p>
              <p><strong className="text-white">Qualificação:</strong> SNQC Nº 14892 (N2-LP)</p>
              <p><strong className="text-white">Data Execução:</strong> 21/10/2026 às 14:30</p>
            </div>

            <div className="pt-2 border-t border-[#1E293B] text-[10px] text-[#94A3B8]">
              Hash SHA-256 do Laudo: <code>e4d2...9b81</code>
            </div>
          </div>

        </div>
      </div>

      {/* ── MODAL OFICIAL: PRÉVIA E EMISSÃO DE LAUDO EM PDF COM A MARCA DA EMPRESA ── */}
      {isPdfPreviewOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs p-4 flex items-center justify-center animate-in fade-in duration-100">
          <div
            className="bg-white text-slate-900 w-full max-w-[1210px] border border-[#CBD5E1] shadow-2xl my-6 flex flex-col overflow-hidden"
            style={{ maxWidth: '1210px', borderRadius: '3px', fontFamily: "'Arial', 'Helvetica', sans-serif" }}
          >
            {/* Barra de Ações Superior do PDF */}
            <div className="bg-[#0B0C0D] text-white px-6 py-3.5 flex items-center justify-between border-b border-[#34383D]">
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-[#7CB7FF]" />
                <span className="font-semibold text-xs tracking-wider uppercase">
                  Folha Oficial de Laudo Técnico • Pré-visualização PDF
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold uppercase tracking-wider cursor-pointer transition-all shadow-xs"
                  style={{ borderRadius: '3px' }}
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir / Salvar PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPdfPreviewOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white cursor-pointer transition-colors"
                  title="Fechar pré-visualização"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Documento Formatado para Impressão com Timbre e Dados Oficiais */}
            <div className="p-8 space-y-6 text-xs leading-normal bg-white print:p-0">
              
              {/* Cabeçalho Oficial com Logotipo da Empresa */}
              <div className="border border-slate-300 p-4 flex items-center justify-between gap-4 bg-slate-50">
                <div className="flex items-center gap-4">
                  {tenant?.logoUrl ? (
                    <img src={tenant.logoUrl} alt={tenant.tradeName} className="h-12 max-w-[150px] object-contain" />
                  ) : (
                    <div className="h-12 w-12 bg-slate-800 text-white flex items-center justify-center font-bold text-base" style={{ borderRadius: '2px' }}>
                      {(tenant?.tradeName || tenantName).slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 tracking-tight uppercase">
                      {tenant?.tradeName || tenantName}
                    </h2>
                    <p className="text-[10px] text-slate-600 font-mono">
                      CNPJ: {tenant?.cnpj || '12.345.678/0001-90'} • Unidade: {tenant?.operationalUnit || 'Refinaria RPBC'}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Contrato: {tenant?.contractRef || 'CTR-2026-END-089'} • Sistema Axos Relatórios
                    </p>
                  </div>
                </div>

                <div className="text-right border-l border-slate-300 pl-4 font-mono text-[11px]">
                  <p className="font-bold text-slate-900">LAUDO Nº: {buildReportCode(tenant?.reportPrefix ?? 'END', 'LP', new Date().getFullYear(), 1)}</p>
                  <p className="text-slate-600">DATA: {new Date().toLocaleDateString('pt-BR')}</p>
                  <p className="text-slate-600">FOLHA: 01/01</p>
                </div>
              </div>

              {/* Título do Laudo */}
              <div className="text-center py-2 bg-slate-800 text-white uppercase tracking-wider font-bold text-xs" style={{ borderRadius: '2px' }}>
                RELATÓRIO TÉCNICO DE INSPEÇÃO POR LÍQUIDO PENETRANTE (LP)
              </div>

              {/* Identificação do Ativo */}
              <div className="border border-slate-300">
                <div className="bg-slate-200 px-3 py-1 font-bold text-[11px] text-slate-800 uppercase">
                  1. Dados do Componente e Procedimento
                </div>
                <div className="grid grid-cols-2 p-3 gap-2 text-[11px]">
                  <div><strong className="text-slate-700">TAG do Equipamento:</strong> {tag}</div>
                  <div><strong className="text-slate-700">Isométrico / Desenho:</strong> {isometric}</div>
                  <div><strong className="text-slate-700">Material Base:</strong> {material}</div>
                  <div><strong className="text-slate-700">Condição Superficial:</strong> {surfaceState}</div>
                  <div><strong className="text-slate-700">Procedimento Técnico:</strong> {procedureCode}</div>
                  <div><strong className="text-slate-700">Norma de Aceitação:</strong> {acceptanceNorm}</div>
                </div>
              </div>

              {/* Tabela de Consumíveis */}
              <div className="border border-slate-300">
                <div className="bg-slate-200 px-3 py-1 font-bold text-[11px] text-slate-800 uppercase">
                  2. Consumíveis Químicos e Condições do Ensaio
                </div>
                <div className="grid grid-cols-2 p-3 gap-2 text-[11px]">
                  <div><strong className="text-slate-700">Penetrante:</strong> {consumables.penetrantBrand} (Lote: {consumables.penetrantBatch})</div>
                  <div><strong className="text-slate-700">Revelador:</strong> {consumables.developerBrand} (Lote: {consumables.developerBatch})</div>
                  <div><strong className="text-slate-700">Removedor/Limpador:</strong> {consumables.cleanerBrand} (Lote: {consumables.cleanerBatch})</div>
                  <div><strong className="text-slate-700">Tempo de Penetração:</strong> {consumables.dwellTime}</div>
                  <div><strong className="text-slate-700">Tempo de Revelação:</strong> {consumables.devTime}</div>
                  <div><strong className="text-slate-700">Intensidade de Luz:</strong> {consumables.lightLux}</div>
                  <div className="col-span-2"><strong className="text-slate-700">Temperatura da Superfície:</strong> {consumables.surfaceTemp}</div>
                </div>
              </div>

              {/* Tabela de Indicações */}
              <div className="border border-slate-300">
                <div className="bg-slate-200 px-3 py-1 font-bold text-[11px] text-slate-800 uppercase">
                  3. Registro das Indicações Mapeadas
                </div>
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-100 font-bold">
                      <th className="p-2">Localização / Quadrante</th>
                      <th className="p-2">Tipo de Indicação</th>
                      <th className="p-2">Comprimento</th>
                      <th className="p-2 text-center">Critério de Aceitação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indications.map((ind) => (
                      <tr key={ind.id} className="border-b border-slate-200">
                        <td className="p-2">{ind.loc}</td>
                        <td className="p-2">{ind.type}</td>
                        <td className="p-2 font-mono">{ind.length}</td>
                        <td className="p-2 text-center font-bold text-emerald-700">{ind.result}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Evidências Fotográficas no Laudo */}
              <div className="border border-slate-300">
                <div className="bg-slate-200 px-3 py-1 font-bold text-[11px] text-slate-800 uppercase">
                  4. Registro Fotográfico de Evidências em Campo
                </div>
                <div className="p-3 grid grid-cols-2 gap-4">
                  {photos.map((photo, idx) => (
                    <div key={photo.id} className="border border-slate-300 p-2 text-center bg-slate-50">
                      <img src={photo.url} alt={`Evidência ${idx + 1}`} className="w-full h-32 object-contain mx-auto" />
                      <p className="text-[10px] text-slate-700 mt-1.5 font-medium">{photo.caption}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Parecer Conclusivo e Assinaturas */}
              <div className="border border-slate-300 p-3 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11px] text-slate-800 uppercase">
                    5. Parecer Técnico Conclusivo:
                  </span>
                  <span className={`px-3 py-1 font-bold text-xs uppercase ${verdict === 'aprovado' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`} style={{ borderRadius: '2px' }}>
                    LAUDO {verdict.toUpperCase()}
                  </span>
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed italic bg-white p-2 border border-slate-200">
                  "{notes}"
                </p>

                <div className="grid grid-cols-2 pt-4 gap-8 text-center text-[10px] border-t border-slate-300">
                  <div>
                    <div className="border-b border-slate-400 w-3/4 mx-auto mb-1"></div>
                    <p className="font-bold text-slate-800">Carlos Eduardo Silva</p>
                    <p className="text-slate-600 font-mono">Inspetor Qualificado SNQC Nº 14892 (N2-LP)</p>
                  </div>
                  <div>
                    <div className="border-b border-slate-400 w-3/4 mx-auto mb-1"></div>
                    <p className="font-bold text-slate-800">Paulo Mendes</p>
                    <p className="text-slate-600 font-mono">Engenheiro Mecânico Responsável • CREA 50628192-SP</p>
                  </div>
                </div>

                <div className="text-center pt-2 text-[9px] text-slate-500 font-mono">
                  Certificação Digital de Integridade SHA-256: e4d2a891f9b81c20173849182740192837492819
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  )
}
