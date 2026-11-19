import React, { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { API_BASE_URL } from '../config'
import { CHAVE_CONVITE, useAuth, VERSAO_DOCUMENTOS_LEGAIS } from '../contexts/AuthContext'
import { CabecalhoLaudo, Campo, Secao, Selecao } from '../components/laudo/CamposLaudo'
import { mensagemErroAuth } from '../utils/errosAuth'

// Planos com pagamento pela Stripe: o servidor cria a página de pagamento de cada pedido
// (30 dias grátis na primeira contratação, cartão obrigatório). Ver routers/contratacao.py.
export const PLANOS: { valor: string; rotulo: string; pagamentoOnline?: boolean }[] = [
  { valor: 'individual', rotulo: 'Individual: 1 inspetor, R$ 147 por mês', pagamentoOnline: true },
  { valor: 'equipe_3', rotulo: 'Equipe 3: até 3 inspetores, R$ 397 por mês', pagamentoOnline: true },
  { valor: 'equipe_5', rotulo: 'Equipe 5: até 5 inspetores, R$ 597 por mês', pagamentoOnline: true },
  { valor: 'equipe_10', rotulo: 'Equipe 10: até 10 inspetores, R$ 997 por mês', pagamentoOnline: true },
  { valor: 'sob_consulta', rotulo: 'Acima de 10 inspetores: sob consulta' },
]

type Pagamento = { pagamento_url: string; teste_gratis: boolean }

export const CHAVE_PLANO_ESCOLHIDO = 'axos_plano_escolhido'

/** Guarda o plano do card da página inicial, inclusive durante o cadastro. */
export function lembrarPlanoDaUrl() {
  const plano = new URLSearchParams(window.location.search).get('plano')
  if (plano && PLANOS.some((p) => p.valor === plano)) localStorage.setItem(CHAVE_PLANO_ESCOLHIDO, plano)
  // O token do convite não fica no endereço nem no histórico do navegador
  const params = new URLSearchParams(window.location.search)
  const convite = params.get('convite')
  if (convite) {
    localStorage.setItem(CHAVE_CONVITE, convite)
    window.history.replaceState(null, '', '/app')
  }
}

export const ContratarPage: React.FC<{ aoVoltar: () => void; aoIrAoSistema: () => void; encerrado: boolean }> = ({ aoVoltar, aoIrAoSistema, encerrado }) => {
  const { user, profile } = useAuth()
  // Decisão do dono do produto (19/11/2026): o formulário começa vazio, sem plano nem dados preenchidos
  const [plano, setPlano] = useState('')
  const [razao, setRazao] = useState('')
  const [documento, setDocumento] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [endereco, setEndereco] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)
  const [aceite, setAceite] = useState(false)
  // Quem já usou os 30 dias grátis: avisa que a cobrança começa hoje e espera a confirmação
  const [semTeste, setSemTeste] = useState<string | null>(null)

  const semConta = !user
  const individual = plano === 'individual'
  const digitos = documento.replace(/\D/g, '')
  const pagamentoOnline = Boolean(PLANOS.find((p) => p.valor === plano)?.pagamentoOnline)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (semTeste) {
      window.location.assign(semTeste)
      return
    }
    setErro(null)
    if (!plano) return setErro('Escolha um plano.')
    if (individual ? ![11, 14].includes(digitos.length) : digitos.length !== 14) {
      return setErro(individual ? 'Informe um CPF com 11 números ou um CNPJ com 14 números.' : 'Informe um CNPJ com 14 números.')
    }
    if (semConta && !aceite) return setErro('Para contratar, aceite os Termos de Uso e a Política de Privacidade.')
    setEnviando(true)
    const pedido = semConta ? await gravarPedidoSemConta() : await gravarPedidoDaConta()
    if ('erro' in pedido) {
      setEnviando(false)
      return setErro(pedido.erro)
    }
    localStorage.removeItem(CHAVE_PLANO_ESCOLHIDO)
    if (!pagamentoOnline) {
      setEnviando(false)
      setEnviado(true)
      return
    }
    // O servidor cria a página da Stripe deste pedido (o número do pedido já vai junto).
    // Sem conta, a página já veio junto com o pedido; com conta, o servidor cria agora.
    const pagamento: Pagamento | { erro: string } = semConta
      ? (pedido as { id: string } & Pagamento)
      : await abrirPagamentoDaConta(pedido.id)
    if ('erro' in pagamento) {
      setEnviando(false)
      return setErro(pagamento.erro)
    }
    if (!pagamento.teste_gratis) {
      setSemTeste(pagamento.pagamento_url)
      setEnviando(false)
      return
    }
    window.location.assign(pagamento.pagamento_url)
  }

  const abrirPagamentoDaConta = async (pedidoId: string): Promise<Pagamento | { erro: string }> => {
    const falha = 'Não foi possível abrir o pagamento. Tente novamente.'
    const { data: sessao } = await supabase.auth.getSession()
    const token = sessao.session?.access_token
    if (!token) return { erro: 'Sua sessão expirou. Entre de novo para contratar.' }
    try {
      const resposta = await fetch(`${API_BASE_URL}/api/contratacao/pagamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pedido_id: pedidoId }),
      })
      const corpo = await resposta.json().catch(() => null)
      if (!resposta.ok) return { erro: typeof corpo?.detail === 'string' ? corpo.detail : falha }
      return corpo as Pagamento
    } catch {
      return { erro: falha }
    }
  }

  const gravarPedidoDaConta = async (): Promise<{ id: string } | { erro: string }> => {
    const { data, error } = await supabase.rpc('solicitar_contratacao', {
      p_plano: plano,
      p_razao_social: razao,
      p_documento: digitos,
      p_responsavel: responsavel,
      p_telefone: telefone,
      p_email: email,
      p_endereco: endereco,
    })
    if (error) return { erro: mensagemErroAuth(error.message, 'Não foi possível enviar o pedido. Tente novamente.') }
    return { id: data as string }
  }

  const gravarPedidoSemConta = async (): Promise<({ id: string } & Pagamento) | { erro: string }> => {
    const falha = 'Não foi possível enviar o pedido. Tente novamente.'
    try {
      const resposta = await fetch(`${API_BASE_URL}/api/contratacao/pedido`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plano,
          razao_social: razao,
          documento: digitos,
          responsavel,
          email,
          aceite_versao: VERSAO_DOCUMENTOS_LEGAIS,
          telefone: telefone || null,
          endereco: endereco || null,
        }),
      })
      const corpo = await resposta.json().catch(() => null)
      if (!resposta.ok) return { erro: typeof corpo?.detail === 'string' ? corpo.detail : falha }
      return { id: corpo.pedido_id, pagamento_url: corpo.pagamento_url, teste_gratis: corpo.teste_gratis }
    } catch {
      return { erro: falha }
    }
  }

  if (!semConta && profile?.role !== 'admin') {
    return (
      <div className="lf-pagina">
        <h1 className="lf-titulo">Contratar plano</h1>
        <p className="lf-descricao">Só o administrador da conta pode contratar um plano. Fale com o responsável pela sua empresa.</p>
        <button type="button" className="lf-botao" onClick={aoVoltar}>Voltar</button>
      </div>
    )
  }

  if (enviado) {
    return (
      <div className="lf-pagina">
        <section className="lf-secao" role="status">
          <h1 className="lf-titulo" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={24} strokeWidth={1.75} /> Pedido recebido
          </h1>
          <p className="lf-descricao">Vamos entrar em contato para combinar o pagamento e liberar o plano. Os dados da sua conta continuam guardados.</p>
          <button type="button" className="lf-botao" onClick={aoIrAoSistema}>Voltar ao sistema</button>
        </section>
      </div>
    )
  }

  return (
    <div className="lf-pagina">
      <CabecalhoLaudo titulo="Contratar plano" aoVoltar={aoVoltar} />
      {encerrado && (
        <p className="lf-alerta" role="alert" style={{ marginBottom: '24px' }}>
          Sua conta está sem plano ativo. Seus dados continuam guardados: escolha um plano para registrar laudos.
        </p>
      )}
      {semConta && (
        <p className="lf-descricao" style={{ marginBottom: '24px' }}>
          Já tem conta? <a href={`/app?entrar=1${plano ? `&plano=${plano}` : ''}`} style={{ color: 'var(--accent-text)' }}>Entre para contratar</a>.
        </p>
      )}
      {/* O aviso de erro some assim que o cliente corrige algo (antes ficava até o próximo clique) */}
      {/* Mudou algo depois do aviso de "sem teste grátis": o próximo clique cria um pedido novo */}
      <form onSubmit={enviar} onChange={() => { setErro(null); setSemTeste(null) }} className="lf-coluna-secoes contratar-form">
        <Secao titulo="Plano">
          <Selecao rotulo="Plano escolhido" valor={plano} vazio="Escolha um plano" opcoes={semConta ? PLANOS.filter((p) => p.pagamentoOnline) : PLANOS} aoMudar={setPlano} />
        </Secao>
        <Secao
          titulo="Dados da empresa"
          descricao={semConta
            ? 'Esses dados vão para o pedido e para a cobrança. Use um e-mail que você acessa: é para ele que mandamos o link de criar a senha.'
            : 'Esses dados vão para o pedido e para a cobrança.'}
        >
          <div className="lf-grade contratar-grade">
            <Campo rotulo={individual ? 'Nome ou razão social' : 'Razão social'} obrigatorio valor={razao} aoMudar={setRazao} />
            <Campo rotulo={individual ? 'CPF ou CNPJ' : 'CNPJ'} obrigatorio numerico valor={documento} aoMudar={setDocumento} />
            <Campo rotulo="Responsável" obrigatorio valor={responsavel} aoMudar={setResponsavel} />
            <Campo rotulo="Telefone" valor={telefone} aoMudar={setTelefone} />
            <Campo rotulo={semConta ? 'E-mail' : 'E-mail de cobrança'} obrigatorio={semConta} tipo={semConta ? 'email' : 'text'} valor={email} aoMudar={setEmail} />
            <Campo rotulo="Endereço" valor={endereco} aoMudar={setEndereco} />
          </div>
        </Secao>
        <Secao
          titulo="Pagamento"
          descricao={plano === 'sob_consulta'
            ? 'Depois do pedido, entramos em contato para combinar o pagamento e liberar o plano.'
            : `No próximo passo, você informa o cartão na página segura da Stripe. Na primeira contratação, são 30 dias grátis e a primeira cobrança vem só no 31º dia. ${semConta ? 'Em seguida, enviamos para o e-mail acima o link para criar sua senha.' : 'Liberamos o plano assim que a Stripe confirmar.'}`}
        >
          {semConta && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', lineHeight: 1.4, marginBottom: '16px' }}>
              <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} style={{ width: '20px', height: '20px', flexShrink: 0 }} />
              <span>
                Li e aceito os <a href="/termos-de-uso.html" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-text)' }}>Termos de Uso</a> e a{' '}
                <a href="/politica-de-privacidade.html" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-text)' }}>Política de Privacidade</a>.
              </span>
            </label>
          )}
          {erro && <p className="lf-alerta" role="alert">{erro}</p>}
          {semTeste && (
            <p className="lf-alerta" role="alert">
              Este CPF ou CNPJ, este e-mail ou esta empresa já usou os 30 dias grátis. Se continuar, a primeira cobrança é feita hoje.
            </p>
          )}
          <div className="lf-acoes">
            <button type="button" className="lf-botao" onClick={aoVoltar}>Cancelar</button>
            <button type="submit" className="lf-botao lf-botao-primario" disabled={enviando}>
              {enviando ? 'Enviando...' : semTeste ? 'Continuar, com cobrança hoje' : plano === 'sob_consulta' ? 'Enviar pedido' : 'Continuar para o pagamento'}
            </button>
          </div>
        </Secao>
      </form>
    </div>
  )
}

/** Dias restantes do teste, ou null quando a empresa já tem plano contratado. */
export function diasDeTeste(plan: string | undefined, fim: string | null | undefined): number | null {
  if (plan !== 'trial' || !fim) return null
  return Math.ceil((new Date(fim).getTime() - Date.now()) / 86_400_000)
}
