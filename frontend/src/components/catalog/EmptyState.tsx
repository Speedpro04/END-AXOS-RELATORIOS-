interface EmptyStateProps {
  term: string
  onClear: () => void
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  term,
  onClear,
}) => {
  return (
    <section
      role='region'
      aria-label='Resultado da busca'
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '32px 24px',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontSize: '16px',
          fontWeight: 500,
          color: 'var(--text)',
          margin: 0,
        }}
      >
        Nenhum método encontrado para <strong>{term}</strong>
      </p>
      <button
        type='button'
        onClick={onClear}
        style={{
          minHeight: '40px',
          padding: '0 12px',
          borderRadius: '5px',
          border: 'none',
          background: 'transparent',
          color: 'var(--text-muted)',
          fontFamily: 'Archivo, system-ui, -apple-system, Segoe UI, sans-serif',
          fontSize: '14px',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'color 0.12s ease-out',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
      >
        Limpar busca
      </button>
    </section>
  )
}
