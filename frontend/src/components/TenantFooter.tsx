import React from 'react'

export const TenantFooter: React.FC = () => {
  return (
    <footer style={{
      width: '100%',
      background: 'var(--bg-surface)',
      borderTop: '1px solid var(--border)',
      padding: '14px 0',
      userSelect: 'none',
      marginTop: 'auto',
      position: 'relative',
      zIndex: 10,
      transition: 'background 0.2s ease, border-color 0.2s ease',
    }}>
      <div style={{
        maxWidth: '1280px', margin: '0 auto', padding: '0 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '12px', flexWrap: 'wrap',
      }}>
        {/* Identidade AXOS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: '#10b981',
          }} />
          <span style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif", fontSize: '15px', color: 'var(--text-muted)' }}>
            Tecnologia{' '}
            <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>AXOS Relatórios</strong>
            {' · '}
            <span>Plataforma de Integridade Estrutural & NDT</span>
          </span>
        </div>

        {/* Status técnico */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontFamily: "'DM Mono', monospace", fontSize: '14px', color: 'var(--text-muted)' }}>
          <span>BUFFER LOCAL ATIVO</span>
          <span style={{ color: 'var(--border-strong)' }}>•</span>
          <span>CERTIFICAÇÃO DIGITAL SHA-256</span>
          <span style={{ color: 'var(--border-strong)' }}>•</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>v2.4</span>
        </div>
      </div>
    </footer>
  )
}
