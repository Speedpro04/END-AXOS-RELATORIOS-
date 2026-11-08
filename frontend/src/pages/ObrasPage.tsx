import React, { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Plus, Search, Filter, Edit2, Trash2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useObra } from '../contexts/ObraContext'
import type { Site } from '../types/os'
import { db } from '../services/dbDexie'
import { enqueueSync } from '../services/sync'

const FONT = 'Arial, Helvetica, sans-serif'

interface ObrasPageProps {
  onBack: () => void
  onAbrirPainel: () => void
}

export const ObrasPage: React.FC<ObrasPageProps> = ({ onBack, onAbrirPainel }) => {
  const { profile } = useAuth()
  const { obraAtual, selecionarObra } = useObra()
  const [obras, setObras] = useState<Site[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [termoBusca, setTermoBusca] = useState('')
  const [filtroContratante, setFiltroContratante] = useState<string | null>(null)
  const [filtroSituacao, setFiltroSituacao] = useState<string | null>(null)

  const carregar = async () => {
    setCarregando(true)
    try {
      const todas = await db.sites.toArray()
      const todosClientes = await db.clients.toArray()
      setClientes(todosClientes)
      setObras(todas)
    } catch (err) {
      console.error('[Obras] Falha ao carregar:', err)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const obrasFiltradas = useMemo(() => {
    return obras.filter((o: Site) => {
      if (o.tenant_id !== (profile?.tenant_id || '')) return false
      const q = termoBusca.toLowerCase()
      const cliente = clientes.find((c) => c.id === o.client_id)
      const nomeContratante = cliente ? cliente.legal_name : ''
      const haystack = `${o.name} ${o.address ?? ''} ${cliente?.legal_name ?? ''} ${o.contract_ref ?? ''}`
      if (q && !haystack.toLowerCase().includes(q)) return false
      if (filtroContratante && o.client_id !== filtroContratante) return false
      if (filtroSituacao && o.situation !== filtroSituacao) return false
      return true
    })
  }, [obras, termoBusca, filtroContratante, filtroSituacao, profile?.tenant_id])

  // Obras com OS atribuídas para inspetor
  const obrasComOS = new Set<string>()
  useEffect(() => {
    const carregarObrasComOS = async () => {
      const orders = await db.workOrders.toArray()
      orders.forEach((o) => { if (o.site_id) obrasComOS.add(o.site_id) })
    }
    carregarObrasComOS()
  }, [])

  const obrasVisiveis = obrasFiltradas.filter((o: Site) => {
    if (profile?.role === 'inspector' && profile.can_inspect && !obrasComOS.has(o.id)) return false
    return true
  })

  const clienteNome = (id: string) => {
    const c = clientes.find((cl) => cl.id === id)
    return c ? c.legal_name : '—'
  }

  const contarLaudosObra = async (siteId: string) => {
    const reports = await db.reports.toArray()
    return reports.filter((r: any) => r.work_order_id === siteId).length
  }

  if (carregando) {
    return (
      <div style={{ padding: '24px 32px', maxWidth: '1280px', margin: '0 auto', minHeight: 'calc(100vh - 200px)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', color: 'var(--text-muted)', fontFamily: FONT }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid rgba(47, 184, 214, 0.2)', borderTopColor: '#2FB8D6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '12px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ fontSize: '14px' }}>Carregando obras...</span>
        </div>
      </div>
    )
  }

  const ultimaObra = obraAtual ? obras.find((o) => o.id === obraAtual.id) : null

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '32px 32px', minHeight: 'calc(100vh - 200px)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: FONT }}>
      {/* ── Cabeçalho padrão do app (mesmas medidas do Painel Operacional) ── */}
      <h1 style={{ fontSize: '29px', fontWeight: 600, margin: '0 0 32px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
        Obras
      </h1>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '5px', border: '1px solid var(--border)',
            background: 'var(--bg-surface)', color: 'var(--text-primary)',
            fontSize: '14px', fontWeight: 500, cursor: 'pointer',
          }}
        >
          <ArrowLeft size={16} strokeWidth={1.75} /> Voltar ao Catálogo
        </button>
        <h2 style={{ fontSize: '24px', fontWeight: 600, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          Obras e Escopo
        </h2>
      </div>

      {/* Última obra em destaque */}
      {obraAtual && (
        <div style={{ background: 'var(--bg-surface-alt)', border: '1px solid var(--border)', borderRadius: '5px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--card-met-azul, #2FB8D6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06222B', fontWeight: 700, fontFamily: FONT }}>
            {obraAtual.name.charAt(0)}
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>{obraAtual.name}</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              {clienteNome(obraAtual.client_id)} · {obraAtual.city || '—'} / {obraAtual.uf || '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => selecionarObra(null)}
            style={{
              padding: '8px 16px', borderRadius: '5px', border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
            }}
          >
            Trocar obra
          </button>
        </div>
      )}

      {/* Barra de ações */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px', minWidth: 0 }}>
          <div className="relative" style={{ maxWidth: '420px' }}>
            <Search size={16} strokeWidth={1.75} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} aria-hidden='true' />
            <input
              type="text"
              placeholder="Buscar por nome, contratante, local ou OS..."
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              className="w-full px-3.5 py-2 text-[14px] transition-all"
              style={{
                paddingLeft: '34px', borderRadius: '5px', border: '1px solid var(--border)',
                background: 'var(--bg-surface-alt)', color: 'var(--text-primary)', fontSize: '14px', fontFamily: FONT,
              }}
            />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', minWidth: 0 }}>
            <select
              value={filtroContratante || ''}
              onChange={(e) => setFiltroContratante(e.target.value || null)}
              style={{ padding: '8px 12px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-surface-alt)', color: 'var(--text-primary)', fontSize: '13px', fontFamily: FONT }}
            >
              <option value="">Todos os contratantes</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.legal_name}</option>
              ))}
            </select>
            <select
              value={filtroSituacao || ''}
              onChange={(e) => setFiltroSituacao(e.target.value || null)}
              style={{ padding: '8px 12px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-surface-alt)', color: 'var(--text-primary)', fontSize: '13px', fontFamily: FONT }}
            >
              <option value="">Todos os status</option>
              <option value="active">Ativa</option>
              <option value="concluded">Concluída</option>
            </select>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('nova-obra', {}))
            }
          }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '10px 20px', borderRadius: '5px', border: 'none',
            background: 'var(--card-met-azul, #2FB8D6)', color: '#FFFFFF',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={16} strokeWidth={1.75} /> Nova Obra
        </button>
      </div>

      {/* Lista de obras */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px' }}>
        {obrasVisiveis.length === 0 ? (
          <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '14px', fontWeight: 500 }}>Nenhuma obra cadastrada.</p>
            <p style={{ fontSize: '12.5px', marginTop: '4px' }}>Clique em "Nova Obra" para adicionar.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface-alt)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nome da Obra</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Contratante</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Local</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Laudos</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Última atividade</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {obrasVisiveis.map((obra) => (
                <tr key={obra.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>{obra.name}</td>
                  <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{clienteNome(obra.client_id)}</td>
                  <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>{obra.address || '—'}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: obra.situation === 'active' ? '#dcfce7' : '#fecaca',
                        color: obra.situation === 'active' ? '#166534' : '#991b1b',
                      }}
                    >
                      {obra.situation === 'active' ? 'Ativa' : 'Concluída'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{'—'}</td>
                  <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>{obra.updated_at ? new Date(obra.updated_at).toLocaleDateString('pt-BR') : '—'}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => {
                        selecionarObra(obra)
                        onAbrirPainel()
                      }}
                      style={{
                        padding: '6px 12px', borderRadius: '5px', border: '1px solid var(--card-met-azul, #2FB8D6)',
                        background: obraAtual?.id === obra.id ? 'var(--card-met-azul, #2FB8D6)' : 'var(--bg-surface)',
                        color: obraAtual?.id === obra.id ? '#FFFFFF' : 'var(--card-met-azul, #2FB8D6)',
                        fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                      }}
                    >
                      {obraAtual?.id === obra.id ? 'Abrir Painel' : 'Selecionar'}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const reativar = obra.situation === 'concluded'
                        const msg = reativar
                          ? `Reativar "${obra.name}"?`
                          : `Marcar "${obra.name}" como concluída?`
                        if (!confirm(msg)) return
                        setCarregando(true)
                        try {
                          await db.sites.update(obra.id, { situation: reativar ? 'active' : 'concluded', updated_at: new Date().toISOString() })
                          await enqueueSync('site', obra.id, 'update')
                          await carregar()
                        } finally {
                          setCarregando(false)
                        }
                      }}
                      style={{
                        marginLeft: '6px', padding: '6px 12px', borderRadius: '5px', border: '1px solid var(--border)',
                        background: 'var(--bg-surface)', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                      }}
                    >
                      {obra.situation === 'concluded' ? 'Reativar' : 'Concluir'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
