import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DashboardMetrics } from '../components/DashboardMetrics'
import { InspectionTable } from '../components/InspectionTable'
import type { InspectionReport } from '../types/inspection'
import {
  METHOD_GROUPS,
  METHODS_CATALOG,
  type MethodCatalogItem,
} from '../data/methodsCatalog'
import { EmptyState, MethodSection, SearchField } from '../components/catalog'

interface HubPageProps {
  reports: InspectionReport[]
  onSelectModel: (modelKey: string) => void
  onNewReport: () => void
  onEditReport: (report: InspectionReport) => void
  onDeleteReport: (id: string) => void
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export const HubPage: React.FC<HubPageProps> = ({
  reports,
  onSelectModel,
  onNewReport,
  onEditReport,
  onDeleteReport,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [reportsLoaded, setReportsLoaded] = useState(false)
  const firstResultRef = useRef<HTMLElement>(null)

  const draftCountsByMethod = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {}
    reports.forEach((r) => {
      if (r.status === 'rascunho') {
        counts[r.method] = (counts[r.method] || 0) + 1
      }
    })
    return counts
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

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    timer = setTimeout(() => {
      // Debounce já está implícito no estado
    }, 100)
    return () => clearTimeout(timer)
  }, [normalizedQuery])

  const handleClear = useCallback(() => {
    setSearchQuery('')
  }, [])

  const handleMethodClick = (code: string) => {
    onSelectModel(code)
  }

  if (!reportsLoaded) {
    return (
      <section
        role='region'
        aria-label='Carregando'
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '48px 24px',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: '16px', color: 'var(--text-muted)', margin: 0 }}>
          Carregando catálogo de métodos…
        </p>
      </section>
    )
  }

  if (error) {
    return (
      <section
        role='region'
        aria-label='Erro'
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '48px 24px',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: '16px', color: 'var(--text)', margin: 0 }}>
          Não foi possível carregar o catálogo de métodos.
        </p>
        <button
          type='button'
          onClick={() => {
            setError(null)
            setReportsLoaded(false)
          }}
          style={{
            minHeight: '40px',
            padding: '0 18px',
            borderRadius: '5px',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontFamily: 'Archivo, system-ui, -apple-system, Segoe UI, sans-serif',
            fontSize: '16px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Tentar novamente
        </button>
      </section>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
        padding: '32px 24px',
        maxWidth: '1280px',
        margin: '0 auto',
      }}
    >
      {/* ── SEÇÃO 1: Catálogo de Modelos ── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 600,
            color: 'var(--text)',
            margin: 0,
            letterSpacing: '-0.01em',
          }}>
            Catálogo de modelos
          </h2>
        </div>
        <p style={{
          fontSize: '16px',
          color: 'var(--text-muted)',
          margin: 0,
        }}>
          Escolha o método de END para iniciar um novo laudo.
        </p>

        <SearchField
          value={searchQuery}
          onChange={(v) => setSearchQuery(v)}
          onClear={handleClear}
          resultCount={searchResults.length}
          onFocusFirstResult={() => {
            if (firstResultRef.current) {
              ;(firstResultRef.current as HTMLElement).focus()
            }
          }}
        />

        {isSearchActive && searchResults.length === 0 ? (
          <EmptyState term={searchQuery} onClear={handleClear} />
        ) : (
          <>
            {METHOD_GROUPS.map((group) => {
              const groupMethods = isSearchActive
                ? group.methods.filter((m) => searchResults.some((r) => r.code === m.code))
                : group.methods

              if (groupMethods.length === 0) return null

              return (
                <MethodSection
                  key={group.id}
                  group={group}
                  methods={groupMethods}
                  hrefFor={(code) => `/laudo/${code}`}
                  onClick={handleMethodClick}
                  draftByMethod={Object.fromEntries(
                    group.methods.map((m) => [m.code, { status: 'rascunho' as const, count: draftCountsByMethod[m.code] || 0 }])
                  )}
                  highlightTerm={isSearchActive ? searchQuery : undefined}
                />
              )
            })}

            {isSearchActive && searchResults.length === 0 && (
              <EmptyState term={searchQuery} onClear={handleClear} />
            )}
          </>
        )}
      </section>

      {/* ── SEÇÃO 2: KPIs (mantida) ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{
            width: '3px', height: '18px',
            background: 'var(--accent)',
            borderRadius: '5px',
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

      {/* ── SEÇÃO 3: Tabela (mantida) ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{
            width: '3px', height: '18px',
            background: 'var(--accent)',
            borderRadius: '5px',
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
