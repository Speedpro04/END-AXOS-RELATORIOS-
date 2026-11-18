import { createClient, type Session } from '@supabase/supabase-js'

// Aceita o endereço como o painel do Supabase mostra (com /rest/v1/ no fim), com espaço ou barra sobrando
export const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')
export const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

function projetoDoEndereco(url: string): string {
  try {
    return new URL(url).hostname.split('.')[0]
  } catch {
    return 'sem-configuracao'
  }
}

// O nome que a biblioteca já usa por padrão: quem está logado continua logado
export const CHAVE_SESSAO = `sb-${projetoDoEndereco(supabaseUrl)}-auth-token`

// Sem endereço válido o site não pode travar em branco: a tela de login mostra o aviso de configuração
const enderecoValido = projetoDoEndereco(supabaseUrl) !== 'sem-configuracao'
export const supabase = createClient(enderecoValido ? supabaseUrl : 'https://sem-configuracao.invalid', supabaseAnonKey || 'sem-chave', {
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
