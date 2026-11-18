import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { isAuthRetryableFetchError, type Session, type User } from '@supabase/supabase-js'
import { CHAVE_SESSAO, lerSessaoGuardada, supabase, supabaseAnonKey, supabaseUrl } from '../lib/supabase'
import { db, type CopiaDaConta } from '../services/dbDexie'
import { mensagemErroAuth } from '../utils/errosAuth'

export type AppRole = 'admin' | 'supervisor' | 'inspector'

export interface UserProfile {
  id: string
  tenant_id: string
  role: AppRole
  can_inspect: boolean
  full_name: string
  active: boolean
}

export interface TenantInfo {
  id: string
  legal_name: string
  trade_name: string | null
  cnpj: string | null
  plan: string
  trial_ends_at: string | null
  require_second_reviewer: boolean
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  tenant: TenantInfo | null
  operationalUnits: string[]
  selectedUnit: string
  setSelectedUnit: (unit: string) => void
  isLoading: boolean
  verificandoSessao: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ success: boolean; message?: string; error?: string }>
  updateUserPassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>
  signUp: (dados: { email: string; senha: string; nome: string; convite?: string | null }) => Promise<{ success: boolean; precisaConfirmar?: boolean; error?: string }>
  emRecuperacao: boolean
  erroLinkRecuperacao: boolean
  concluirRecuperacao: () => void
  cancelarRecuperacao: () => void
}

export const CHAVE_CONVITE = 'axos_convite'

// Data da última atualização dos Termos e da Política
export const VERSAO_DOCUMENTOS_LEGAIS = '2026-11-09'

export const DEFAULT_OPERATIONAL_UNITS = [
  'Unidade Operacional Principal',
  'Refinaria Norte',
  'Plataforma P-77',
  'Terminal de Gás Sul',
  'Petroquímica Leste',
]

// Com cópia no aparelho, quanto a abertura e a saída esperam pelo servidor quando há sinal
const ESPERA_SERVIDOR_MS = 3_000
const INTERVALO_NOVA_CONSULTA_MS = 30_000
const MENSAGEM_SEM_INTERNET = 'Sem internet. Para usar o app sem sinal, entre uma vez com internet neste aparelho.'

const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [tenant, setTenant] = useState<TenantInfo | null>(null)
  const [operationalUnits, setOperationalUnits] = useState<string[]>(DEFAULT_OPERATIONAL_UNITS)
  const [selectedUnit, setSelectedUnit] = useState<string>(DEFAULT_OPERATIONAL_UNITS[0])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  // Só na abertura do app: separa "ainda verificando" de "não está logado"
  const [verificandoSessao, setVerificandoSessao] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  // Link do e-mail de recuperação: abre a tela de nova senha
  const [emRecuperacao, setEmRecuperacao] = useState(() => window.location.pathname === '/redefinir-senha')
  const [erroLinkRecuperacao] = useState(() => window.location.pathname === '/redefinir-senha' && (window.location.hash + window.location.search).includes('error='))
  // Muda ao sair da conta: uma consulta ainda no ar não pode recolocar ninguém para dentro
  const contaAtual = useRef(0)
  // O servidor ainda não respondeu sobre esta conta: consulta de novo quando houver rede
  const semResposta = useRef(false)

  const aplicarCopia = (copia: CopiaDaConta, perfilDoServidor?: UserProfile | null) => {
    setProfile(perfilDoServidor ?? copia.profile)
    setTenant(copia.tenant)
    if (copia.unidades.length > 0) {
      setOperationalUnits(copia.unidades)
      setSelectedUnit((prev) => (copia.unidades.includes(prev) ? prev : copia.unidades[0]))
    }
  }

  /** Encerra a sessão no servidor. Sem resposta dele, ela sai ao menos deste aparelho. */
  const encerrarSessao = async () => {
    const saida = supabase.auth.signOut().catch(() => ({ error: true }))
    const resposta = await Promise.race([saida, esperar(navigator.onLine ? ESPERA_SERVIDOR_MS : 0).then(() => null)])
    if (!resposta || resposta.error) localStorage.removeItem(CHAVE_SESSAO)
  }

  const loadUserData = async (currentSession: Session) => {
    const conta = contaAtual.current
    const saiuDaConta = () => conta !== contaAtual.current
    const userId = currentSession.user.id
    let statusDaFalha: number | null = null
    let perfilDoServidor: UserProfile | null = null

    try {
      if (!semResposta.current) setError(null)

      // 1. Carrega o perfil da tabela profiles (fonte única de papel)
      const { data: pData, error: pError, status: pStatus } = await supabase
        .from('profiles')
        .select('id, tenant_id, role, can_inspect, full_name, active')
        .eq('id', userId)
        .maybeSingle()

      if (saiuDaConta()) return
      if (pError) {
        statusDaFalha = pStatus
        throw pError
      }
      if (!pData) {
        // Primeiro acesso de quem se cadastrou: cria a empresa com os dados informados na conta
        const meta = currentSession.user.user_metadata as { empresa?: string; nome?: string; aceite_versao?: string; convite?: string } | undefined
        // Convidado entra na empresa que convidou: nunca cria outra
        const convite = meta?.convite || localStorage.getItem(CHAVE_CONVITE)
        if (convite) {
          const { error: conviteError } = await supabase.rpc('aceitar_convite', { p_token: convite, p_nome: meta?.nome ?? '' })
          if (conviteError) throw new Error(mensagemErroAuth(conviteError.message, 'Não foi possível aceitar o convite. Peça um novo convite.'))
          localStorage.removeItem(CHAVE_CONVITE)
          if (meta?.aceite_versao) await supabase.rpc('registrar_aceites', { p_versao: meta.aceite_versao })
          return loadUserData(currentSession)
        }
        if (meta?.nome) {
          const { error: criarError } = await supabase.rpc('criar_empresa_inicial', {
            // A conta nasce com o nome da pessoa; os dados da empresa entram na contratação
            p_empresa: meta.empresa || meta.nome,
            p_nome: meta.nome,
          })
          if (criarError) throw new Error(mensagemErroAuth(criarError.message, 'Não foi possível concluir o cadastro da empresa. Fale com suporte@axosrelatorios.com.'))
          // Prova do aceite marcado no cadastro
          if (meta.aceite_versao) await supabase.rpc('registrar_aceites', { p_versao: meta.aceite_versao })
          return loadUserData(currentSession)
        }
        throw new Error('Perfil não encontrado no sistema. Contate o administrador.')
      }

      // Regra: usuário desativado perde acesso imediatamente
      if (!pData.active) {
        contaAtual.current += 1
        semResposta.current = false
        await db.apagarCopiaDaConta()
        await encerrarSessao()
        setSession(null)
        setUser(null)
        setProfile(null)
        setTenant(null)
        setError('Sua conta foi desativada pelo administrador. Acesso revogado imediatamente.')
        return
      }

      // Quem já tem empresa não aceita convite: o link fica sem efeito
      localStorage.removeItem(CHAVE_CONVITE)
      const activeProfile = pData as UserProfile
      perfilDoServidor = activeProfile
      setProfile(activeProfile)

      // 2. Carrega dados do tenant
      const { data: tData, error: tError, status: tStatus } = await supabase
        .from('tenants')
        .select('id, legal_name, trade_name, cnpj, plan, trial_ends_at, require_second_reviewer')
        .eq('id', activeProfile.tenant_id)
        .maybeSingle()

      if (saiuDaConta()) return
      if (tError) {
        statusDaFalha = tStatus
        throw tError
      }
      if (tData) {
        setProfile(activeProfile)
        setTenant(tData as TenantInfo)
        await db.guardarCopiaDaConta(activeProfile, tData as TenantInfo)
      } else {
        await db.apagarCopiaDaConta()
      }
      if (saiuDaConta()) return
      semResposta.current = false
      setError(null)

      // 3. Unidades operacionais derivadas das ordens de serviço do tenant (dados reais, não lista fixa)
      const { data: woData, error: woError } = await supabase
        .from('work_orders')
        .select('site')
        .eq('tenant_id', activeProfile.tenant_id)

      if (saiuDaConta()) return

      const sitesSet = new Set<string>()
      if (woData && woData.length > 0) {
        woData.forEach((row: { site?: string | null }) => {
          if (row.site && row.site.trim()) {
            sitesSet.add(row.site.trim())
          }
        })
      }

      const uniqueSites = Array.from(sitesSet)
      if (uniqueSites.length === 0) {
        uniqueSites.push('Unidade Operacional Principal')
      }
      setOperationalUnits(uniqueSites)
      setSelectedUnit((prev) => (uniqueSites.includes(prev) ? prev : uniqueSites[0]))
      if (!woError && tData) await db.guardarCopiaDaConta(activeProfile, tData as TenantInfo, uniqueSites)

    } catch (err: unknown) {
      if (saiuDaConta()) return

      // O pedido não chegou ao servidor: só neste caso a cópia do aparelho vale
      if (statusDaFalha === 0) {
        semResposta.current = true
        const copia = await db.lerCopiaDaConta(userId)
        if (saiuDaConta()) return
        if (copia && (!perfilDoServidor || perfilDoServidor.tenant_id === copia.tenant.id)) {
          aplicarCopia(copia, perfilDoServidor)
        } else {
          setError(MENSAGEM_SEM_INTERNET)
          setProfile(null)
          setTenant(null)
        }
        return
      }

      // Servidor com defeito não decide nada sobre a conta: quem já entrou continua, e a cópia fica
      const servidorComDefeito = statusDaFalha !== null && statusDaFalha >= 500
      if (servidorComDefeito && semResposta.current) return
      if (!servidorComDefeito) await db.apagarCopiaDaConta()

      const msg = err instanceof Error ? err.message : 'Falha ao carregar dados do usuário'
      setError(msg)
      setProfile(null)
      setTenant(null)
    }
  }

  useEffect(() => {
    let isMounted = true

    const initAuth = async () => {
      try {
        // Verifica se o Supabase está configurado
        if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('seu-projeto')) {
          if (isMounted) {
            setError('Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env')
            setIsLoading(false)
          }
          return
        }

        const guardada = lerSessaoGuardada()
        const copia = guardada ? await db.lerCopiaDaConta(guardada.user.id) : null
        if (!isMounted) return

        const conta = contaAtual.current
        const abrirSemServidor = () => {
          if (!isMounted || !guardada || conta !== contaAtual.current) return
          semResposta.current = true
          setSession(guardada)
          setUser(guardada.user)
          if (copia) aplicarCopia(copia)
          else setError(MENSAGEM_SEM_INTERNET)
        }

        let respondeu = false
        const verificacao = (async () => {
          const { data: { session: initialSession }, error } = await supabase.auth.getSession()
          if (!isMounted) return

          if (error) {
            // Token vencido e sem rede para renovar: a sessão continua guardada
            if (isAuthRetryableFetchError(error)) return abrirSemServidor()
            throw error
          }

          setSession(initialSession)
          setUser(initialSession?.user ?? null)

          if (initialSession) {
            await loadUserData(initialSession)
          }
        })()
          .catch((err: unknown) => {
            if (isMounted) setError(err instanceof Error ? err.message : 'Erro ao inicializar autenticação')
          })
          .finally(() => {
            respondeu = true
          })

        // A consulta continua em segundo plano: quando o servidor responder, o dado dele manda
        if (guardada && (copia || !navigator.onLine)) {
          await Promise.race([verificacao, esperar(navigator.onLine ? ESPERA_SERVIDOR_MS : 0)])
          if (!respondeu) abrirSemServidor()
        } else {
          await verificacao
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Erro ao inicializar autenticação')
          setIsLoading(false)
        }
      } finally {
        if (isMounted) {
          if (!session) setIsLoading(false)
          setVerificandoSessao(false)
        }
      }
    }

    initAuth()

    const { data: authListener } = supabase.auth.onAuthStateChange(async (evento, newSession) => {
      if (evento === 'PASSWORD_RECOVERY') setEmRecuperacao(true)

      // Sem rede para renovar o token a biblioteca avisa "sem sessão", mas ela segue guardada
      if (!newSession && evento === 'INITIAL_SESSION' && lerSessaoGuardada()) {
        setIsLoading(false)
        return
      }

      setSession(newSession)
      setUser(newSession?.user ?? null)

      if (newSession) {
        await loadUserData(newSession)
      } else {
        contaAtual.current += 1
        semResposta.current = false
        await db.apagarCopiaDaConta()
        setProfile(null)
        setTenant(null)
        setOperationalUnits(DEFAULT_OPERATIONAL_UNITS)
      }
      setIsLoading(false)
    })

    // Aberto com a cópia do aparelho: pergunta ao servidor assim que houver rede.
    // navigator.onLine também fica ligado em Wi-Fi sem internet, por isso a repetição.
    let consultando = false
    const consultarServidor = async () => {
      if (!semResposta.current || consultando || !navigator.onLine) return
      consultando = true
      try {
        const { data: { session: atual }, error } = await supabase.auth.getSession()
        if (!error && atual && isMounted) await loadUserData(atual)
      } finally {
        consultando = false
      }
    }
    window.addEventListener('online', consultarServidor)
    const repeticao = window.setInterval(consultarServidor, INTERVALO_NOVA_CONSULTA_MS)

    return () => {
      isMounted = false
      authListener?.subscription.unsubscribe()
      window.removeEventListener('online', consultarServidor)
      window.clearInterval(repeticao)
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    setError(null)
    setIsLoading(true)
    try {
      // Login direto para demonstração (só existe em desenvolvimento)
      if (import.meta.env.DEV) {
        const demoEmail = import.meta.env.VITE_DEMO_EMAIL || ''
        const demoPassword = import.meta.env.VITE_DEMO_PASSWORD || ''

        if (demoEmail && demoPassword && email.trim().toLowerCase() === demoEmail.toLowerCase() && password === demoPassword) {
          const mockSession: Session = {
            user: {
              id: 'axos-demo-user-001',
              email: demoEmail,
              aud: 'authenticated',
              role: 'authenticated',
              email_confirmed_at: new Date().toISOString(),
              phone: '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              app_metadata: {},
              user_metadata: {},
              identities: [],
              confirmation_token: '',
              confirmation_sent_at: '',
              recovery_token: '',
              recovery_sent_at: '',
              instance_id: '',
              is_anonymous: false,
            } as User,
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            token_type: 'bearer',
            provider_token: '',
            provider_refresh_token: '',
          } as unknown as Session

          setSession(mockSession)
          setUser(mockSession.user)

          setProfile({
            id: 'axos-demo-user-001',
            tenant_id: 'axos-demo-tenant-001',
            role: 'admin',
            can_inspect: true,
            full_name: 'Carlos Eduardo Silva',
            active: true,
          } as UserProfile)

          setTenant({
            id: 'axos-demo-tenant-001',
            legal_name: 'AXOS Relatórios Ltda',
            trade_name: 'AXOS Relatórios',
            cnpj: '00.000.000/0001-00',
            plan: 'trial',
            trial_ends_at: import.meta.env.VITE_DEMO_TESTE_FIM || new Date(Date.now() + 30 * 86_400_000).toISOString(),
            require_second_reviewer: false,
          } as TenantInfo)

          setOperationalUnits(['Unidade Operacional Principal', 'Refinaria Norte', 'Plataforma P-77', 'Terminal de Gás Sul', 'Petroquímica Leste'])
          setSelectedUnit('Unidade Operacional Principal')

          setIsLoading(false)
          return { success: true }
        }
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError) {
        const msg = mensagemErroAuth(signInError.message, 'Erro ao realizar login. Verifique suas credenciais.')
        setError(msg)
        return { success: false, error: msg }
      }

      if (data.session) {
        setSession(data.session)
        setUser(data.session.user)
        await loadUserData(data.session)
      }

      return { success: true }
    } catch (err: unknown) {
      const msg = mensagemErroAuth(err instanceof Error ? err.message : undefined, 'Falha inesperada no login')
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setIsLoading(false)
    }
  }

  const signOut = async () => {
    contaAtual.current += 1
    semResposta.current = false
    try {
      await db.apagarCopiaDaConta()
      await encerrarSessao()
    } finally {
      setSession(null)
      setUser(null)
      setProfile(null)
      setTenant(null)
      setError(null)
    }
  }

  const resetPassword = async (email: string) => {
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      })
      if (resetError) {
        return { success: false, error: mensagemErroAuth(resetError.message, 'Não foi possível enviar o link. Tente novamente.') }
      }
      return {
        success: true,
        message: 'Link de recuperação de senha enviado com sucesso! Verifique sua caixa de entrada.',
      }
    } catch (err: unknown) {
      return {
        success: false,
        error: mensagemErroAuth(err instanceof Error ? err.message : undefined, 'Falha ao solicitar recuperação de senha'),
      }
    }
  }

  const signUp: AuthContextType['signUp'] = async ({ email, senha, nome, convite }) => {
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: senha,
        options: {
          emailRedirectTo: `${window.location.origin}/app`,
          data: { nome: nome.trim(), aceite_versao: VERSAO_DOCUMENTOS_LEGAIS, ...(convite ? { convite } : {}) },
        },
      })
      if (signUpError) {
        return { success: false, error: mensagemErroAuth(signUpError.message, 'Não foi possível criar a conta. Tente novamente.') }
      }
      return { success: true, precisaConfirmar: !data.session }
    } catch (err: unknown) {
      return { success: false, error: mensagemErroAuth(err instanceof Error ? err.message : undefined, 'Não foi possível criar a conta. Tente novamente.') }
    }
  }

  const sairDoLinkDeRecuperacao = () => {
    setEmRecuperacao(false)
    window.history.replaceState(null, '', '/app')
  }

  const updateUserPassword = async (newPassword: string) => {
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (updateError) {
        return { success: false, error: mensagemErroAuth(updateError.message, 'Não foi possível salvar a senha. Tente novamente.') }
      }
      return { success: true }
    } catch (err: unknown) {
      return {
        success: false,
        error: mensagemErroAuth(err instanceof Error ? err.message : undefined, 'Falha ao atualizar senha'),
      }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        tenant,
        operationalUnits,
        selectedUnit,
        setSelectedUnit,
        isLoading,
        verificandoSessao,
        error,
        signIn,
        signOut,
        resetPassword,
        updateUserPassword,
        signUp,
        emRecuperacao,
        erroLinkRecuperacao,
        concluirRecuperacao: sairDoLinkDeRecuperacao,
        cancelarRecuperacao: sairDoLinkDeRecuperacao,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider')
  }
  return context
}
