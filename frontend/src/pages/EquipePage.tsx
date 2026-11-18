import React, { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, Check, Copy, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Campo, Secao, Selecao } from '../components/laudo/CamposLaudo'
import { mensagemErroAuth } from '../utils/errosAuth'
import { METHOD_LABELS, type ENDMethod } from '../types/inspection'
import { cadastrarQualificacao, descreverQualificacao, qualificacaoValida, qualificacoesDaEquipe, removerQualificacao, type Qualificacao } from '../services/qualificacoes'

interface Membro {
  id: string
  full_name: string
  role: 'admin' | 'supervisor' | 'inspector'
  active: boolean
}

interface Convite {
  id: string
  email: string
  papel: 'inspector' | 'supervisor'
  expira_em: string
}

const NOME_FUNCAO: Record<Membro['role'], string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  inspector: 'Inspetor',
}

const dataCurta = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')
const dataDoDia = (aaaammdd: string) => aaaammdd.split('-').reverse().join('/')
const diasAte = (aaaammdd: string) => Math.ceil((new Date(`${aaaammdd}T23:59:59`).getTime() - Date.now()) / 86_400_000)
const METODOS = Object.entries(METHOD_LABELS).map(([valor, m]) => ({ valor, rotulo: `${m.label}, ${m.full}` }))
const QUALIFICACAO_VAZIA = { userId: '', method: '', level: '2', certNumber: '', issuer: '', validUntil: '' }

export const EquipePage: React.FC = () => {
  const { user, profile } = useAuth()
  const [membros, setMembros] = useState<Membro[]>([])
  const [convites, setConvites] = useState<Convite[]>([])
  const [carregando, setCarregando] = useState(true)
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState<Convite['papel']>('inspector')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [link, setLink] = useState<{ endereco: string; email: string } | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [qualificacoes, setQualificacoes] = useState<Qualificacao[]>([])
  const [novaQualif, setNovaQualif] = useState(QUALIFICACAO_VAZIA)
  const [salvandoQualif, setSalvandoQualif] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    const [m, c] = await Promise.all([
      supabase.from('profiles').select('id, full_name, role, active').order('full_name'),
      supabase.from('convites')
        .select('id, email, papel, expira_em')
        .is('aceito_em', null)
        .is('cancelado_em', null)
        .gt('expira_em', new Date().toISOString())
        .order('criado_em', { ascending: false }),
    ])
    if (m.error || c.error) {
      setErro('Não foi possível carregar a equipe. Confira a conexão e tente novamente.')
    } else {
      setMembros((m.data ?? []) as Membro[])
      setConvites((c.data ?? []) as Convite[])
    }
    try {
      setQualificacoes(await qualificacoesDaEquipe())
    } catch {
      setErro('Não foi possível carregar as qualificações. Confira a conexão e tente novamente.')
    }
    setCarregando(false)
  }, [])

  useEffect(() => {
    if (profile?.role === 'admin') void carregar()
  }, [carregar, profile?.role])

  const convidar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)
    setLink(null)
    setCopiado(false)
    setEnviando(true)
    const { data, error } = await supabase.rpc('criar_convite', { p_email: email, p_papel: papel })
    setEnviando(false)
    if (error) return setErro(mensagemErroAuth(error.message, 'Não foi possível criar o convite. Tente novamente.'))
    setLink({ endereco: `${window.location.origin}/app?convite=${data as string}`, email: email.trim().toLowerCase() })
    setEmail('')
    void carregar()
  }

  const copiar = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link.endereco)
      setCopiado(true)
    } catch {
      setErro('Não foi possível copiar. Selecione o link e copie manualmente.')
    }
  }

  const cancelar = async (id: string) => {
    setErro(null)
    const { error } = await supabase.from('convites').update({ cancelado_em: new Date().toISOString() }).eq('id', id)
    if (error) return setErro('Não foi possível cancelar o convite. Tente novamente.')
    setLink(null)
    void carregar()
  }

  const alterarAcesso = async (membro: Membro) => {
    setErro(null)
    const { error } = await supabase.from('profiles').update({ active: !membro.active }).eq('id', membro.id)
    if (error) return setErro(mensagemErroAuth(error.message, 'Não foi possível alterar o acesso. Tente novamente.'))
    void carregar()
  }

  const salvarQualificacao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.tenant_id) return
    setErro(null)
    setSalvandoQualif(true)
    try {
      await cadastrarQualificacao({
        tenant_id: profile.tenant_id,
        user_id: novaQualif.userId,
        method: novaQualif.method as ENDMethod,
        level: Number(novaQualif.level),
        cert_number: novaQualif.certNumber.trim(),
        issuer: novaQualif.issuer.trim(),
        valid_until: novaQualif.validUntil,
      })
      setNovaQualif(QUALIFICACAO_VAZIA)
      setQualificacoes(await qualificacoesDaEquipe())
    } catch (err) {
      setErro(mensagemErroAuth((err as { message?: string })?.message, 'Não foi possível cadastrar a qualificação. Confira os dados e tente novamente.'))
    } finally {
      setSalvandoQualif(false)
    }
  }

  const apagarQualificacao = async (q: Qualificacao) => {
    setErro(null)
    try {
      await removerQualificacao(q.id)
      setQualificacoes(await qualificacoesDaEquipe())
    } catch (err) {
      const usada = (err as { code?: string })?.code === '23503'
      setErro(usada
        ? 'Esta qualificação já foi usada em laudo e fica guardada no histórico. Ela não pode ser removida.'
        : 'Não foi possível remover a qualificação. Tente novamente.')
    }
  }

  const nomeDe = (id: string) => membros.find((m) => m.id === id)?.full_name ?? 'Pessoa removida'

  if (profile?.role !== 'admin') {
    return (
      <div className="lf-pagina">
        <h1 className="lf-titulo">Equipe</h1>
        <p className="lf-descricao">Só o administrador da conta gerencia a equipe.</p>
      </div>
    )
  }

  return (
    <div className="lf-pagina">
      <h1 className="lf-titulo">Equipe</h1>
      <div className="lf-coluna-secoes" style={{ maxWidth: '760px' }}>
        {erro && <p className="lf-alerta" role="alert">{erro}</p>}

        <Secao titulo="Convidar pessoa" descricao="A pessoa entra na sua empresa, sem preencher dados da empresa nem pagamento.">
          <form onSubmit={convidar} className="lf-coluna">
            <div className="lf-grade">
              <Campo rotulo="E-mail da pessoa" tipo="email" obrigatorio valor={email} aoMudar={setEmail} />
              <Selecao
                rotulo="Função"
                valor={papel}
                aoMudar={(v) => setPapel(v as Convite['papel'])}
                opcoes={[
                  { valor: 'inspector', rotulo: 'Inspetor' },
                  { valor: 'supervisor', rotulo: 'Supervisor' },
                ]}
              />
            </div>
            <button type="submit" className="lf-botao lf-botao-primario" disabled={enviando}>
              <UserPlus size={16} strokeWidth={1.75} /> {enviando ? 'Criando...' : 'Criar convite'}
            </button>
          </form>
          {link && (
            <div className="lf-linha" role="status">
              <strong>Convite criado para {link.email}</strong>
              <p className="lf-descricao">Envie este link por e-mail ou mensagem. Ele vale por 7 dias, serve só para esse e-mail e não aparece de novo depois que você sair desta tela.</p>
              <Campo rotulo="Link do convite" valor={link.endereco} aoMudar={() => undefined} />
              <button type="button" className="lf-botao" onClick={copiar}>
                {copiado ? <Check size={16} strokeWidth={1.75} /> : <Copy size={16} strokeWidth={1.75} />} {copiado ? 'Link copiado' : 'Copiar link'}
              </button>
            </div>
          )}
        </Secao>

        <Secao titulo="Convites abertos">
          {carregando ? <p className="lf-descricao">Carregando...</p> : convites.length === 0 ? (
            <p className="lf-descricao">Nenhum convite aberto.</p>
          ) : (
            <ul className="lf-lista">
              {convites.map((c) => (
                <li key={c.id}>
                  <div>
                    <strong>{c.email}</strong>
                    <span className="lf-descricao">{NOME_FUNCAO[c.papel]}, vale até {dataCurta(c.expira_em)}</span>
                  </div>
                  <button type="button" className="lf-botao" onClick={() => void cancelar(c.id)} aria-label={`Cancelar convite de ${c.email}`}>Cancelar convite</button>
                </li>
              ))}
            </ul>
          )}
        </Secao>

        <Secao titulo="Qualificações (SNQC)" descricao="Certificado de cada pessoa por método. O laudo só pode ser enviado para revisão com a qualificação do próprio inspetor, do mesmo método e válida na data do ensaio.">
          <form onSubmit={salvarQualificacao} className="lf-coluna">
            <div className="lf-grade">
              <Selecao rotulo="Pessoa" valor={novaQualif.userId} vazio="Escolha a pessoa" aoMudar={(v) => setNovaQualif((q) => ({ ...q, userId: v }))}
                opcoes={membros.filter((m) => m.active).map((m) => ({ valor: m.id, rotulo: m.full_name }))} />
              <Selecao rotulo="Método" valor={novaQualif.method} vazio="Escolha o método" aoMudar={(v) => setNovaQualif((q) => ({ ...q, method: v }))} opcoes={METODOS} />
              <Selecao rotulo="Nível" valor={novaQualif.level} aoMudar={(v) => setNovaQualif((q) => ({ ...q, level: v }))}
                opcoes={[{ valor: '1', rotulo: 'Nível 1' }, { valor: '2', rotulo: 'Nível 2' }, { valor: '3', rotulo: 'Nível 3' }]} />
              <Campo rotulo="Número do certificado" obrigatorio valor={novaQualif.certNumber} aoMudar={(v) => setNovaQualif((q) => ({ ...q, certNumber: v }))} />
              <Campo rotulo="Órgão certificador" obrigatorio placeholder="Ex: SNQC" valor={novaQualif.issuer} aoMudar={(v) => setNovaQualif((q) => ({ ...q, issuer: v }))} />
              <Campo rotulo="Válido até" tipo="date" obrigatorio valor={novaQualif.validUntil} aoMudar={(v) => setNovaQualif((q) => ({ ...q, validUntil: v }))} />
            </div>
            <button type="submit" className="lf-botao lf-botao-primario" disabled={salvandoQualif || !novaQualif.userId || !novaQualif.method}>
              <BadgeCheck size={16} strokeWidth={1.75} /> {salvandoQualif ? 'Salvando...' : 'Cadastrar qualificação'}
            </button>
          </form>
          {carregando ? <p className="lf-descricao">Carregando...</p> : qualificacoes.length === 0 ? (
            <p className="lf-descricao">Nenhuma qualificação cadastrada.</p>
          ) : (
            <ul className="lf-lista">
              {qualificacoes.map((q) => {
                const dias = diasAte(q.valid_until)
                return (
                  <li key={q.id}>
                    <div>
                      <strong>{nomeDe(q.user_id)}: {METHOD_LABELS[q.method]?.label ?? q.method}</strong>
                      <span className="lf-descricao">{descreverQualificacao(q)}, {q.issuer}, válida até {dataDoDia(q.valid_until)}</span>
                      {!qualificacaoValida(q) && <span className="lf-alerta" role="status">Vencida</span>}
                      {qualificacaoValida(q) && dias <= 30 && <span className="lf-descricao"><strong>Vence em {dias} {dias === 1 ? 'dia' : 'dias'}</strong></span>}
                    </div>
                    <button type="button" className="lf-botao" onClick={() => void apagarQualificacao(q)} aria-label={`Remover qualificação ${q.cert_number} de ${nomeDe(q.user_id)}`}>Remover</button>
                  </li>
                )
              })}
            </ul>
          )}
        </Secao>

        <Secao titulo="Pessoas da equipe">
          {carregando ? <p className="lf-descricao">Carregando...</p> : (
            <ul className="lf-lista">
              {membros.map((m) => (
                <li key={m.id}>
                  <div>
                    <strong>{m.full_name}</strong>
                    <span className="lf-descricao">{NOME_FUNCAO[m.role]}, {m.active ? 'ativo' : 'desativado'}</span>
                  </div>
                  {m.id !== user?.id && (
                    <button type="button" className="lf-botao" onClick={() => void alterarAcesso(m)} aria-label={`${m.active ? 'Desativar' : 'Reativar'} ${m.full_name}`}>
                      {m.active ? 'Desativar' : 'Reativar'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Secao>
      </div>
    </div>
  )
}
