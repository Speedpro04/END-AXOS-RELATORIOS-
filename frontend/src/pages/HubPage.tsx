import { useCallback, useMemo, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { DashboardMetrics } from '../components/DashboardMetrics'
import { InspectionTable } from '../components/InspectionTable'
import type { InspectionReport } from '../types/inspection'
import {
  METHOD_GROUPS,
  METHODS_CATALOG,
  type MethodCatalogItem,
} from '../data/methodsCatalog'
import { EmptyState, MethodButton, SearchField } from '../components/catalog'
interface HubPageProps {
  reports: InspectionReport[]
  onSelectModel: (modelKey: string) => void
  onNewReport: () => void
  onEditReport: (report: InspectionReport) => void
  onDeleteReport: (id: string) => void
  onVoltarObras: () => void
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
  onVoltarObras,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const resultsWrapRef = useRef<HTMLDivElement>(null)

  const normalizedQuery = normalize(searchQuery)

  // Nome da família entra na busca embora os títulos por família não apareçam na tela
  const familyNameByCode = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    METHOD_GROUPS.forEach((g) => {
      g.methods.forEach((m) => {
        map[m.code] = g.name
      })
    })
    return map
  }, [])

  const searchResults = useMemo<MethodCatalogItem[]>(() => {
    if (!normalizedQuery) return []
    return METHODS_CATALOG.filter((m) => {
      const haystack = normalize(
        `${m.name} ${m.code} ${m.norm} ${familyNameByCode[m.code] ?? ''} ${m.aliases.join(' ')}`
      )
      return haystack.includes(normalizedQuery)
    })
  }, [normalizedQuery, familyNameByCode])

  const isSearchActive = normalizedQuery.length > 0

  const byName = (a: MethodCatalogItem, b: MethodCatalogItem) =>
    a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })

  const visibleMethods = useMemo<MethodCatalogItem[]>(() => {
    const base = isSearchActive ? searchResults : METHODS_CATALOG
    return [...base].sort(byName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSearchActive, searchResults])

  const totalCount = visibleMethods.length

  const handleClear = useCallback(() => {
    setSearchQuery('')
  }, [])

  const handleMethodClick = (code: string) => {
    onSelectModel(code)
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
          }}
          style={{
            minHeight: '40px',
            padding: '0 18px',
            borderRadius: '5px',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontFamily: 'Arial, Helvetica, sans-serif',
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
        padding: '32px 32px',
        maxWidth: '1280px',
        margin: '0 auto',
      }}
    >
      {/* ── Título da página ── */}
      <h1 style={{
        fontSize: '29px',
        fontWeight: 600,
        color: 'var(--text)',
        margin: '0',
        letterSpacing: '-0.01em',
      }}>
        Painel Operacional
      </h1>

      {/* ── SEÇÃO 1: Catálogo de Modelos ── */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onVoltarObras}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '5px', border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text)',
              fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '14px', fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={16} strokeWidth={1.75} /> Voltar às Obras
          </button>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 600,
            color: 'var(--text)',
            margin: '0 0 8px',
            letterSpacing: '-0.01em',
          }}>
            Catálogo de modelos
          </h2>
        </div>
        <p style={{
          fontSize: '16px',
          color: 'var(--text-muted)',
          margin: '0 0 24px',
        }}>
          Escolha o método de END para iniciar um novo laudo.
        </p>

        <SearchField
          value={searchQuery}
          onChange={(v) => setSearchQuery(v)}
          onClear={handleClear}
          resultCount={searchResults.length}
          onFocusFirstResult={() => {
            const first = resultsWrapRef.current?.querySelector<HTMLAnchorElement>('a[href]')
            first?.focus()
          }}
          style={{ marginBottom: '8px' }}
        />
        <p
          style={{
            fontSize: '14px',
            fontWeight: 500,
            color: 'var(--text-muted)',
            margin: '0 0 16px',
          }}
        >
          {isSearchActive && searchResults.length > 0 ? `${searchResults.length === 1 ? '1' : searchResults.length} resultado(s)` : totalCount === 1 ? '1 método disponível' : `${totalCount} métodos disponíveis`}
        </p>

        {isSearchActive && searchResults.length === 0 ? (
          <EmptyState term={searchQuery} onClear={handleClear} />
        ) : (
          <div ref={resultsWrapRef}>
            {/* ── Bloco 1: Convencional ── */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              <h3 style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                margin: '0',
                letterSpacing: '-0.01em',
                textTransform: 'uppercase',
              }}>
                Convencional
              </h3>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(260px, 1fr))',
                  gap: '16px',
                }}
              >
                {visibleMethods
                  .filter((m) => m.groupId === 'convencional')
                  .map((m) => (
                    <MethodButton
                      key={m.code}
                      item={m}
                      href={`/laudo/${m.code}`}
                      onClick={handleMethodClick}
                      highlightTerm={isSearchActive ? searchQuery : undefined}
                    />
                  ))}
              </div>
            </section>

            {/* ── Bloco 2: Avançado e especial ── */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h3 style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                margin: '0',
                letterSpacing: '-0.01em',
                textTransform: 'uppercase',
              }}>
                Avançado e especial
              </h3>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(260px, 1fr))',
                  gap: '16px',
                }}
              >
                {visibleMethods
                  .filter((m) => m.groupId === 'avancado')
                  .map((m) => (
                    <MethodButton
                      key={m.code}
                      item={m}
                      href={`/laudo/${m.code}`}
                      onClick={handleMethodClick}
                      highlightTerm={isSearchActive ? searchQuery : undefined}
                    />
                  ))}
              </div>
            </section>
          </div>
        )}
      </section>

      {/* ── SEÇÃO 2: KPIs ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{
            width: '3px', height: '18px',
            background: 'var(--accent)',
            borderRadius: '5px',
          }} />
          <h3 style={{
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
            letterSpacing: '-0.01em',
          }}>
            Consolidação operacional da unidade
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
            borderRadius: '5px',
          }} />
          <h3 style={{
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
            letterSpacing: '-0.01em',
          }}>
            Histórico e registro central de laudos
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
