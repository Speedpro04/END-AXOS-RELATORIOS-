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
      label: 'TOTAL DE LAUDOS',
      value: total,
      sub: 'Base consolidada',
      icon: Files,
      barWidth: total > 0 ? '100%' : '0%',
    },
    {
      code: '02',
      label: 'EM COLETA / CAMPO',
      value: rascunhos,
      sub: 'Rascunhos pendentes',
      icon: Clock,
      barWidth: total > 0 ? `${(rascunhos / total) * 100}%` : '0%',
    },
    {
      code: '03',
      label: 'EM REVISÃO TÉCNICA',
      value: enviados,
      sub: 'Avaliação Eng. PH',
      icon: ClipboardCheck,
      barWidth: total > 0 ? `${(enviados / total) * 100}%` : '0%',
    },
    {
      code: '04',
      label: 'CONFORMES / APROVADOS',
      value: aprovados,
      sub: 'Critério atendido',
      icon: CheckCircle2,
      barWidth: total > 0 ? `${(aprovados / total) * 100}%` : '0%',
    },
    {
      code: '05',
      label: 'NÃO-CONFORMES',
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
              gap: '14px',
              position: 'relative',
              overflow: 'hidden',
              cursor: 'default',
              transition: 'box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 8px 20px -2px rgba(15, 23, 42, 0.14)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(15, 23, 42, 0.08)'
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
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', minHeight: '34px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '5px',
                    backgroundColor: 'var(--bg-surface-alt)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: 'var(--text-secondary)',
                  }}
                >
                  <IconComponent size={14} strokeWidth={2.5} aria-hidden='true' />
                </div>
                <span
                  style={{
                    fontFamily: 'Archivo, system-ui, -apple-system, Segoe UI, sans-serif',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.03em',
                    textTransform: 'uppercase',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.25,
                  }}
                >
                  {card.label}
                </span>
              </div>

              <span
                style={{
                  fontFamily: 'Archivo, system-ui, -apple-system, Segoe UI, sans-serif',
                  fontSize: '10.5px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  backgroundColor: 'var(--bg-surface-alt)',
                  border: '1px solid var(--border)',
                  borderRadius: '5px',
                  padding: '2px 6px',
                  flexShrink: 0,
                }}
              >
                #{card.code}
              </span>
            </div>

            {/* Número principal — azul acento; vermelho em Não-conformes > 0; secundário quando 0 */}
            <div
              className="animate-number"
              style={{
                fontFamily: 'Archivo, -apple-system, sans-serif',
                fontSize: '38px',
                fontWeight: 800,
                lineHeight: 1,
                color: detailColor,
                letterSpacing: '-0.02em',
                margin: '2px 0',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {card.value.toString().padStart(2, '0')}
            </div>

            {/* Barra de progresso — mesma cor do número */}
            <div
              style={{
                height: '5px',
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
                  transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
              />
            </div>

            {/* Subtítulo */}
            <span
              style={{
                fontSize: '12.5px',
                fontWeight: 500,
                color: 'var(--text-muted)',
                fontFamily: 'Archivo, system-ui, -apple-system, Segoe UI, sans-serif',
                letterSpacing: '0.01em',
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
