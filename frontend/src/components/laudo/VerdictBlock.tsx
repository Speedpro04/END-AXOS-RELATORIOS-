import React from 'react'

export type UsVerdict = 'A' | 'R' | 'NEC' | 'AC'

interface VerdictBlockProps {
  verdict: UsVerdict | null
  onChange: (verdict: UsVerdict) => void
  conditionalData?: {
    approverName: string
    approverRole: string
    approverDate: string
    reason: string
  }
  onConditionalChange?: (key: string, value: string) => void
  hasRejectedIndication?: boolean
}

const VERDICT_OPTIONS: Array<{ value: UsVerdict; label: string }> = [
  { value: 'A', label: 'Aprovado' },
  { value: 'R', label: 'Reprovado' },
  { value: 'NEC', label: 'NEC (Necessário Exame Complementar)' },
  { value: 'AC', label: 'Aprovado condicional' },
]

export const VerdictBlock: React.FC<VerdictBlockProps> = ({
  verdict,
  onChange,
  conditionalData,
  onConditionalChange,
  hasRejectedIndication,
}) => {
  const isConditional = verdict === 'AC'

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
        Veredito do Inspetor
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {VERDICT_OPTIONS.map((opt) => {
          const isSelected = verdict === opt.value
          const colorMap: Record<UsVerdict, string> = {
            A: '#166534',
            R: '#991b1b',
            NEC: '#92400e',
            AC: '#1e3a8a',
          }
          const bgMap: Record<UsVerdict, string> = {
            A: '#dcfce7',
            R: '#fecaca',
            NEC: '#fef3c7',
            AC: '#dbeafe',
          }
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '4px',
                border: `2px solid ${isSelected ? colorMap[opt.value] : 'transparent'}`,
                background: isSelected ? bgMap[opt.value] : 'transparent',
                color: isSelected ? colorMap[opt.value] : 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {hasRejectedIndication && verdict === 'A' && (
        <div style={{
          marginTop: '10px',
          padding: '8px 10px',
          borderRadius: '4px',
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          color: '#991b1b',
          fontSize: '12px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          ⚠️ Há indicação rejeitada e veredito Aprovado — revisar antes de emitir
        </div>
      )}

      {isConditional && conditionalData && (
        <div style={{
          marginTop: '14px',
          padding: '12px',
          borderRadius: '4px',
          background: '#f8fafc',
          border: '1px solid var(--border)',
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '8px',
          }}>
            Liberação Condicional
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Responsável pela aprovação
              </label>
              <input
                type="text"
                value={conditionalData.approverName}
                onChange={(e) => onConditionalChange?.('approverName', e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Cargo
              </label>
              <input
                type="text"
                value={conditionalData.approverRole}
                onChange={(e) => onConditionalChange?.('approverRole', e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Data
              </label>
              <input
                type="date"
                value={conditionalData.approverDate}
                onChange={(e) => onConditionalChange?.('approverDate', e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Motivo (obrigatório)
              </label>
              <input
                type="text"
                value={conditionalData.reason}
                onChange={(e) => onConditionalChange?.('reason', e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
