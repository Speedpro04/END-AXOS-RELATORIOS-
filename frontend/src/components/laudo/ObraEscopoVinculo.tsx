import React, { useEffect, useState } from 'react'
import { Search, RefreshCw } from 'lucide-react'
import type { ObraEscopoLinha, ObraEscopoUnidade } from '../../types/obra'
import { useAuth } from '../../contexts/AuthContext'

interface ObraEscopoVinculoProps {
  linhaId: string | null
  quantidadeInspecionada: number
  quantidadeAprovada: number
  quantidadeReprovada: number
  onChange: (valores: {
    linhaId: string | null
    quantidadeInspecionada: number
    quantidadeAprovada: number
    quantidadeReprovada: number
  }) => void
  siteId?: string | null
  desabilitado?: boolean
}

export const ObraEscopoVinculo: React.FC<ObraEscopoVinculoProps> = ({
  linhaId,
  quantidadeInspecionada,
  quantidadeAprovada,
  quantidadeReprovada,
  onChange,
  siteId,
  desabilitado = false,
}) => {
  const { profile } = useAuth()
  const [linhas, setLinhas] = useState<ObraEscopoLinha[]>([])
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    const carregar = async () => {
      if (!siteId) return
      setCarregando(true)
      try {
        const { db } = await import('../../services/dbDexie')
        const todas = await db.obraEscopoLinhas.toArray()
        setLinhas(todas.filter((l: any) => l.site_id === siteId && l.ativo))
      } catch (err) {
        console.error('[ObraEscopoVinculo] Falha ao carregar linhas:', err)
      } finally {
        setCarregando(false)
      }
    }
    carregar()
  }, [siteId])

  const linhaSelecionada = linhas.find((l) => l.id === linhaId)

  const unidadeLabel = (u: string) => {
    const map: Record<string, string> = {
      junta: 'Junta', ponto_medicao: 'Ponto de medição', peca: 'Peça',
      metro_linear: 'Metro linear', m2: 'm²', filme: 'Filme', equipamento: 'Equipamento',
    }
    return map[u] || u
  }

  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '16px', marginTop: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={14} strokeWidth={1.75} aria-hidden='true' />
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Escopo da obra (vínculo com laudo)
          </span>
        </div>
        {siteId && (
          <button
            type="button"
            onClick={() => setCarregando(true)}
            disabled={carregando}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '6px 10px', borderRadius: '5px', border: '1px solid var(--border)',
              background: 'var(--bg-surface)', color: 'var(--text-primary)',
              fontSize: '12px', cursor: carregando ? 'not-allowed' : 'pointer',
              opacity: carregando ? 0.7 : 1,
            }}
          >
            <RefreshCw size={14} strokeWidth={1.75} style={{ animation: carregando ? 'spin 1s linear infinite' : 'none' }} aria-hidden='true' />
          </button>
        )}
      </div>

      <div className="campos-vinculo">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Linha de escopo</label>
          <select
            value={linhaId || ''}
            onChange={(e) => {
              const id = e.target.value || null
              onChange({ linhaId: id, quantidadeInspecionada, quantidadeAprovada, quantidadeReprovada })
            }}
            disabled={desabilitado || !siteId || carregando}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: '5px', border: '1px solid var(--border)',
              background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px',
            }}
          >
            <option value="">Selecione a linha de escopo</option>
            {linhas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.method} • {l.quantidade_prevista} {unidadeLabel(l.unidade)} {l.referencia_tag ? `(${l.referencia_tag})` : ''}
              </option>
            ))}
          </select>
          {linhaSelecionada && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              Previsto: {linhaSelecionada.quantidade_prevista} {unidadeLabel(linhaSelecionada.unidade)}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Qtde inspecionada</label>
          <input
            type="number"
            step="any"
            min="0"
            value={quantidadeInspecionada}
            onChange={(e) => {
              const v = parseFloat(e.target.value) || 0
              onChange({ linhaId, quantidadeInspecionada: v, quantidadeAprovada, quantidadeReprovada })
            }}
            disabled={desabilitado || !linhaId || carregando}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Qtde aprovada</label>
          <input
            type="number"
            step="any"
            min="0"
            value={quantidadeAprovada}
            onChange={(e) => {
              const v = parseFloat(e.target.value) || 0
              onChange({ linhaId, quantidadeInspecionada, quantidadeAprovada: v, quantidadeReprovada })
            }}
            disabled={desabilitado || !linhaId || carregando}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Qtde reprovada</label>
          <input
            type="number"
            step="any"
            min="0"
            value={quantidadeReprovada}
            onChange={(e) => {
              const v = parseFloat(e.target.value) || 0
              onChange({ linhaId, quantidadeInspecionada, quantidadeAprovada, quantidadeReprovada: v })
            }}
            disabled={desabilitado || !linhaId || carregando}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px' }}
          />
        </div>
      </div>

      {linhaId && quantidadeInspecionada !== (quantidadeAprovada + quantidadeReprovada) && (
        <div style={{ marginTop: '8px', padding: '6px 10px', background: 'rgba(255, 107, 107, 0.1)', border: '1px solid var(--danger, #FF6B6B)', borderRadius: '5px', fontSize: '12px', color: 'var(--danger, #FF6B6B)' }}>
          Quantidade aprovada + reprovada deve ser igual à inspecionada.
        </div>
      )}
    </div>
  )
}
