import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

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
  plan: 'trial' | 'starter' | 'pro' | 'enterprise'
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
  error: string | null
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ success: boolean; message?: string; error?: string }>
  updateUserPassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>
}

export const DEFAULT_OPERATIONAL_UNITS = [
  'Unidade Operacional Principal',
  'Refinaria Norte',
  'Plataforma P-77',
  'Terminal de Gás Sul',
  'Petroquímica Leste',
]

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [tenant, setTenant] = useState<TenantInfo | null>(null)
  const [operationalUnits, setOperationalUnits] = useState<string[]>(DEFAULT_OPERATIONAL_UNITS)
  const [selectedUnit, setSelectedUnit] = useState<string>(DEFAULT_OPERATIONAL_UNITS[0])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const loadUserData = async (currentSession: Session) => {
    try {
      setError(null)
      const userId = currentSession.user.id

      // 1. Carrega o perfil da tabela profiles (fonte única de papel)
      const { data: pData, error: pError } = await supabase
        .from('profiles')
        .select('id, tenant_id, role, can_inspect, full_name, active')
        .eq('id', userId)
        .maybeSingle()

      if (pError) throw pError
      if (!pData) {
        throw new Error('Perfil não encontrado no sistema. Contate o administrador.')
      }

      // Regra: usuário desativado perde acesso imediatamente
      if (!pData.active) {
        await supabase.auth.signOut()
        setSession(null)
        setUser(null)
        setProfile(null)
        setTenant(null)
        throw new Error('Sua conta foi desativada pelo administrador. Acesso revogado imediatamente.')
      }

      const activeProfile = pData as UserProfile
      setProfile(activeProfile)

      // 2. Carrega dados do tenant
      const { data: tData, error: tError } = await supabase
        .from('tenants')
        .select('id, legal_name, trade_name, cnpj, plan, require_second_reviewer')
        .eq('id', activeProfile.tenant_id)
        .maybeSingle()

      if (tError) throw tError
      if (tData) {
        setTenant(tData as TenantInfo)
      }

      // 3. Unidades operacionais derivadas das ordens de serviço do tenant (dados reais, não lista fixa)
      const { data: woData } = await supabase
        .from('work_orders')
        .select('site')
        .eq('tenant_id', activeProfile.tenant_id)

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

    } catch (err: unknown) {
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

        const { data: { session: initialSession }, error } = await supabase.auth.getSession()
        if (!isMounted) return

        if (error) throw error

        setSession(initialSession)
        setUser(initialSession?.user ?? null)

        if (initialSession) {
          await loadUserData(initialSession)
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Erro ao inicializar autenticação')
          setIsLoading(false)
        }
      } finally {
        if (isMounted && !session) setIsLoading(false)
      }
    }

    initAuth()

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)

      if (newSession) {
        await loadUserData(newSession)
      } else {
        setProfile(null)
        setTenant(null)
        setOperationalUnits(DEFAULT_OPERATIONAL_UNITS)
      }
      setIsLoading(false)
    })

    return () => {
      isMounted = false
      authListener?.subscription.unsubscribe()
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
            plan: 'enterprise',
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
        let msg = 'Erro ao realizar login. Verifique suas credenciais.'
        if (signInError.message.includes('Invalid login credentials')) {
          msg = 'E-mail ou senha incorretos.'
        } else if (signInError.message.includes('Email not confirmed')) {
          msg = 'E-mail não confirmado. Verifique sua caixa de entrada.'
        }
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
      const msg = err instanceof Error ? err.message : 'Falha inesperada no login'
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setIsLoading(false)
    }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
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
        return { success: false, error: resetError.message }
      }
      return {
        success: true,
        message: 'Link de recuperação de senha enviado com sucesso! Verifique sua caixa de entrada.',
      }
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Falha ao solicitar recuperação de senha',
      }
    }
  }

  const updateUserPassword = async (newPassword: string) => {
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })
      if (updateError) {
        return { success: false, error: updateError.message }
      }
      return { success: true }
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Falha ao atualizar senha',
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
        error,
        signIn,
        signOut,
        resetPassword,
        updateUserPassword,
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
