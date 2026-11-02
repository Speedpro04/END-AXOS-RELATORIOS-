import React, { useEffect, useState } from 'react'
import { ArrowLeft, Plus, Search, Edit2, Trash2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const FONT = 'Arial, Helvetica, sans-serif'

interface ObrasPageProps {
  onBack: () => void
  onNovaObra: () => void
}

export const ObrasPage: React.FC<ObrasPageProps> = ({ onBack, onNovaObra }) => {
  const { profile } = useAuth()
  const [obras, setObras] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [termoBusca, setTermoBusca] = useState('')

  const carregar = async () => {
    setCarregando(true)
    try {
      const { db } = await import('../services/dbDexie')
      const todas = await db.sites.toArray()
      setObras(todas.filter((s: any) => s.tenant_id === (profile?.tenant_id || '')))
    } catch (err) {
      console.error('[Obras] Falha ao carregar:', err)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [profile?.tenant_id])

  const obrasFiltradas = obras.filter((o) =>
    o.name.toLowerCase().includes(termoBusca.toLowerCase()) ||
    (o.address || '').toLowerCase().includes(termoBusca.toLowerCase())
  )

  const handleExcluir = async (id: string) => {
    if (!confirm('Excluir esta obra?')) return
    setCarregando(true)
    try {
      const { db } = await import('../services/dbDexie')
      await db.sites.delete(id)
      await carregar()
    } catch (err) {
      console.error('[Obras] Falha ao excluir:', err)
    } finally {
      setCarregando(false)
    }
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

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 32px', minHeight: 'calc(100vh - 200px)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
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
        <h1 style={{ fontSize: '22px', fontWeight: 600, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          Obras e Escopo
        </h1>
      </div>

      {/* Barra de ações */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="relative" style={{ maxWidth: '420px' }}>
            <Search size={16} strokeWidth={1.75} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} aria-hidden='true' />
            <input
              type="text"
              placeholder="Buscar por nome da obra..."
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              className="w-full px-3.5 py-2 text-[14px] transition-all"
              style={{
                paddingLeft: '34px', borderRadius: '5px', border: '1px solid var(--border)',
                background: 'var(--bg-surface-alt)', color: 'var(--text-primary)', fontSize: '14px', fontFamily: FONT,
              }}
            />
          </div>
          <button
            type="button"
            onClick={onNovaObra}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '5px', border: '1px solid var(--border)',
              background: 'var(--bg-surface)', color: 'var(--text-primary)',
              fontSize: '14px', fontWeight: 500, cursor: 'pointer',
            }}
          >
            <Plus size={16} strokeWidth={1.75} /> Nova Obra
          </button>
        </div>
      </div>

      {/* Lista de obras */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px' }}>
        {obrasFiltradas.length === 0 ? (
          <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '14px', fontWeight: 500 }}>Nenhuma obra cadastrada.</p>
            <p style={{ fontSize: '12.5px', marginTop: '4px' }}>Clique em "Nova Obra" para adicionar.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface-alt)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nome da Obra</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Endereço</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cidade / UF</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Contrato</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {obrasFiltradas.map((obra) => (
                <tr key={obra.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-primary)' }}>{obra.name}</td>
                  <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>{obra.address || '—'}</td>
                  <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>{obra.city || '—'} / {obra.uf || '—'}</td>
                  <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>{obra.contract_ref || '—'}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('obra-selecionada', { detail: { id: obra.id, nome: obra.name } }))
                      }}
                      style={{
                        marginLeft: '6px', padding: '6px 12px', borderRadius: '5px', border: '1px solid var(--card-met-azul, #2FB8D6)',
                        background: 'transparent', color: 'var(--card-met-azul, #2FB8D6)',
                        fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                      }}
                    >
                      Escopo
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
