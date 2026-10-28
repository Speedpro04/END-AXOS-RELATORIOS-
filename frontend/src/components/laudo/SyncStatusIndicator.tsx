import React, { useEffect, useState } from 'react'
import { syncManager } from '../../services/sync'

export const SyncStatusIndicator: React.FC = () => {
  const [state, setState] = useState(syncManager.getState())

  useEffect(() => {
    const unsubscribe = syncManager.subscribe(setState)
    return () => unsubscribe()
  }, [])

  const isOnline = state.isOnline
  const pending = state.pendingCount

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        background: isOnline ? '#dcfce7' : '#fecaca',
        color: isOnline ? '#166534' : '#991b1b',
        fontSize: '12px',
        fontWeight: 600,
        borderRadius: '4px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        border: `1px solid ${isOnline ? '#86efac' : '#fca5a5'}`,
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: isOnline ? '#166534' : '#991b1b',
          animation: isOnline ? 'pulse 2s infinite' : 'none',
        }}
      />
      {isOnline ? 'Online' : 'Offline'}
      {pending > 0 && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            marginLeft: '8px',
            padding: '2px 8px',
            borderRadius: '4px',
            background: '#fef2f2',
            color: '#991b1b',
            fontSize: '11px',
            fontWeight: 700,
            border: '1px solid #fca5a5',
          }}
        >
          ⚠ {pending} pendente{pending > 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}