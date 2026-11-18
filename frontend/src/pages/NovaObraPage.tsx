import React, { useEffect, useState } from 'react'
import { ArrowLeft, Plus, Save, Search } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useObra } from '../contexts/ObraContext'
import type { Client } from '../types/os'
import { db } from '../services/dbDexie'
import { enqueueSync } from '../services/sync'

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
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [clientes, setClientes] = useState<any[]>([])
  const [novoCliente, setNovoCliente] = useState(false)
  const [novoClienteNome, setNovoClienteNome] = useState('')
  const [novoClienteCnpj, setNovoClienteCnpj] = useState('')

  useEffect(() => {
    const carregar = async () => {
      const todas = await db.clients.toArray()
      setClientes(todas.filter((c: any) => c.tenant_id === (profile?.tenant_id || '')))
    }
    carregar()
  }, [profile?.tenant_id])

  const handleSalvar = async () => {
    if (!nome) return
    if (!clienteId) {
      alert('Selecione ou crie um contratante válido antes de salvar a obra.')
      return
    }
    setCarregando(true)
    try {
      const { db } = await import('../services/dbDexie')
      const agora = new Date().toISOString()
      const tenantId = profile?.tenant_id || ''
      const obraId = crypto.randomUUID()
      await db.sites.put({
        id: obraId,
        tenant_id: tenantId,
        client_id: clienteId,
        name: nome,
        address: endereco || null,
        city: cidade || null,
        uf: uf || null,
        contract_ref: contrato || null,
        situation: 'active',
        created_by: profile?.id || '',
        created_in_field: false,
        needs_review: true,
        created_at: agora,
        updated_at: agora,
      })
      await enqueueSync('site', obraId)
      onBack()
    } catch (err) {
      console.error('[NovaObraPage] Falha ao salvar:', err)
      alert('Falha ao salvar a obra.')
    } finally {
      setCarregando(false)
    }
  }

  const handleNovoCliente = async () => {
    if (!novoClienteNome) {
      alert('Informe o nome do contratante.')
      return
    }
    setCarregando(true)
    try {
      const { db } = await import('../services/dbDexie')
      const agora = new Date().toISOString()
      const tenantId = profile?.tenant_id || ''
      const id = crypto.randomUUID()
      await db.clients.put({
        id,
        tenant_id: tenantId,
        legal_name: novoClienteNome,
        cnpj: novoClienteCnpj || null,
        address: null,
        contact_name: null,
        contact_email: null,
        contact_phone: null,
        active: true,
        created_by: profile?.id || '',
        created_in_field: true,
        needs_review: true,
        created_at: agora,
        updated_at: agora,
      })
      setClientes([...clientes, { id, tenant_id: tenantId, legal_name: novoClienteNome, cnpj: novoClienteCnpj || null, active: true, created_in_field: true, needs_review: true, created_at: agora, updated_at: agora }])
      await enqueueSync('client', id)
      setClienteId(id)
      setNovoCliente(false)
      setNovoClienteNome('')
      setNovoClienteCnpj('')
    } catch (err) {
      console.error('[NovaObraPage] Falha ao criar contratante:', err)
      alert('Falha ao criar contratante.')
    } finally {
      setCarregando(false)
    }
  }

  if (carregando) {
    return (
      <div style={{ padding: '24px 0', maxWidth: '1280px', margin: '0 auto', minHeight: 'calc(100vh - 200px)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', color: 'var(--text-muted)', fontFamily: FONT }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid rgba(47, 184, 214, 0.2)', borderTopColor: '#2FB8D6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '12px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ fontSize: '14px' }}>Carregando contratantes...</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 0', minHeight: 'calc(100vh - 200px)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: FONT }}>
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

      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '32px', maxWidth: '1200px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 24px' }}>
          Cadastro de Obra
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Contratante *</label>
            <select
              value={clienteId || ''}
              onChange={(e) => setClienteId(e.target.value || null)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '14px', fontFamily: FONT }}
            >
              <option value="">Selecione um contratante</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.legal_name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setNovoCliente(true)}
              style={{
                marginTop: '8px', padding: '6px 12px', borderRadius: '5px', border: '1px solid var(--border)',
                background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer',
              }}
            >
              <Plus size={14} strokeWidth={1.75} /> Criar novo contratante
            </button>
            {novoCliente && (
              <div style={{ marginTop: '8px', background: 'var(--bg-surface-alt)', border: '1px solid var(--border)', borderRadius: '5px', padding: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Nome do Contratante *</label>
                    <input
                      type="text"
                      value={novoClienteNome}
                      onChange={(e) => setNovoClienteNome(e.target.value)}
                      placeholder="Ex: Petrobras S.A."
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '14px', fontFamily: FONT }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>CNPJ</label>
                    <input
                      type="text"
                      value={novoClienteCnpj}
                      onChange={(e) => setNovoClienteCnpj(e.target.value)}
                      placeholder="00.000.000/0001-00"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: '14px', fontFamily: FONT }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button type="button" onClick={handleNovoCliente} disabled={carregando || !novoClienteNome} style={{ padding: '8px 16px', borderRadius: '5px', border: 'none', background: 'var(--card-met-azul, #2FB8D6)', color: '#FFFFFF', fontSize: '13px', fontWeight: 600, cursor: carregando || !novoClienteNome ? 'not-allowed' : 'pointer' }}>Criar Contratante</button>
                    <button type="button" onClick={() => setNovoCliente(false)} style={{ padding: '8px 16px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer' }}>Cancelar</button>
                  </div>
                </div>
              </div>
            )}
          </div>

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

          <div className="campos-2" style={{ gap: '16px' }}>
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
              disabled={carregando || !nome || !clienteId}
              style={{
                padding: '10px 24px', borderRadius: '5px', border: 'none',
                background: carregando ? 'var(--bg-surface-alt)' : 'var(--card-met-azul, #2FB8D6)',
                color: carregando ? 'var(--text-muted)' : '#FFFFFF',
                fontFamily: FONT, fontSize: '14px', fontWeight: 600,
                cursor: carregando || !nome || !clienteId ? 'not-allowed' : 'pointer',
                opacity: carregando || !nome || !clienteId ? 0.7 : 1,
              }}
            >
              {carregando ? 'Criando…' : 'Criar Obra'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
