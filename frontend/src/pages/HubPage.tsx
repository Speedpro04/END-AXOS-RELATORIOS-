import React, { useCallback, useMemo, useState } from 'react'
import { DashboardMetrics } from '../components/DashboardMetrics'
import { InspectionTable } from '../components/InspectionTable'
import type { InspectionReport } from '../types/inspection'
import { SyncStatusIndicator } from '../components/laudo/SyncStatusIndicator'
import { ReportStatusChip } from '../components/laudo/ReportStatusChip'
import {
  METHOD_GROUPS,
  METHODS_CATALOG,
  type MethodCatalogItem,
  type MethodGroup,
} from '../data/methodsCatalog'

interface HubPageProps {
  reports: InspectionReport[]
  onSelectModel: (modelKey: string) => void
  onNewReport: () => void
  onEditReport: (report: InspectionReport) => void
  onDeleteReport: (id: string) => void
}

const RECENT_STORAGE_KEY = 'axos_recent_methods'
const MAX_RECENT = 3

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function MethodButton({ item, onClick, lastStatus, lastError }: { item: MethodCatalogItem; onClick: (item: MethodCatalogItem) => void; lastStatus?: string; lastError?: string }) {
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <button
        type="button"
        onClick={() => onClick(item)}
        disabled={!item.available}
        style={{
          width: '100%',
          padding: '8px 10px',
          borderRadius: '4px',
          border: `1px solid ${item.available ? 'var(--border)' : '#e5e7eb'}`,
          background: item.available ? 'var(--bg-surface)' : '#f3f4f6',
          color: item.available ? 'var(--text-primary)' : '#9ca3af',
          fontSize: '13px',
          cursor: item.available ? 'pointer' : 'not-allowed',
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          opacity: item.available ? 1 : 0.5,
        }}
      >
        <span style={{ fontWeight: 600 }}>{item.name}</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.code}</span>
      </button>
      <ReportStatusChip localStatus={(lastStatus || 'rascunho') as 'rascunho' | 'pronto' | 'enviando' | 'sincronizado' | 'erro'} serverStatus={lastStatus as string | undefined} lastError={lastError as string | undefined} />
    </div>
  )
}

export const HubPage: React.FC<HubPageProps> = ({
  reports,
  onSelectModel,
  onNewReport,
  onEditReport,
  onDeleteReport,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)
  const [recentMethods, setRecentMethods] = useState<string[]>([])

  const addRecent = useCallback((code: string) => {
    setRecentMethods((prev) => {
      const next = [code, ...prev.filter((c) => c !== code)].slice(0, MAX_RECENT)
      try {
        localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignore storage errors
      }
      return next
    })
  }, [])

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as string[]
        if (Array.isArray(parsed)) {
          setRecentMethods(parsed.slice(0, MAX_RECENT))
        }
      }
    } catch {
      // ignore storage errors
    }
  }, [])

  const handleMethodClick = (item: MethodCatalogItem) => {
    addRecent(item.code)
    onSelectModel(item.route)
  }

  const groupsWithCounts = useMemo<MethodGroup[]>(() => {
    return METHOD_GROUPS.map((group) => ({
      ...group,
      methods: group.methods.map((m) => {
        const methodReports = reports.filter((r) => r.method === m.code)
        const lastReport = methodReports.length > 0
          ? methodReports.sort((a, b) => (a.updatedAt || '').localeCompare(b.updatedAt || ''))[0]
          : null
        return {
          ...m,
          count: methodReports.length,
          lastStatus: lastReport?.status as 'rascunho' | 'pronto' | 'enviando' | 'sincronizado' | 'erro' | undefined,
          lastError: (lastReport as any)?.lastError,
        }
      }),
    }))
  }, [reports])

  const normalizedQuery = normalize(searchQuery)

  const searchResults = useMemo<MethodCatalogItem[]>(() => {
    if (!normalizedQuery) return []
    return METHODS_CATALOG.filter((m) => {
      const haystack = normalize(`${m.name} ${m.code} ${m.norm} ${m.aliases.join(' ')}`)
      return haystack.includes(normalizedQuery)
    })
  }, [normalizedQuery])

  const isSearchActive = normalizedQuery.length > 0

  return (
    <div className="animate-slide-up" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '32px',
      padding: '24px',
      borderRadius: '12px',
      background: 'linear-gradient(to bottom, var(--bg-base), var(--bg-surface))',
      boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
      backdropFilter: 'blur(8px)',
    }}>
      {/* ── SEÇÃO 1: Catálogo de Modelos ── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
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
            Catálogo de Modelos Técnicos
          </h3>
        </div>

        <div style={{ position: 'relative', width: '100%', maxWidth: '520px' }}>
          <input
            type="text"
            placeholder="Buscar método, sigla ou norma..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === '/') {
                e.preventDefault()
                ;(e.target as HTMLInputElement).focus()
              }
              if (e.key === 'Escape') {
                setSearchQuery('')
              }
            }}
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
          <span style={{
            position: 'absolute',
            left: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#4B5563',
            fontSize: '14px',
          }}>🔍</span>
        </div>

        {/* Usados recentemente */}
        {!isSearchActive && recentMethods.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>Usados recentemente</span>
            {recentMethods.map((code) => {
              const item = METHODS_CATALOG.find((m) => m.code === code)
              if (!item) return null
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => handleMethodClick(item)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {item.code}
                </button>
              )
            })}
          </div>
        )}

        {/* Catálogo de modelos */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(240px, 1fr))',
          gap: '24px',
        }}>
          {groupsWithCounts.map((group) => {
            const totalEmitidos = group.methods.reduce((sum, m) => sum + (m.count ?? 0), 0)
            const isExpanded = expandedGroupId === group.id

            return (
              <div
                key={group.id}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  borderLeft: `4px solid ${group.accentColor}`,
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease-in-out',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-strong)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                }}
                onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <h4 style={{
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif",
                    fontSize: '15px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    margin: 0,
                  }}>
                    {group.name}
                  </h4>
                  <span style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    background: 'var(--bg-surface-alt)',
                    border: '1px solid var(--border)',
                    borderRadius: '3px',
                    color: 'var(--text-secondary)',
                  }}>
                    {totalEmitidos} emitidos
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  marginTop: '4px',
                }}>
                  {group.methods.map((m) => {
                    const methodReports = reports.filter((r) => r.method === m.code)
                    const lastReport = methodReports.length > 0
                      ? methodReports.sort((a, b) => (a.updatedAt || '').localeCompare(b.updatedAt || ''))[0]
                      : null
                    return (
                      <MethodButton
                        key={m.id}
                        item={m}
                        onClick={handleMethodClick}
                        lastStatus={(lastReport?.status || 'rascunho') as 'rascunho' | 'pronto' | 'enviando' | 'sincronizado' | 'erro' | 'aprovado'}
                        lastError={(lastReport as any)?.lastError}
                      />
                    )
                  })}
                  {group.methods.some((m) => !m.available) && (
                    <div style={{
                      fontSize: '11px',
                      color: '#9ca3af',
                      fontStyle: 'italic',
                      paddingLeft: '2px',
                    }}>Em breve</div>
                  )}
                  {group.methods.length > 1 && (
                    <div style={{
                      fontSize: '11px',
                      color: '#6b7280',
                      fontStyle: 'italic',
                      paddingLeft: '2px',
                      marginTop: '4px',
                    }}>
                      +{group.methods.length - 1} método(s) na busca
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── SEÇÃO 2: KPIs ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
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
            Consolidação Operacional da Unidade
          </h3>
        </div>
        <DashboardMetrics reports={reports} />
      </section>

      {/* ── SEÇÃO 3: Tabela ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
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
            Histórico e Registro Central de Laudos
          </h3>
        </div>
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
