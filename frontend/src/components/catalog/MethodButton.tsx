import { type MethodCatalogItem } from '../../data/methodsCatalog'

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

type DraftStatus = 'rascunho' | 'draft' | 'returned' | null | undefined

interface MethodButtonProps {
  item: MethodCatalogItem
  href: string
  onClick: (code: string) => void
  status?: DraftStatus
  draftCount?: number
  highlightTerm?: string
}

export const MethodButton: React.FC<MethodButtonProps> = ({
  item,
  href,
  onClick,
  status,
  draftCount,
  highlightTerm,
}) => {
  const hasDraft = (status === 'rascunho' || status === 'draft') && (!!draftCount && draftCount > 0)
  const draftLabel = draftCount && draftCount > 1 ? 'Rascunho em andamento (' + draftCount + ')' : 'Rascunho em andamento'
  const isDisabled = !item.available

  const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isDisabled) {
      ;(e.currentTarget as HTMLElement).style.background = 'var(--surface-muted)'
    }
  }

  const handleMouseLeave = (e: React.MouseEvent<HTMLAnchorElement>) => {
    ;(e.currentTarget as HTMLElement).style.background = 'var(--surface)'
  }

  const handleFocus = (e: React.FocusEvent<HTMLAnchorElement>) => {
    if (!isDisabled) {
      ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px var(--accent-soft)'
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLAnchorElement>) => {
    ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
  }

  function highlightName(name: string): React.ReactNode {
    if (!highlightTerm) return name
    const q = normalize(highlightTerm)
    const n = normalize(name)
    const idx = n.indexOf(q)
    if (idx === -1) return name
    return (
      <>
        {name.slice(0, idx)}
        <span style={{ fontWeight: 600 }}>{name.slice(idx, idx + highlightTerm.length)}</span>
        {name.slice(idx + highlightTerm.length)}
      </>
    )
  }

  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault()
        if (!isDisabled) {
          onClick(item.code)
        }
      }}
      aria-disabled={isDisabled ? true : undefined}
      tabIndex={isDisabled ? -1 : 0}
      style={{
        display: 'block',
        width: '100%',
        minHeight: '40px',
        padding: '0 12px',
        borderRadius: '5px',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        color: 'var(--text)',
        textDecoration: 'none',
        fontFamily: 'Archivo, system-ui, -apple-system, Segoe UI, sans-serif',
        fontSize: '16px',
        fontWeight: 500,
        lineHeight: '1.2',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.12s ease-out, border-color 0.12s ease-out',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {highlightName(item.name)}
        </span>
        <span
          style={{
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
            minWidth: '24px',
            textAlign: 'right',
          }}
        >
          {item.code}
        </span>
      </div>

      {!item.available && (
        <span style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          fontSize: '12px',
          fontWeight: 500,
          color: 'var(--text-muted)',
        }}>
          Em breve
        </span>
      )}

      {hasDraft && (
        <span style={{
          position: 'absolute',
          left: '8px',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '11px',
          color: 'var(--text)',
          background: 'var(--accent-soft)',
          padding: '1px 6px',
          borderRadius: '3px',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--accent-text)' }} />
          {draftLabel}
        </span>
      )}
    </a>
  )
}
