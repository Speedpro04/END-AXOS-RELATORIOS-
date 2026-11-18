// Qualificações SNQC dos inspetores (tabela public.qualifications).
// Só administrador e supervisor cadastram; o inspetor vê as próprias.
// O banco só aceita enviar o laudo para revisão com qualificação do próprio inspetor,
// do mesmo método e válida na data do ensaio.
import { supabase } from '../lib/supabase'
import { db } from './dbDexie'
import type { ENDMethod } from '../types/inspection'

export interface Qualificacao {
  id: string
  tenant_id: string
  user_id: string
  method: ENDMethod
  level: number | null
  cert_number: string
  issuer: string
  valid_until: string // AAAA-MM-DD
}

const COLUNAS = 'id, tenant_id, user_id, method, level, cert_number, issuer, valid_until'

/** Válida na data informada (AAAA-MM-DD); sem data, vale hoje. */
export function qualificacaoValida(q: Pick<Qualificacao, 'valid_until'>, data?: string): boolean {
  const referencia = data || new Date().toISOString().slice(0, 10)
  return q.valid_until >= referencia
}

export function descreverQualificacao(q: Pick<Qualificacao, 'cert_number' | 'level'>): string {
  return `SNQC ${q.cert_number}${q.level ? ` N${q.level}` : ''}`
}

/** Qualificações do próprio usuário. Sem internet, usa a cópia guardada no aparelho. */
export async function minhasQualificacoes(userId: string): Promise<Qualificacao[]> {
  try {
    const { data, error } = await supabase.from('qualifications').select(COLUNAS).eq('user_id', userId).order('valid_until', { ascending: false })
    if (error) throw error
    const lista = (data ?? []) as Qualificacao[]
    await db.transaction('rw', db.qualifications, async () => {
      const locais = await db.qualifications.where('userId').equals(userId).primaryKeys()
      await db.qualifications.bulkDelete(locais.filter((id) => !lista.some((q) => q.id === id)))
      await db.qualifications.bulkPut(lista.map((q) => ({ ...q, tenantId: q.tenant_id, userId: q.user_id })))
    })
    return lista
  } catch {
    return (await db.qualifications.where('userId').equals(userId).toArray()) as Qualificacao[]
  }
}

/** Todas as qualificações da empresa (administrador e supervisor). */
export async function qualificacoesDaEquipe(): Promise<Qualificacao[]> {
  const { data, error } = await supabase.from('qualifications').select(COLUNAS).order('valid_until', { ascending: true })
  if (error) throw error
  return (data ?? []) as Qualificacao[]
}

export async function cadastrarQualificacao(q: Omit<Qualificacao, 'id'>): Promise<void> {
  const { error } = await supabase.from('qualifications').insert(q)
  if (error) throw error
}

/** Recusa se a qualificação já foi usada em algum laudo (o histórico precisa dela). */
export async function removerQualificacao(id: string): Promise<void> {
  const { error } = await supabase.from('qualifications').delete().eq('id', id)
  if (error) throw error
}
