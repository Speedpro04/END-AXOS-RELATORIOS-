interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  onClear: () => void
  resultCount: number
  onFocusFirstResult: () => void
  style?: React.CSSProperties
}

export const SearchField: React.FC<SearchFieldProps> = ({
  value,
  onChange,
  onClear,
  resultCount,
  onFocusFirstResult,
  style,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === '/') {
      e.preventDefault()
      ;(e.target as HTMLInputElement).focus()
    }
    if (e.key === 'Escape') {
      onClear()
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      onFocusFirstResult()
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', ...style }}>
      <input
        id='catalogo-busca'
        type='text'
        aria-label='Buscar por método, sigla ou norma'
        placeholder='Buscar por método, sigla ou norma'
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        autoComplete='off'
        spellCheck={false}
        style={{
          width: '100%',
          height: '48px',
          boxSizing: 'border-box',
          padding: '0 48px 0 40px',
          borderRadius: '5px',
          border: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          fontSize: '15px',
          fontFamily: 'Archivo, system-ui, -apple-system, Segoe UI, sans-serif',
        }}
      />
      <span
        style={{
          position: 'absolute',
          left: '14px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-muted)',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
        aria-hidden='true'
      >
        <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.75' strokeLinecap='round' strokeLinejoin='round'>
          <circle cx='11' cy='11' r='8' />
          <line x1='21' y1='21' x2='16.65' y2='16.65' />
        </svg>
      </span>
      <span
        style={{
          position: 'absolute',
          right: '40px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-muted)',
          pointerEvents: 'none',
          userSelect: 'none',
          fontSize: '11px',
          fontWeight: 500,
        }}
        aria-hidden='true'
      >
        /
      </span>
      {value.length > 0 && (
        <button
          type='button'
          onClick={onClear}
          style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px',
            fontSize: '16px',
          }}
        >
          ×
        </button>
      )}
      <span
        role='status'
        aria-live='polite'
        aria-atomic='true'
        style={{
          position: 'absolute',
          left: '-9999px',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}
      >
        {resultCount === 0 ? 'Nenhum resultado encontrado' : `${resultCount} resultado(s) encontrado(s)`}
      </span>
    </div>
  )
}
