import React, { useEffect, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { METHOD_LABELS, type InspectionReport, type ReportStatus } from '../types/inspection'

interface InspectionTableProps {
  reports: InspectionReport[]
  onNewReport: () => void
  onEditReport: (report: InspectionReport) => void
  onDeleteReport: (id: string) => void
}

const FONT = 'Archivo, system-ui, -apple-system, Segoe UI, sans-serif'

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const fn = () => setIsMobile(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return isMobile
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
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const isMobile = useIsMobile()

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
            Conforme
          </span>
        )
      case 'enviado':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[13px] font-semibold bg-[#FFFBEB] text-[#d97706] border border-[#FDE68A]/70"
            style={{ borderRadius: '4px' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]"></span>
            Em revisão
          </span>
        )
      case 'reprovado':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[13px] font-semibold bg-[#FFF1F2] text-[#ef4444] border border-[#FECDD3]/70"
            style={{ borderRadius: '4px' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#f87171]"></span>
            Não conforme
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
            Rascunho
          </span>
        )
    }
  }

  const handlePdf = (report: InspectionReport) => {
    alert(`Gerando PDF corporativo do Laudo ${report.code}...`)
  }

  const handleDelete = (report: InspectionReport) => {
    if (confirm(`Remover permanentemente o laudo ${report.code}?`)) {
      onDeleteReport(report.id)
    }
  }

  const closeMenu = () => setMenuOpenId(null)

  const actionsMenu = (report: InspectionReport) => (
    <div className="relative inline-flex items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onEditReport(report)
        }}
        className="px-3 py-1 text-[14px] font-semibold text-[#334155] hover:text-black hover:bg-[#F1F5F9] border border-[#CBD5E1] rounded-md transition-colors"
        style={{ fontFamily: FONT }}
      >
        Abrir
      </button>
      <button
        type="button"
        aria-label="Mais ações"
        title="Mais ações"
        onClick={(e) => {
          e.stopPropagation()
          setMenuOpenId(menuOpenId === report.id ? null : report.id)
        }}
        className="inline-flex items-center justify-center w-8 h-8 text-[#334155] hover:bg-[#F1F5F9] border border-[#CBD5E1] rounded-md transition-colors"
      >
        <MoreHorizontal size={16} strokeWidth={1.75} aria-hidden='true' />
      </button>
      {menuOpenId === report.id && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            onClick={(e) => {
              e.stopPropagation()
              closeMenu()
            }}
            aria-hidden='true'
          />
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: '100%',
              marginTop: '4px',
              zIndex: 50,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '5px',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.16)',
              minWidth: '140px',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handlePdf(report)
                closeMenu()
              }}
              className="w-full text-left px-3 py-2 text-[14px] font-medium text-[#334155] hover:bg-[#F1F5F9] transition-colors"
              style={{ fontFamily: FONT }}
            >
              Gerar PDF
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleDelete(report)
                closeMenu()
              }}
              className="w-full text-left px-3 py-2 text-[14px] font-medium text-[#ef4444] hover:bg-[#FFF1F2] transition-colors"
              style={{ fontFamily: FONT }}
            >
              Remover laudo
            </button>
          </div>
        </>
      )}
    </div>
  )

  if (isMobile) {
    return (
      <div className="bg-white border border-[#CBD5E1] shadow-2xs flex flex-col" style={{ borderRadius: '6px' }}>
        {/* Barra de Ações Superior */}
        <div className="p-4 border-b border-[#CBD5E1] bg-white flex flex-col gap-3">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Pesquisar por TAG, laudo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3.5 py-2 text-[15px] bg-[#F8FAFC] border border-[#CBD5E1] text-[#0F172A] focus:bg-white focus:border-[#0284c7] transition-all placeholder:text-[#94A3B8]"
              style={{ borderRadius: '6px' }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 text-[14px] bg-[#F8FAFC] border border-[#CBD5E1] text-[#334155] font-medium outline-hidden cursor-pointer"
              style={{ borderRadius: '6px' }}
            >
              <option value="ALL">Todos os Ensaios END</option>
              {(Object.keys(METHOD_LABELS) as (keyof typeof METHOD_LABELS)[]).map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABELS[m].label}
                </option>
              ))}
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 text-[14px] bg-[#F8FAFC] border border-[#CBD5E1] text-[#334155] font-medium outline-hidden cursor-pointer"
              style={{ borderRadius: '6px' }}
            >
              <option value="ALL">Todos os Vereditos</option>
              <option value="rascunho">Rascunhos (Coleta)</option>
              <option value="enviado">Em Revisão</option>
              <option value="aprovado">Conformes</option>
              <option value="reprovado">Não Conformes</option>
            </select>
            <button
              type="button"
              onClick={onNewReport}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#1e293b] hover:bg-[#334155] text-white text-[15px] font-semibold tracking-wide transition-all cursor-pointer shadow-sm"
              style={{ borderRadius: '6px', fontFamily: FONT }}
            >
              <span>+ Novo Laudo Técnico</span>
            </button>
          </div>
        </div>

        {/* Cards empilhados (sem rolagem horizontal) */}
        <div className="flex flex-col divide-y divide-[#CBD5E1]">
          {filteredReports.length === 0 ? (
            <div className="py-12 text-center text-[#94A3B8] bg-white px-4">
              <p className="font-semibold text-slate-700 text-[15px]">Nenhum laudo encontrado com os filtros aplicados.</p>
              <p className="text-[14px] text-[#94A3B8] mt-1">Utilize o botão acima para cadastrar uma nova inspeção de campo.</p>
            </div>
          ) : (
            filteredReports.map((report) => (
              <div
                key={report.id}
                className="p-4 bg-white flex flex-col gap-2"
                onClick={() => onEditReport(report)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[15px] text-[#0F172A]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {report.code}
                  </span>
                  {renderStatusBadge(report.status)}
                </div>
                <div className="flex items-center gap-2 text-[14px]" style={{ fontFamily: FONT }}>
                  <span className="font-semibold text-[#0F172A]">{report.method}</span>
                  <span className="text-[#94A3B8]" aria-hidden='true'>—</span>
                  <span className="text-[#334155] truncate" title={report.equipmentTag}>{report.equipmentTag}</span>
                </div>
                <div className="text-[13.5px] text-[#64748B] truncate" style={{ fontFamily: FONT }} title={report.unitArea}>
                  {report.unitArea}
                </div>
                <div className="flex items-center justify-between gap-2 text-[13.5px] text-[#64748B]" style={{ fontFamily: FONT }}>
                  <span className="truncate" title={report.inspectorName}>{report.inspectorName}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{report.date}</span>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  {actionsMenu(report)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sub-barra */}
        <div className="p-3 bg-[#F8FAFC] border-t border-[#CBD5E1] flex items-center justify-between text-[13.5px] text-[#64748B]" style={{ fontFamily: FONT }}>
          <span>Mostrando {filteredReports.length} de {reports.length} laudos auditados</span>
          <span className="hidden sm:inline">Registro Rastreável</span>
        </div>
      </div>
    )
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
              style={{ borderRadius: '6px', fontFamily: FONT }}
            />
          </div>

          {/* Filtro por Método */}
          <div className="flex items-center bg-[#F8FAFC] border border-[#CBD5E1] px-3 py-2" style={{ borderRadius: '6px' }}>
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="text-[14px] bg-transparent text-[#334155] font-medium outline-hidden cursor-pointer"
              style={{ fontFamily: FONT }}
            >
              <option value="ALL">Todos os Ensaios END</option>
              {(Object.keys(METHOD_LABELS) as (keyof typeof METHOD_LABELS)[]).map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABELS[m].label}
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
              style={{ fontFamily: FONT }}
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
          style={{ borderRadius: '6px', fontFamily: FONT }}
        >
          <span>+ Novo Laudo Técnico</span>
        </button>
      </div>

      {/* Tabela — layout fixo, sem rolagem horizontal */}
      <div>
        <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed', fontFamily: FONT }}>
          <colgroup>
            <col style={{ width: '14%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '15%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <thead>
            <tr className="bg-[#F8FAFC] text-[#475569] text-[13px] font-semibold border-b border-[#CBD5E1]">
              <th className="py-3 px-4">Código</th>
              <th className="py-3 px-4">Ensaio</th>
              <th className="py-3 px-4">Tag</th>
              <th className="py-3 px-4">Unidade / área</th>
              <th className="py-3 px-4">Emissão</th>
              <th className="py-3 px-4">Inspetor</th>
              <th className="py-3 px-4">Veredito</th>
              <th className="py-3 px-4">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#CBD5E1] text-[15px] text-[#0F172A]">
            {filteredReports.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-[#94A3B8] bg-white px-4">
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
                  <td
                    className="py-3 px-4 font-semibold text-[#0F172A] text-[14px] whitespace-nowrap overflow-hidden text-ellipsis"
                    title={report.code}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {report.code}
                  </td>

                  {/* Ensaio — só a sigla, uma vez */}
                  <td className="py-3 px-4 whitespace-nowrap overflow-hidden text-ellipsis">
                    <span className="text-[14px] font-semibold text-[#0F172A]">{report.method}</span>
                  </td>

                  {/* Tag */}
                  <td
                    className="py-3 px-4 font-semibold text-[#0F172A] text-[14px] whitespace-nowrap overflow-hidden text-ellipsis"
                    title={report.equipmentTag}
                  >
                    {report.equipmentTag}
                  </td>

                  {/* Unidade / área */}
                  <td
                    className="py-3 px-4 text-[#64748B] text-[14px] whitespace-nowrap overflow-hidden text-ellipsis"
                    title={report.unitArea}
                  >
                    {report.unitArea}
                  </td>

                  {/* Emissão */}
                  <td
                    className="py-3 px-4 text-[#64748B] text-[14px] whitespace-nowrap overflow-hidden text-ellipsis"
                    title={report.date}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {report.date}
                  </td>

                  {/* Inspetor */}
                  <td
                    className="py-3 px-4 text-[#475569] text-[14px] whitespace-nowrap overflow-hidden text-ellipsis"
                    title={report.inspectorName}
                  >
                    {report.inspectorName}
                  </td>

                  {/* Veredito */}
                  <td className="py-3 px-4 whitespace-nowrap">{renderStatusBadge(report.status)}</td>

                  {/* Ações: Abrir + menu de três pontos (PDF / Remover) */}
                  <td
                    className="py-3 px-2 whitespace-nowrap overflow-visible"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {actionsMenu(report)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Sub-barra da Tabela */}
      <div className="p-3 bg-[#F8FAFC] border-t border-[#CBD5E1] flex items-center justify-between text-[14px] text-[#64748B]" style={{ fontFamily: FONT }}>
        <span>Mostrando {filteredReports.length} de {reports.length} laudos auditados</span>
        <span>Ambiente Seguro • Registro Rastreável</span>
      </div>
    </div>
  )
}
