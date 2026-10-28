import React from 'react'

interface SignatureCardProps {
  signature: {
    executorName: string
    level: 'N1' | 'N2' | 'N3'
    certificateNumber: string
    certifyingBody: string
    qualificationValidity: string
    emissionDate: string
    optionalViews: {
      responsible: string | null
      contractor: string | null
    }
  }
  onChange: (key: string, value: string) => void
}

const LEVELS: Array<{ value: 'N1' | 'N2' | 'N3'; label: string }> = [
  { value: 'N1', label: 'N1' },
  { value: 'N2', label: 'N2' },
  { value: 'N3', label: 'N3' },
]

export const SignatureCard: React.FC<SignatureCardProps> = ({
  signature,
  onChange,
}) => {
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
        Assinatura do Executante
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Executante
          </label>
          <input
            type="text"
            value={signature.executorName}
            onChange={(e) => onChange('executorName', e.target.value)}
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
            Nível
          </label>
          <select
            value={signature.level}
            onChange={(e) => onChange('level', (e.target.value as 'N1' | 'N2' | 'N3'))}
            style={{
              width: '100%',
              padding: '6px 8px',
              borderRadius: '4px',
              border: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '12px',
            }}
          >
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Nº do certificado
          </label>
          <input
            type="text"
            value={signature.certificateNumber}
            onChange={(e) => onChange('certificateNumber', e.target.value)}
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Órgão certificador
          </label>
          <input
            type="text"
            value={signature.certifyingBody}
            onChange={(e) => onChange('certifyingBody', e.target.value)}
            placeholder="Campo livre"
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
            Validade da qualificação
          </label>
          <input
            type="date"
            value={signature.qualificationValidity}
            onChange={(e) => onChange('qualificationValidity', e.target.value)}
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

      <div style={{ marginTop: '10px' }}>
        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
          Data de emissão
        </label>
        <input
          type="date"
          value={signature.emissionDate}
          onChange={(e) => onChange('emissionDate', e.target.value)}
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

      <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
        <div style={{
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '8px',
        }}>
          Vistos opcionais
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Responsável
            </label>
            <input
              type="text"
              value={signature.optionalViews.responsible || ''}
              onChange={(e) => onChange('responsible', e.target.value)}
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
              Contratante
            </label>
            <input
              type="text"
              value={signature.optionalViews.contractor || ''}
              onChange={(e) => onChange('contractor', e.target.value)}
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

      <div style={{
        marginTop: '14px',
        padding: '10px',
        borderRadius: '4px',
        background: '#f8fafc',
        border: '1px solid var(--border)',
        fontSize: '11px',
        color: 'var(--text-muted)',
        textAlign: 'center',
      }}>
        Espaço reservado para hash e QR de verificação pública
      </div>
    </div>
  )
}
