import React, { useState } from 'react'
import { METHOD_LABELS, type InspectionReport, type NDTMethod, type ReportStatus } from '../types/inspection'

interface InspectionTableProps {
  reports: InspectionReport[]
  onNewReport: () => void
  onEditReport: (report: InspectionReport) => void
  onDeleteReport: (id: string) => void
}

export const InspectionTable: React.FC<InspectionTableProps> = ({
  reports,
  onNewReport,
  onEditReport,
  onDeleteReport,
}) => {
  const [search, setSearch] = useState('')
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL')
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL')

  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      r.code.toLowerCase().includes(search.toLowerCase()) ||
      r.equipmentTag.toLowerCase().includes(search.toLowerCase()) ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.inspectorName.toLowerCase().includes(search.toLowerCase())

    const matchesMethod = selectedMethod === 'ALL' || r.method === selectedMethod
    const matchesStatus = selectedStatus === 'ALL' || r.status === selectedStatus

    return matchesSearch && matchesMethod && matchesStatus
  })

  const renderStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'aprovado':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[13px] font-semibold bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]/70"
            style={{ borderRadius: '4px' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span>
            CONFORME
          </span>
        )
      case 'enviado':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[13px] font-semibold bg-[#FFFBEB] text-[#d97706] border border-[#FDE68A]/70"
            style={{ borderRadius: '4px' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]"></span>
            EM REVISÃO
          </span>
        )
      case 'reprovado':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[13px] font-semibold bg-[#FFF1F2] text-[#ef4444] border border-[#FECDD3]/70"
            style={{ borderRadius: '4px' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#f87171]"></span>
            NÃO CONFORME
          </span>
        )
      case 'rascunho':
      default:
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[13px] font-semibold bg-[#F1F5F9] text-[#64748B] border border-[#CBD5E1]/70"
            style={{ borderRadius: '4px' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#94A3B8]"></span>
            RASCUNHO
          </span>
        )
    }
  }

  return (
    <div className="bg-white border border-[#CBD5E1] shadow-2xs flex flex-col" style={{ borderRadius: '6px' }}>
      
      {/* Barra de Ações Superior Limpa */}
      <div className="p-4 border-b border-[#CBD5E1] bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Busca */}
          <div className="relative min-w-[260px] flex-1 max-w-md">
            <input
              type="text"
              placeholder="Pesquisar por TAG, laudo, junta soldada ou inspetor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3.5 py-2 text-[15px] bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] focus:bg-white focus:border-[#0284c7] transition-all placeholder:text-[#94A3B8]"
              style={{ borderRadius: '6px' }}
            />
          </div>

          {/* Filtro por Método */}
          <div className="flex items-center bg-[#F8FAFC] border border-[#CBD5E1] px-3 py-2" style={{ borderRadius: '6px' }}>
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="text-[14px] bg-transparent text-[#334155] font-medium outline-hidden cursor-pointer"
            >
              <option value="ALL">Todos os Ensaios END</option>
              {(Object.keys(METHOD_LABELS) as NDTMethod[]).map((m) => (
                <option key={m} value={m}>
                  [{METHOD_LABELS[m].label}] {METHOD_LABELS[m].full}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por Status */}
          <div className="flex items-center bg-[#F8FAFC] border border-[#CBD5E1] px-3 py-2" style={{ borderRadius: '6px' }}>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-[14px] bg-transparent text-[#334155] font-medium outline-hidden cursor-pointer"
            >
              <option value="ALL">Todos os Vereditos</option>
              <option value="rascunho">Rascunhos (Coleta)</option>
              <option value="enviado">Em Revisão</option>
              <option value="aprovado">Conformes</option>
              <option value="reprovado">Não Conformes</option>
            </select>
          </div>
        </div>

        {/* Botão de Novo Laudo */}
        <button
          type="button"
          onClick={onNewReport}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#1e293b] hover:bg-[#334155] text-white text-[15px] font-semibold tracking-wide transition-all cursor-pointer shadow-sm shrink-0"
          style={{ borderRadius: '6px' }}
        >
          <span>+ Novo Laudo Técnico</span>
        </button>
      </div>

      {/* Tabela de Precisão */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F8FAFC] text-[#475569] text-[13px] font-semibold uppercase tracking-wider border-b border-[#CBD5E1]">
              <th className="py-3.5 px-4">Código / Laudo</th>
              <th className="py-3.5 px-4">Ensaio &amp; Norma</th>
              <th className="py-3.5 px-4">TAG do Equipamento</th>
              <th className="py-3.5 px-4">Unidade / Área</th>
              <th className="py-3.5 px-4">Data Emissão</th>
              <th className="py-3.5 px-4">Inspetor Responsável</th>
              <th className="py-3.5 px-4 text-center">Veredito</th>
              <th className="py-3.5 px-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#CBD5E1] text-[15px] text-[#0F172A]">
            {filteredReports.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-[#94A3B8] bg-white">
                  <p className="font-semibold text-slate-700 text-[15px]">Nenhum laudo encontrado com os filtros aplicados.</p>
                  <p className="text-[14px] text-[#94A3B8] mt-1">
                    Utilize o botão acima para cadastrar uma nova inspeção de campo.
                  </p>
                </td>
              </tr>
            ) : (
              filteredReports.map((report) => (
                <tr
                  key={report.id}
                  className="hover:bg-[#F8FAFC] transition-colors group cursor-pointer"
                  onClick={() => onEditReport(report)}
                >
                  {/* Código */}
                  <td className="py-3 px-4 font-semibold text-[#0F172A] whitespace-nowrap font-mono text-[14px]">
                    {report.code}
                  </td>

                  {/* Método */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      className="inline-block px-2 py-0.5 text-[12px] font-mono font-semibold bg-[#1e293b] text-white mr-1.5 tracking-wider uppercase"
                      style={{ borderRadius: '3px' }}
                    >
                      {report.method}
                    </span>
                    <span className="text-[14px] text-[#64748B]">{METHOD_LABELS[report.method]?.label}</span>
                  </td>

                  {/* TAG */}
                  <td className="py-3 px-4 font-semibold text-[#0F172A] whitespace-nowrap text-[15px]">
                    {report.equipmentTag}
                  </td>

                  {/* Área */}
                  <td className="py-3 px-4 text-[#64748B] max-w-[200px] truncate text-[14px]" title={report.unitArea}>
                    {report.unitArea}
                  </td>

                  {/* Data */}
                  <td className="py-3 px-4 text-[#94A3B8] whitespace-nowrap font-mono text-[14px]">
                    {report.date}
                  </td>

                  {/* Inspetor */}
                  <td className="py-3 px-4 text-[#475569] whitespace-nowrap text-[15px]">
                    {report.inspectorName}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    {renderStatusBadge(report.status)}
                  </td>

                  {/* Ações (Links Textuais de Alta Precisão em vez de Ícones) */}
                  <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onEditReport(report)}
                        className="px-3 py-1 text-[14px] font-semibold text-[#334155] hover:text-black hover:bg-[#F1F5F9] border border-[#CBD5E1] rounded-md transition-colors"
                      >
                        Abrir
                      </button>
                      <button
                        type="button"
                        onClick={() => alert(`Gerando PDF corporativo do Laudo ${report.code}...`)}
                        className="px-3 py-1 text-[14px] font-semibold text-[#059669] hover:bg-[#ECFDF5] border border-[#A7F3D0] rounded-md transition-colors"
                      >
                        PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Remover permanentemente o laudo ${report.code}?`)) {
                            onDeleteReport(report.id)
                          }
                        }}
                        className="px-3 py-1 text-[14px] font-semibold text-[#ef4444] hover:bg-[#FFF1F2] border border-[#FECDD3] rounded-md transition-colors"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Sub-barra da Tabela */}
      <div className="p-3 bg-[#F8FAFC] border-t border-[#CBD5E1] flex items-center justify-between text-[14px] text-[#64748B]">
        <span>Mostrando {filteredReports.length} de {reports.length} laudos auditados</span>
        <span className="text-[#64748B]">Ambiente Seguro • Registro Rastreável</span>
      </div>
    </div>
  )
}
