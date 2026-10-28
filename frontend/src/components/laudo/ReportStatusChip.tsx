import React from 'react'

export interface ReportStatusChipProps {
  localStatus?: string
  serverStatus?: string | null
  lastError?: string | null
}

export function ReportStatusChip(props: ReportStatusChipProps) {
  const { localStatus = 'rascunho', serverStatus, lastError } = props

  const colors: Record<string, string> = {
    rascunho: '#f3f4f6',
    pronto: '#dcfce7',
    enviando: '#dbeafe',
    sincronizado: '#dcfce7',
    erro: '#fecaca',
  }

  const colorsText: Record<string, string> = {
    rascunho: '#6b7280',
    pronto: '#166534',
    enviando: '#1d4ed8',
    sincronizado: '#166534',
    erro: '#991b1b',
  }

  const borderColors: Record<string, string> = {
    rascunho: '#e5e7eb',
    pronto: '#86efac',
    enviando: '#3b82f6',
    sincronizado: '#86efac',
    erro: '#fca5a5',
  }

  const cfg = colors[localStatus] || colors.rascunho
  const cfgText = colorsText[localStatus] || colorsText.rascunho
  const cfgBorder = borderColors[localStatus] || borderColors.rascunho

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 10px',
      borderRadius: '4px',
      background: cfg,
      color: cfgText,
      fontSize: '11px',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      border: `1px solid ${cfgBorder}`,
      whiteSpace: 'nowrap',
    }}>
      {localStatus.charAt(0).toUpperCase() + localStatus.slice(1)}
      {localStatus === 'sincronizado' && serverStatus && (
        <span style={{ fontSize: '10px', opacity: 0.8, marginLeft: '4px' }}>
          ({serverStatus})
        </span>
      )}
      {lastError && localStatus === 'erro' && (
        <span style={{ fontSize: '10px', fontWeight: 600, marginLeft: '6px', whiteSpace: 'nowrap' }}>
          ⚠ {lastError}
        </span>
      )}
    </div>
  )
}