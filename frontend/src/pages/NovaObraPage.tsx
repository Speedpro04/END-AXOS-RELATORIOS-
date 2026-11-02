import React, { useEffect, useState } from 'react'
import { ArrowLeft, Plus, Save } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const FONT = 'Arial, Helvetica, sans-serif'

interface NovaObraPageProps {
  onBack: () => void
}

export const NovaObraPage: React.FC<NovaObraPageProps> = ({ onBack }) => {
  const { profile } = useAuth()
  const [nome, setNome] = useState('')
  const [endereco, setEndereco] = useState('')
  const [cidade, setCidade] = useState('')
  const [uf, setUF] = useState('')
  const [contrato, setContrato] = useState('')
  const [carregando, setCarregando] = useState(false)

  const handleSalvar = async () => {
    if (!nome) return
    setCarregando(true)
    try {
      const { db } = await import('../services/dbDexie')
      const agora = new Date().toISOString()
      const tenantId = profile?.tenant_id || ''
      await db.sites.put({
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        client_id: '', // será preenchido quando houver tela de contratantes
        name: nome,
        address: endereco || null,
        city: cidade || null,
        uf: uf || null,
        contract_ref: contrato || null,
        situation: 'active',
        created_by: agora,
        created_in_field: false,
        needs_review: true,
        created_at: agora,
        updated_at: agora,
      })
      onBack()
    } catch (err) {
      console.error('[NovaObraPage] Falha ao salvar:', err)
    } finally {
      setCarregando(false)
    }
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
          Nova Obra
        </h1>
      </div>

      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '32px', maxWidth: '640px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 24px' }}>
          Cadastro de Obra
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nome da Obra *</label>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Plataforma P-77"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '14px', fontFamily: FONT }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Endereço</label>
            <input
              type="text"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Ex: Av. das Nações Unidas, 1000"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '14px', fontFamily: FONT }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cidade</label>
              <input
                type="text"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="Cidade"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '14px', fontFamily: FONT }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>UF</label>
              <input
                type="text"
                value={uf}
                onChange={(e) => setUF(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="SP"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '14px', fontFamily: FONT, textTransform: 'uppercase' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Referência do Contrato</label>
            <input
              type="text"
              value={contrato}
              onChange={(e) => setContrato(e.target.value)}
              placeholder="Ex: CT-PETRO-2024/0892"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '14px', fontFamily: FONT }}
            />
          </div>
        </div>

        <div style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              padding: '10px 20px', borderRadius: '5px', border: '1px solid var(--border)',
              background: 'var(--bg-base)', color: 'var(--text-primary)',
              fontFamily: FONT, fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSalvar}
            disabled={carregando || !nome}
            style={{
              padding: '10px 24px', borderRadius: '5px', border: 'none',
              background: carregando ? 'var(--bg-surface-alt)' : 'var(--card-met-azul, #2FB8D6)',
              color: carregando ? 'var(--text-muted)' : '#FFFFFF',
              fontFamily: FONT, fontSize: '14px', fontWeight: 600,
              cursor: carregando || !nome ? 'not-allowed' : 'pointer',
              opacity: carregando || !nome ? 0.7 : 1,
            }}
          >
            {carregando ? 'Criando…' : 'Criar Obra'}
          </button>
        </div>
      </div>
    </div>
  )
}
