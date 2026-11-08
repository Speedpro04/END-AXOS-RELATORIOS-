import React, { useEffect, useState } from 'react'
import { MoreHorizontal, FileText, Edit2, RefreshCw, History } from 'lucide-react'
import { METHOD_LABELS, type InspectionReport, type ReportStatus } from '../types/inspection'
import { ESTILO_TECNICO, htmlTecnico } from '../utils/impressaoLaudo'

const AZUL_DESTAQUE = 'var(--card-met-azul, #2FB8D6)'

interface InspectionTableProps {
  reports: InspectionReport[]
  onNewReport: () => void
  onEditReport: (report: InspectionReport) => void
  onDeleteReport: (id: string) => void
}

const FONT = 'Arial, Helvetica, sans-serif'

function escapeHtml(text: string | null | undefined): string {
  if (!text) return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

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
  const [pdfGeneratingId, setPdfGeneratingId] = useState<string | null>(null)
  const [pdfError, setPdfError] = useState<{ id: string; message: string } | null>(null)
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
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[13px] font-medium"
            style={{
              borderRadius: '5px',
              background: 'rgba(61, 220, 151, 0.12)',
              color: 'var(--ok, #3DDC97)',
              border: '1px solid rgba(61, 220, 151, 0.3)',
              fontFamily: FONT,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--ok, #3DDC97)' }} />
            Conforme
          </span>
        )
      case 'enviado':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[13px] font-medium"
            style={{
              borderRadius: '5px',
              background: 'rgba(245, 165, 36, 0.12)',
              color: 'var(--warn, #F5A524)',
              border: '1px solid rgba(245, 165, 36, 0.3)',
              fontFamily: FONT,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--warn, #F5A524)' }} />
            Em revisão
          </span>
        )
      case 'reprovado':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[13px] font-medium"
            style={{
              borderRadius: '5px',
              background: 'rgba(255, 107, 107, 0.12)',
              color: 'var(--danger, #FF6B6B)',
              border: '1px solid rgba(255, 107, 107, 0.3)',
              fontFamily: FONT,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--danger, #FF6B6B)' }} />
            Não conforme
          </span>
        )
      case 'rascunho':
      default:
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[13px] font-medium"
            style={{
              borderRadius: '5px',
              background: 'var(--bg-surface-alt)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
              fontFamily: FONT,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--text-muted)' }} />
            Rascunho
          </span>
        )
    }
  }

  const estaEmitido = (report: InspectionReport) => report.status === 'issued'

  const gerarPdf = async (report: InspectionReport) => {
    setPdfGeneratingId(report.id)
    setPdfError(null)
    try {
      const emitido = estaEmitido(report)
      // TODO: Integrar com pdf_worker existente (backend) quando o endpoint de emissão estiver disponível.
      // Por enquanto, gera HTML em nova aba e aciona window.print() para impressão/PDF do navegador.
      const tecnico = await htmlTecnico(report, escapeHtml)
      const conteudo = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
@page { size: A4; margin: 2cm; }
body { font-family: 'Arial', sans-serif; font-size: 11px; color: #111; line-height: 1.4; }
.watermark {
  position: fixed;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%) rotate(-45deg);
  font-size: 60px; font-weight: bold; color: rgba(255, 0, 0, 0.15);
  z-index: 1; pointer-events: none; white-space: nowrap;
}
.conteudo { position: relative; z-index: 2; }
h1 { font-size: 18px; margin-bottom: 4px; color: #0284C7; }
.sub { font-size: 11px; color: #666; margin-bottom: 16px; }
table { width: 100%; border-collapse: collapse; margin-top: 12px; }
th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 10.5px; text-align: left; }
th { background: #f2f2f2; }
${ESTILO_TECNICO}
</style>
</head>
<body>
${!emitido ? '<div class="watermark">PROVISÓRIO, SEM VALOR OFICIAL</div>' : ''}
<div class="conteudo">
  <h1>Laudo Técnico END</h1>
  <div class="sub">
    <strong>Número:</strong> ${escapeHtml(report.code)} &nbsp;|&nbsp;
    <strong>Método:</strong> ${escapeHtml(report.method)} &nbsp;|&nbsp;
    <strong>Status:</strong> ${escapeHtml(report.status)} &nbsp;|&nbsp;
    <strong>Revisão:</strong> ${escapeHtml(String(report.technicalData?.revisao ?? '0'))}
  </div>
  <table>
    <tr><th style="width:30%">Campo</th><th>Valor</th></tr>
    <tr><td>Código / Laudo</td><td>${escapeHtml(report.code)}</td></tr>
    <tr><td>TAG / Equipamento</td><td>${escapeHtml(report.equipmentTag)}</td></tr>
    <tr><td>Unidade / Área</td><td>${escapeHtml(report.unitArea)}</td></tr>
    <tr><td>Data de Emissão</td><td>${escapeHtml(report.date)}</td></tr>
    <tr><td>Inspetor</td><td>${escapeHtml(report.inspectorName)}</td></tr>
    <tr><td>SNQC</td><td>${escapeHtml(report.inspectorSNQC)}</td></tr>
    <tr><td>Norma / Procedimento</td><td>${escapeHtml(report.normProcedure)}</td></tr>
    <tr><td>Critério de Aceitação</td><td>${escapeHtml(report.acceptanceCriteria)}</td></tr>
    <tr><td>Título</td><td>${escapeHtml(report.title)}</td></tr>
    <tr><td>Resumo</td><td>${escapeHtml(report.summary) || '—'}</td></tr>
  </table>
  ${tecnico}
  <div style="margin-top:20px; font-size:10px; color:#666;">
    ${emitido ? 'PDF oficial emitido pelo sistema AXOS Relatórios.' : 'PDF gerado a partir de laudo PROVISÓRIO. Sem valor oficial.'}
  </div>
</div>
</body>
</html>
      `
      const blob = new Blob([conteudo], { type: 'text/html' })
      // Abre em nova aba e aciona impressão do navegador (gera PDF via Ctrl+P / comando de impressão)
      const url = URL.createObjectURL(blob)
      const win = window.open(url, '_blank')
      if (win) {
        win.onload = () => {
          win.print()
        }
      }
    } catch (err: any) {
      setPdfError({ id: report.id, message: err?.message || 'Falha ao gerar PDF.' })
    } finally {
      setPdfGeneratingId(null)
    }
  }

  const gerarPdfFiltrados = async () => {
    setPdfGeneratingId('todos')
    setPdfError(null)
    try {
      const emitidos = filteredReports.filter((r) => estaEmitido(r)).length
      const conteudo = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
@page { size: A4; margin: 2cm; }
body { font-family: 'Arial', sans-serif; font-size: 11px; color: #111; line-height: 1.4; }
.watermark {
  position: fixed;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%) rotate(-45deg);
  font-size: 60px; font-weight: bold; color: rgba(255, 0, 0, 0.15);
  z-index: 1; pointer-events: none; white-space: nowrap;
}
.conteudo { position: relative; z-index: 2; }
h1 { font-size: 18px; margin-bottom: 4px; color: #0284C7; }
.sub { font-size: 11px; color: #666; margin-bottom: 16px; }
table { width: 100%; border-collapse: collapse; margin-top: 12px; }
th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 10.5px; text-align: left; }
th { background: #f2f2f2; }
</style>
</head>
<body>
<div class="conteudo">
  <h1>Relatório de Laudos END</h1>
  <div class="sub">
    <strong>Total:</strong> ${filteredReports.length} laudo(s) &nbsp;|&nbsp;
    <strong>Emitidos:</strong> ${emitidos} &nbsp;|&nbsp;
    <strong>Gerado em:</strong> ${new Date().toLocaleString('pt-BR')}
  </div>
  <table>
    <tr>
      <th style="width:18%">Código</th>
      <th style="width:12%">Método</th>
      <th style="width:15%">TAG</th>
      <th style="width:20%">Unidade / Área</th>
      <th style="width:12%">Emissão</th>
      <th style="width:15%">Inspetor</th>
      <th style="width:8%">Veredito</th>
    </tr>
    ${filteredReports.map((r) => `
    <tr>
      <td>${escapeHtml(r.code)}</td>
      <td>${escapeHtml(r.method)}</td>
      <td>${escapeHtml(r.equipmentTag)}</td>
      <td>${escapeHtml(r.unitArea)}</td>
      <td>${escapeHtml(r.date)}</td>
      <td>${escapeHtml(r.inspectorName)}</td>
      <td>${escapeHtml(r.status)}</td>
    </tr>
    `).join('')}
  </table>
  <div style="margin-top:20px; font-size:10px; color:#666;">
    Relatório consolidado gerado pelo sistema AXOS Relatórios.
  </div>
</div>
</body>
</html>
      `
      const blob = new Blob([conteudo], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const win = window.open(url, '_blank')
      if (win) {
        win.onload = () => {
          win.print()
        }
      }
    } catch (err: any) {
      setPdfError({ id: 'todos', message: err?.message || 'Falha ao gerar PDF.' })
    } finally {
      setPdfGeneratingId(null)
    }
  }

  const handleDelete = (report: InspectionReport) => {
    if (report.status !== 'rascunho') return
    if (confirm(`Remover permanentemente o laudo ${report.code}?`)) {
      onDeleteReport(report.id)
    }
  }

  const closeMenu = () => setMenuOpenId(null)

  const actionsMenu = (report: InspectionReport) => (
    <div className="relative inline-flex items-center justify-end gap-1.5">
      {/* Botão ABRIR — secundário, só contorno */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onEditReport(report)
        }}
        className="px-3 py-1 text-[13px] font-medium transition-colors cursor-pointer"
        style={{
          fontFamily: FONT,
          borderRadius: '5px',
          background: 'transparent',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt)'
          e.currentTarget.style.borderColor = 'var(--border-strong)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.borderColor = 'var(--border)'
        }}
      >
        <Edit2 size={13} strokeWidth={1.75} style={{ marginRight: '4px' }} aria-hidden='true' />
        Abrir
      </button>

      {/* Botão GERAR PDF — principal, sempre visível, azul preenchido */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          gerarPdf(report)
        }}
        disabled={pdfGeneratingId === report.id}
        className="px-3 py-1 text-[13px] font-medium transition-colors cursor-pointer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONT,
          borderRadius: '5px',
          background: pdfGeneratingId === report.id ? 'var(--bg-surface-alt)' : AZUL_DESTAQUE,
          border: pdfGeneratingId === report.id ? '1px solid var(--border)' : `1px solid ${AZUL_DESTAQUE}`,
          color: pdfGeneratingId === report.id ? 'var(--text-muted)' : '#FFFFFF',
          cursor: pdfGeneratingId === report.id ? 'not-allowed' : 'pointer',
          opacity: pdfGeneratingId === report.id ? 0.6 : 1,
        }}
      >
        {pdfGeneratingId === report.id ? (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px', animation: 'spin 1s linear infinite' }}>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            Gerando…
          </>
        ) : (
          <>
            <FileText size={13} strokeWidth={1.75} style={{ marginRight: '4px' }} aria-hidden='true' />
            Gerar PDF
          </>
        )}
      </button>

      {/* Menu "..." — apenas ações secundárias (sem Gerar PDF) */}
      <button
        type="button"
        aria-label="Mais ações"
        title="Mais ações"
        onClick={(e) => {
          e.stopPropagation()
          setMenuOpenId(menuOpenId === report.id ? null : report.id)
        }}
        className="inline-flex items-center justify-center w-8 h-8 transition-colors cursor-pointer"
        style={{
          borderRadius: '5px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          color: 'var(--text-secondary)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt)'
          e.currentTarget.style.borderColor = 'var(--border-strong)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-surface)'
          e.currentTarget.style.borderColor = 'var(--border)'
        }}
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
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
              minWidth: '160px',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                closeMenu()
              }}
              className="w-full text-left px-3 py-2 text-[13px] font-medium transition-colors cursor-pointer"
              style={{ fontFamily: FONT, color: 'var(--text-primary)', background: 'transparent' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt)' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <RefreshCw size={13} strokeWidth={1.75} style={{ marginRight: '6px' }} aria-hidden='true' />
              Nova revisão
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                closeMenu()
              }}
              className="w-full text-left px-3 py-2 text-[13px] font-medium transition-colors cursor-pointer"
              style={{ fontFamily: FONT, color: 'var(--text-primary)', background: 'transparent' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt)' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <History size={13} strokeWidth={1.75} style={{ marginRight: '6px' }} aria-hidden='true' />
              Histórico de versões
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                closeMenu()
              }}
              className="w-full text-left px-3 py-2 text-[13px] font-medium transition-colors cursor-pointer"
              style={{ fontFamily: FONT, color: 'var(--text-primary)', background: 'transparent' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt)' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <FileText size={13} strokeWidth={1.75} style={{ marginRight: '6px' }} aria-hidden='true' />
              Duplicar laudo
            </button>
            <div style={{ height: '1px', background: 'var(--border)', margin: '6px 0' }} />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleDelete(report)
                closeMenu()
              }}
              className="w-full text-left px-3 py-2 text-[13px] font-medium transition-colors cursor-pointer"
              style={{ fontFamily: FONT, color: 'var(--danger, #FF6B6B)', background: 'transparent' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt)' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              Remover laudo
            </button>
          </div>
        </>
      )}
    </div>
  )

  // Exibe erro de PDF na tela (não apaga enquanto ainda está gerando para esse laudo)
  useEffect(() => {
    if (pdfError && pdfError.id !== pdfGeneratingId && pdfGeneratingId !== null) {
      setPdfError(null)
    }
  }, [pdfError, pdfGeneratingId])

  if (isMobile) {
    return (
      <div className="flex flex-col overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px' }}>
        {/* Barra de Ações Superior */}
        <div className="p-4 border-b flex flex-col gap-3" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="relative w-full" style={{ maxWidth: '390px' }}>
            <input
              type="text"
              placeholder="Pesquisar por TAG, laudo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3.5 py-2 text-[14px] transition-all"
              style={{
                borderRadius: '5px',
                fontFamily: FONT,
                background: 'var(--bg-surface-alt)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 text-[13px] font-medium cursor-pointer"
              style={{
                borderRadius: '5px',
                fontFamily: FONT,
                background: 'var(--bg-surface-alt)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
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
              className="flex-1 min-w-0 px-3 py-2 text-[13px] font-medium cursor-pointer"
              style={{
                borderRadius: '5px',
                fontFamily: FONT,
                background: 'var(--bg-surface-alt)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
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
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[14px] font-medium tracking-wide transition-all cursor-pointer"
              style={{
                borderRadius: '5px',
                fontFamily: FONT,
                background: 'var(--btn-pri-bg)',
                border: '1px solid var(--btn-pri-border)',
                color: 'var(--btn-pri-text)',
              }}
            >
              <span>+ Novo Laudo Técnico</span>
            </button>
          </div>
        </div>

        {/* Cards empilhados (sem rolagem horizontal) */}
        <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
          {filteredReports.length === 0 ? (
            <div className="py-12 text-center px-4" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
              <p className="font-medium text-[14px]" style={{ color: 'var(--text-primary)' }}>Nenhum laudo encontrado com os filtros aplicados.</p>
              <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>Utilize o botão acima para cadastrar uma nova inspeção de campo.</p>
            </div>
          ) : (
            filteredReports.map((report) => (
              <div
                key={report.id}
                className="p-4 flex flex-col gap-2 transition-colors cursor-pointer"
                style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
                onClick={() => onEditReport(report)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-[14px]" style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                    {report.code}
                  </span>
                  {renderStatusBadge(report.status)}
                </div>
                <div className="flex items-center gap-2 text-[13px]" style={{ fontFamily: FONT }}>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{report.method}</span>
                  <span style={{ color: 'var(--border-strong)' }} aria-hidden='true'>—</span>
                  <span className="truncate" style={{ color: 'var(--text-secondary)' }} title={report.equipmentTag}>{report.equipmentTag}</span>
                </div>
                <div className="text-[13px] truncate" style={{ fontFamily: FONT, color: 'var(--text-muted)' }} title={report.unitArea}>
                  {report.unitArea}
                </div>
                <div className="flex items-center justify-between gap-2 text-[13px]" style={{ fontFamily: FONT, color: 'var(--text-muted)' }}>
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
        <div className="p-3 border-t flex items-center justify-between text-[13px]" style={{ background: 'var(--bg-surface-alt)', borderColor: 'var(--border)', color: 'var(--text-muted)', fontFamily: FONT }}>
          <span>Mostrando {filteredReports.length} de {reports.length} laudos auditados</span>
          <span className="hidden sm:inline">Registro Rastreável</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px' }}>

      {/* Barra de Ações Superior Limpa */}
      <div className="p-4 border-b flex flex-col md:flex-row md:items-center md:justify-between gap-3" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Busca — largura reduzida para cerca de metade */}
          <div className="relative w-full" style={{ maxWidth: '390px' }}>
            <input
              type="text"
              placeholder="Pesquisar por TAG, laudo, junta soldada ou inspetor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3.5 py-2 text-[14px] transition-all"
              style={{
                borderRadius: '5px',
                fontFamily: FONT,
                background: 'var(--bg-surface-alt)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)'
                e.currentTarget.style.boxShadow = '0 0 0 3px var(--input-focus-ring)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </div>

          {/* Filtro por Método */}
          <div className="flex items-center px-3 py-2" style={{ borderRadius: '5px', background: 'var(--bg-surface-alt)', border: '1px solid var(--border)' }}>
            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="text-[13px] bg-transparent font-medium cursor-pointer"
              style={{ fontFamily: FONT, color: 'var(--text-primary)', outline: 'none' }}
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
          <div className="flex items-center px-3 py-2" style={{ borderRadius: '5px', background: 'var(--bg-surface-alt)', border: '1px solid var(--border)' }}>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-[13px] bg-transparent font-medium cursor-pointer"
              style={{ fontFamily: FONT, color: 'var(--text-primary)', outline: 'none' }}
            >
              <option value="ALL">Todos os Vereditos</option>
              <option value="rascunho">Rascunhos (Coleta)</option>
              <option value="enviado">Em Revisão</option>
              <option value="aprovado">Conformes</option>
              <option value="reprovado">Não Conformes</option>
            </select>
          </div>
        </div>

        {/* Botão de Novo Laudo e Gerar PDF */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={onNewReport}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[14px] font-medium tracking-wide transition-all cursor-pointer shrink-0"
            style={{
              borderRadius: '5px',
              fontFamily: FONT,
              background: 'var(--btn-pri-bg)',
              border: '1px solid var(--btn-pri-border)',
              color: 'var(--btn-pri-text)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--btn-pri-hover-bg)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--btn-pri-bg)'
            }}
          >
            <span>+ Novo Laudo Técnico</span>
          </button>
          <button
            type="button"
            onClick={() => gerarPdfFiltrados()}
            disabled={pdfGeneratingId === 'todos'}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[14px] font-medium tracking-wide transition-all cursor-pointer shrink-0"
            style={{
              borderRadius: '5px',
              fontFamily: FONT,
              background: AZUL_DESTAQUE,
              border: `1px solid ${AZUL_DESTAQUE}`,
              color: '#FFFFFF',
              cursor: pdfGeneratingId === 'todos' ? 'not-allowed' : 'pointer',
              opacity: pdfGeneratingId === 'todos' ? 0.7 : 1,
            }}
          >
            {pdfGeneratingId === 'todos' ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px', animation: 'spin 1s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                Gerando…
              </>
            ) : (
              <>
                <FileText size={14} strokeWidth={1.75} style={{ marginRight: '6px' }} aria-hidden='true' />
                Gerar PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabela — layout fixo, sem rolagem horizontal */}
      <div>
        <table className="w-full text-left border-collapse" style={{ tableLayout: 'fixed', fontFamily: FONT }}>
          <colgroup>
            <col style={{ width: '13%' }} />
            <col style={{ width: '7%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '9%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '18%' }} />
          </colgroup>
          <thead>
            <tr style={{ background: 'var(--bg-surface-alt)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <th className="py-3 px-4 text-[13px] font-medium">Código</th>
              <th className="py-3 px-4 text-[13px] font-medium">Ensaio</th>
              <th className="py-3 px-4 text-[13px] font-medium">Tag</th>
              <th className="py-3 px-4 text-[13px] font-medium">Unidade / área</th>
              <th className="py-3 px-4 text-[13px] font-medium">Emissão</th>
              <th className="py-3 px-4 text-[13px] font-medium">Inspetor</th>
              <th className="py-3 px-4 text-[13px] font-medium">Veredito</th>
              <th className="py-3 px-4 text-[13px] font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y text-[14px]" style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
            {filteredReports.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center px-4" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                  <p className="font-medium text-[14px]" style={{ color: 'var(--text-primary)' }}>Nenhum laudo encontrado com os filtros aplicados.</p>
                  <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>
                    Utilize o botão acima para cadastrar uma nova inspeção de campo.
                  </p>
                </td>
              </tr>
            ) : (
              filteredReports.map((report) => (
                <tr
                  key={report.id}
                  className="transition-colors group cursor-pointer"
                  style={{ borderBottom: '1px solid var(--border)' }}
                  onClick={() => onEditReport(report)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  {/* Código */}
                  <td
                    className="py-3 px-4 font-medium text-[13px] whitespace-nowrap overflow-hidden text-ellipsis"
                    title={report.code}
                    style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {report.code}
                  </td>

                  {/* Ensaio — só a sigla, uma vez */}
                  <td className="py-3 px-4 whitespace-nowrap overflow-hidden text-ellipsis">
                    <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{report.method}</span>
                  </td>

                  {/* Tag */}
                  <td
                    className="py-3 px-4 font-medium text-[13px] whitespace-nowrap overflow-hidden text-ellipsis"
                    title={report.equipmentTag}
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {report.equipmentTag}
                  </td>

                  {/* Unidade / área */}
                  <td
                    className="py-3 px-4 text-[13px] whitespace-nowrap overflow-hidden text-ellipsis"
                    title={report.unitArea}
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {report.unitArea}
                  </td>

                  {/* Emissão */}
                  <td
                    className="py-3 px-4 text-[13px] whitespace-nowrap overflow-hidden text-ellipsis"
                    title={report.date}
                    style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {report.date}
                  </td>

                  {/* Inspetor */}
                  <td
                    className="py-3 px-4 text-[13px] whitespace-nowrap overflow-hidden text-ellipsis"
                    title={report.inspectorName}
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {report.inspectorName}
                  </td>

                  {/* Veredito */}
                  <td className="py-3 px-4 whitespace-nowrap">{renderStatusBadge(report.status)}</td>

                  {/* Ações: Gerar PDF (principal) + Abrir (secundário) + menu "..." */}
                  <td
                    className="py-3 px-2 whitespace-nowrap overflow-visible"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          gerarPdf(report)
                        }}
                        disabled={pdfGeneratingId === report.id}
                        className="px-3 py-1 text-[13px] font-medium transition-colors cursor-pointer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: FONT,
                          borderRadius: '5px',
                          background: pdfGeneratingId === report.id ? 'var(--bg-surface-alt)' : AZUL_DESTAQUE,
                          border: pdfGeneratingId === report.id ? '1px solid var(--border)' : `1px solid ${AZUL_DESTAQUE}`,
                          color: pdfGeneratingId === report.id ? 'var(--text-muted)' : '#FFFFFF',
                          cursor: pdfGeneratingId === report.id ? 'not-allowed' : 'pointer',
                          opacity: pdfGeneratingId === report.id ? 0.6 : 1,
                        }}
                      >
                        {pdfGeneratingId === report.id ? (
                          <>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px', animation: 'spin 1s linear infinite' }}>
                              <circle cx="12" cy="12" r="10" />
                              <path d="M12 6v6l4 2" />
                            </svg>
                            Gerando…
                          </>
                        ) : (
                          <>
                            <FileText size={13} strokeWidth={1.75} style={{ marginRight: '4px' }} aria-hidden='true' />
                            Gerar PDF
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onEditReport(report)
                        }}
                        className="inline-flex items-center justify-center w-8 h-8 transition-colors cursor-pointer"
                        style={{
                          borderRadius: '5px',
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          color: 'var(--text-primary)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt)'
                          e.currentTarget.style.borderColor = 'var(--border-strong)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent'
                          e.currentTarget.style.borderColor = 'var(--border)'
                        }}
                      >
                        <Edit2 size={15} strokeWidth={1.75} aria-hidden='true' />
                      </button>
                      <button
                        type="button"
                        aria-label="Mais ações"
                        title="Mais ações"
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenuOpenId(menuOpenId === report.id ? null : report.id)
                        }}
                        className="inline-flex items-center justify-center w-8 h-8 transition-colors cursor-pointer"
                        style={{
                          borderRadius: '5px',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-secondary)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt)'
                          e.currentTarget.style.borderColor = 'var(--border-strong)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-surface)'
                          e.currentTarget.style.borderColor = 'var(--border)'
                        }}
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
                              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
                              minWidth: '160px',
                              overflow: 'hidden',
                            }}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                closeMenu()
                              }}
                              className="w-full text-left px-3 py-2 text-[13px] font-medium transition-colors cursor-pointer"
                              style={{ fontFamily: FONT, color: 'var(--text-primary)', background: 'transparent' }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt)' }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                            >
                              <RefreshCw size={13} strokeWidth={1.75} style={{ marginRight: '6px' }} aria-hidden='true' />
                              Nova revisão
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                closeMenu()
                              }}
                              className="w-full text-left px-3 py-2 text-[13px] font-medium transition-colors cursor-pointer"
                              style={{ fontFamily: FONT, color: 'var(--text-primary)', background: 'transparent' }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt)' }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                            >
                              <History size={13} strokeWidth={1.75} style={{ marginRight: '6px' }} aria-hidden='true' />
                              Histórico de versões
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                closeMenu()
                              }}
                              className="w-full text-left px-3 py-2 text-[13px] font-medium transition-colors cursor-pointer"
                              style={{ fontFamily: FONT, color: 'var(--text-primary)', background: 'transparent' }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt)' }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                            >
                              <FileText size={13} strokeWidth={1.75} style={{ marginRight: '6px' }} aria-hidden='true' />
                              Duplicar laudo
                            </button>
                            <div style={{ height: '1px', background: 'var(--border)', margin: '6px 0' }} />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(report)
                                closeMenu()
                              }}
                              disabled={report.status !== 'rascunho'}
                              className="w-full text-left px-3 py-2 text-[13px] font-medium transition-colors cursor-pointer"
                              style={{ fontFamily: FONT, color: 'var(--danger, #FF6B6B)', background: 'transparent' }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt)' }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                            >
                              Remover laudo
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Sub-barra da Tabela */}
      <div className="p-3 border-t flex items-center justify-between text-[13px]" style={{ background: 'var(--bg-surface-alt)', borderColor: 'var(--border)', color: 'var(--text-muted)', fontFamily: FONT }}>
        <span>Mostrando {filteredReports.length} de {reports.length} laudos auditados</span>
        <span>Ambiente Seguro • Registro Rastreável</span>
      </div>
      {pdfError && (
        <div style={{ padding: '8px 12px', color: 'var(--danger, #FF6B6B)', fontSize: '12px', fontFamily: FONT, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', margin: '0 12px 8px 12px' }}>
          Erro ao gerar PDF: {pdfError.message}
        </div>
      )}
    </div>
  )
}
