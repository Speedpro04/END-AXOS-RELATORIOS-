import { type MethodCatalogItem } from '../../data/methodsCatalog'
import { MethodButton } from './MethodButton'

interface MethodSectionProps {
  group: { id: string; name: string }
  methods: MethodCatalogItem[]
  hrefFor: (code: string) => string
  onClick: (code: string) => void
  draftByMethod?: Record<string, { status: 'rascunho' | 'draft'; count: number }>
  highlightTerm?: string
}

export const MethodSection: React.FC<MethodSectionProps> = ({
  group,
  methods,
  hrefFor,
  onClick,
  draftByMethod,
  highlightTerm,
}) => {
  const availableMethods = methods.filter((m) => m.available)
  const unavailableMethods = methods.filter((m) => !m.available)
  const sectionId = 'section-' + group.id

  return (
    <section aria-labelledby={sectionId} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <h2 id={sectionId} style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)', margin: 0, letterSpacing: '-0.01em' }}>
        {group.name}
      </h2>

      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        {availableMethods.map((m) => {
          const draft = draftByMethod?.[m.code]
          return (
            <MethodButton
              key={m.code}
              item={m}
              href={hrefFor(m.code)}
              onClick={onClick}
              status={draft?.status as 'rascunho' | 'draft' | null}
              draftCount={draft?.count}
              highlightTerm={highlightTerm}
            />
          )
        })}

        {unavailableMethods.map((m) => (
          <button
            key={m.code}
            type='button'
            disabled
            aria-disabled='true'
            style={{
              position: 'relative',
              minHeight: '40px',
              padding: '0 12px',
              borderRadius: '5px',
              border: '1px solid var(--border)',
              background: 'var(--surface-muted)',
              color: 'var(--text-muted)',
              fontFamily: 'Archivo, system-ui, -apple-system, Segoe UI, sans-serif',
              fontSize: '16px',
              fontWeight: 500,
              lineHeight: '1.2',
              cursor: 'not-allowed',
              textDecoration: 'none',
              transition: 'none',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.name}
              </span>
              <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {m.code}
              </span>
            </div>
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>
              Em breve
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
