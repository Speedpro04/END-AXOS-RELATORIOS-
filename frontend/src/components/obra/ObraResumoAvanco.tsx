import React, { useEffect, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type {
  RespostaAvancoObra,
  AvançoObra,
  RetrabalhoMetodo,
  ProducaoInspetor,
  PendenciaLaudo,
} from '../../types/obra'
import { METHOD_LABELS, type ENDMethod } from '../../types/inspection'
import { supabase } from '../../lib/supabase'

const FONT = 'Arial, Helvetica, sans-serif'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const AZUL = '#2FB8D6'
const CINZA = '#94A3B8'
const ESCURO = '#0B0F17'
const CORES_ROSCA = ['#2FB8D6', '#0B0F17', '#64748B', '#CBD5E1', '#34D399', '#7CB7FF', '#94A3B8']

const nomeMetodo = (m: string): string => METHOD_LABELS[m as ENDMethod]?.label || m

const fmt = (v: number): string =>
  Number.isInteger(v) ? String(v) : v.toFixed(1)

const pct = (v: number): string => v.toFixed(1) + '%'

interface ObraResumoAvancoProps {
  siteId: string
}

export const ObraResumoAvanco: React.FC<ObraResumoAvancoProps> = ({ siteId }) => {
  const [dados, setDados] = useState<RespostaAvancoObra | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [periodo, setPeriodo] = useState<'4' | '12' | 'todo'>('12')
  const [metodoExpandido, setMetodoExpandido] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    const carregar = async () => {
      setCarregando(true)
      setErro(null)
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token || ''
        const resp = await fetch(`${API_BASE_URL}/api/avanco/${siteId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const json = (await resp.json()) as RespostaAvancoObra
        if (ativo) setDados(json)
      } catch (err) {
        if (ativo) {
          setDados(null)
          setErro(err instanceof Error ? err.message : 'Falha ao carregar')
        }
      } finally {
        if (ativo) setCarregando(false)
      }
    }
    carregar()
    return () => {
      ativo = false
    }
  }, [siteId])

  const pontos = useMemo(() => {
    const p = dados?.curva_s.pontos || []
    if (periodo === 'todo') return p
    const n = periodo === '4' ? 4 : 12
    return p.slice(-n)
  }, [dados, periodo])

  const producaoOrdenada = useMemo(() => {
    const lista = dados?.producao_por_inspetor || []
    return [...lista].sort((a, b) =>
      a.inspetor_nome.localeCompare(b.inspetor_nome, 'pt-BR')
    )
  }, [dados])

  if (carregando) {
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', fontFamily: FONT }}>
        Carregando avanço da obra...
      </div>
    )
  }

  if (erro || !dados) {
    return (
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '32px', textAlign: 'center', fontFamily: FONT }}>
        <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, margin: '0 0 6px' }}>
          Sem dados de avanço disponíveis
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
          {erro
            ? `Não foi possível carregar (${erro}). Verifique se o backend está em execução.`
            : 'Cadastre o escopo da obra e emita laudos vinculados para ver o avanço.'}
        </p>
      </div>
    )
  }

  const { resumo, rosca, retrabalho_por_metodo, pendencias, previsao } = dados
  const linhas = dados.linhas

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: FONT }}>
      {/* Filtro de período único */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <label htmlFor="filtro-periodo" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Período
        </label>
        <select
          id="filtro-periodo"
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value as '4' | '12' | 'todo')}
          style={{
            padding: '7px 10px', borderRadius: '5px', border: '1px solid var(--border)',
            background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '13px',
            fontFamily: FONT, cursor: 'pointer',
          }}
        >
          <option value="4">Últimas 4 semanas</option>
          <option value="12">Últimas 12 semanas</option>
          <option value="todo">Tudo</option>
        </select>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Atualizado em {new Date(resumo.data_atualizacao).toLocaleDateString('pt-BR')}
        </span>
      </div>

      {/* Indicadores gerais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        {[
          { rotulo: 'Avanço aprovado', valor: pct(resumo.avancao_aprovado_pct) },
          { rotulo: 'Avanço inspecionado', valor: pct(resumo.avancao_inspecionado_pct) },
          { rotulo: 'Total previsto', valor: fmt(resumo.total_previsto) },
          { rotulo: 'Total aprovado', valor: fmt(resumo.total_aprovado) },
        ].map((c) => (
          <div key={c.rotulo} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '14px 16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '6px' }}>
              {c.rotulo}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>{c.valor}</div>
          </div>
        ))}
      </div>

      {resumo.excesso_escopo && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid #F59E0B', borderRadius: '5px', padding: '10px 14px', fontSize: '13px', color: 'var(--text-primary)' }}>
          Atenção: o inspecionado ultrapassou 100% do previsto (excesso de escopo).
        </div>
      )}

      {/* Curva S + Rosca lado a lado */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '16px 18px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>
            Estamos no prazo?
          </h4>
          {pontos.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Sem histórico de semanas para exibir.</p>
          ) : (
            <svg viewBox="0 0 560 210" width="100%" height="210" role="img" aria-label="Curva S: previsto versus realizado">
              {(() => {
                const W = 560
                const H = 210
                const pl = 46
                const pr = 12
                const pt = 12
                const pb = 30
                const max = Math.max(
                  1,
                  ...pontos.map((p) => Math.max(p.previsto, p.realizado))
                )
                const x = (i: number) =>
                  pl + (i * (W - pl - pr)) / Math.max(1, pontos.length - 1)
                const y = (v: number) =>
                  H - pb - (v / max) * (H - pt - pb)
                const linha = (campo: 'previsto' | 'realizado') =>
                  pontos.map((p, i) => `${x(i)},${y(p[campo])}`).join(' ')
                const rotuloPasso = Math.max(1, Math.ceil(pontos.length / 6))
                return (
                  <>
                    <line x1={pl} y1={H - pb} x2={W - pr} y2={H - pb} stroke="var(--border)" strokeWidth="1" />
                    <line x1={pl} y1={pt} x2={pl} y2={H - pb} stroke="var(--border)" strokeWidth="1" />
                    <text x={pl - 6} y={pt + 8} textAnchor="end" fontSize="10" fill="var(--text-muted)" fontFamily={FONT}>{fmt(max)}</text>
                    <text x={pl - 6} y={H - pb} textAnchor="end" fontSize="10" fill="var(--text-muted)" fontFamily={FONT}>0</text>
                    <polyline points={linha('previsto')} fill="none" stroke={CINZA} strokeWidth="1.75" strokeDasharray="5 4" />
                    <polyline points={linha('realizado')} fill="none" stroke={AZUL} strokeWidth="2.5" />
                    {pontos.map((p, i) => (
                      <circle key={i} cx={x(i)} cy={y(p.realizado)} r="3" fill={AZUL} />
                    ))}
                    {pontos.map((p, i) =>
                      i % rotuloPasso === 0 ? (
                        <text key={`r${i}`} x={x(i)} y={H - pb + 16} textAnchor="middle" fontSize="9" fill="var(--text-muted)" fontFamily={FONT}>
                          {p.semana}
                        </text>
                      ) : null
                    )}
                  </>
                )
              })()}
            </svg>
          )}
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '16px', height: '2px', background: CINZA, display: 'inline-block' }} /> Previsto
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '16px', height: '2px', background: AZUL, display: 'inline-block' }} /> Realizado
            </span>
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '16px 18px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>
            Como está a qualidade?
          </h4>
          {rosca.fatias.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Sem laudos emitidos ainda.</p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
              <svg viewBox="0 0 140 140" width="140" height="140" role="img" aria-label="Distribuição de laudos">
                {(() => {
                  const r = 54
                  const circ = 2 * Math.PI * r
                  let acumulado = 0
                  return rosca.fatias.map((f, i) => {
                    const frac = rosca.total > 0 ? f.valor / rosca.total : 0
                    const len = frac * circ
                    const el = (
                      <circle
                        key={i}
                        cx="70"
                        cy="70"
                        r={r}
                        fill="none"
                        stroke={CORES_ROSCA[i % CORES_ROSCA.length]}
                        strokeWidth="22"
                        strokeDasharray={`${len} ${circ - len}`}
                        strokeDashoffset={-acumulado}
                        transform="rotate(-90 70 70)"
                      />
                    )
                    acumulado += len
                    return el
                  })
                })()}
                <text x="70" y="66" textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--text-primary)" fontFamily={FONT}>
                  {fmt(rosca.total)}
                </text>
                <text x="70" y="84" textAnchor="middle" fontSize="10" fill="var(--text-muted)" fontFamily={FONT}>
                  laudos
                </text>
              </svg>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                {rosca.fatias.map((f, i) => (
                  <li key={f.categoria} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: CORES_ROSCA[i % CORES_ROSCA.length], flexShrink: 0 }} />
                    <span>{f.categoria}</span>
                    <span style={{ color: 'var(--text-muted)' }}>({pct(f.percentual)})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Avanço por método — tabela expansível */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '16px 18px' }}>
        <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>
          Como avança cada método?
        </h4>
        {linhas.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Nenhuma linha de escopo cadastrada.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Método', 'Previsto', 'Inspecionado', 'Aprovado', 'Reprovado', 'Avanço'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l: AvançoObra) => {
                  const aberto = metodoExpandido === l.linha_id
                  return (
                    <React.Fragment key={l.linha_id}>
                      <tr
                        onClick={() => setMetodoExpandido(aberto ? null : l.linha_id)}
                        style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                      >
                        <td style={{ padding: '9px 10px', color: 'var(--text-primary)', fontWeight: 600 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <ChevronRight
                              size={14}
                              strokeWidth={1.75}
                              style={{ transform: aberto ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', color: 'var(--text-muted)' }}
                            />
                            {nomeMetodo(l.metodo)}
                          </span>
                        </td>
                        <td style={{ padding: '9px 10px', color: 'var(--text-secondary)' }}>{fmt(l.quantidade_prevista)}</td>
                        <td style={{ padding: '9px 10px', color: 'var(--text-secondary)' }}>{fmt(l.quantidade_inspecionada)}</td>
                        <td style={{ padding: '9px 10px', color: 'var(--text-secondary)' }}>{fmt(l.quantidade_aprovada)}</td>
                        <td style={{ padding: '9px 10px', color: 'var(--text-secondary)' }}>{fmt(l.quantidade_reprovada)}</td>
                        <td style={{ padding: '9px 10px', color: 'var(--text-primary)', fontWeight: 600 }}>{pct(l.avancao_aprovado_pct)}</td>
                      </tr>
                      {aberto && (
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <td colSpan={6} style={{ padding: '14px 10px 18px', background: 'var(--bg-base)' }}>
                            <BarrasLinha linha={l} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Retrabalho */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '16px 18px' }}>
        <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>
          Onde estamos retrabalhando?
        </h4>
        {retrabalho_por_metodo.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Sem registro de retrabalho no período.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Método', 'Laudos', 'Devolvidos', 'Retrabalho', 'Prazo médio'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {retrabalho_por_metodo.map((r: RetrabalhoMetodo) => (
                  <tr key={r.metodo} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '9px 10px', color: 'var(--text-primary)', fontWeight: 600 }}>{nomeMetodo(r.metodo)}</td>
                    <td style={{ padding: '9px 10px', color: 'var(--text-secondary)' }}>{r.total_laudos}</td>
                    <td style={{ padding: '9px 10px', color: 'var(--text-secondary)' }}>{r.devolvidos}</td>
                    <td style={{ padding: '9px 10px', color: r.percentual_retrabalho > 20 ? '#F59E0B' : 'var(--text-secondary)', fontWeight: 600 }}>
                      {pct(r.percentual_retrabalho)}
                    </td>
                    <td style={{ padding: '9px 10px', color: 'var(--text-secondary)' }}>
                      {r.prazo_medio_dias != null ? `${fmt(r.prazo_medio_dias)} dia(s)` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Produção por inspetor — ordem alfabética, sem ranking */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '16px 18px' }}>
        <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
          Quem está produzindo?
        </h4>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 12px' }}>
          Relação em ordem alfabética, sem classificação de desempenho.
        </p>
        {producaoOrdenada.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Sem produção registrada no período.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Inspetor', 'Aprovado', 'Reprovado', 'Unidade'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {producaoOrdenada.map((p: ProducaoInspetor) => (
                  <tr key={p.inspetor_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '9px 10px', color: 'var(--text-primary)', fontWeight: 600 }}>{p.inspetor_nome}</td>
                    <td style={{ padding: '9px 10px', color: 'var(--text-secondary)' }}>{fmt(p.quantidade_aprovada)}</td>
                    <td style={{ padding: '9px 10px', color: 'var(--text-secondary)' }}>{fmt(p.quantidade_reprovada)}</td>
                    <td style={{ padding: '9px 10px', color: 'var(--text-secondary)' }}>{p.unidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pendências + Previsão */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '16px 18px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>
            O que está parado?
          </h4>
          {pendencias.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Nenhum laudo pendente há mais de 7 dias.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pendencias.map((p: PendenciaLaudo) => (
                <li key={p.laudo_id} style={{ border: '1px solid var(--border)', borderRadius: '5px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{p.laudo_codigo}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {nomeMetodo(p.metodo)} · {p.inspetor_nome}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#F59E0B' }}>{p.dias_parado} dia(s)</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{p.status}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '5px', padding: '16px 18px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>
            Quando terminamos?
          </h4>
          {previsao.dados_insuficientes ? (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              Dados insuficientes para estimar o término. Emita mais laudos para ativar a previsão.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                  Data estimada de conclusão
                </div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {previsao.data_estimada
                    ? new Date(previsao.data_estimada).toLocaleDateString('pt-BR')
                    : '—'}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                <div style={{ color: 'var(--text-secondary)' }}>
                  Saldo restante
                  <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '16px' }}>
                    {fmt(previsao.saldo_restante)}
                  </strong>
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  Ritmo médio semanal
                  <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '16px' }}>
                    {previsao.ritmo_medio_semanal != null ? fmt(previsao.ritmo_medio_semanal) : '—'}
                  </strong>
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  Semanas estimadas
                  <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '16px' }}>
                    {previsao.semanas_estimadas != null ? fmt(previsao.semanas_estimadas) : '—'}
                  </strong>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* Gráfico de barras horizontal detalhando uma linha de escopo */
const BarrasLinha: React.FC<{ linha: AvançoObra }> = ({ linha }) => {
  const base = Math.max(1, linha.quantidade_prevista)
  const barras = [
    { rotulo: 'Previsto', valor: linha.quantidade_prevista, cor: CINZA },
    { rotulo: 'Inspecionado', valor: linha.quantidade_inspecionada, cor: ESCURO },
    { rotulo: 'Aprovado', valor: linha.quantidade_aprovada, cor: AZUL },
    { rotulo: 'Reprovado', valor: linha.quantidade_reprovada, cor: '#F59E0B' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: FONT }}>
      {barras.map((b) => {
        const largura = Math.min(100, (b.valor / base) * 100)
        return (
          <div key={b.rotulo} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 70px', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{b.rotulo}</span>
            <span style={{ background: 'var(--border)', borderRadius: '5px', height: '14px', position: 'relative', display: 'block' }}>
              <span style={{ position: 'absolute', inset: 0, width: `${largura}%`, background: b.cor, borderRadius: '5px' }} />
            </span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right' }}>{fmt(b.valor)}</span>
          </div>
        )
      })}
      {linha.excesso_escopo && (
        <span style={{ fontSize: '12px', color: '#F59E0B' }}>Excesso de escopo: inspecionado acima do previsto.</span>
      )}
    </div>
  )
}
