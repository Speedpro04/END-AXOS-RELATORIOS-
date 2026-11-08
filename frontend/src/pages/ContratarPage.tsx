import React, { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { CHAVE_CONVITE, useAuth } from '../contexts/AuthContext'
import { CabecalhoLaudo, Campo, Secao, Selecao } from '../components/laudo/CamposLaudo'
import { mensagemErroAuth } from '../utils/errosAuth'

export const PLANOS = [
  { valor: 'individual', rotulo: 'Individual: 1 inspetor, R$ 147 por mês' },
  { valor: 'equipe_3', rotulo: 'Equipe 3: até 3 inspetores, R$ 397 por mês' },
  { valor: 'equipe_5', rotulo: 'Equipe 5: até 5 inspetores, R$ 597 por mês' },
  { valor: 'equipe_10', rotulo: 'Equipe 10: até 10 inspetores, R$ 997 por mês' },
  { valor: 'sob_consulta', rotulo: 'Acima de 10 inspetores: sob consulta' },
]

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

export const ContratarPage: React.FC<{ aoVoltar: () => void; encerrado: boolean }> = ({ aoVoltar, encerrado }) => {
  const { user, profile, tenant } = useAuth()
  const [plano, setPlano] = useState(() => localStorage.getItem(CHAVE_PLANO_ESCOLHIDO) ?? '')
  const [razao, setRazao] = useState(tenant?.legal_name && tenant.legal_name !== profile?.full_name ? tenant.legal_name : '')
  const [documento, setDocumento] = useState(tenant?.cnpj ?? '')
  const [responsavel, setResponsavel] = useState(profile?.full_name ?? '')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState(user?.email ?? '')
  const [endereco, setEndereco] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)

  const individual = plano === 'individual'
  const digitos = documento.replace(/\D/g, '')

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)
    if (!plano) return setErro('Escolha um plano.')
    if (individual ? ![11, 14].includes(digitos.length) : digitos.length !== 14) {
      return setErro(individual ? 'Informe um CPF com 11 números ou um CNPJ com 14 números.' : 'Informe um CNPJ com 14 números.')
    }
    setEnviando(true)
    const { error } = await supabase.rpc('solicitar_contratacao', {
      p_plano: plano,
      p_razao_social: razao,
      p_documento: digitos,
      p_responsavel: responsavel,
      p_telefone: telefone,
      p_email: email,
      p_endereco: endereco,
    })
    setEnviando(false)
    if (error) return setErro(mensagemErroAuth(error.message, 'Não foi possível enviar o pedido. Tente novamente.'))
    localStorage.removeItem(CHAVE_PLANO_ESCOLHIDO)
    setEnviado(true)
  }

  if (profile?.role !== 'admin') {
    return (
      <div className="lf-pagina">
        <h1 className="lf-titulo">Contratar plano</h1>
        <p className="lf-descricao">Só o administrador da conta pode contratar um plano. Fale com o responsável pela sua empresa.</p>
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
          <button type="button" className="lf-botao" onClick={aoVoltar}>Voltar ao sistema</button>
        </section>
      </div>
    )
  }

  return (
    <div className="lf-pagina">
      <CabecalhoLaudo titulo="Contratar plano" aoVoltar={aoVoltar} />
      {encerrado && (
        <p className="lf-alerta" role="alert" style={{ marginBottom: '24px' }}>
          Seu teste grátis terminou. Seus dados continuam guardados: escolha um plano para voltar a registrar laudos.
        </p>
      )}
      <form onSubmit={enviar} className="lf-coluna-secoes" style={{ maxWidth: '760px' }}>
        <Secao titulo="Plano">
          <Selecao rotulo="Plano escolhido" valor={plano} vazio="Escolha um plano" opcoes={PLANOS} aoMudar={setPlano} />
        </Secao>
        <Secao titulo="Dados da empresa">
          <div className="lf-grade">
            <Campo rotulo={individual ? 'Nome ou razão social' : 'Razão social'} obrigatorio valor={razao} aoMudar={setRazao} />
            <Campo rotulo={individual ? 'CPF ou CNPJ' : 'CNPJ'} obrigatorio numerico valor={documento} aoMudar={setDocumento} />
            <Campo rotulo="Responsável" obrigatorio valor={responsavel} aoMudar={setResponsavel} />
            <Campo rotulo="Telefone" valor={telefone} aoMudar={setTelefone} />
            <Campo rotulo="E-mail de cobrança" valor={email} aoMudar={setEmail} />
            <Campo rotulo="Endereço" valor={endereco} aoMudar={setEndereco} />
          </div>
        </Secao>
        <Secao titulo="Pagamento" descricao="Depois do pedido, entramos em contato para combinar o pagamento e liberar o plano.">
          {erro && <p className="lf-alerta" role="alert">{erro}</p>}
          <div className="lf-acoes">
            <button type="button" className="lf-botao" onClick={aoVoltar}>Cancelar</button>
            <button type="submit" className="lf-botao lf-botao-primario" disabled={enviando}>
              {enviando ? 'Enviando...' : 'Enviar pedido'}
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
