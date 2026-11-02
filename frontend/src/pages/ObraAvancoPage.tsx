import React, { useEffect, useState } from 'react'
import { ArrowLeft, Maximize, Download } from 'lucide-react'
import type { AvançoResumo, AvançoObra as LinhaAvanço, PrevisaoTermino as Previsão } from '../types/obra'
import { useAuth } from '../contexts/AuthContext'

const FONT = 'Arial, Helvetica, sans-serif'

interface ObraAvancoPageProps {
  onBack: () => void
  siteId: string
  siteName: string
}

export const ObraAvancoPage: React.FC<ObraAvancoPageProps> = ({ onBack, siteId, siteName }) => {
  const { profile } = useAuth()
  const [resumo, setResumo] = useState<AvançoResumo | null>(null)
  const [linhas, setLinhas] = useState<LinhaAvanço[]>([])
  const [previsao, setPrevisao] = useState<Previsão | null>(null)
  const [periodo, setPeriodo] = useState<'semana' | 'mes' | 'trimestre'>('mes')
  const [filtroMetodo, setFiltroMetodo] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  const metodos = [
    { codigo: 'VT', label: 'Ensaio Visual' },
    { codigo: 'PT', label: 'Líquidos Penetrantes' },
    { codigo: 'MT', label: 'Partículas Magnéticas' },
    { codigo: 'UT', label: 'Ultrassom Convencional' },
    { codigo: 'RT', label: 'Radiografia Industrial' },
    { codigo: 'ET', label: 'Correntes Parasitas Convencional' },
    { codigo: 'LT', label: 'Estanqueidade' },
    { codigo: 'PAUT', label: 'Ultrassom Phased Array' },
    { codigo: 'TOFD', label: 'ToFD' },
    { codigo: 'CRDR', label: 'Radiografia Digital' },
    { codigo: 'ECA', label: 'Eddy Current Array' },
    { codigo: 'EA', label: 'Emissão Acústica' },
    { codigo: 'IRT', label: 'Termografia Infravermelha' },
    { codigo: 'ACFM', label: 'ACFM' },
    { codigo: 'TFM', label: 'TFM / FMC' },
  ]

  useEffect(() => {
    const carregar = async () => {
      try {
        // Carrega dados do servidor (cálculo de avanço)
        try {
          const url = `http://localhost:8000/api/avanco/${siteId}${
            filtroMetodo ? `?metodo=${filtroMetodo}` : ''
          }`
          const resp = await fetch(url, {
            headers: { Authorization: `Bearer ${(await import('../contexts/AuthContext')).useAuth().user?.id || ''}` },
          })
          if (resp.ok) {
            const data = await resp.json()
            setResumo(data.resumo)
            setLinhas(data.linhas)
            setPrevisao(data.previsao)
          }
        } catch {
          // Fallback silencioso se backend ainda não estiver disponível
        }
      } catch (err) {
        console.error('[ObraAvanco] Falha ao carregar:', err)
      } finally {
        setCarregando(false)
      }
    }
    carregar()
  }, [siteId, filtroMetodo, profile?.tenant_id])

  const formatarPct = (v: number) => v.toFixed(1) + '%'

  return (
    <div
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '24px 32px',
        minHeight: 'calc(100vh - 200px)',
        background: 'var(--bg-base)',
        color: 'var(--text-primary)',
        fontFamily: FONT,
      }}
    >
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
          Avanço da Obra: {siteName}
        </h1>
      </div>

      {/* Filtros fixos no topo */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '16px 20px', display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Período</span>
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as 'semana' | 'mes' | 'trimestre')}
            style={{ padding: '6px 10px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px' }}
          >
            <option value="semana">Semana</option>
            <option value="mes">Mês</option>
            <option value="trimestre">Trimestre</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Método</span>
          <select
            value={filtroMetodo || ''}
            onChange={(e) => setFiltroMetodo(e.target.value || null)}
            style={{ padding: '6px 10px', borderRadius: '5px', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px' }}
          >
            <option value="">Todos</option>
            {metodos.map((m) => <option key={m.codigo} value={m.codigo}>{m.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
          <button
            type="button"
            onClick={() => {
              // Exportar PDF do painel (servidor)
              alert('Exportar PDF do painel – servidor em integração')
            }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '5px', border: '1px solid var(--border)',
              background: 'var(--card-met-azul, #2FB8D6)', color: '#FFFFFF',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Download size={14} strokeWidth={1.75} style={{ marginRight: '4px' }} aria-hidden='true' />
            Exportar PDF
          </button>
        </div>
      </div>

      {carregando ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', color: 'var(--text-muted)', fontFamily: FONT }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid rgba(47, 184, 214, 0.2)', borderTopColor: '#2FB8D6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '12px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ fontSize: '14px' }}>Calculando avanço…</span>
        </div>
      ) : (
        <>
          {/* Linha de resumo: Curva S (larga) + Rosca (estreita) */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
            <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px' }}>
                Curva S — “Estamos no prazo?”
              </h2>
              <div style={{ flex: 1, minHeight: '260px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                Curva S – previsto vs realizado ao longo do tempo
              </div>
            </section>
            <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px' }}>
                Escopo — “Quanto está aprovado, em retrabalho e a executar?”
              </h2>
              <div style={{ flex: 1, minHeight: '260px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                Rosca – composição do escopo (aprovado / reprovado / saldo)
              </div>
            </section>
          </div>

          {/* Barras por método */}
          <section style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px' }}>
              Avanço por método — “Qual método está atrasando?”
            </h2>
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '20px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-alt)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Método</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Unidade</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Previsto</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Insp.</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Aprov.</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Reprov.</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avanço Aprov.</th>
                    <th style={{ textAlign: 'right', padding: '10px 14px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avanço Insp.</th>
                    <th style={{ textAlign: 'center', padding: '10px 14px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Excesso</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Nenhum dado de avanço disponível para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    linhas.map((l) => (
                      <tr key={l.linha_id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-primary)' }}>{l.metodo}</td>
                        <td style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-secondary)' }}>{l.unidade}</td>
                        <td style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{l.quantidade_prevista}</td>
                        <td style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{l.quantidade_inspecionada}</td>
                        <td style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{l.quantidade_aprovada}</td>
                        <td style={{ padding: '10px 14px', fontSize: '13px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{l.quantidade_reprovada}</td>
                        <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{formatarPct(l.avancao_aprovado_pct)}</td>
                        <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{formatarPct(l.avancao_inspecionado_pct)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          {l.excesso_escopo ? (
                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--danger, #FF6B6B)', background: 'rgba(255, 107, 107, 0.1)', padding: '2px 8px', borderRadius: '5px' }}>
                              EXCESSO
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Pendências e previsão */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '20px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px' }}>
                Pendências — “O que está parado esperando avaliação?”
              </h2>
              <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                Nenhuma pendência registrada.
              </div>
            </section>
            <section style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '20px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px' }}>
                Previsão de término — “Quando termina no ritmo atual?”
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {previsao?.dados_insuficientes ? 'Dados insuficientes (menos de 4 semanas)' : `Semanas estimadas: ${previsao?.semanas_estimadas}`}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Ritmo médio semanal: {previsao?.ritmo_medio_semanal ?? '—'}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Saldo restante: {previsao?.saldo_restante ?? 0}
                </div>
                {previsao?.data_estimada && (
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Estimativa: {new Date(previsao.data_estimada).toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>
              {resumo?.excesso_escopo && (
                <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(255, 107, 107, 0.1)', border: '1px solid var(--danger, #FF6B6B)', borderRadius: '5px', fontSize: '12px', color: 'var(--danger, #FF6B6B)' }}>
                  Escopo acima do contratado — avaliar aditivo.
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
