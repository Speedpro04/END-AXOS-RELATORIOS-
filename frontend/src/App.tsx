import { useState, useEffect, useRef } from 'react'
import { TenantHeader } from './components/TenantHeader'
import { TenantFooter } from './components/TenantFooter'
import { InspectionModal } from './components/InspectionModal'
import { DEFAULT_TENANT, type TenantProfile } from './types/tenant'
import type { InspectionReport } from './types/inspection'

// Páginas Dedicadas
import { HubPage } from './pages/HubPage'
import { LPPage } from './pages/LPPage'
import { MEPage } from './pages/MEPage'
import { EVSPage } from './pages/EVSPage'
import { NR13Page } from './pages/NR13Page'
import { PMPage } from './pages/PMPage'
import { USPage } from './pages/USPage'
import { PinturaPage } from './pages/PinturaPage'
import { LoginPage } from './pages/LoginPage'

const INITIAL_REPORTS: InspectionReport[] = [
  {
    id: '1',
    code: 'NDT-LP-2024-001',
    method: 'LP',
    title: 'Líquido Penetrante no Spool SP-2101 / Junta J-01',
    equipmentTag: 'SP-2101-J01',
    unitArea: 'Unidade U-2100 (Processamento Primário)',
    inspectorName: 'Carlos Eduardo Silva',
    inspectorSNQC: 'SNQC 14892 (N2-LP)',
    normProcedure: 'Petrobras N-1596 / ASME Sec. VIII',
    acceptanceCriteria: 'ASME Sec. VIII Div. 1 Apêndice 8',
    date: '2026-10-21',
    status: 'aprovado',
    findingsCount: 0,
    summary: 'Ensaio por Líquido Penetrante realizado 100% no cordão de solda e ZTA. Aprovado sem descontinuidades.',
    technicalData: { penetrant: 'VP-30', developer: 'D-70' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    code: 'NDT-ME-2024-042',
    method: 'ME',
    title: 'Medição de Espessura no Costado do Vaso V-2104',
    equipmentTag: 'V-2104',
    unitArea: 'Área de Estocagem de GLP',
    inspectorName: 'Carlos Eduardo Silva',
    inspectorSNQC: 'SNQC 14892 (N2-US-ME)',
    normProcedure: 'Petrobras N-1594 / ASME V Art. 5',
    acceptanceCriteria: 'Espessura Mínima Admissível = 9.20 mm',
    date: '2026-10-20',
    status: 'aprovado',
    findingsCount: 0,
    summary: 'Malha de 64 pontos. Espessura nominal 12.7 mm, mínima registrada 11.4 mm. Equipamento em conformidade.',
    technicalData: { transducer: 'D790-SM 5MHz', minThickness: '11.4mm' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    code: 'NDT-EVS-2024-019',
    method: 'EVS',
    title: 'Exame Visual de Solda em Tubulação de Alta Pressão',
    equipmentTag: 'LIN-HP-401',
    unitArea: 'Parque de Bombas B-301',
    inspectorName: 'Roberto Nogueira',
    inspectorSNQC: 'SNQC 11204 (N2-VS)',
    normProcedure: 'AWS D1.1 / ASME B31.3',
    acceptanceCriteria: 'ASME B31.3 Tabela 341.3.2',
    date: '2026-10-21',
    status: 'reprovado',
    findingsCount: 2,
    summary: 'Constatada mordedura contínua com profundidade > 1.2 mm e porosidade agrupada. Reparo por goivagem exigido.',
    technicalData: { defect: 'Mordedura e Porosidade' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '4',
    code: 'NR13-VASO-2024-08',
    method: 'NR13_VASO',
    title: 'Inspeção Periódica de Vaso de Pressão (NR-13)',
    equipmentTag: 'TQ-501-A',
    unitArea: 'Unidade de Hidrotratamento (HDT)',
    inspectorName: 'Eng. Paulo Mendes',
    inspectorSNQC: 'CREA-SP 50619283 (PH)',
    normProcedure: 'NR-13 / ASME Sec. VIII Div. 1',
    acceptanceCriteria: 'NR-13 Portaria MTE 1.847',
    date: '2026-10-19',
    status: 'enviado',
    findingsCount: 0,
    summary: 'Exame interno e externo com teste de estanqueidade. Aguardando emissão da ART e assinatura digital do PH.',
    technicalData: { pmta: '18.5 kgf/cm²', categoria: 'Classe II' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '5',
    code: 'NDT-PM-2024-012',
    method: 'PM',
    title: 'Partícula Magnética em Munhão de Suporte',
    equipmentTag: 'MN-8802',
    unitArea: 'Caldeira de Recuperação',
    inspectorName: 'Carlos Eduardo Silva',
    inspectorSNQC: 'SNQC 14892 (N2-PM)',
    normProcedure: 'Petrobras N-1598',
    acceptanceCriteria: 'ASME Sec. VIII Div. 1 Apêndice 6',
    date: '2026-10-21',
    status: 'rascunho',
    findingsCount: 0,
    summary: 'Inspeção via úmida fluorescente em andamento na área industrial.',
    technicalData: { yoke: 'Eletromagnético AC/DC' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

export function App() {
  const [tenant, setTenant] = useState<TenantProfile>(() => {
    const saved = localStorage.getItem('axos_tenant_profile')
    return saved ? JSON.parse(saved) : DEFAULT_TENANT
  })

  const [reports, setReports] = useState<InspectionReport[]>(() => {
    const saved = localStorage.getItem('axos_reports_list')
    return saved ? JSON.parse(saved) : INITIAL_REPORTS
  })

  // Autenticação corporativa
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('axos_logged_in') === 'true'
  })

  // Navegação entre páginas de modelos
  // 'HUB' | 'LP' | 'ME' | 'EVS' | 'NR13' | 'PM' | 'US' | 'PINTURA'
  const [currentPage, setCurrentPage] = useState<string>('HUB')

  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)
  const [offlineQueueCount] = useState<number>(0)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingReport, setEditingReport] = useState<InspectionReport | null>(null)

  const handleLoginSuccess = (_role: string, plant: string) => {
    setIsAuthenticated(true)
    sessionStorage.setItem('axos_logged_in', 'true')
    if (plant) {
      setTenant((prev) => ({ ...prev, operationalUnit: plant }))
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    sessionStorage.removeItem('axos_logged_in')
  }

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleUpdateTenant = (updated: TenantProfile) => {
    setTenant(updated)
    localStorage.setItem('axos_tenant_profile', JSON.stringify(updated))
  }

  const handleSaveReport = (reportData: Partial<InspectionReport>) => {
    if (editingReport) {
      const updated = reports.map((r) =>
        r.id === editingReport.id
          ? ({ ...r, ...reportData, updatedAt: new Date().toISOString() } as InspectionReport)
          : r
      )
      setReports(updated)
      localStorage.setItem('axos_reports_list', JSON.stringify(updated))
    } else {
      const newReport: InspectionReport = {
        id: Date.now().toString(),
        code: `NDT-${reportData.method}-${new Date().getFullYear()}-${String(reports.length + 1).padStart(3, '0')}`,
        method: reportData.method || 'LP',
        title: reportData.title || 'Laudo Técnico NDT',
        equipmentTag: reportData.equipmentTag || 'TAG-PENDENTE',
        unitArea: reportData.unitArea || 'Área Industrial',
        inspectorName: reportData.inspectorName || 'Inspetor',
        inspectorSNQC: reportData.inspectorSNQC || 'SNQC',
        normProcedure: reportData.normProcedure || 'Norma',
        acceptanceCriteria: reportData.acceptanceCriteria || 'Critério',
        date: reportData.date || new Date().toISOString().split('T')[0],
        status: reportData.status || 'rascunho',
        findingsCount: reportData.findingsCount || 0,
        summary: reportData.summary || '',
        technicalData: reportData.technicalData || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const updated = [newReport, ...reports]
      setReports(updated)
      localStorage.setItem('axos_reports_list', JSON.stringify(updated))
    }
    setEditingReport(null)
  }

  const handleDeleteReport = (id: string) => {
    const updated = reports.filter((r) => r.id !== id)
    setReports(updated)
    localStorage.setItem('axos_reports_list', JSON.stringify(updated))
  }

  // Lista de Abas de Modelos Técnicos
  const navItems = [
    { id: 'HUB', label: 'Catálogo Geral', tag: 'HUB' },
    { id: 'LP', label: 'Líquido Penetrante', tag: 'LP' },
    { id: 'ME', label: 'Medição de Espessura', tag: 'ME' },
    { id: 'EVS', label: 'Visual de Solda', tag: 'EVS' },
    { id: 'NR13', label: 'Vaso de Pressão (NR-13)', tag: 'NR-13' },
    { id: 'PM', label: 'Partícula Magnética', tag: 'PM' },
    { id: 'US', label: 'Ultrassom Industrial', tag: 'US' },
    { id: 'PINTURA', label: 'Pintura & Aderência', tag: 'PINT' },
  ]

  const navRef = useRef<HTMLElement>(null)

  const handleNavScroll = (dir: 'left' | 'right') => {
    if (navRef.current) {
      navRef.current.scrollBy({ left: dir === 'left' ? -240 : 240, behavior: 'smooth' })
    }
  }

  if (!isAuthenticated) {
    return <LoginPage tenant={tenant} onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', color: 'var(--text-primary)', position: 'relative', transition: 'background 0.2s ease, color 0.2s ease' }}>
      {/* HEADER: 100% White-Label da Empresa Contratante */}
      <TenantHeader
        tenant={tenant}
        onUpdateTenant={handleUpdateTenant}
        isOnline={isOnline}
        offlineQueueCount={offlineQueueCount}
        onLogout={handleLogout}
      />

      {/* BARRA DE NAVEGAÇÃO DE MODELOS TÉCNICOS COM ROLAGEM SUAVE E DEGRADÊ */}
      <div style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 30,
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
        transition: 'background 0.2s ease, border-color 0.2s ease',
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px', position: 'relative', display: 'flex', alignItems: 'center' }}>
          
          {/* Botão de Rolar para Esquerda */}
          <button
            type="button"
            onClick={() => handleNavScroll('left')}
            title="Rolar abas para a esquerda"
            style={{
              flexShrink: 0,
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-surface-alt)',
              border: '1px solid var(--border)',
              borderRadius: '3px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              marginRight: '8px',
              zIndex: 2,
            }}
          >
            ‹
          </button>

          <nav
            ref={navRef}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              overflowX: 'auto',
              padding: '10px 0',
              scrollBehavior: 'smooth',
              scrollbarWidth: 'none',
              flex: 1,
            }}
          >
            {navItems.map((item) => {
              const isActive = currentPage === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrentPage(item.id)}
                  className={`nav-tab ${isActive ? 'active' : ''}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '8px 14px',
                    whiteSpace: 'nowrap',
                    borderRadius: '3px',
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: '13px',
                      fontWeight: 600,
                      padding: '2px 7px',
                      borderRadius: '3px',
                      letterSpacing: '0.04em',
                      background: isActive ? 'var(--nav-active-bg)' : 'var(--nav-tag-bg)',
                      border: isActive ? '1px solid var(--nav-active-border)' : '1px solid var(--nav-tag-border)',
                      color: isActive ? 'var(--nav-active-color)' : 'var(--nav-tag-color)',
                    }}
                  >
                    {item.tag}
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: 600, color: isActive ? 'var(--nav-active-color)' : 'var(--text-secondary)' }}>
                    {item.label}
                  </span>
                </button>
              )
            })}
          </nav>

          {/* Sombra de Degradê suave no canto direito indicando rolagem */}
          <div style={{
            position: 'absolute',
            right: '48px',
            top: 0,
            bottom: 0,
            width: '40px',
            background: 'linear-gradient(to right, transparent, var(--bg-surface))',
            pointerEvents: 'none',
            zIndex: 1,
          }} />

          {/* Botão de Rolar para Direita */}
          <button
            type="button"
            onClick={() => handleNavScroll('right')}
            title="Rolar abas para a direita"
            style={{
              flexShrink: 0,
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-surface-alt)',
              border: '1px solid var(--border)',
              borderRadius: '3px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              marginLeft: '8px',
              zIndex: 2,
            }}
          >
            ›
          </button>
        </div>
      </div>

      {/* ÁREA PRINCIPAL DO APP */}
      <main style={{ flex: 1, maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '28px 32px', position: 'relative', zIndex: 1 }}>
        {currentPage === 'HUB' && (
          <HubPage
            reports={reports}
            onSelectModel={(modelId) => setCurrentPage(modelId)}
            onNewReport={() => {
              setEditingReport(null)
              setIsModalOpen(true)
            }}
            onEditReport={(report) => {
              setEditingReport(report)
              setIsModalOpen(true)
            }}
            onDeleteReport={handleDeleteReport}
          />
        )}

        {currentPage === 'LP' && (
          <LPPage onBack={() => setCurrentPage('HUB')} tenant={tenant} tenantName={tenant.tradeName} />
        )}

        {currentPage === 'ME' && (
          <MEPage onBack={() => setCurrentPage('HUB')} tenantName={tenant.tradeName} />
        )}

        {currentPage === 'EVS' && (
          <EVSPage onBack={() => setCurrentPage('HUB')} tenantName={tenant.tradeName} />
        )}

        {currentPage === 'NR13' && (
          <NR13Page onBack={() => setCurrentPage('HUB')} tenantName={tenant.tradeName} />
        )}

        {currentPage === 'PM' && (
          <PMPage onBack={() => setCurrentPage('HUB')} tenantName={tenant.tradeName} />
        )}

        {currentPage === 'US' && (
          <USPage onBack={() => setCurrentPage('HUB')} tenantName={tenant.tradeName} />
        )}

        {currentPage === 'PINTURA' && (
          <PinturaPage onBack={() => setCurrentPage('HUB')} tenantName={tenant.tradeName} />
        )}
      </main>

      {/* MODAL GERAL DE LAUDO (ACESSO RÁPIDO) */}
      <InspectionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingReport(null)
        }}
        onSave={handleSaveReport}
        initialReport={editingReport}
      />

      {/* FOOTER DISCRETO DA AXOS */}
      <TenantFooter />
    </div>
  )
}

export default App
