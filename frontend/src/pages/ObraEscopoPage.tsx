import React, { useEffect, useState } from 'react'
import { ArrowLeft, FileText, Plus, RefreshCw, Save, Trash2 } from 'lucide-react'
import type { ObraEscopoLinha, ObraEscopoRevisao, ObraEscopoUnidade } from '../types/obra'
import { useAuth } from '../contexts/AuthContext'

interface ObraEscopoPageProps {
  onBack: () => void
  siteId: string
  siteName: string
}

export const ObraEscopoPage: React.FC<ObraEscopoPageProps> = ({ onBack, siteId, siteName }) => {
  const { user, profile } = useAuth()
  const [linhas, setLinhas] = useState<ObraEscopoLinha[]>([])
  const [revisoes, setRevisoes] = useState<ObraEscopoRevisao[]>([])
  const [linhaEditando, setLinhaEditando] = useState<ObraEscopoLinha | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const [editMethod, setEditMethod] = useState('')
  const [editUnidade, setEditUnidade] = useState<ObraEscopoUnidade>('junta')
  const [editQtdPrevista, setEditQtdPrevista] = useState('')
  const [editReferencia, setEditReferencia] = useState('')

  const unidades: { valor: ObraEscopoUnidade; label: string }[] = [
    { valor: 'junta', label: 'Junta' },
    { valor: 'ponto_medicao', label: 'Ponto de medição' },
    { valor: 'peca', label: 'Peça' },
    { valor: 'metro_linear', label: 'Metro linear' },
    { valor: 'm2', label: 'm²' },
    { valor: 'filme', label: 'Filme' },
    { valor: 'equipamento', label: 'Equipamento' },
  ]

  const carregar = async () => {
    try {
      const { db } = await import('../services/dbDexie')
      const todas = await db.obraEscopoLinhas.toArray()
      setLinhas(todas.filter((l: any) => l.site_id === siteId && l.ativo))
      const todasRev = await db.obraEscopoRevisoes.toArray()
      setRevisoes(todasRev.filter((r: any) => r.tenant_id === (profile?.tenant_id || '')))
    } catch (err) {
      console.error('[ObraEscopo] Falha ao carregar:', err)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [siteId, profile?.tenant_id])

  const handleSalvarLinha = async () => {
    if (!editMethod || !editQtdPrevista) return
    setSalvando(true)
    try {
      const { db } = await import('../services/dbDexie')
      const tenantId = profile?.tenant_id || ''
      const agora = new Date().toISOString()
      const linha: any = {
        id: linhaEditando?.id || crypto.randomUUID(),
        tenant_id: tenantId,
        site_id: siteId,
        method: editMethod,
        unidade: editUnidade,
        quantidade_prevista: parseFloat(editQtdPrevista),
        referencia_tag: editReferencia || null,
        ativo: true,
        created_by: user?.id || '',
        created_at: linhaEditando?.created_at || agora,
        updated_at: agora,
      }
      await db.obraEscopoLinhas.put(linha)

      if (linhaEditando && Math.abs((linhaEditando.quantidade_prevista || 0) - linha.quantidade_prevista) > 0.0001) {
        await db.obraEscopoRevisoes.put({
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          linha_id: linha.id,
          quantidade_anterior: linhaEditando.quantidade_prevista,
          quantidade_nova: linha.quantidade_prevista,
          motivo: 'Edição de escopo via tela',
          created_by: user?.id || '',
          created_at: agora,
        })
      }

      await carregar()
      setLinhaEditando(null)
      setEditMethod('')
      setEditUnidade('junta')
      setEditQtdPrevista('')
      setEditReferencia('')
    } catch (err) {
      console.error('[ObraEscopo] Falha ao salvar linha:', err)
    } finally {
      setSalvando(false)
    }
  }

  const handleAdicionarRevisao = async (linhaId: string, qtdAnterior?: number, qtdNova?: number, motivo?: string) => {
    if (qtdNova === undefined || qtdNova <= 0 || !motivo) return
    setSalvando(true)
    try {
      const { db } = await import('../services/dbDexie')
      const agora = new Date().toISOString()
      await db.obraEscopoRevisoes.put({
        id: crypto.randomUUID(),
        tenant_id: profile?.tenant_id || '',
        linha_id: linhaId,
        quantidade_anterior: qtdAnterior,
        quantidade_nova: qtdNova,
        motivo,
        created_by: user?.id || '',
        created_at: agora,
      })
      const linha = linhas.find((l) => l.id === linhaId)
      if (linha) {
        await db.obraEscopoLinhas.put({
          ...linha,
          quantidade_prevista: qtdNova,
          updated_at: agora,
        })
      }
      await carregar()
    } catch (err) {
      console.error('[ObraEscopo] Falha ao gravar revisão:', err)
    } finally {
      setSalvando(false)
    }
  }

  const handleExcluirLinha = async (id: string) => {
    if (!confirm('Excluir esta linha de escopo?')) return
    setSalvando(true)
    try {
      const { db } = await import('../services/dbDexie')
      await db.obraEscopoLinhas.delete(id)
      await carregar()
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return (
      <div style={{ padding: '24px 32px', maxWidth: '1280px', margin: '0 auto', minHeight: 'calc(100vh - 200px)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', color: 'var(--text-muted)', fontFamily: 'Arial, sans-serif' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid rgba(47, 184, 214, 0.2)', borderTopColor: '#2FB8D6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '12px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ fontSize: '14px' }}>Carregando escopo da obra...</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 32px', minHeight: 'calc(100vh - 200px)', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'Arial, sans-serif' }}>
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
          <ArrowLeft size={16} strokeWidth={1.75} /> Voltar
        </button>
        <h1 style={{ fontSize: '22px', fontWeight: 600, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          Escopo da Obra: {siteName}
        </h1>
      </div>

      <section style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
            Linhas de Escopo
          </h2>
          <button
            type="button"
            onClick={() => setLinhaEditando(null)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '5px', border: '1px solid var(--border)',
              background: 'var(--bg-surface)', color: 'var(--text-primary)',
              fontSize: '14px', fontWeight: 500, cursor: 'pointer',
            }}
          >
            <Plus size={16} strokeWidth={1.75} /> Nova linha
          </button>
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', overflow: 'hidden' }}>
          {linhas.length === 0 ? (
            <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '14px', fontWeight: 500 }}>Nenhuma linha de escopo cadastrada.</p>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>Clique em "Nova linha" para adicionar.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-alt)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Método</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Unidade</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Qtde Prevista</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Referência / TAG</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ações</th>
                </tr>
              </thead>
              <tbody style={{ borderColor: 'var(--border)' }}>
                {linhas.map((l) => {
                  const editando = linhaEditando?.id === l.id
                  return (
                    <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      {editando ? (
                        <>
                          <td style={{ padding: '10px 16px' }}>
                            <select
                              value={editMethod || l.method}
                              onChange={(e) => setEditMethod(e.target.value)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px' }}
                            >
                              {metodosEnd.map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '10px 16px' }}>
                            <select
                              value={editUnidade || l.unidade}
                              onChange={(e) => setEditUnidade(e.target.value as ObraEscopoUnidade)}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px' }}
                            >
                              {unidades.map((u) => <option key={u.valor} value={u.valor}>{u.label}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '10px 16px' }}>
                            <input
                              type="number"
                              value={editQtdPrevista || l.quantidade_prevista}
                              onChange={(e) => setEditQtdPrevista(e.target.value)}
                              step="any"
                              style={{ width: '100%', padding: '6px 8px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px' }}
                            />
                          </td>
                          <td style={{ padding: '10px 16px' }}>
                            <input
                              type="text"
                              value={editReferencia || l.referencia_tag || ''}
                              onChange={(e) => setEditReferencia(e.target.value)}
                              placeholder="TAG / área"
                              style={{ width: '100%', padding: '6px 8px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px' }}
                            />
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={handleSalvarLinha}
                              disabled={salvando}
                              style={{
                                padding: '6px 12px', borderRadius: '5px', border: '1px solid var(--border)',
                                background: salvando ? 'var(--bg-surface-alt)' : 'var(--card-met-azul, #2FB8D6)',
                                color: salvando ? 'var(--text-muted)' : '#FFFFFF',
                                fontSize: '12px', fontWeight: 600,
                                cursor: salvando ? 'not-allowed' : 'pointer',
                                opacity: salvando ? 0.7 : 1,
                              }}
                            >
                              {salvando ? 'Salvando…' : 'Salvar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setLinhaEditando(null)}
                              style={{
                                marginLeft: '6px', padding: '6px 12px', borderRadius: '5px', border: '1px solid var(--border)',
                                background: 'var(--bg-surface)', color: 'var(--text-muted)',
                                fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                              }}
                            >
                              Cancelar
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-primary)' }}>{l.method}</td>
                          <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-primary)' }}>{unidades.find((u) => u.valor === l.unidade)?.label || l.unidade}</td>
                          <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{l.quantidade_prevista}</td>
                          <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>{l.referencia_tag || '—'}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setLinhaEditando(l)
                                setEditMethod(l.method)
                                setEditUnidade(l.unidade)
                                setEditQtdPrevista(String(l.quantidade_prevista))
                                setEditReferencia(l.referencia_tag || '')
                              }}
                              style={{
                                padding: '6px 12px', borderRadius: '5px', border: '1px solid var(--border)',
                                background: 'var(--bg-surface)', color: 'var(--text-primary)',
                                fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                              }}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleExcluirLinha(l.id)}
                              style={{
                                marginLeft: '6px', padding: '6px 12px', borderRadius: '5px', border: '1px solid var(--border)',
                                background: 'var(--bg-surface)', color: 'var(--danger, #FF6B6B)',
                                fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                              }}
                            >
                              <Trash2 size={14} strokeWidth={1.75} style={{ marginRight: '4px' }} aria-hidden='true' />
                              Excluir
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {!linhaEditando && (
          <div style={{ marginTop: '16px', background: 'var(--bg-surface-alt)', border: '1px solid var(--border)', borderRadius: '5px', padding: '16px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>Nova linha de escopo</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Método</label>
                <select
                  value={editMethod}
                  onChange={(e) => setEditMethod(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px' }}
                >
                  <option value="">Selecione</option>
                  {metodosEnd.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Unidade</label>
                <select
                  value={editUnidade}
                  onChange={(e) => setEditUnidade(e.target.value as ObraEscopoUnidade)}
                  style={{ padding: '8px 10px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px' }}
                >
                  {unidades.map((u) => <option key={u.valor} value={u.valor}>{u.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Qtde Prevista</label>
                <input
                  type="number"
                  step="any"
                  value={editQtdPrevista}
                  onChange={(e) => setEditQtdPrevista(e.target.value)}
                  placeholder="0"
                  style={{ padding: '8px 10px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Referência / TAG</label>
                <input
                  type="text"
                  value={editReferencia}
                  onChange={(e) => setEditReferencia(e.target.value)}
                  placeholder="TAG ou área"
                  style={{ padding: '8px 10px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleSalvarLinha}
                  disabled={salvando || !editMethod || !editUnidade || !editQtdPrevista}
                  style={{
                    padding: '10px 20px', borderRadius: '5px', border: 'none',
                    background: salvando ? 'var(--bg-surface-alt)' : 'var(--card-met-azul, #2FB8D6)',
                    color: salvando ? 'var(--text-muted)' : '#FFFFFF',
                    fontSize: '14px', fontWeight: 600,
                    cursor: salvando || !editMethod || !editUnidade || !editQtdPrevista ? 'not-allowed' : 'pointer',
                  }}
                >
                  {salvando ? 'Salvando…' : 'Adicionar linha'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
            Histórico de Aditivos / Supressões
          </h2>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', overflow: 'hidden' }}>
          {revisoes.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '14px', fontWeight: 500 }}>Nenhum aditivo ou supressão registrado.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-alt)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Data</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Qtde Anterior</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Qtde Nova</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Motivo</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Por</th>
                </tr>
              </thead>
              <tbody>
                {revisoes.map((r) => {
                  const linha = linhas.find((l) => l.id === r.linha_id)
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-primary)' }}>{new Date(r.created_at).toLocaleDateString('pt-BR')}</td>
                      <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{r.quantidade_anterior !== undefined ? r.quantidade_anterior : '—'}</td>
                      <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{r.quantidade_nova}</td>
                      <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{r.motivo}</td>
                      <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>{r.created_by}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}

const metodosEnd: string[] = ['VT', 'PT', 'MT', 'UT', 'RT', 'ET', 'LT', 'LT_VACUO', 'PAUT', 'TOFD', 'CRDR', 'ECA', 'EA', 'IRT', 'ACFM', 'TFM']
