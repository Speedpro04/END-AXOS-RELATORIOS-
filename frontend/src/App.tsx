import { useState, useEffect, useRef } from 'react'
import { TenantHeader } from './components/TenantHeader'
import { TenantFooter } from './components/TenantFooter'
import { InspectionModal } from './components/InspectionModal'
import { DEFAULT_TENANT, type TenantProfile } from './types/tenant'
import type { InspectionReport } from './types/inspection'
import { buildReportCode } from './utils/buildReportCode'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { db } from './services/dbDexie'
import type { LocalReport } from './types/sync'

// Páginas Dedicadas
import { HubPage } from './pages/HubPage'
import { PTPage } from './pages/PTPage'
import { MTPage } from './pages/MTPage'
import { VTPage } from './pages/VTPage'
import { UTPage } from './pages/UTPage'
import { RTPage } from './pages/RTPage'
import { ETPage } from './pages/ETPage'
import { LTPage } from './pages/LTPage'
import { LT_VACUOPage } from './pages/LT_VACUOPage'
import { PAUTPage } from './pages/PAUTPage'
import { TOFDPage } from './pages/TOFDPage'
import { CRDRPage } from './pages/CRDRPage'
import { ECAPage } from './pages/ECAPage'
import { EAPage } from './pages/EAPage'
import { IRTPage } from './pages/IRTPage'
import { ACFMPage } from './pages/ACFMPage'
import { TFMPage } from './pages/TFMPage'
import { LoginPage } from './pages/LoginPage'

// Relatório inicial padrão (apenas se não houver nada no Dexie)
const DEFAULT_REPORT: Omit<LocalReport, 'id' | 'tenantId' | 'method' | 'data' | 'updatedAt'> = {
  verdict: null,
  localStatus: 'rascunho',
  serverStatus: null,
  clientRevision: 0,
  serverRevision: null,
  reportNumber: null,
  lastSyncAt: null,
  lastError: null,
}

function AppContent() {
  const { user, profile, tenant: authTenant, selectedUnit, isLoading, signOut } = useAuth()

  const [tenant, setTenant] = useState<TenantProfile>(() => {
    const saved = localStorage.getItem('axos_tenant_profile')
    return saved ? JSON.parse(saved) : DEFAULT_TENANT
  })

  // Sincroniza dados do tenant do Supabase com o perfil da empresa
  useEffect(() => {
    if (authTenant) {
      setTenant((prev) => ({
        ...prev,
        name: authTenant.legal_name || prev.name,
        tradeName: authTenant.trade_name || authTenant.legal_name || prev.tradeName,
        cnpj: authTenant.cnpj || prev.cnpj,
        operationalUnit: selectedUnit || prev.operationalUnit,
      }))
    }
  }, [authTenant, selectedUnit])

  const [reports, setReports] = useState<InspectionReport[]>([])
  const [reportsLoaded, setReportsLoaded] = useState(false)

  useEffect(() => {
    const loadReports = async () => {
      try {
        const all = await db.reports.toArray()
        if (all.length === 0) {
          // Se não há nada no Dexie, inicializa com os relatórios padrão
          const defaultReports: LocalReport[] = [
            {
              id: '1',
              tenantId: tenant.id,
              method: 'VT',
              data: {
                id: '1',
                code: 'END-VT-2026-001',
                method: 'VT',
                title: 'Ensaio Visual no Spool SP-2101 / Junta J-01',
                equipmentTag: 'SP-2101-J01',
                unitArea: 'Unidade U-2100 (Processamento Primário)',
                inspectorName: 'Carlos Eduardo Silva',
                inspectorSNQC: 'SNQC 14892 (N2-VT)',
                normProcedure: 'ASME V Art. 9',
                acceptanceCriteria: 'ASME Sec. VIII Div. 1 Apêndice 8',
                date: '2026-10-21',
                status: 'aprovado',
                findingsCount: 0,
                summary: 'Ensaio Visual realizado 100% na junta de solda. Aprovado sem descontinuidades.',
                technicalData: { metodo: 'Visual direta', iluminacao: '500 lux' },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              verdict: 'A',
              localStatus: 'sincronizado',
              serverStatus: 'aprovado',
              clientRevision: 0,
              serverRevision: 0,
              reportNumber: 'END-VT-2026-001',
              updatedAt: new Date().toISOString(),
              lastSyncAt: new Date().toISOString(),
              lastError: null,
            },
          ]
          await db.reports.bulkPut(defaultReports)
          setReports(defaultReports.map(r => r.data as InspectionReport))
        } else {
          setReports(all.map(r => r.data as InspectionReport))
        }
      } catch (err) {
        console.error('[Dexie] Falha ao carregar reports:', err)
      } finally {
        setReportsLoaded(true)
      }
    }
    loadReports()
  }, [])

  // Navegação entre páginas de modelos
  // 'HUB' | 'LP' | 'ME' | 'EVS' | 'NR13' | 'PM' | 'US' | 'PINTURA'
  const [currentPage, setCurrentPage] = useState<string>('HUB')

  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)
  const [offlineQueueCount] = useState<number>(0)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingReport, setEditingReport] = useState<InspectionReport | null>(null)

  const handleLogout = async () => {
    await signOut()
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

  const handleSaveReport = async (reportData: Partial<InspectionReport>) => {
    if (editingReport) {
      const updated = reports.map((r) =>
        r.id === editingReport.id
          ? ({ ...r, ...reportData, updatedAt: new Date().toISOString() } as InspectionReport)
          : r
      )
      setReports(updated)
      // Salva no Dexie
      const localReport: LocalReport = {
        id: editingReport.id,
        tenantId: tenant.id,
        method: updated.find(r => r.id === editingReport.id)!.method,
        workOrderId: null,
        data: updated.find(r => r.id === editingReport.id)!,
        verdict: null,
        localStatus: 'rascunho',
        serverStatus: null,
        clientRevision: 0,
        serverRevision: null,
        reportNumber: null,
        updatedAt: new Date().toISOString(),
        lastSyncAt: null,
        lastError: null,
      }
      await db.reports.put(localReport)
    } else {
      const newReport: InspectionReport = {
        id: crypto.randomUUID(),
        code: 'RASCUNHO', // número definitivo atribuído pelo servidor na emissão
        method: reportData.method || 'VT',
        title: reportData.title || 'Laudo Técnico END',
        equipmentTag: reportData.equipmentTag || 'TAG-PENDENTE',
        unitArea: reportData.unitArea || 'Área Industrial',
        inspectorName: reportData.inspectorName || 'Inspetor',
        inspectorSNQC: reportData.inspectorSNQC || 'SNQC',
        normProcedure: reportData.normProcedure || 'Norma',
        acceptanceCriteria: reportData.acceptanceCriteria || 'Critério',
        date: reportData.date || new Date().toISOString().split('T')[0],
        status: 'rascunho',
        findingsCount: reportData.findingsCount || 0,
        summary: reportData.summary || '',
        technicalData: reportData.technicalData || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const localReport: LocalReport = {
        id: newReport.id,
        tenantId: tenant.id,
        method: newReport.method,
        workOrderId: null,
        data: newReport,
        verdict: null,
        localStatus: 'rascunho',
        serverStatus: null,
        clientRevision: 0,
        serverRevision: null,
        reportNumber: null,
        updatedAt: new Date().toISOString(),
        lastSyncAt: null,
        lastError: null,
      }
      await db.reports.put(localReport)
      setReports([newReport, ...reports])
    }
    setEditingReport(null)
  }

  const handleDeleteReport = async (id: string) => {
    const updated = reports.filter((r) => r.id !== id)
    setReports(updated)
    await db.reports.delete(id)
  }

  // Lista de Abas de Modelos Técnicos — Convencional (8)
  const navItems = [
    { id: 'HUB', label: 'Catálogo Geral', tag: 'HUB' },
    { id: 'VT', label: 'Ensaio Visual (VT)', tag: 'VT' },
    { id: 'PT', label: 'Líquidos Penetrantes (PT)', tag: 'PT' },
    { id: 'MT', label: 'Partículas Magnéticas (MT)', tag: 'MT' },
    { id: 'UT', label: 'Ultrassom Convencional (UT)', tag: 'UT' },
    { id: 'RT', label: 'Radiografia Industrial (RT)', tag: 'RT' },
    { id: 'ET', label: 'Correntes Parasitas (ET)', tag: 'ET' },
    { id: 'LT', label: 'Estanqueidade (LT)', tag: 'LT' },
    { id: 'LT_VACUO', label: 'Estanqueidade Vácuo (LT)', tag: 'LV' },
    // Avançado (8)
    { id: 'PAUT', label: 'Ultrassom Phased Array (PAUT)', tag: 'PAUT' },
    { id: 'TOFD', label: 'ToFD', tag: 'TOFD' },
    { id: 'CRDR', label: 'Radiografia Digital (CR/DR)', tag: 'CR/DR' },
    { id: 'ECA', label: 'Eddy Current Array (ECA)', tag: 'ECA' },
    { id: 'EA', label: 'Emissão Acústica (EA)', tag: 'EA' },
    { id: 'IRT', label: 'Termografia (IRT)', tag: 'IRT' },
    { id: 'ACFM', label: 'ACFM', tag: 'ACFM' },
    { id: 'TFM', label: 'TFM / FMC', tag: 'TFM' },
  ]

  const navRef = useRef<HTMLElement>(null)

  const handleNavScroll = (dir: 'left' | 'right') => {
    if (navRef.current) {
      navRef.current.scrollBy({ left: dir === 'left' ? -240 : 240, behavior: 'smooth' })
    }
  }

  if (!user || !profile) {
    return <LoginPage />
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
        userRole={profile.role}
        userName={profile.full_name}
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

        {currentPage === 'VT' && (
          <VTPage onBack={() => setCurrentPage('HUB')} tenant={tenant} tenantName={tenant.tradeName} />
        )}
        {currentPage === 'PT' && (
          <PTPage onBack={() => setCurrentPage('HUB')} tenant={tenant} tenantName={tenant.tradeName} />
        )}
        {currentPage === 'MT' && (
          <MTPage onBack={() => setCurrentPage('HUB')} tenant={tenant} tenantName={tenant.tradeName} />
        )}
        {currentPage === 'UT' && (
          <UTPage onBack={() => setCurrentPage('HUB')} tenant={tenant} tenantName={tenant.tradeName} />
        )}
        {currentPage === 'RT' && (
          <RTPage onBack={() => setCurrentPage('HUB')} tenant={tenant} tenantName={tenant.tradeName} />
        )}
        {currentPage === 'ET' && (
          <ETPage onBack={() => setCurrentPage('HUB')} tenant={tenant} tenantName={tenant.tradeName} />
        )}
        {currentPage === 'LT' && (
          <LTPage onBack={() => setCurrentPage('HUB')} tenant={tenant} tenantName={tenant.tradeName} />
        )}
        {currentPage === 'LT_VACUO' && (
          <LT_VACUOPage onBack={() => setCurrentPage('HUB')} tenant={tenant} tenantName={tenant.tradeName} />
        )}
        {currentPage === 'PAUT' && (
          <PAUTPage onBack={() => setCurrentPage('HUB')} tenant={tenant} tenantName={tenant.tradeName} />
        )}
        {currentPage === 'TOFD' && (
          <TOFDPage onBack={() => setCurrentPage('HUB')} tenant={tenant} tenantName={tenant.tradeName} />
        )}
        {currentPage === 'CRDR' && (
          <CRDRPage onBack={() => setCurrentPage('HUB')} tenant={tenant} tenantName={tenant.tradeName} />
        )}
        {currentPage === 'ECA' && (
          <ECAPage onBack={() => setCurrentPage('HUB')} tenant={tenant} tenantName={tenant.tradeName} />
        )}
        {currentPage === 'EA' && (
          <EAPage onBack={() => setCurrentPage('HUB')} tenant={tenant} tenantName={tenant.tradeName} />
        )}
        {currentPage === 'IRT' && (
          <IRTPage onBack={() => setCurrentPage('HUB')} tenant={tenant} tenantName={tenant.tradeName} />
        )}
        {currentPage === 'ACFM' && (
          <ACFMPage onBack={() => setCurrentPage('HUB')} tenant={tenant} tenantName={tenant.tradeName} />
        )}
        {currentPage === 'TFM' && (
          <TFMPage onBack={() => setCurrentPage('HUB')} tenant={tenant} tenantName={tenant.tradeName} />
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

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
