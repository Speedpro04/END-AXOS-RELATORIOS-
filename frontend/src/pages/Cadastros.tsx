import React, { useMemo, useState } from 'react'
import { ArrowLeft, Plus, Search, AlertCircle } from 'lucide-react'
import type { Client, Site, WorkOrder } from '../types/os'

interface CadastrosProps {
  onBack: () => void
  tenantId: string
  userRole: 'admin' | 'supervisor' | 'inspector'
  userId: string
  allowFieldCreation: boolean
}

type Tab = 'clients' | 'sites' | 'work_orders'

const TAB_LABELS: Record<Tab, string> = {
  clients: 'Contratantes',
  sites: 'Obras',
  work_orders: 'Ordens de serviço',
}

export const Cadastros: React.FC<CadastrosProps> = ({
  onBack,
  tenantId,
  userRole,
  userId,
  allowFieldCreation,
}) => {
  const [tab, setTab] = useState<Tab>('clients')
  const [search, setSearch] = useState('')
  const [showPending, setShowPending] = useState(false)
  const [openCreate, setOpenCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Mock de dados — substituir por chamadas reais ao Supabase nas tarefas seguintes (F/E)
  const MOCK_CLIENTS: Client[] = [
    {
      id: 'c1',
      tenant_id: tenantId,
      legal_name: 'Petrobras S.A.',
      cnpj: '24.819.340/0001-82',
      address: 'Av. Chile, 100 - Centro, Rio de Janeiro - RJ',
      contact_name: 'João Silva',
      contact_email: 'joao@petrobras.com.br',
      contact_phone: '(21) 3490-8800',
      active: true,
      created_by: 'admin-user',
      created_in_field: false,
      needs_review: false,
      created_at: '2026-01-10T10:00:00Z',
      updated_at: '2026-01-10T10:00:00Z',
    },
    {
      id: 'c2',
      tenant_id: tenantId,
      legal_name: 'Shell Brasil Petróleo LTDA',
      cnpj: '12.345.678/0001-90',
      address: 'Av. Paulista, 1000 - São Paulo - SP',
      contact_name: 'Maria Souza',
      contact_email: 'maria@shell.com.br',
      contact_phone: '(11) 3490-8801',
      active: true,
      created_by: 'inspector-user',
      created_in_field: true,
      needs_review: true,
      created_at: '2026-10-20T14:30:00Z',
      updated_at: '2026-10-20T14:30:00Z',
    },
  ]

  const MOCK_SITES: Site[] = [
    {
      id: 's1',
      tenant_id: tenantId,
      client_id: 'c1',
      name: 'Refinaria RPBC',
      address: 'Av. Chile, 100 - Centro',
      city: 'Rio de Janeiro',
      uf: 'RJ',
      contract_ref: 'CT-PETRO-2026/0892',
      situation: 'active',
      created_by: 'admin-user',
      created_in_field: false,
      needs_review: false,
      created_at: '2026-01-15T09:00:00Z',
      updated_at: '2026-01-15T09:00:00Z',
    },
    {
      id: 's2',
      tenant_id: tenantId,
      client_id: 'c2',
      name: 'Terminal de Gás Sul',
      address: 'Av. Paulista, 1000',
      city: 'São Paulo',
      uf: 'SP',
      contract_ref: 'CT-SHELL-2026/0112',
      situation: 'active',
      created_by: 'inspector-user',
      created_in_field: true,
      needs_review: true,
      created_at: '2026-10-21T11:00:00Z',
      updated_at: '2026-10-21T11:00:00Z',
    },
  ]

  const MOCK_WORK_ORDERS: WorkOrder[] = [
    {
      id: 'w1',
      tenant_id: tenantId,
      client_id: 'c1',
      code: 'OS-001',
      site_id: 's1',
      site: 'Refinaria RPBC',
      scheduled_for: '2026-10-25',
      assigned_to: userId,
      method: 'US',
      notes: 'Inspeção de solda na junta J-01',
      created_by: 'admin-user',
      created_in_field: false,
      needs_review: false,
      created_at: '2026-10-22T08:00:00Z',
      updated_at: '2026-10-22T08:00:00Z',
    },
    {
      id: 'w2',
      tenant_id: tenantId,
      client_id: 'c2',
      code: 'OS-002',
      site_id: 's2',
      site: 'Terminal de Gás Sul',
      scheduled_for: '2026-10-26',
      assigned_to: null,
      method: 'LP',
      notes: 'Inspeção de penetrante em tanque T-501',
      created_by: 'inspector-user',
      created_in_field: true,
      needs_review: true,
      created_at: '2026-10-23T10:00:00Z',
      updated_at: '2026-10-23T10:00:00Z',
    },
  ]

  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

  const clients = useMemo(() => {
    const q = norm(search)
    return MOCK_CLIENTS.filter((c) => {
      const haystack = norm(`${c.legal_name} ${c.cnpj ?? ''} ${c.contact_name ?? ''}`)
      const match = !q || haystack.includes(q)
      const pending = showPending ? c.needs_review : true
      return match && pending
    })
  }, [search, showPending])

  const sites = useMemo(() => {
    const q = norm(search)
    return MOCK_SITES.filter((s) => {
      const haystack = norm(`${s.name} ${s.contract_ref ?? ''} ${s.city ?? ''}`)
      const match = !q || haystack.includes(q)
      const pending = showPending ? s.needs_review : true
      return match && pending
    })
  }, [search, showPending])

  const workOrders = useMemo(() => {
    const q = norm(search)
    return MOCK_WORK_ORDERS.filter((w) => {
      const haystack = norm(`${w.code} ${w.site ?? ''} ${w.method ?? ''}`)
      const match = !q || haystack.includes(q)
      const pending = showPending ? w.needs_review : true
      return match && pending
    })
  }, [search, showPending])

  const pendingCount = useMemo(() => {
    return (
      MOCK_CLIENTS.filter((c) => c.needs_review).length +
      MOCK_SITES.filter((s) => s.needs_review).length +
      MOCK_WORK_ORDERS.filter((w) => w.needs_review).length
    )
  }, [])

  const canCreate = useMemo(() => {
    if (userRole === 'admin' || userRole === 'supervisor') return true
    return allowFieldCreation
  }, [userRole, allowFieldCreation])

  const handleCreate = () => {
    if (!canCreate) {
      alert('Criação em campo não está habilitada para este tenant. Peça ao supervisor para cadastrar.')
      return
    }
    setEditingId(null)
    setOpenCreate(true)
  }

  const handleEdit = (id: string) => {
    setEditingId(id)
    setOpenCreate(true)
  }

  const handleDelete = (id: string) => {
    alert('Exclusão não permitida — desative o registro em vez de apagá-lo.')
  }

  const handleCloseCreate = () => {
    setOpenCreate(false)
    setEditingId(null)
  }

  const TabButton = ({ key, label, count }: { key: Tab; label: string; count: number }) => {
    const active = tab === key
    return (
      <button
        type="button"
        onClick={() => setTab(key)}
        style={{
          padding: '8px 16px',
          borderRadius: '4px',
          border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
          background: active ? 'var(--accent)' : 'var(--bg-surface)',
          color: active ? '#fff' : 'var(--text-primary)',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {label}
        <span style={{ fontSize: '11px', opacity: active ? 0.9 : 0.6 }}>{count}</span>
      </button>
    )
  }

  const renderClientRow = (c: Client) => {
    const formattedCnpj = c.cnpj ? c.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : ''
    return (
      <tr key={c.id} className="border-t border-[#E2E8F0]">
        <td className="px-3 py-2 text-xs font-bold text-[#0F172A]">{c.legal_name}</td>
        <td className="px-3 py-2 text-xs text-[#64748B] font-mono">{formattedCnpj}</td>
        <td className="px-3 py-2 text-xs text-[#64748B]">{c.contact_name ?? '—'}</td>
        <td className="px-3 py-2 text-xs text-[#64748B]">{c.contact_phone ?? '—'}</td>
        <td className="px-3 py-2 text-xs">
          <span
            style={{
              display: 'inline-block',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 600,
              background: c.active ? '#dcfce7' : '#fecaca',
              color: c.active ? '#166534' : '#991b1b',
            }}
          >
            {c.active ? 'Ativo' : 'Inativo'}
          </span>
        </td>
        <td className="px-3 py-2 text-xs">
          {c.created_in_field && (
            <span style={{ fontSize: '10px', color: '#2FB8D6', fontWeight: 600 }}>CAMPO</span>
          )}
        </td>
        <td className="px-3 py-2 text-xs">
          {c.needs_review ? (
            <span style={{ fontSize: '10px', color: '#d97706', fontWeight: 600 }}>PENDENTE</span>
          ) : (
            <span style={{ fontSize: '10px', color: '#166534', fontWeight: 600 }}>REVISADO</span>
          )}
        </td>
        <td className="px-3 py-2 text-right">
          <button type="button" onClick={() => handleEdit(c.id)} className="text-xs text-[#2FB8D6] hover:text-[#1a8fa3]">Editar</button>
          <button type="button" onClick={() => handleDelete(c.id)} className="text-xs text-[#c4262e] hover:text-[#991b1b] ml-2">Desativar</button>
        </td>
      </tr>
    )
  }

  const renderSiteRow = (s: Site) => {
    return (
      <tr key={s.id} className="border-t border-[#E2E8F0]">
        <td className="px-3 py-2 text-xs font-bold text-[#0F172A]">{s.name}</td>
        <td className="px-3 py-2 text-xs text-[#64748B]">{s.client_id}</td>
        <td className="px-3 py-2 text-xs text-[#64748B]">{s.address ?? '—'}</td>
        <td className="px-3 py-2 text-xs text-[#64748B]">
          {s.city && s.uf ? `${s.city} - ${s.uf}` : '—'}
        </td>
        <td className="px-3 py-2 text-xs text-[#64748B] font-mono">{s.contract_ref ?? '—'}</td>
        <td className="px-3 py-2 text-xs">
          <span
            style={{
              display: 'inline-block',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 600,
              background: s.situation === 'active' ? '#dcfce7' : '#fecaca',
              color: s.situation === 'active' ? '#166534' : '#991b1b',
            }}
          >
            {s.situation === 'active' ? 'Ativa' : s.situation === 'concluded' ? 'Concluída' : 'Cancelada'}
          </span>
        </td>
        <td className="px-3 py-2 text-xs">
          {s.created_in_field && (
            <span style={{ fontSize: '10px', color: '#2FB8D6', fontWeight: 600 }}>CAMPO</span>
          )}
        </td>
        <td className="px-3 py-2 text-xs">
          {s.needs_review ? (
            <span style={{ fontSize: '10px', color: '#d97706', fontWeight: 600 }}>PENDENTE</span>
          ) : (
            <span style={{ fontSize: '10px', color: '#166534', fontWeight: 600 }}>REVISADO</span>
          )}
        </td>
        <td className="px-3 py-2 text-right">
          <button type="button" onClick={() => handleEdit(s.id)} className="text-xs text-[#2FB8D6] hover:text-[#1a8fa3]">Editar</button>
        </td>
      </tr>
    )
  }

  const renderWorkOrderRow = (w: WorkOrder) => {
    return (
      <tr key={w.id} className="border-t border-[#E2E8F0]">
        <td className="px-3 py-2 text-xs font-bold text-[#0F172A]">{w.code}</td>
        <td className="px-3 py-2 text-xs text-[#64748B]">{w.client_id}</td>
        <td className="px-3 py-2 text-xs text-[#64748B]">{w.site ?? '—'}</td>
        <td className="px-3 py-2 text-xs text-[#64748B]">{w.scheduled_for ?? '—'}</td>
        <td className="px-3 py-2 text-xs text-[#64748B]">{w.method ?? '—'}</td>
        <td className="px-3 py-2 text-xs">
          {w.assigned_to ? (w.assigned_to === userId ? 'Você' : 'Atribuído') : 'Não atribuída'}
        </td>
        <td className="px-3 py-2 text-xs">
          {w.created_in_field && (
            <span style={{ fontSize: '10px', color: '#2FB8D6', fontWeight: 600 }}>CAMPO</span>
          )}
        </td>
        <td className="px-3 py-2 text-xs">
          {w.needs_review ? (
            <span style={{ fontSize: '10px', color: '#d97706', fontWeight: 600 }}>PENDENTE</span>
          ) : (
            <span style={{ fontSize: '10px', color: '#166534', fontWeight: 600 }}>REVISADO</span>
          )}
        </td>
        <td className="px-3 py-2 text-right">
          <button type="button" onClick={() => handleEdit(w.id)} className="text-xs text-[#2FB8D6] hover:text-[#1a8fa3]">Editar</button>
        </td>
      </tr>
    )
  }

  const renderEmpty = (label: string) => (
    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
      {showPending ? 'Nenhum registro pendente de revisão.' : `Nenhum ${label} cadastrado.`}
    </div>
  )

  const renderCreateModal = () => {
    if (!openCreate) return null
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(15, 23, 42, 0.4)',
          padding: '16px',
        }}
      >
        <div
          style={{
            background: 'var(--modal-bg)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            width: '100%',
            maxWidth: '560px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ background: 'var(--modal-header-bg)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                {editingId ? 'Editar' : 'Novo registro'}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>
                Cadastro de {TAB_LABELS[tab]}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCloseCreate}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px', lineHeight: 1, padding: '4px' }}
            >
              ✕
            </button>
          </div>
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Este é um formulário de exemplo. A integração real com o Supabase será implementada na Tarefa F (backend de sincronização).
            </p>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={handleCloseCreate} className="btn-industrial">
                Cancelar
              </button>
              <button type="button" onClick={handleCloseCreate} className="btn-primary-action">
                Salvar
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const pendingBadge = pendingCount > 0 ? (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      borderRadius: '4px',
      background: '#fef2f2',
      color: '#991b1b',
      fontSize: '11px',
      fontWeight: 700,
      border: '1px solid #fca5a5',
    }}>
      <AlertCircle size={14} />
      {pendingCount} pendente(s) de revisão
    </span>
  ) : null

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="bg-white border border-[#E2E8F0] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs" style={{ borderRadius: '3px' }}>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="p-1.5 text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] border border-[#CBD5E1] transition-colors cursor-pointer" style={{ borderRadius: '3px' }}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#0B0F17] text-white tracking-wider uppercase" style={{ borderRadius: '3px' }}>
                CADASTROS
              </span>
              <h2 className="text-base font-bold text-[#0F172A] tracking-tight uppercase">
                Cadastros de Contratantes, Obras e OS
              </h2>
            </div>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              Gestão de contratantes, obras e ordens de serviço do tenant.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-[#64748B]">
            <input
              type="checkbox"
              checked={showPending}
              onChange={() => setShowPending(!showPending)}
              className="w-4 h-4"
            />
            Pendentes de revisão
          </label>
          {pendingBadge && userRole !== 'inspector' && pendingBadge}
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canCreate}
            className="px-4 py-1.5 bg-[#0B0F17] hover:bg-[#1E293B] text-white text-xs font-bold tracking-wide uppercase transition-colors cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed" style={{ borderRadius: '3px' }}
          >
            <Plus className="w-3 h-3 mr-1" /> Novo
          </button>
          {!canCreate && (
            <span style={{ fontSize: '11px', color: '#d97706', fontWeight: 600 }}>
              Criação em campo desabilitada
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
          <input
            type="text"
            placeholder="Buscar nome, código, CNPJ, local..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#F8FAFC] border border-[#CBD5E1] rounded font-bold text-[#0F172A] focus:ring-0"
          />
        </div>
        <div className="flex gap-1">
          <TabButton
            key="clients"
            label={TAB_LABELS.clients}
            count={tab === 'clients' ? clients.length : 0}
          />
          <TabButton
            key="sites"
            label={TAB_LABELS.sites}
            count={tab === 'sites' ? sites.length : 0}
          />
          <TabButton
            key="work_orders"
            label={TAB_LABELS.work_orders}
            count={tab === 'work_orders' ? workOrders.length : 0}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse" style={{ borderRadius: '3px', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              {tab === 'clients' && (
                <>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase">Contratante</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase font-mono">CNPJ</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase">Contato</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase font-mono">Telefone</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase">Situação</th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-[#64748B] uppercase">Origem</th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-[#64748B] uppercase">Revisão</th>
                  <th className="px-3 py-2 text-right text-[10px] font-bold text-[#64748B] uppercase"></th>
                </>
              )}
              {tab === 'sites' && (
                <>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase">Obra</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase">Contratante</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase">Local</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase">Cidade - UF</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase font-mono">Contrato</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase">Situação</th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-[#64748B] uppercase">Origem</th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-[#64748B] uppercase">Revisão</th>
                  <th className="px-3 py-2 text-right text-[10px] font-bold text-[#64748B] uppercase"></th>
                </>
              )}
              {tab === 'work_orders' && (
                <>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase">Código OS</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase font-mono">Contratante</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase">Obra</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase">Agendado</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase">Método</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold text-[#64748B] uppercase">Atribuído</th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-[#64748B] uppercase">Origem</th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold text-[#64748B] uppercase">Revisão</th>
                  <th className="px-3 py-2 text-right text-[10px] font-bold text-[#64748B] uppercase"></th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {tab === 'clients' ? (
              clients.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-xs text-[#64748B]">{renderEmpty('contratante')}</td></tr>
              ) : (
                clients.map(renderClientRow)
              )
            ) : tab === 'sites' ? (
              sites.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-xs text-[#64748B]">{renderEmpty('obra')}</td></tr>
              ) : (
                sites.map(renderSiteRow)
              )
            ) : (
              workOrders.length === 0 ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-xs text-[#64748B]">{renderEmpty('ordem de serviço')}</td></tr>
              ) : (
                workOrders.map(renderWorkOrderRow)
              )
            )}
          </tbody>
        </table>
      </div>

      {renderCreateModal()}
    </div>
  )
}
