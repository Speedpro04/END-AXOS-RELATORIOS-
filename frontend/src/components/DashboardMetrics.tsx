import React from 'react'
import { Files, Clock, ClipboardCheck, CheckCircle2, AlertTriangle } from 'lucide-react'
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
      label: 'Total de laudos',
      value: total,
      sub: 'Base consolidada',
      icon: Files,
      barWidth: total > 0 ? '100%' : '0%',
    },
    {
      code: '02',
      label: 'Em coleta / campo',
      value: rascunhos,
      sub: 'Rascunhos pendentes',
      icon: Clock,
      barWidth: total > 0 ? `${(rascunhos / total) * 100}%` : '0%',
    },
    {
      code: '03',
      label: 'Em revisão técnica',
      value: enviados,
      sub: 'Avaliação Eng. PH',
      icon: ClipboardCheck,
      barWidth: total > 0 ? `${(enviados / total) * 100}%` : '0%',
    },
    {
      code: '04',
      label: 'Conformes / aprovados',
      value: aprovados,
      sub: 'Critério atendido',
      icon: CheckCircle2,
      barWidth: total > 0 ? `${(aprovados / total) * 100}%` : '0%',
    },
    {
      code: '05',
      label: 'Não-conformes',
      value: reprovados,
      sub: 'Reparo / Reinspeção',
      icon: AlertTriangle,
      barWidth: total > 0 ? `${(reprovados / total) * 100}%` : '0%',
    },
  ]

  return (
    <div
      className="stagger"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px',
        width: '100%',
      }}
    >
      {cards.map((card, index) => {
        const IconComponent = card.icon
        const isNaoConforme = card.code === '05'
        const dangerActive = isNaoConforme && card.value > 0
        // Cor única de acento: azul (inclusive valor 0); "Não-conformes" usa vermelho só quando > 0
        const detailColor = dangerActive ? 'var(--danger)' : 'var(--accent-text)'

        return (
          <div
            key={index}
            className="animate-slide-up"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: '5px',
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              position: 'relative',
              overflow: 'hidden',
              cursor: 'default',
              transition: 'background-color 0.12s ease-out, border-color 0.12s ease-out',
            }}
          >
            {/* Faixa superior (borda de acento) */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                backgroundColor: detailColor,
              }}
            />

            {/* Cabeçalho do Card: Ícone + Label + Código */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', minHeight: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '5px',
                    backgroundColor: 'var(--bg-surface-alt)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: 'var(--text-secondary)',
                  }}
                >
                  <IconComponent size={16} strokeWidth={1.75} aria-hidden='true' />
                </div>
                <span
                  style={{
                    fontFamily: 'Arial, Helvetica, sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                    lineHeight: 1.3,
                  }}
                >
                  {card.label}
                </span>
              </div>

              <span
                style={{
                  fontFamily: 'Arial, Helvetica, sans-serif',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  backgroundColor: 'var(--bg-surface-alt)',
                  border: '1px solid var(--border)',
                  borderRadius: '5px',
                  padding: '2px 6px',
                  flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                #{card.code}
              </span>
            </div>

            {/* Número principal — 28px peso 600 (padrão de KPI da Axos) */}
            <div
              className="animate-number"
              style={{
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontSize: '28px',
                fontWeight: 600,
                lineHeight: 1.2,
                color: detailColor,
                letterSpacing: '-0.01em',
                margin: '2px 0',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {card.value.toString().padStart(2, '0')}
            </div>

            {/* Barra de progresso — mesma cor do número */}
            <div
              style={{
                height: '4px',
                backgroundColor: 'var(--bg-surface-alt)',
                borderRadius: '5px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: card.barWidth,
                  backgroundColor: detailColor,
                  borderRadius: '5px',
                  transition: 'width 0.4s ease-out',
                }}
              />
            </div>

            {/* Subtítulo */}
            <span
              style={{
                fontSize: '12px',
                fontWeight: 400,
                color: 'var(--text-muted)',
                fontFamily: 'Arial, Helvetica, sans-serif',
                lineHeight: 1.4,
              }}
            >
              {card.sub}
            </span>
          </div>
        )
      })}
    </div>
  )
}
