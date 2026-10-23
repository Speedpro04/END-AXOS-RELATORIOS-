import React from 'react'
import { DashboardMetrics } from '../components/DashboardMetrics'
import { InspectionTable } from '../components/InspectionTable'
import type { InspectionReport } from '../types/inspection'

interface HubPageProps {
  reports: InspectionReport[]
  onSelectModel: (modelKey: string) => void
  onNewReport: () => void
  onEditReport: (report: InspectionReport) => void
  onDeleteReport: (id: string) => void
}

export const HubPage: React.FC<HubPageProps> = ({
  reports,
  onSelectModel,
  onNewReport,
  onEditReport,
  onDeleteReport,
}) => {
  const models = [
    {
      id: 'LP',
      code: 'LP-01',
      tag: 'LP',
      title: 'Líquido Penetrante',
      norm: 'ASME V Art. 6 / Petrobras N-1596',
      desc: 'Ensaio superficial com kits químicos VP-30/D-70, tempos de penetração e mapeamento de indicações.',
      count: reports.filter((r) => r.method === 'LP').length,
      accentColor: '#059669',
      bgColor: '#ecfdf5',
    },
    {
      id: 'ME',
      code: 'ME-02',
      tag: 'ME',
      title: 'Medição de Espessura',
      norm: 'Petrobras N-1594 / ASME V Art. 5',
      desc: 'Malha interativa de pontos, cálculo de taxa de corrosão e vida remanescente em tempo real.',
      count: reports.filter((r) => r.method === 'ME').length,
      accentColor: '#2563eb',
      bgColor: '#eff6ff',
    },
    {
      id: 'EVS',
      code: 'EVS-03',
      tag: 'EVS',
      title: 'Inspeção Visual de Solda',
      norm: 'AWS D1.1 / ASME B31.3',
      desc: 'Checklist dimensional completo, EPS/WPS, mordedura, reforço excessivo e desalinhamento.',
      count: reports.filter((r) => r.method === 'EVS').length,
      accentColor: '#7c3aed',
      bgColor: '#f5f3ff',
    },
    {
      id: 'NR13',
      code: 'NR-13',
      tag: 'NR-13',
      title: 'Vaso de Pressão (NR-13)',
      norm: 'NR-13 MTE / ASME Sec. VIII',
      desc: 'Prontuário, placa de dados, cálculo de PMTA, PSV, exame interno/externo e ART do PH.',
      count: reports.filter((r) => r.method === 'NR13_VASO').length,
      accentColor: '#d97706',
      bgColor: '#fffbeb',
    },
    {
      id: 'PM',
      code: 'PM-04',
      tag: 'PM',
      title: 'Partícula Magnética',
      norm: 'Petrobras N-1598 / ASME VIII Ap. 6',
      desc: 'Inspeção subsuperficial ferromagnética com Yoke AC/DC, via úmida fluorescente e força de levantamento.',
      count: reports.filter((r) => r.method === 'PM').length,
      accentColor: '#db2777',
      bgColor: '#fdf2f8',
    },
    {
      id: 'US',
      code: 'US-05',
      tag: 'US',
      title: 'Ultrassom Industrial',
      norm: 'ASME V Art. 4 / Petrobras N-1594',
      desc: 'Varredura volumétrica de juntas com feixe angular, blocos V1/V2 e calibração por curva DAC.',
      count: reports.filter((r) => r.method === 'US').length,
      accentColor: '#0891b2',
      bgColor: '#ecfeff',
    },
    {
      id: 'PINTURA',
      code: 'PINT-06',
      tag: 'PINT',
      title: 'Pintura & Aderência',
      norm: 'Petrobras N-13 / ISO 8501',
      desc: 'Condições psicrométricas, perfil de rugosidade, medição magnética de EPS e teste de corte em X.',
      count: reports.filter((r) => r.method === 'PINTURA').length,
      accentColor: '#ea580c',
      bgColor: '#fff7ed',
    },
  ]

  const SectionLabel = ({ children, count }: { children: React.ReactNode; count?: string }) => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: '14px',
      paddingBottom: '10px',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '3px', height: '18px',
          background: 'var(--accent)',
          borderRadius: '3px',
        }} />
        <h3 style={{
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif",
          fontSize: '18px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          margin: 0,
          letterSpacing: '-0.01em',
        }}>
          {children}
        </h3>
      </div>
      {count && (
        <span style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '13px',
          fontWeight: 600,
          letterSpacing: '0.04em',
          padding: '4px 10px',
          background: 'var(--bg-surface-alt)',
          border: '1px solid var(--border)',
          borderRadius: '3px',
          color: 'var(--text-secondary)',
        }}>
          {count}
        </span>
      )}
    </div>
  )

  return (
    <div className="animate-slide-up" style={{
  display: 'flex',
  flexDirection: 'column',
  gap: '32px',
  padding: '24px',
  borderRadius: '12px',
  background: 'linear-gradient(to bottom, var(--bg-base), var(--bg-surface))',
  boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
  backdropFilter: 'blur(8px)'
}}>

      {/* ── SEÇÃO 1: Catálogo de Modelos ── */}
      <section>
        <SectionLabel count="7 PROCEDIMENTOS & MODELOS NDT / NR-13">
          Catálogo de Modelos Técnicos
        </SectionLabel>
        <p style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif", fontSize: '15px', color: 'var(--text-muted)', marginBottom: '16px', marginTop: '-6px' }}>
          Selecione o modelo normativo para emitir laudos, registrar dados de campo e calcular taxas em conformidade industrial.
        </p>

        <div className="stagger" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
          gap: '14px',
        }}>
          {models.map((m) => (
            <div
              key={m.id}
              className="animate-slide-up"
              onClick={() => onSelectModel(m.id)}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: '3px',
                padding: '20px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '14px',
                transition: 'all 0.18s ease-in-out',
                position: 'relative',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-strong)'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 8px 14px -3px rgba(15, 23, 42, 0.06)'
                const arrow = e.currentTarget.querySelector('.card-arrow') as HTMLElement
                if (arrow) arrow.style.transform = 'translateX(4px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.04)'
                const arrow = e.currentTarget.querySelector('.card-arrow') as HTMLElement
                if (arrow) arrow.style.transform = 'translateX(0)'
              }}
            >
              {/* Linha de cor lateral de método */}
              <div style={{
                position: 'absolute',
                left: 0, top: 0, bottom: 0, width: '4px',
                borderTopLeftRadius: '3px',
                borderBottomLeftRadius: '3px',
                background: m.accentColor,
              }} />

              {/* Topo do Card */}
              <div style={{ paddingLeft: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: '13px',
                    fontWeight: 600,
                    padding: '3px 8px',
                    background: m.bgColor,
                    border: `1px solid ${m.accentColor}30`,
                    borderRadius: '3px',
                    color: m.accentColor,
                    letterSpacing: '0.04em',
                  }}>
                    {m.tag}
                  </span>
                  <span style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: '13px',
                    color: 'var(--text-faint)',
                  }}>
                    {m.code}
                  </span>
                </div>

                <h4 style={{
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif",
                  fontSize: '18px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  margin: '0 0 4px 0',
                  letterSpacing: '-0.01em',
                }}>
                  {m.title}
                </h4>

                <span style={{
                  display: 'block',
                  fontFamily: "'DM Mono', monospace",
                  fontSize: '13px',
                  color: 'var(--accent)',
                  fontWeight: 500,
                  marginBottom: '8px',
                }}>
                  {m.norm}
                </span>

                <p style={{
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif",
                  fontSize: '14px',
                  color: 'var(--text-muted)',
                  lineHeight: 1.5,
                  margin: 0,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {m.desc}
                </p>
              </div>

              {/* Rodapé do Card */}
              <div style={{
                borderTop: '1px solid var(--border)',
                paddingTop: '12px',
                paddingLeft: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {m.count.toString().padStart(2, '0')} {m.count === 1 ? 'laudo emitido' : 'laudos emitidos'}
                </span>
                <span
                  className="card-arrow"
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: '13px',
                    fontWeight: 600,
                    color: m.accentColor,
                    transition: 'transform 0.15s ease',
                    letterSpacing: '0.02em',
                  }}
                >
                  Abrir →
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SEÇÃO 2: KPIs ── */}
      <section>
        <SectionLabel>
          Consolidação Operacional da Unidade
        </SectionLabel>
        <DashboardMetrics reports={reports} />
      </section>

      {/* ── SEÇÃO 3: Tabela ── */}
      <section>
        <SectionLabel>
          Histórico e Registro Central de Laudos
        </SectionLabel>
        <InspectionTable
          reports={reports}
          onNewReport={onNewReport}
          onEditReport={onEditReport}
          onDeleteReport={onDeleteReport}
        />
      </section>
    </div>
  )
}
