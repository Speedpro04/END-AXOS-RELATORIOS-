import React from 'react'

interface ValidityBadgeProps {
  qualificationValidity: string
  onBlockEmission?: boolean
}

export const ValidityBadge: React.FC<ValidityBadgeProps> = ({
  qualificationValidity,
  onBlockEmission = false,
}) => {
  const now = new Date()
  const expiry = qualificationValidity ? new Date(qualificationValidity) : null
  const isValid = expiry ? expiry > now : false

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 10px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        background: isValid ? '#dcfce7' : '#fecaca',
        color: isValid ? '#166534' : '#991b1b',
        border: `1px solid ${isValid ? '#86efac' : '#fca5a5'}`,
      }}
    >
      {isValid ? 'VALIDADE CONFORME' : 'VENCIDO'}
      {!isValid && onBlockEmission && (
        <span style={{ fontSize: '11px', fontWeight: 400 }}>— emissão bloqueada</span>
      )}
    </span>
  )
}
