import React, { useEffect, useState } from 'react'
import { ArrowLeft, Home, List, Plus, Edit2, Layout } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useObra } from '../contexts/ObraContext'
import { ObraResumoAvanco } from '../components/obra/ObraResumoAvanco'
import { ObraEscopoPage } from './ObraEscopoPage'

const FONT = 'Arial, Helvetica, sans-serif'

interface ObraContextoPageProps {
  onBack: () => void
}

interface MenuItem {
  id: string
  label: string
  icon: React.ReactNode
  adminOnly?: boolean
}

export const ObraContextoPage: React.FC<ObraContextoPageProps> = ({ onBack }) => {
  const { profile } = useAuth()
  const { obraAtual, selecionarObra } = useObra()
  const [painelAtivo, setPainelAtivo] = useState('resumo')

  const clienteNome = (id: string) => {
    return 'Contratante'
  }

  const itensMenu: MenuItem[] = [
    { id: 'resumo', label: 'Resumo e avanço', icon: <Home size={16} strokeWidth={1.75} /> },
    { id: 'laudos', label: 'Laudos', icon: <List size={16} strokeWidth={1.75} /> },
    { id: 'novolaudo', label: 'Novo laudo', icon: <Plus size={16} strokeWidth={1.75} /> },
    { id: 'escopo', label: 'Escopo', icon: <Edit2 size={16} strokeWidth={1.75} />, adminOnly: true },
    { id: 'ordens', label: 'Ordens de serviço', icon: <Layout size={16} strokeWidth={1.75} />, adminOnly: true },
  ]

  const podeVerItem = (item: MenuItem) => {
    if (item.adminOnly && profile?.role !== 'admin' && profile?.role !== 'supervisor') return false
    return true
  }

  if (!obraAtual) {
    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 32px', minHeight: 'calc(100vh - 200px)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: FONT }}>
        <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Nenhuma obra selecionada</h2>
          <p style={{ fontSize: '14px' }}>Selecione uma obra na lista de Obras para visualizar seus detalhes.</p>
          <button
            type="button"
            onClick={onBack}
            style={{
              marginTop: '16px', padding: '8px 16px', borderRadius: '5px', border: '1px solid var(--border)',
              background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '14px', fontWeight: 500, cursor: 'pointer',
            }}
          >
            Voltar às Obras
          </button>
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
          <ArrowLeft size={16} strokeWidth={1.75} /> Voltar às Obras
        </button>
        <h1 style={{ fontSize: '22px', fontWeight: 600, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          {obraAtual.name}
        </h1>
      </div>

      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '16px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--card-met-azul, #2FB8D6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06222B', fontWeight: 700, fontFamily: FONT }}>
          {obraAtual.name.charAt(0)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>{obraAtual.name}</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Contratante: {clienteNome(obraAtual.client_id)}</p>
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

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto' }}>
        {itensMenu.filter((item) => podeVerItem(item)).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPainelAtivo(item.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '8px 14px', borderRadius: '5px', border: `1px solid ${painelAtivo === item.id ? 'var(--card-met-azul, #2FB8D6)' : 'var(--border)'}`,
              background: painelAtivo === item.id ? 'var(--card-met-azul, #2FB8D6)' : 'var(--bg-surface)',
              color: painelAtivo === item.id ? '#FFFFFF' : 'var(--text-primary)',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '14px' }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div style={{ minHeight: '400px' }}>
        {painelAtivo === 'resumo' && (
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
              Resumo e avanço da obra
            </h3>
            <ObraResumoAvanco siteId={obraAtual.id} />
          </div>
        )}
        {painelAtivo === 'laudos' && (
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
              Laudos da Obra
            </h3>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '24px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Laudos vinculados a esta obra.</p>
            </div>
          </div>
        )}
        {painelAtivo === 'novolaudo' && (
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
              Novo Laudo
            </h3>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '24px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                Crie um novo laudo vinculado a esta obra. A obra já está pré-selecionada.
              </p>
            </div>
          </div>
        )}
        {painelAtivo === 'escopo' && <ObraEscopoPage />}
        {painelAtivo === 'ordens' && (
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px' }}>
              Ordens de Serviço
            </h3>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '24px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                Lista de ordens de serviço vinculadas a esta obra.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
