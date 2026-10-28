import React from 'react'

interface EvidenceItem {
  id: string
  url: string
  caption: string
}

interface EvidenceBlockProps {
  evidence: EvidenceItem[]
  onAdd: (item: EvidenceItem) => void
  onRemove: (id: string) => void
  onCaptionChange: (id: string, caption: string) => void
}

export const EvidenceBlock: React.FC<EvidenceBlockProps> = ({
  evidence,
  onAdd,
  onRemove,
  onCaptionChange,
}) => {
  const [newUrl, setNewUrl] = React.useState('')
  const [newCaption, setNewCaption] = React.useState('')

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: '6px',
      padding: '14px',
      background: 'var(--bg-surface)',
    }}>
      <div style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif",
        fontSize: '12px',
        fontWeight: 600,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '10px',
      }}>
        Evidências
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
        <input
          type="text"
          placeholder="Legenda (ex: tela do aparelho, foto, relatório de calibração)"
          value={newCaption}
          onChange={(e) => setNewCaption(e.target.value)}
          style={{
            flex: 1,
            padding: '8px 10px',
            borderRadius: '4px',
            border: '1px solid var(--border)',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            fontSize: '12px',
          }}
        />
        <button
          type="button"
          onClick={() => {
            if (!newUrl || !newCaption) return
            const item: EvidenceItem = {
              id: crypto.randomUUID(),
              url: newUrl,
              caption: newCaption,
            }
            onAdd(item)
            setNewUrl('')
            setNewCaption('')
          }}
          disabled={!newUrl || !newCaption}
          style={{
            padding: '8px 14px',
            borderRadius: '4px',
            border: '1px solid var(--border)',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Adicionar
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {evidence.map((item) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: '4px',
              border: '1px solid var(--border)',
              background: 'var(--bg-surface-alt)',
            }}
          >
            <span style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '11px',
              color: 'var(--text-muted)',
              wordBreak: 'break-all',
              flex: 1,
            }}>
              {item.url}
            </span>
            <input
              type="text"
              value={item.caption}
              onChange={(e) => onCaptionChange(item.id, e.target.value)}
              style={{
                padding: '6px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                minWidth: '140px',
              }}
            />
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              style={{
                padding: '6px',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
