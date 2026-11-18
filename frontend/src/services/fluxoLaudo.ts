// Fluxo do laudo no servidor: rascunho → revisão → (devolvido) → aprovado → emitido → nova revisão.
// As regras ficam no banco (gatilho de reports); aqui só pedimos a mudança e traduzimos a recusa.
import { supabase } from '../lib/supabase'
import { API_BASE_URL } from '../config'
import { db } from './dbDexie'
import { SCREEN_STATUS, SERVER_STATUS, syncManager } from './sync'

export type StatusServidor = 'draft' | 'submitted' | 'returned' | 'approved' | 'issued' | 'superseded'

export interface SituacaoLaudo {
  status: StatusServidor
  report_number: string | null
  revision: number
  inspector_id: string
  submitted_at: string | null
  issued_at: string | null
  data_hash: string | null
}

export type Resultado = { ok: true; mensagem?: string; novoId?: string } | { ok: false; mensagem: string }

const MENSAGENS: Record<string, string> = {
  REPORT_INCOMPLETE: 'Faltam dados obrigatórios: equipamento, data do ensaio e qualificação do inspetor.',
  QUALIFICATION_INVALID: 'A qualificação escolhida não vale para este laudo: precisa ser sua, do mesmo método e válida na data do ensaio.',
  INSTRUMENT_CALIBRATION_EXPIRED: 'Há instrumento com calibração vencida na data do ensaio.',
  ONLY_OWNER_CAN_SUBMIT: 'Só o inspetor que fez o laudo pode enviá-lo para revisão.',
  ONLY_REVIEWER_CAN_RETURN: 'Só administrador ou supervisor pode devolver o laudo.',
  ONLY_REVIEWER_CAN_APPROVE: 'Só administrador ou supervisor pode aprovar o laudo.',
  ONLY_REVIEWER_CAN_ISSUE: 'Só administrador ou supervisor pode emitir o laudo.',
  RETURN_REQUIRES_COMMENT: 'Para devolver, escreva o motivo.',
  SELF_APPROVAL_NOT_ALLOWED: 'Sua empresa exige que outra pessoa aprove: você não pode aprovar o próprio laudo.',
  ONLY_ISSUED_CAN_BE_REVISED: 'Só laudo emitido pode ganhar nova revisão.',
}

function traduzir(err: unknown, padrao: string): string {
  const texto = `${(err as { message?: string })?.message ?? ''} ${(err as { details?: string })?.details ?? ''}`
  const codigo = Object.keys(MENSAGENS).find((c) => texto.includes(c))
  if (codigo) return MENSAGENS[codigo]
  if (/failed to fetch|network/i.test(texto)) return 'Sem conexão com o servidor. Confira a internet e tente de novo.'
  return padrao
}

const semInternet = (): Resultado | null =>
  navigator.onLine ? null : { ok: false, mensagem: 'Sem internet. Esta ação precisa de conexão com o servidor.' }

/** Situação do laudo no servidor; null se ainda não chegou lá; 'sem-conexao' se não deu para perguntar. */
export async function lerSituacao(id: string): Promise<SituacaoLaudo | null | 'sem-conexao'> {
  if (!navigator.onLine) return 'sem-conexao'
  const { data, error } = await supabase
    .from('reports')
    .select('status, report_number, revision, inspector_id, submitted_at, issued_at, data_hash')
    .eq('id', id)
    .maybeSingle()
  if (error) return 'sem-conexao'
  return (data as SituacaoLaudo | null) ?? null
}

/** Motivo da última devolução (comentário do revisor). */
export async function ultimoComentario(id: string): Promise<string | null> {
  const { data } = await supabase
    .from('report_comments')
    .select('body, created_at')
    .eq('report_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
  return (data?.[0] as { body?: string } | undefined)?.body ?? null
}

/** Grava a situação nova no aparelho e puxa o resto do servidor (a lista se atualiza sozinha). */
async function atualizarLocal(id: string, status: StatusServidor, numero?: string | null): Promise<void> {
  const local = await db.reports.get(id)
  if (local) {
    const reportNumber = numero ?? local.reportNumber
    await db.reports.update(id, {
      serverStatus: SERVER_STATUS[status],
      reportNumber,
      data: { ...local.data, status: SCREEN_STATUS[status], code: reportNumber ?? local.data.code },
    })
  }
  await syncManager.syncNow()
}

export async function enviarParaRevisao(id: string): Promise<Resultado> {
  const offline = semInternet()
  if (offline) return offline
  const local = await db.reports.get(id)
  if (!local) return { ok: false, mensagem: 'Registre o laudo antes de enviar para revisão.' }
  if (!local.workOrderId) {
    return { ok: false, mensagem: 'Este laudo foi feito fora de uma obra e fica só no aparelho. Só laudos de obra vão para o servidor e podem ser revisados.' }
  }
  if (!local.data.qualificationId) {
    return { ok: false, mensagem: 'Escolha a qualificação usada neste laudo (quadro Responsável técnico) e clique em Registrar laudo.' }
  }

  // O laudo e as fotos precisam estar no servidor antes: em revisão, o banco recusa foto nova
  await syncManager.syncNow()
  const naFila = await db.outbox.where('entityId').equals(id).count()
  const fotosNaFila = (await db.fotosFila.toArray()).filter((f: { laudoId?: string }) => f.laudoId === id).length
  if (naFila > 0 || fotosNaFila > 0) {
    return { ok: false, mensagem: 'O laudo ou as fotos ainda estão subindo para o servidor. Aguarde alguns segundos e tente de novo.' }
  }

  const { data, error } = await supabase
    .from('reports')
    .update({ status: 'submitted' })
    .eq('id', id)
    .in('status', ['draft', 'returned'])
    .select('id')
  if (error) return { ok: false, mensagem: traduzir(error, 'Não foi possível enviar para revisão. Tente de novo.') }
  if (!data?.length) return { ok: false, mensagem: 'O laudo não está em rascunho nem devolvido.' }
  await atualizarLocal(id, 'submitted')
  return { ok: true, mensagem: 'Laudo enviado para revisão.' }
}

export async function aprovar(id: string): Promise<Resultado> {
  const offline = semInternet()
  if (offline) return offline
  const { data, error } = await supabase.from('reports').update({ status: 'approved' }).eq('id', id).eq('status', 'submitted').select('id')
  if (error) return { ok: false, mensagem: traduzir(error, 'Não foi possível aprovar. Tente de novo.') }
  if (!data?.length) return { ok: false, mensagem: 'O laudo não está em revisão.' }
  await atualizarLocal(id, 'approved')
  return { ok: true, mensagem: 'Laudo aprovado. Agora ele pode ser emitido.' }
}

export async function devolver(id: string, tenantId: string, motivo: string): Promise<Resultado> {
  const offline = semInternet()
  if (offline) return offline
  if (!motivo.trim()) return { ok: false, mensagem: MENSAGENS.RETURN_REQUIRES_COMMENT }
  const comentario = await supabase.from('report_comments').insert({ tenant_id: tenantId, report_id: id, body: motivo.trim() })
  if (comentario.error) return { ok: false, mensagem: traduzir(comentario.error, 'Não foi possível registrar o motivo. Tente de novo.') }
  const { data, error } = await supabase.from('reports').update({ status: 'returned' }).eq('id', id).eq('status', 'submitted').select('id')
  if (error) return { ok: false, mensagem: traduzir(error, 'Não foi possível devolver. Tente de novo.') }
  if (!data?.length) return { ok: false, mensagem: 'O laudo não está em revisão.' }
  await atualizarLocal(id, 'returned')
  return { ok: true, mensagem: 'Laudo devolvido ao inspetor com o motivo.' }
}

export async function emitir(id: string): Promise<Resultado> {
  const offline = semInternet()
  if (offline) return offline
  const { data: sessao } = await supabase.auth.getSession()
  const token = sessao.session?.access_token
  if (!token) return { ok: false, mensagem: 'Sua sessão expirou. Entre de novo para emitir.' }
  try {
    const resposta = await fetch(`${API_BASE_URL}/api/sync/emitir/${id}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    const corpo = await resposta.json().catch(() => ({}))
    if (!resposta.ok) return { ok: false, mensagem: traduzir({ message: String(corpo.detail ?? '') }, String(corpo.detail ?? 'Não foi possível emitir. Tente de novo.')) }
    await atualizarLocal(id, 'issued', corpo.report_number ?? null)
    return { ok: true, mensagem: `Laudo emitido com o número ${corpo.report_number ?? ''}.`.replace(' .', '.') }
  } catch (err) {
    return { ok: false, mensagem: traduzir(err, 'Não foi possível emitir. Tente de novo.') }
  }
}

async function chamarApi(caminho: string, metodo: 'GET' | 'POST'): Promise<Response | Resultado> {
  const offline = semInternet()
  if (offline) return offline
  const { data: sessao } = await supabase.auth.getSession()
  const token = sessao.session?.access_token
  if (!token) return { ok: false, mensagem: 'Sua sessão expirou. Entre de novo.' }
  try {
    return await fetch(`${API_BASE_URL}${caminho}`, { method: metodo, headers: { Authorization: `Bearer ${token}` } })
  } catch (err) {
    return { ok: false, mensagem: traduzir(err, 'Sem conexão com o servidor. Tente de novo.') }
  }
}

/** Baixa o PDF oficial guardado no servidor (o servidor confere o SHA-256 antes de entregar). */
export async function baixarPdfOficial(id: string): Promise<Resultado & { semPdf?: boolean }> {
  const resposta = await chamarApi(`/api/sync/pdf/${id}`, 'GET')
  if (!(resposta instanceof Response)) return resposta
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => ({}))
    return { ok: false, semPdf: resposta.status === 404, mensagem: String(corpo.detail ?? 'Não foi possível baixar o PDF oficial.') }
  }
  const nome = /filename="([^"]+)"/.exec(resposta.headers.get('Content-Disposition') ?? '')?.[1] ?? 'laudo.pdf'
  const url = URL.createObjectURL(await resposta.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return { ok: true, mensagem: `PDF oficial baixado: ${nome}.` }
}

/** Gera o PDF oficial de um laudo emitido que ficou sem PDF (revisor). */
export async function gerarPdfOficial(id: string): Promise<Resultado> {
  const resposta = await chamarApi(`/api/sync/pdf/${id}/gerar`, 'POST')
  if (!(resposta instanceof Response)) return resposta
  const corpo = await resposta.json().catch(() => ({}))
  if (!resposta.ok) return { ok: false, mensagem: String(corpo.detail ?? 'Não foi possível gerar o PDF oficial.') }
  return { ok: true, mensagem: 'PDF oficial gerado. Agora é só baixar.' }
}

export async function novaRevisao(id: string): Promise<Resultado> {
  const offline = semInternet()
  if (offline) return offline
  const { data, error } = await supabase.rpc('create_report_revision', { p_report_id: id })
  if (error) return { ok: false, mensagem: traduzir(error, 'Não foi possível criar a nova revisão. Tente de novo.') }
  await syncManager.syncNow()
  return { ok: true, novoId: data as string, mensagem: 'Nova revisão criada como rascunho. Ela aparece na lista de laudos.' }
}
