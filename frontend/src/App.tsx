import { useState, useEffect, useRef, useCallback } from 'react'
import { TenantHeader } from './components/TenantHeader'
import { TenantFooter } from './components/TenantFooter'
import { InspectionModal } from './components/InspectionModal'
import { DEFAULT_TENANT, type TenantProfile } from './types/tenant'
import type { ENDMethod, InspectionReport } from './types/inspection'
import { buildReportCode } from './utils/buildReportCode'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ObraProvider, useObra } from './contexts/ObraContext'
import { db } from './services/dbDexie'
import { removerAnexo } from './services/anexos'
import { enqueueSync, ensureObraWorkOrder, syncManager } from './services/sync'
import type { FotoLaudo } from './types/laudoEnsaio'
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
import { ContratarPage, diasDeTeste, lembrarPlanoDaUrl } from './pages/ContratarPage'
import { EquipePage } from './pages/EquipePage'

// Métodos com formulário próprio: abrem e editam na página, não na janela geral
const FORMULARIO_PROPRIO: string[] = ['UT', 'PAUT']

// Plano escolhido nos cards da página inicial
lembrarPlanoDaUrl()
import { ObraEscopoPage } from './pages/ObraEscopoPage'
import { ObrasPage } from './pages/ObrasPage'
import { NovaObraPage } from './pages/NovaObraPage'
import { ObraContextoPage } from './pages/ObraContextoPage'

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
  const { user, profile, tenant: authTenant, selectedUnit, isLoading, verificandoSessao, signOut, emRecuperacao } = useAuth()
  const { obraAtual: obraSelecionada, selecionarObra } = useObra()

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
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0)

  const tenantId = profile?.tenant_id ?? ''

  const loadReports = useCallback(async () => {
    if (!tenantId) return
    try {
      await db.migrateFromLocalStorage()
      // Laudos antigos do aparelho (sem empresa definida) continuam visíveis
      const all = (await db.reports.toArray()).filter(
        (r) => r.tenantId === tenantId || r.tenantId === '' || r.tenantId === DEFAULT_TENANT.id
      )
      if (all.length === 0 && import.meta.env.DEV) {
        // Dados de exemplo só em desenvolvimento
        const defaultReports: LocalReport[] = [
          {
            id: '1',
            tenantId,
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
        setReports(defaultReports.map((r) => r.data))
      } else {
        setReports(all.map((r) => r.data))
      }
    } catch (err) {
      console.error('[Dexie] Falha ao carregar reports:', err)
    } finally {
      setReportsLoaded(true)
    }
  }, [tenantId])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  // Sincroniza ao entrar e recarrega a lista quando chegam dados do servidor
  useEffect(() => {
    if (!tenantId) return
    let lastSyncAt = syncManager.getState().lastSyncAt
    const unsubscribe = syncManager.subscribe((state) => {
      setOfflineQueueCount(state.pendingCount)
      if (state.lastSyncAt !== lastSyncAt) {
        lastSyncAt = state.lastSyncAt
        loadReports()
      }
    })
    syncManager.refreshPendingCount()
    syncManager.syncNow()
    return unsubscribe
  }, [tenantId, loadReports])

  // Navegação entre páginas de modelos
  // 'HUB' | 'LP' | 'ME' | 'EVS' | 'NR13' | 'PM' | 'US' | 'PINTURA'
  // Veio de um card de plano da página inicial: abre direto a contratação
  const [veioDoCard] = useState(() => new URLSearchParams(window.location.search).has('plano'))
  const [currentPage, setCurrentPage] = useState<string>(veioDoCard ? 'CONTRATAR' : 'OBRAS')

  // Botão Entrar da página inicial: mostra o login mesmo com sessão guardada
  const [pedirLogin, setPedirLogin] = useState(() => new URLSearchParams(window.location.search).has('entrar'))
  const concluirLogin = () => {
    setPedirLogin(false)
    window.history.replaceState(null, '', '/app')
  }

  // Já logado, o plano sai do endereço: recarregar a página não reabre a contratação
  useEffect(() => {
    if (user && new URLSearchParams(window.location.search).has('plano')) window.history.replaceState(null, '', '/app')
  }, [user])

  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingReport, setEditingReport] = useState<InspectionReport | null>(null)
  const [modalMethod, setModalMethod] = useState<ENDMethod | undefined>(undefined)

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

  // Navega para a tela Nova Obra quando disparado da tela de Obras
  useEffect(() => {
    const handlerNovaObra = () => setCurrentPage('OBRA_NOVO')
    window.addEventListener('nova-obra', handlerNovaObra as EventListener)
    return () => window.removeEventListener('nova-obra', handlerNovaObra as EventListener)
  }, [])

  const handleUpdateTenant = (updated: TenantProfile) => {
    setTenant(updated)
    localStorage.setItem('axos_tenant_profile', JSON.stringify(updated))
  }

  // Saiu do formulário sem salvar: o próximo laudo não pode herdar a edição
  useEffect(() => {
    if (editingReport && !isModalOpen && editingReport.method !== currentPage) setEditingReport(null)
  }, [currentPage, editingReport, isModalOpen])

  const diasRestantes = diasDeTeste(authTenant?.plan, authTenant?.trial_ends_at)
  const testeEncerrado = diasRestantes !== null && diasRestantes <= 0

  // Teste encerrado: consulta continua liberada, laudo novo pede plano
  useEffect(() => {
    if (testeEncerrado && !['HUB', 'OBRAS', 'OBRA_NOVO', 'OBRA_CONTEXTO', 'CONTRATAR', 'EQUIPE'].includes(currentPage)) setCurrentPage('CONTRATAR')
  }, [testeEncerrado, currentPage])

  const voltarDoFormulario = () => {
    setEditingReport(null)
    setCurrentPage('HUB')
  }

  const handleSaveReport = async (reportData: Partial<InspectionReport>) => {
    const agora = new Date().toISOString()
    // Veredito é do inspetor; o status de workflow é só do servidor
    const { status: veredito, ...campos } = reportData
    const existing = editingReport ? await db.reports.get(editingReport.id) : undefined

    const data: InspectionReport = editingReport
      ? { ...editingReport, ...campos, updatedAt: agora }
      : {
          id: reportData.id || crypto.randomUUID(),
          code: 'RASCUNHO', // número definitivo atribuído pelo servidor na emissão
          method: reportData.method || 'VT',
          title: reportData.title || 'Laudo Técnico END',
          equipmentTag: reportData.equipmentTag || 'TAG-PENDENTE',
          unitArea: reportData.unitArea || 'Área Industrial',
          inspectorName: reportData.inspectorName || 'Inspetor',
          inspectorSNQC: reportData.inspectorSNQC || 'SNQC',
          normProcedure: reportData.normProcedure || 'Norma',
          acceptanceCriteria: reportData.acceptanceCriteria || 'Critério',
          date: reportData.date || agora.split('T')[0],
          status: 'rascunho',
          findingsCount: reportData.findingsCount || 0,
          summary: reportData.summary || '',
          technicalData: reportData.technicalData || {},
          createdAt: agora,
          updatedAt: agora,
          linhaId: reportData.linhaId || null,
          quantidadeInspecionada: reportData.quantidadeInspecionada || 0,
          quantidadeAprovada: reportData.quantidadeAprovada || 0,
          quantidadeReprovada: reportData.quantidadeReprovada || 0,
        }

    const workOrderId =
      existing?.workOrderId ?? (obraSelecionada && user ? await ensureObraWorkOrder(obraSelecionada, user.id) : null)
    const verdict = veredito === 'aprovado' ? 'A' : veredito === 'reprovado' ? 'R' : existing?.verdict ?? null

    await db.reports.put({
      id: data.id,
      tenantId,
      method: data.method,
      workOrderId,
      data,
      verdict,
      localStatus: 'rascunho',
      serverStatus: existing?.serverStatus ?? null,
      clientRevision: (existing?.clientRevision ?? 0) + 1,
      serverRevision: existing?.serverRevision ?? null,
      reportNumber: existing?.reportNumber ?? null,
      updatedAt: agora,
      lastSyncAt: existing?.lastSyncAt ?? null,
      lastError: null,
    })
    setReports(editingReport ? reports.map((r) => (r.id === data.id ? data : r)) : [data, ...reports])
    setEditingReport(null)
    // Sem obra o laudo fica guardado no aparelho: no servidor todo laudo pertence a uma OS
    if (workOrderId) await enqueueSync('report', data.id)
  }

  const handleDeleteReport = async (id: string) => {
    const existing = await db.reports.get(id)
    setReports(reports.filter((r) => r.id !== id))
    const fotos = (existing?.data.technicalData as { fotos?: FotoLaudo[] } | undefined)?.fotos ?? []
    for (const foto of fotos) await removerAnexo(foto.anexoId, id).catch(() => undefined)
    await db.reports.delete(id)
    if (existing?.lastSyncAt) {
      await enqueueSync('report', id, 'delete') // o servidor só aceita apagar rascunho
    } else {
      await db.outbox.where('entityId').equals(id).delete()
      await syncManager.refreshPendingCount()
    }
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
    // Módulo de Obras (Plano Empresas) - acessível apenas dentro de uma obra selecionada
    { id: 'OBRA_CONTEXTO', label: 'Obra Atual', tag: 'OBR' },
    ...(profile?.role === 'admin' ? [{ id: 'EQUIPE', label: 'Equipe', tag: 'EQP' }] : []),
  ]

  const navRef = useRef<HTMLElement>(null)

  const handleNavScroll = (dir: 'left' | 'right') => {
    if (navRef.current) {
      navRef.current.scrollBy({ left: dir === 'left' ? -240 : 240, behavior: 'smooth' })
    }
  }

  if (verificandoSessao && !emRecuperacao) {
    return (
      <div role="status" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', color: 'var(--text-muted)', fontSize: '16px' }}>
        Carregando...
      </div>
    )
  }

  if (emRecuperacao || !user || !profile || pedirLogin) {
    return <LoginPage aoEntrar={concluirLogin} />
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', color: 'var(--text-primary)', position: 'relative', transition: 'background 0.2s ease, color 0.2s ease' }}>
      {/* A contratação abre só com o formulário e o rodapé */}
      {currentPage !== 'CONTRATAR' && (<>
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
        <div className="app-abas" style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px', position: 'relative', display: 'flex', alignItems: 'center' }}>
          
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
      </>)}

      {/* ÁREA PRINCIPAL DO APP */}
      {diasRestantes !== null && currentPage !== 'CONTRATAR' && (
        <div className="teste-aviso" role={testeEncerrado ? 'alert' : 'status'}>
          <span>{testeEncerrado ? 'Seu teste grátis terminou. Seus dados continuam guardados.' : `Teste grátis: ${diasRestantes === 1 ? 'falta 1 dia' : `faltam ${diasRestantes} dias`}.`}</span>
          <button type="button" className="lf-botao" onClick={() => setCurrentPage('CONTRATAR')}>Contratar plano</button>
        </div>
      )}

      <main className="app-main" style={{ flex: 1, maxWidth: '1280px', width: '100%', margin: '0 auto', padding: '28px 32px', position: 'relative', zIndex: 1 }}>
        {currentPage === 'EQUIPE' && <EquipePage />}

        {currentPage === 'CONTRATAR' && (
          <ContratarPage
            aoVoltar={() => (veioDoCard ? window.location.assign('/') : setCurrentPage('HUB'))}
            aoIrAoSistema={() => setCurrentPage('HUB')}
            encerrado={testeEncerrado}
          />
        )}

        {currentPage === 'HUB' && (
          <HubPage
            reports={reports}
            onVoltarObras={() => setCurrentPage('OBRAS')}
            onSelectModel={(modelId) => {
              if (testeEncerrado) return setCurrentPage('CONTRATAR')
              if (obraSelecionada && !FORMULARIO_PROPRIO.includes(modelId)) {
                setModalMethod(modelId as ENDMethod)
                setIsModalOpen(true)
                setEditingReport(null)
              } else {
                setCurrentPage(modelId)
              }
            }}
            onNewReport={() => {
              if (testeEncerrado) return setCurrentPage('CONTRATAR')
              setEditingReport(null)
              setModalMethod(undefined)
              setIsModalOpen(true)
            }}
            onEditReport={(report) => {
              setEditingReport(report)
              if (FORMULARIO_PROPRIO.includes(report.method)) setCurrentPage(report.method)
              else setIsModalOpen(true)
            }}
            onDeleteReport={handleDeleteReport}
          />
        )}

        {currentPage === 'OBRAS' && (
          <ObrasPage onBack={() => setCurrentPage('OBRAS')} onAbrirPainel={() => setCurrentPage('HUB')} />
        )}

        {currentPage === 'OBRA_NOVO' && (
          <NovaObraPage onBack={() => setCurrentPage('OBRAS')} />
        )}

        {currentPage === 'OBRA_CONTEXTO' && (
          <ObraContextoPage onBack={() => setCurrentPage('OBRAS')} />
        )}

        {currentPage === 'VT' && (
          <VTPage onBack={() => setCurrentPage('HUB')} onSave={handleSaveReport} tenant={tenant} tenantName={tenant.tradeName} />
        )}
        {currentPage === 'PT' && (
          <PTPage onBack={() => setCurrentPage('HUB')} onSave={handleSaveReport} tenant={tenant} tenantName={tenant.tradeName} />
        )}
        {currentPage === 'MT' && (
          <MTPage onBack={() => setCurrentPage('HUB')} onSave={handleSaveReport} tenant={tenant} tenantName={tenant.tradeName} />
        )}
        {currentPage === 'UT' && (
          <UTPage key={editingReport?.id ?? 'novo'} initialReport={editingReport} siteId={obraSelecionada?.id} onBack={voltarDoFormulario} onSave={handleSaveReport} />
        )}
        {currentPage === 'RT' && (
          <RTPage onBack={() => setCurrentPage('HUB')} onSave={handleSaveReport} tenant={tenant} tenantName={tenant.tradeName} />
        )}
        {currentPage === 'ET' && (
          <ETPage onBack={() => setCurrentPage('HUB')} onSave={handleSaveReport} tenant={tenant} tenantName={tenant.tradeName} />
        )}
        {currentPage === 'LT' && (
          <LTPage onBack={() => setCurrentPage('HUB')} onSave={handleSaveReport} tenant={tenant} tenantName={tenant.tradeName} />
        )}
        {currentPage === 'LT_VACUO' && (
          <LT_VACUOPage onBack={() => setCurrentPage('HUB')} onSave={handleSaveReport} tenant={tenant} tenantName={tenant.tradeName} />
        )}
        {currentPage === 'PAUT' && (
          <PAUTPage key={editingReport?.id ?? 'novo'} initialReport={editingReport} siteId={obraSelecionada?.id} onBack={voltarDoFormulario} onSave={handleSaveReport} />
        )}
        {currentPage === 'TOFD' && (
          <TOFDPage onBack={() => setCurrentPage('HUB')} onSave={handleSaveReport} tenant={tenant} tenantName={tenant.tradeName} />
        )}
        {currentPage === 'CRDR' && (
          <CRDRPage onBack={() => setCurrentPage('HUB')} onSave={handleSaveReport} tenant={tenant} tenantName={tenant.tradeName} />
        )}
        {currentPage === 'ECA' && (
          <ECAPage onBack={() => setCurrentPage('HUB')} onSave={handleSaveReport} tenant={tenant} tenantName={tenant.tradeName} />
        )}
        {currentPage === 'EA' && (
          <EAPage onBack={() => setCurrentPage('HUB')} onSave={handleSaveReport} tenant={tenant} tenantName={tenant.tradeName} />
        )}
        {currentPage === 'IRT' && (
          <IRTPage onBack={() => setCurrentPage('HUB')} onSave={handleSaveReport} tenant={tenant} tenantName={tenant.tradeName} />
        )}
        {currentPage === 'ACFM' && (
          <ACFMPage onBack={() => setCurrentPage('HUB')} onSave={handleSaveReport} tenant={tenant} tenantName={tenant.tradeName} />
        )}
        {currentPage === 'TFM' && (
          <TFMPage onBack={() => setCurrentPage('HUB')} onSave={handleSaveReport} tenant={tenant} tenantName={tenant.tradeName} />
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
        initialMethod={modalMethod}
        siteId={obraSelecionada?.id}
      />

      {/* FOOTER DISCRETO DA AXOS */}
      <TenantFooter />
    </div>
  )
}

export function App() {
  return (
    <AuthProvider>
      <ObraProvider>
        <AppContent />
      </ObraProvider>
    </AuthProvider>
  )
}

export default App
