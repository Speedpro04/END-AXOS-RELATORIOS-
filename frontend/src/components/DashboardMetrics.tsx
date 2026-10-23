import React from 'react'
import type { InspectionReport } from '../types/inspection'

interface DashboardMetricsProps {
  reports: InspectionReport[]
}

export const DashboardMetrics: React.FC<DashboardMetricsProps> = ({ reports }) => {
  const total = reports.length
  const rascunhos = reports.filter((r) => r.status === 'rascunho').length
  const enviados = reports.filter((r) => r.status === 'enviado').length
  const aprovados = reports.filter((r) => r.status === 'aprovado').length
  const reprovados = reports.filter((r) => r.status === 'reprovado').length

  const cards = [
    {
      code: '01',
      label: 'TOTAL DE LAUDOS',
      value: total,
      sub: 'Base consolidada',
      accent: '#0284c7',
      barColor: '#38bdf8',
      bgColor: '#f0f9ff',
      barWidth: total > 0 ? '100%' : '0%',
    },
    {
      code: '02',
      label: 'EM COLETA / CAMPO',
      value: rascunhos,
      sub: 'Rascunhos pendentes',
      accent: '#64748b',
      barColor: '#94a3b8',
      bgColor: '#f8fafc',
      barWidth: total > 0 ? `${(rascunhos / total) * 100}%` : '0%',
    },
    {
      code: '03',
      label: 'EM REVISÃO TÉCNICA',
      value: enviados,
      sub: 'Avaliação Eng. PH',
      accent: '#d97706',
      barColor: '#f59e0b',
      bgColor: '#fffbeb',
      barWidth: total > 0 ? `${(enviados / total) * 100}%` : '0%',
    },
    {
      code: '04',
      label: 'CONFORMES / APROVADOS',
      value: aprovados,
      sub: 'Critério atendido',
      accent: '#16a34a',
      barColor: '#4ade80',
      bgColor: '#f0fdf4',
      barWidth: total > 0 ? `${(aprovados / total) * 100}%` : '0%',
    },
    {
      code: '05',
      label: 'NÃO-CONFORMES',
      value: reprovados,
      sub: 'Reparo / Reinspeção',
      accent: '#ef4444',
      barColor: '#f87171',
      bgColor: '#fef2f2',
      barWidth: total > 0 ? `${(reprovados / total) * 100}%` : '0%',
    },
  ]

  return (
    <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
      {cards.map((card, index) => (
        <div
          key={index}
          className="animate-slide-up"
          style={{
            background: 'rgba(255,255,255,0.45)',
            border: '1px solid var(--border)',
            borderRadius: '3px',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            transition: 'all 0.15s ease',
            position: 'relative',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-strong)'
            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(15, 23, 42, 0.07)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.04)'
          }}
        >
          {/* Topo do Card */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}>
              {card.label}
            </span>
            <span style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: '13px',
              color: 'var(--text-faint)',
            }}>
              #{card.code}
            </span>
          </div>

          {/* Número Principal */}
          <div
            className="animate-number"
            style={{
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif",
              fontSize: '37px',
              fontWeight: 600,
              lineHeight: 1,
              color: card.accent,
              letterSpacing: '-0.02em',
            }}
          >
            {card.value.toString().padStart(2, '0')}
          </div>

          {/* Barra de Progresso */}
          <div style={{
            height: '4px',
            backgroundColor: 'var(--border)',
            borderRadius: '3px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: card.barWidth,
              backgroundColor: card.barColor,
              borderRadius: '3px',
              transition: 'width 0.4s ease',
            }} />
          </div>

          {/* Subtítulo */}
          <span style={{
            fontSize: '14px',
            color: 'var(--text-muted)',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif",
          }}>
            {card.sub}
          </span>
        </div>
      ))}
    </div>
  )
}
