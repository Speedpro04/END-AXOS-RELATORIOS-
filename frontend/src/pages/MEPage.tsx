import React, { useState } from 'react'
import { Layers, ArrowLeft, Printer, Save, AlertOctagon, CheckCircle2, Calculator, ShieldCheck } from 'lucide-react'

interface MEPageProps {
  onBack: () => void
  tenantName: string
}

export const MEPage: React.FC<MEPageProps> = ({ onBack, tenantName }) => {
  const [tag, setTag] = useState('V-2104')
  const [component, setComponent] = useState('Costado Cilíndrico - Anel 02')
  const [equipmentType, setEquipmentType] = useState('Vaso de Pressão (Separador Bifásico de Teste)')
  const [material, setMaterial] = useState('Aço Carbono ASTM A-516 Gr. 70')
  const [deviceModel, setDeviceModel] = useState('Olympus 38DL Plus (Cert. Cal. Nº 8491/2026)')
  const [transducer, setTransducer] = useState('Duplo Cristal D790-SM (5.0 MHz)')
  const [couplant, setCouplant] = useState('Glicerina Industrial / Carboximetilcelulose')
  
  // Parâmetros de Projeto
  const [nominalThickness, setNominalThickness] = useState<number>(12.7) // mm
  const [allowableMinThickness, setAllowableMinThickness] = useState<number>(9.2) // mm (PMTA)
  const [previousThickness, setPreviousThickness] = useState<number>(12.1) // mm na inspeção anterior
  const [yearsBetween, setYearsBetween] = useState<number>(3.5) // anos

  // Malha de Pontos de Medição (Grid de quadrantes por elevação)
  const [gridReadings, setGridReadings] = useState<number[][]>([
    [12.5, 12.4, 12.3, 12.6], // Elevação 1 (0°, 90°, 180°, 270°)
    [12.2, 12.0, 11.8, 12.1], // Elevação 2
    [11.9, 11.6, 11.4, 11.7], // Elevação 3 (Ponto crítico)
    [12.3, 12.2, 12.1, 12.4], // Elevação 4
  ])

  // Cálculos Automáticos em Tempo Real
  const allReadings = gridReadings.flat()
  const minThicknessFound = Math.min(...allReadings)
  const avgThickness = (allReadings.reduce((a, b) => a + b, 0) / allReadings.length).toFixed(2)
  const totalLoss = (nominalThickness - minThicknessFound).toFixed(2)
  const corrosionRate = ((previousThickness - minThicknessFound) / yearsBetween).toFixed(3) // mm/ano
  const remainingLife = Number(corrosionRate) > 0 
    ? ((minThicknessFound - allowableMinThickness) / Number(corrosionRate)).toFixed(1)
    : '50+'

  const isCritical = minThicknessFound < allowableMinThickness

  const handleCellChange = (rowIndex: number, colIndex: number, val: string) => {
    const num = parseFloat(val) || 0
    const newGrid = gridReadings.map((row, rIdx) =>
      row.map((col, cIdx) => (rIdx === rowIndex && cIdx === colIndex ? num : col))
    )
    setGridReadings(newGrid)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      
      {/* Barra de Ações Superior */}
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
                MODELO ME-02
              </span>
              <h2 className="text-base font-bold text-[#0F172A] tracking-tight uppercase">
                Medição de Espessura por Ultrassom (ME) &amp; Taxa de Corrosão
              </h2>
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Mapeamento de malha de espessuras conforme Petrobras N-1594 e ASME Sec. V Art. 5.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => alert('Dados da malha salvos offline!')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#F8FAFC] text-[#334155] text-xs font-semibold border border-[#CBD5E1] transition-colors cursor-pointer"
            style={{ borderRadius: '3px' }}
          >
            <Save className="w-3.5 h-3.5 text-[#64748B]" />
            <span>Salvar Malha</span>
          </button>
          <button
            type="button"
            onClick={() => alert(`Gerando Relatório de Medição de Espessura da ${tenantName}...`)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#0B0F17] hover:bg-[#1E293B] text-white text-xs font-bold tracking-wide uppercase transition-colors cursor-pointer shadow-xs"
            style={{ borderRadius: '3px' }}
          >
            <Printer className="w-3.5 h-3.5 text-[#34D399]" />
            <span>EMITIR LAUDO ME EM PDF</span>
          </button>
        </div>
      </div>

      {/* Grid de 4 Cards de Cálculos de Integridade */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white border border-[#E2E8F0] p-4 shadow-2xs" style={{ borderRadius: '3px' }}>
          <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">ESPESSURA MÍNIMA ENCONTRADA</span>
          <div className="text-2xl font-bold mt-1 text-[#0F172A] font-mono">
            {minThicknessFound.toFixed(1)} <span className="text-xs font-normal text-slate-500">mm</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Nominal: {nominalThickness} mm</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] p-4 shadow-2xs" style={{ borderRadius: '3px' }}>
          <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">LIMITE MÍNIMO ADMISSÍVEL (PMTA)</span>
          <div className="text-2xl font-bold mt-1 text-[#0F172A] font-mono">
            {allowableMinThickness.toFixed(1)} <span className="text-xs font-normal text-slate-500">mm</span>
          </div>
          <span className={`text-[11px] font-semibold mt-0.5 block ${isCritical ? 'text-[#E11D48]' : 'text-[#059669]'}`}>
            Margem restante: +{(minThicknessFound - allowableMinThickness).toFixed(1)} mm
          </span>
        </div>

        <div className="bg-white border border-[#E2E8F0] p-4 shadow-2xs" style={{ borderRadius: '3px' }}>
          <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">TAXA ESTIMADA DE CORROSÃO</span>
          <div className="text-2xl font-bold mt-1 text-[#D97706] font-mono">
            {corrosionRate} <span className="text-xs font-normal text-slate-500">mm/ano</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Intervalo analisado: {yearsBetween} anos</span>
        </div>

        <div className="bg-white border border-[#E2E8F0] p-4 shadow-2xs" style={{ borderRadius: '3px' }}>
          <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">VIDA REMANESCENTE ESTIMADA</span>
          <div className="text-2xl font-bold mt-1 text-[#059669] font-mono">
            {remainingLife} <span className="text-xs font-normal text-slate-500">anos</span>
          </div>
          <span className="text-[11px] text-[#059669] font-semibold mt-0.5 block">Equipamento Seguro</span>
        </div>
      </div>

      {/* Grade de 2 Colunas: Matriz de Malha vs. Dados do Aparelho */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Coluna Principal: Matriz de Malha de Medição (Tabela Interativa) */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white border border-[#E2E8F0] p-5 shadow-2xs" style={{ borderRadius: '3px' }}>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#F1F5F9]">
              <div>
                <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-[#0B0F17]" />
                  Matriz de Espessuras da Malha (Costado Cilíndrico)
                </h3>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  Insira ou edite as leituras coletadas pelo cabeçote de ultrassom nos 4 quadrantes.
                </p>
              </div>
              <span className="text-[11px] font-mono font-bold text-slate-700 bg-[#F1F5F9] px-2 py-1" style={{ borderRadius: '3px' }}>
                Média: {avgThickness} mm
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs border border-[#CBD5E1]">
                <thead>
                  <tr className="bg-[#0B0F17] text-white text-[10px] font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-3 border border-[#334155]">Elevação / Posição</th>
                    <th className="py-2.5 px-3 border border-[#334155]">0° (Norte)</th>
                    <th className="py-2.5 px-3 border border-[#334155]">90° (Leste)</th>
                    <th className="py-2.5 px-3 border border-[#334155]">180° (Sul)</th>
                    <th className="py-2.5 px-3 border border-[#334155]">270° (Oeste)</th>
                  </tr>
                </thead>
                <tbody>
                  {gridReadings.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-[#F8FAFC]">
                      <td className="py-2 px-3 font-bold bg-[#F8FAFC] border border-[#CBD5E1] text-[#475569]">
                        Nível {rIdx + 1} ({rIdx * 500} mm da base)
                      </td>
                      {row.map((val, cIdx) => {
                        const isUnder = val < allowableMinThickness
                        const isMin = val === minThicknessFound
                        return (
                          <td key={cIdx} className="p-1 border border-[#CBD5E1]">
                            <input
                              type="number"
                              step="0.1"
                              value={val}
                              onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                              className={`w-full py-1.5 px-2 text-center font-mono text-xs font-bold transition-colors ${
                                isUnder
                                  ? 'bg-[#FFF1F2] text-[#E11D48] border border-[#FECDD3]'
                                  : isMin
                                  ? 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]'
                                  : 'bg-white text-[#0F172A] border border-transparent hover:border-[#CBD5E1]'
                              }`}
                              style={{ borderRadius: '3px' }}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-[#64748B]">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 bg-[#FFFBEB] border border-[#FDE68A] inline-block"></span>
                  Ponto de Espessura Mínima
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 bg-[#FFF1F2] border border-[#FECDD3] inline-block"></span>
                  Abaixo do Limite de Projeto
                </span>
              </div>
              <span>Total de Pontos Auditados: 16 pontos</span>
            </div>
          </div>
        </div>

        {/* Coluna da Direita: Calibração do Aparelho & Veredito */}
        <div className="space-y-5">
          <div className="bg-white border border-[#E2E8F0] p-5 shadow-2xs space-y-3.5" style={{ borderRadius: '3px' }}>
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider pb-2 border-b border-[#F1F5F9]">
              Instrumentação de Ultrassom
            </h3>

            <div>
              <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                Aparelho de Medição
              </label>
              <input
                type="text"
                value={deviceModel}
                onChange={(e) => setDeviceModel(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]"
                style={{ borderRadius: '3px' }}
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                Transdutor / Frequência
              </label>
              <input
                type="text"
                value={transducer}
                onChange={(e) => setTransducer(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]"
                style={{ borderRadius: '3px' }}
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">
                Acoplante Utilizado
              </label>
              <input
                type="text"
                value={couplant}
                onChange={(e) => setCouplant(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A]"
                style={{ borderRadius: '3px' }}
              />
            </div>

            <div className="p-3 bg-[#ECFDF5] border border-[#A7F3D0] text-[#059669] text-xs" style={{ borderRadius: '3px' }}>
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Calibração em Bloco Escalonado</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Verificado antes e após a inspeção em bloco padrão de 4 degraus (2.5 / 5.0 / 10.0 / 20.0 mm). Erro máximo &lt; 0.05 mm.
              </p>
            </div>
          </div>

          <div className="bg-[#0B0F17] text-white p-5 shadow-2xs space-y-3" style={{ borderRadius: '3px' }}>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200 uppercase tracking-wider border-b border-[#1E293B] pb-2">
              <ShieldCheck className="w-4 h-4 text-[#34D399]" />
              <span>Conclusão de Integridade</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              O equipamento {tag} apresenta espessura mínima de {minThicknessFound.toFixed(1)} mm, mantendo-se{' '}
              <strong>conforme e seguro</strong> para operação contínua com vida remanescente estimada em {remainingLife} anos.
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
