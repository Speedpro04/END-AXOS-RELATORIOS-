import { type MethodCatalogItem } from '../../data/methodsCatalog'
import { MethodButton } from './MethodButton'

interface MethodSectionProps {
  group: { id: string; name: string }
  methods: MethodCatalogItem[]
  hrefFor: (code: string) => string
  onClick: (code: string) => void
  highlightTerm?: string
}

export const MethodSection: React.FC<MethodSectionProps> = ({
  group,
  methods,
  hrefFor,
  onClick,
  highlightTerm,
}) => {
  const sectionId = 'section-' + group.id

  return (
    <section aria-labelledby={sectionId} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <h2 id={sectionId} style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)', margin: 0, letterSpacing: '-0.01em' }}>
        {group.name}
      </h2>

      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        {methods.map((m) => (
          <MethodButton
            key={m.code}
            item={m}
            href={hrefFor(m.code)}
            onClick={onClick}
            highlightTerm={highlightTerm}
          />
        ))}
      </div>
    </section>
  )
}
