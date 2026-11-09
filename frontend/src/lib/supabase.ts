import { createClient, type Session } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// O nome que a biblioteca já usa por padrão: quem está logado continua logado
export const CHAVE_SESSAO = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: CHAVE_SESSAO,
  },
})

/** Sessão guardada no aparelho, lida sem depender da rede (nem de renovar o token). */
export function lerSessaoGuardada(): Session | null {
  try {
    const sessao = JSON.parse(localStorage.getItem(CHAVE_SESSAO) ?? 'null')
    return sessao?.access_token && sessao.refresh_token && sessao.user?.id ? (sessao as Session) : null
  } catch {
    return null
  }
}

export const isSupabaseConfigured = () =>
  Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('seu-projeto'))
