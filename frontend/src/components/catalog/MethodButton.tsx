import { type MethodCatalogItem } from '../../data/methodsCatalog'

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

interface MethodButtonProps {
  item: MethodCatalogItem
  href: string
  onClick: (code: string) => void
  highlightTerm?: string
}

export const MethodButton: React.FC<MethodButtonProps> = ({
  item,
  href,
  onClick,
  highlightTerm,
}) => {
  const isDisabled = !item.available

  const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isDisabled) {
      ;(e.currentTarget as HTMLElement).style.background = 'var(--card-met-azul-hover)'
      ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--card-met-azul-hover)'
    }
  }

  const handleMouseLeave = (e: React.MouseEvent<HTMLAnchorElement>) => {
    ;(e.currentTarget as HTMLElement).style.background = 'var(--card-met-azul)'
    ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--card-met-azul)'
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        height: '52px',
        padding: '0 20px',
        boxSizing: 'border-box',
        borderRadius: '5px',
        border: '1px solid var(--card-met-azul)',
        background: 'var(--card-met-azul)',
        color: 'var(--card-met-azul-texto)',
        textDecoration: 'none',
        fontFamily: 'Archivo, system-ui, -apple-system, Segoe UI, sans-serif',
        cursor: isDisabled ? 'default' : 'pointer',
        transition: 'background 0.12s ease-out, border-color 0.12s ease-out',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={(e) => {
        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px var(--input-focus-ring)'
      }}
      onBlur={(e) => {
        ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
      }}
    >
      <span
        style={{
          fontSize: '16px',
          fontWeight: 500,
          color: isDisabled ? 'var(--text-muted)' : 'inherit',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {isDisabled ? 'Em breve' : highlightName(item.name)}
      </span>
      <span
        style={{
          fontSize: '14px',
          fontWeight: 500,
          color: isDisabled ? 'var(--text-muted)' : 'inherit',
          opacity: isDisabled ? 1 : 0.75,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
      >
        {item.code}
      </span>
    </a>
  )
}
