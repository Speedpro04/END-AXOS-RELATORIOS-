import React from 'react'

export type LaudoLocalStatus = 'rascunho' | 'pronto' | 'enviando' | 'sincronizado' | 'erro'

interface ReportStatusChipProps {
  localStatus: LaudoLocalStatus
  serverStatus?: string | null
  lastError?: string | null
}

const STATUS_CONFIG: Record<LaudoLocalStatus, { label: string; color: string; bg: string; border: string }> = {
  rascunho: { label: 'Rascunho', color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb' },
  pronto: { label: 'Pronto para envio', color: '#0f766e', bg: '#ccfbf1', border: '#14b8a6' },
  enviando: { label: 'Enviando...', color: '#1d4ed8', bg: '#dbeafe', border: '#3b82f6' },
  sincronizado: { label: 'Sincronizado', color: '#166534', bg: '#dcfce7', border: '#86efac' },
  erro: { label: 'Erro', color: '#991b1b', bg: '#fecaca', border: '#fca5a5' },
}

export function ReportStatusChip(props: ReportStatusChipProps) {
  const { localStatus, serverStatus, lastError } = props
  const config = STATUS_CONFIG[localStatus]
  const showError = localStatus === 'erro' && lastError

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 10px',
      borderRadius: '4px',
      background: config.bg,
      color: config.color,
      fontSize: '11px',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      border: `1px solid ${config.border}`,
      whiteSpace: 'nowrap',
    }}>
      <span
        style={{
          display: 'inline-block',
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          background: localStatus === 'erro' ? '#991b1b' : config.color,
          animation: localStatus === 'enviando' ? 'pulse 2s infinite' : 'none',
        }}
      />
      {config.label}
      {localStatus === 'sincronizado' && serverStatus && (
        <span
          style={{
            fontSize: '10px',
            opacity: 0.8,
            marginLeft: '4px',
          }}
        >
          ({serverStatus})
        </span>
      )}
      {showError && (
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            marginLeft: '6px',
            whiteSpace: 'nowrap',
          }}
        >
          ⚠ {lastError}
        </span>
      )}
    </div>
  )
}