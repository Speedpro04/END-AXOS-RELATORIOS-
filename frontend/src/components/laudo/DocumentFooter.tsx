import React from 'react'

export interface DocumentFooterProps {
  /** Número da página atual */
  page: number
  /** Total de páginas */
  totalPages: number
  /** Trecho do hash SHA-256 do laudo */
  hashFragment?: string
  /** Se true, suprime avisos e botões (modo impressão) */
  print?: boolean
}

export const DocumentFooter: React.FC<DocumentFooterProps> = ({
  page,
  totalPages,
  hashFragment,
  print = false,
}) => {
  return (
    <footer
      style={{
        marginTop: print ? 0 : '24px',
        paddingTop: print ? 0 : '12px',
        borderTop: print ? '1px solid #999' : '1px solid var(--border)',
        fontSize: '11px',
        color: print ? '#000' : 'var(--text-muted)',
        fontFamily: "'DM Mono', monospace",
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        ...(print
          ? {
              borderColor: '#999',
              color: '#000',
            }
          : {}),
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span>
          Gerado por Axos Relatórios • axosrelatorios.com
        </span>
        <span>
          Página {page} de {totalPages}
        </span>
        {hashFragment && (
          <span>Hash {hashFragment}</span>
        )}
      </div>

      {!print && (
        <div style={{
          fontSize: '10px',
          color: 'var(--text-faint)',
          textAlign: 'center',
          marginTop: '4px',
        }}>
          QR de verificação pública: axosrelatorios.com/verificar/{hashFragment ?? ''}
        </div>
      )}
    </footer>
  )
}
