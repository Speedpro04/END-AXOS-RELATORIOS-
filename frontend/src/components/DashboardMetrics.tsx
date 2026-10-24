import React from 'react'
import { Files, Clock, ClipboardCheck, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { InspectionReport } from '../types/inspection'
import { useTheme } from '../contexts/ThemeContext'

interface DashboardMetricsProps {
  reports: InspectionReport[]
}

export const DashboardMetrics: React.FC<DashboardMetricsProps> = ({ reports }) => {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

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
      accent: isDark ? '#38BDF8' : '#0284C7',
      barColor: isDark ? '#38BDF8' : '#0284C7',
      iconBg: isDark ? 'rgba(56, 189, 248, 0.14)' : '#E0F2FE',
      barWidth: total > 0 ? '100%' : '0%',
    },
    {
      code: '02',
      label: 'EM COLETA / CAMPO',
      value: rascunhos,
      sub: 'Rascunhos pendentes',
      icon: Clock,
      accent: isDark ? '#60A5FA' : '#2563EB',
      barColor: isDark ? '#60A5FA' : '#3B82F6',
      iconBg: isDark ? 'rgba(96, 165, 250, 0.14)' : '#EFF6FF',
      barWidth: total > 0 ? `${(rascunhos / total) * 100}%` : '0%',
    },
    {
      code: '03',
      label: 'EM REVISÃO TÉCNICA',
      value: enviados,
      sub: 'Avaliação Eng. PH',
      icon: ClipboardCheck,
      accent: isDark ? '#FBBF24' : '#D97706',
      barColor: isDark ? '#F59E0B' : '#D97706',
      iconBg: isDark ? 'rgba(251, 191, 36, 0.14)' : '#FEF3C7',
      barWidth: total > 0 ? `${(enviados / total) * 100}%` : '0%',
    },
    {
      code: '04',
      label: 'CONFORMES / APROVADOS',
      value: aprovados,
      sub: 'Critério atendido',
      icon: CheckCircle2,
      accent: isDark ? '#34D399' : '#16A34A',
      barColor: isDark ? '#10B981' : '#16A34A',
      iconBg: isDark ? 'rgba(52, 211, 153, 0.14)' : '#DCFCE7',
      barWidth: total > 0 ? `${(aprovados / total) * 100}%` : '0%',
    },
    {
      code: '05',
      label: 'NÃO-CONFORMES',
      value: reprovados,
      sub: 'Reparo / Reinspeção',
      icon: AlertTriangle,
      accent: isDark ? '#F87171' : '#DC2626',
      barColor: isDark ? '#EF4444' : '#DC2626',
      iconBg: isDark ? 'rgba(248, 113, 113, 0.14)' : '#FEE2E2',
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
        return (
          <div
            key={index}
            className="animate-slide-up"
            style={{
              background: isDark
                ? 'linear-gradient(180deg, #1C1F24 0%, #15171A 100%)'
                : '#FFFFFF',
              border: `1px solid ${isDark ? '#2B3037' : '#E2E8F0'}`,
              borderRadius: '8px',
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: isDark
                ? '0 4px 16px rgba(0, 0, 0, 0.45)'
                : '0 2px 8px rgba(15, 23, 42, 0.05)',
              cursor: 'default',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.borderColor = card.accent
              e.currentTarget.style.boxShadow = isDark
                ? `0 10px 24px -2px rgba(0, 0, 0, 0.6), 0 0 0 1px ${card.accent}33`
                : `0 8px 20px -2px rgba(15, 23, 42, 0.1), 0 0 0 1px ${card.accent}33`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.borderColor = isDark ? '#2B3037' : '#E2E8F0'
              e.currentTarget.style.boxShadow = isDark
                ? '0 4px 16px rgba(0, 0, 0, 0.45)'
                : '0 2px 8px rgba(15, 23, 42, 0.05)'
            }}
          >
            {/* Faixa de Destaque Superior */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                backgroundColor: card.accent,
              }}
            />

            {/* Cabeçalho do Card: Ícone + Label + Código */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', minHeight: '34px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '6px',
                    backgroundColor: card.iconBg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: card.accent,
                  }}
                >
                  <IconComponent size={14} strokeWidth={2.5} />
                </div>
                <span
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: '10.5px',
                    fontWeight: 700,
                    letterSpacing: '0.03em',
                    textTransform: 'uppercase',
                    color: isDark ? '#E2E8F0' : '#334155',
                    lineHeight: 1.25,
                  }}
                >
                  {card.label}
                </span>
              </div>

              <span
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: '10.5px',
                  fontWeight: 600,
                  color: isDark ? '#94A3B8' : '#64748B',
                  backgroundColor: isDark ? '#22262D' : '#F1F5F9',
                  border: `1px solid ${isDark ? '#313742' : '#E2E8F0'}`,
                  borderRadius: '4px',
                  padding: '2px 6px',
                  flexShrink: 0,
                }}
              >
                #{card.code}
              </span>
            </div>

            {/* Número Principal de Alto Contraste */}
            <div
              className="animate-number"
              style={{
                fontFamily: "'Archivo', -apple-system, sans-serif",
                fontSize: '38px',
                fontWeight: 800,
                lineHeight: 1,
                color: card.accent,
                letterSpacing: '-0.02em',
                margin: '2px 0',
              }}
            >
              {card.value.toString().padStart(2, '0')}
            </div>

            {/* Barra de Progresso com Trilha Nítida */}
            <div
              style={{
                height: '5px',
                backgroundColor: isDark ? '#262A32' : '#E2E8F0',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: card.barWidth,
                  backgroundColor: card.barColor,
                  borderRadius: '4px',
                  transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: isDark ? `0 0 8px ${card.accent}66` : 'none',
                }}
              />
            </div>

            {/* Subtítulo Legível */}
            <span
              style={{
                fontSize: '12.5px',
                fontWeight: 500,
                color: isDark ? '#94A3B8' : '#64748B',
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif",
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
