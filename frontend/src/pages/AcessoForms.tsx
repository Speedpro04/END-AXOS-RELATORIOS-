import React, { useId, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const SENHA_MINIMA = 8

interface EstiloAcesso {
  rotulo: React.CSSProperties
  campo: React.CSSProperties
  botao: React.CSSProperties
  voltar: React.CSSProperties
  corLink: string
  corTexto: string
}

const CampoAcesso: React.FC<{
  rotulo: string
  valor: string
  aoMudar: (v: string) => void
  estilo: EstiloAcesso
  tipo?: string
  obrigatorio?: boolean
  autoComplete?: string
  placeholder?: string
}> = ({ rotulo, valor, aoMudar, estilo, tipo = 'text', obrigatorio = true, autoComplete, placeholder }) => {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} style={estilo.rotulo}>{rotulo}</label>
      <input
        id={id}
        type={tipo}
        value={valor}
        required={obrigatorio}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => aoMudar(e.target.value)}
        style={estilo.campo}
      />
    </div>
  )
}

/** Criação de conta com a empresa. A empresa é criada no primeiro acesso, depois de confirmar o e-mail. */
export const CadastroForm: React.FC<{
  estilo: EstiloAcesso
  aoVoltar: () => void
  aoErro: (mensagem: string | null) => void
  aoEnviar: (email: string) => void
}> = ({ estilo, aoVoltar, aoErro, aoEnviar }) => {
  const { signUp } = useAuth()
  const [nome, setNome] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [aceite, setAceite] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    aoErro(null)
    const digitosCnpj = cnpj.replace(/\D/g, '')
    if (digitosCnpj && digitosCnpj.length !== 14) return aoErro('O CNPJ precisa ter 14 números.')
    if (senha.length < SENHA_MINIMA) return aoErro(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`)
    if (senha !== confirmacao) return aoErro('As senhas não são iguais.')
    if (!aceite) return aoErro('Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.')
    setEnviando(true)
    const res = await signUp({ email, senha, nome, empresa, cnpj: digitosCnpj })
    setEnviando(false)
    if (!res.success) return aoErro(res.error ?? 'Não foi possível criar a conta. Tente novamente.')
    if (res.precisaConfirmar) aoEnviar(email.trim())
  }

  return (
    <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <CampoAcesso rotulo="Seu nome" valor={nome} aoMudar={setNome} estilo={estilo} autoComplete="name" />
      <CampoAcesso rotulo="Nome da empresa" valor={empresa} aoMudar={setEmpresa} estilo={estilo} autoComplete="organization" />
      <CampoAcesso rotulo="CNPJ (opcional)" valor={cnpj} aoMudar={setCnpj} estilo={estilo} obrigatorio={false} placeholder="00.000.000/0000-00" />
      <CampoAcesso rotulo="E-mail" tipo="email" valor={email} aoMudar={setEmail} estilo={estilo} autoComplete="email" />
      <CampoAcesso rotulo={`Senha (mínimo ${SENHA_MINIMA} caracteres)`} tipo="password" valor={senha} aoMudar={setSenha} estilo={estilo} autoComplete="new-password" />
      <CampoAcesso rotulo="Confirmar senha" tipo="password" valor={confirmacao} aoMudar={setConfirmacao} estilo={estilo} autoComplete="new-password" />
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '14px', color: estilo.corTexto, lineHeight: 1.4 }}>
        <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} style={{ width: '20px', height: '20px', flexShrink: 0 }} />
        <span>
          Li e aceito os <a href="/termos-de-uso.html" target="_blank" rel="noreferrer" style={{ color: estilo.corLink }}>Termos de Uso</a> e a{' '}
          <a href="/politica-de-privacidade.html" target="_blank" rel="noreferrer" style={{ color: estilo.corLink }}>Política de Privacidade</a>.
        </span>
      </label>
      <button type="submit" disabled={enviando} style={{ ...estilo.botao, cursor: enviando ? 'not-allowed' : 'pointer', opacity: enviando ? 0.75 : 1 }}>
        {enviando ? 'Criando conta...' : 'Criar conta'}
      </button>
      <button type="button" onClick={aoVoltar} style={estilo.voltar}>
        <ArrowLeft size={16} /> Voltar para o login
      </button>
    </form>
  )
}

/** Tela aberta pelo link do e-mail de recuperação. */
export const NovaSenhaForm: React.FC<{
  estilo: EstiloAcesso
  aoErro: (mensagem: string | null) => void
}> = ({ estilo, aoErro }) => {
  const { updateUserPassword, concluirRecuperacao } = useAuth()
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [salvando, setSalvando] = useState(false)

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    aoErro(null)
    if (senha.length < SENHA_MINIMA) return aoErro(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`)
    if (senha !== confirmacao) return aoErro('As senhas não são iguais.')
    setSalvando(true)
    const res = await updateUserPassword(senha)
    setSalvando(false)
    if (!res.success) return aoErro(res.error ?? 'Não foi possível salvar a senha. Tente novamente.')
    concluirRecuperacao()
  }

  return (
    <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <CampoAcesso rotulo={`Nova senha (mínimo ${SENHA_MINIMA} caracteres)`} tipo="password" valor={senha} aoMudar={setSenha} estilo={estilo} autoComplete="new-password" />
      <CampoAcesso rotulo="Confirmar nova senha" tipo="password" valor={confirmacao} aoMudar={setConfirmacao} estilo={estilo} autoComplete="new-password" />
      <button type="submit" disabled={salvando} style={{ ...estilo.botao, cursor: salvando ? 'not-allowed' : 'pointer', opacity: salvando ? 0.75 : 1 }}>
        {salvando ? 'Salvando...' : 'Salvar nova senha'}
      </button>
    </form>
  )
}
