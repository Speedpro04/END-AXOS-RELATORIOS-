/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║              GERENCIADOR DE SINCRONIZAÇÃO – Axos Relatórios      ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  CONTATO PÚBLICO:                                                ║
 * ║  - enqueueSync(entidade, id, operação)                           ║
 * ║  - ensureObraWorkOrder(obra, usuário)                            ║
 * ║  - syncManager.syncNow() / getState() / subscribe()              ║
 * ║                                                                  ║
 * ║  DISPARO AUTOMÁTICO:                                             ║
 * ║  - Ao abrir o app logado                                         ║
 * ║  - No evento online                                              ║
 * ║  - Quando a aba volta a ficar visível                            ║
 * ║  - A cada 60s com aba visível e conexão                          ║
 * ║  - Logo depois de salvar algo no aparelho                        ║
 * ║                                                                  ║
 * ║  ENVIO: POST /api/sync/reports, lote de até 20 itens             ║
 * ║  ORDEM: clients → sites → work_orders → escopo → reports         ║
 * ║  FOTOS: remoções antes dos laudos; envios depois deles           ║
 * ║  BACKOFF: 15s, 30s, 1min, 2min, até 5min (erros retryable)       ║
 * ║  NUNCA apagar dados locais após sincronizar                      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { API_BASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { contarFotosPendentes, enviarFotosPendentes, processarRemocoesDeFotos } from './anexos';
import { db } from './dbDexie';
import type { InspectionReport, ReportStatus } from '../types/inspection';
import type { ObraEscopoLinha, ObraEscopoRevisao } from '../types/obra';
import type { Client, Site, WorkOrder } from '../types/os';
import type { LocalReport, OutboxItem, ServerStatus, SyncBatchResult, SyncItemResult, SyncState } from '../types/sync';

const BATCH_SIZE = 20;
const BACKOFF_DELAYS_MS = [15_000, 30_000, 60_000, 120_000, 300_000]; // 15s, 30s, 1m, 2m, 5m
// Vale a pena tentar de novo sozinho: falha temporária ou dependência que ainda vai subir
const RETRYABLE_CODES = ['UNKNOWN', 'CLIENT_NOT_FOUND', 'SITE_NOT_FOUND', 'WORK_ORDER_NOT_FOUND', 'DEPENDENCY_FAILED'];
// Os demais erros esperam o usuário editar o item (enqueueSync libera de novo)
const BLOCKED_UNTIL = Number.MAX_SAFE_INTEGER;

const ENTITY_PRIORITY: Record<OutboxItem['entity'], number> = {
  client: 0,
  site: 1,
  work_order: 2,
  escopo_linha: 3,
  escopo_revisao: 4,
  report: 5,
};

const SERVER_STATUS: Record<string, ServerStatus> = {
  draft: 'rascunho',
  submitted: 'enviado',
  returned: 'returned',
  approved: 'aprovado',
  issued: 'issued',
  superseded: 'superseded',
};

const SCREEN_STATUS: Record<string, ReportStatus> = {
  draft: 'rascunho',
  submitted: 'enviado',
  returned: 'rascunho',
  approved: 'aprovado',
  issued: 'issued',
  superseded: 'issued',
};

interface ServerItemResult {
  client_id: string;
  ok: boolean;
  server_revision?: number | null;
  error_code?: string | null;
  message?: string | null;
  workflow_status?: string | null;
  report_number?: string | null;
}

function backoffFor(attempts: number): number {
  return Date.now() + BACKOFF_DELAYS_MS[Math.min(attempts - 1, BACKOFF_DELAYS_MS.length - 1)];
}

/** Monta o item do contrato de sincronização a partir do que está no aparelho. */
async function buildPayload(item: OutboxItem): Promise<Record<string, unknown> | null | undefined> {
  const base = { client_id: item.entityId, client_revision: item.attempts + 1 };

  switch (item.entity) {
    case 'client': {
      const c = await db.clients.get(item.entityId);
      return c && {
        ...base,
        legal_name: c.legal_name,
        cnpj: c.cnpj,
        address: c.address,
        contact_name: c.contact_name,
        contact_email: c.contact_email,
        contact_phone: c.contact_phone,
        active: c.active,
      };
    }
    case 'site': {
      const s = await db.sites.get(item.entityId);
      return s && {
        ...base,
        contratante_id: s.client_id,
        name: s.name,
        address: s.address,
        city: s.city,
        uf: s.uf,
        contract_ref: s.contract_ref,
        situation: s.situation,
      };
    }
    case 'work_order': {
      const w = await db.workOrders.get(item.entityId);
      return w && {
        ...base,
        contratante_id: w.client_id,
        code: w.code,
        site_id: w.site_id ?? null,
        scheduled_for: w.scheduled_for,
        assigned_to: w.assigned_to,
        method: w.method,
        notes: w.notes,
      };
    }
    case 'escopo_linha': {
      const l = await db.obraEscopoLinhas.get(item.entityId);
      return l && {
        ...base,
        site_id: l.site_id,
        method: l.method,
        unidade: l.unidade,
        quantidade_prevista: l.quantidade_prevista,
        referencia_tag: l.referencia_tag,
        ativo: l.ativo,
      };
    }
    case 'escopo_revisao': {
      const r = await db.obraEscopoRevisoes.get(item.entityId);
      return r && {
        ...base,
        linha_id: r.linha_id,
        quantidade_anterior: r.quantidade_anterior,
        quantidade_nova: r.quantidade_nova,
        motivo: r.motivo,
      };
    }
    case 'report': {
      if (item.op === 'delete') return { ...base, deleted: true };
      const report = await db.reports.get(item.entityId);
      if (!report) return null;
      const { technicalData, linhaId, quantidadeInspecionada = 0, quantidadeAprovada = 0, quantidadeReprovada = 0, ...laudo } = report.data;
      const vinculoValido = linhaId && quantidadeInspecionada > 0 && quantidadeAprovada + quantidadeReprovada === quantidadeInspecionada;
      return {
        client_id: report.id,
        client_revision: report.clientRevision,
        method: report.method,
        work_order_id: report.workOrderId,
        equipment_tag: report.data.equipmentTag,
        inspection_date: report.data.date,
        technical_data: { ...technicalData, veredito: report.verdict },
        administrative_data: { laudo },
        vinculo: vinculoValido
          ? {
              linha_id: linhaId,
              quantidade_inspecionada: quantidadeInspecionada,
              quantidade_aprovada: quantidadeAprovada,
              quantidade_reprovada: quantidadeReprovada,
            }
          : null,
      };
    }
  }
}

class SyncManager {
  private state: SyncState = {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncAt: null,
    lastError: null,
    canRetry: false,
  };
  private listeners: Array<(state: SyncState) => void> = [];
  private syncTimer: number | null = null;
  private syncLock = false;
  private lastReportPullAt: string | null = null;

  constructor() {
    this.setupListeners();
    this.setupPeriodicSync();
  }

  /* ─────────────────────────────────────────────────────────
   * Listeners de rede e visibilidade
   * ───────────────────────────────────────────────────────── */
  private setupListeners(): void {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
  }

  private handleOnline(): void {
    this.setState({ isOnline: true });
    this.syncNow();
  }

  private handleOffline(): void {
    this.setState({ isOnline: false });
  }

  private handleVisibilityChange(): void {
    if (document.visibilityState === 'visible' && this.state.isOnline) {
      this.syncNow();
    }
  }

  /* ─────────────────────────────────────────────────────────
   * Sincronização periódica (60s)
   * ───────────────────────────────────────────────────────── */
  private setupPeriodicSync(): void {
    if (typeof setInterval === 'undefined') return;
    this.syncTimer = window.setInterval(() => {
      if (this.state.isOnline && !this.state.isSyncing && document.visibilityState === 'visible') {
        this.syncNow();
      }
    }, 60_000);
  }

  /* ─────────────────────────────────────────────────────────
   * API pública
   * ───────────────────────────────────────────────────────── */
  static instance: SyncManager | null = null;

  static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  getState(): SyncState {
    return { ...this.state };
  }

  async syncNow(): Promise<SyncBatchResult | null> {
    if (this.syncLock) return null;
    if (!this.state.isOnline) {
      this.setState({ lastError: 'Offline: sincronização só ocorre com conexão ativa' });
      return null;
    }

    // Sem sessão real do Supabase não há o que enviar; a fila continua guardada no aparelho
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;

    this.syncLock = true;
    this.setState({ isSyncing: true, lastError: null });

    try {
      await processarRemocoesDeFotos();
      const result = await this.processOutbox(token);
      await this.refreshCache();
      await enviarFotosPendentes();
      this.setState({
        isSyncing: false,
        lastSyncAt: new Date().toISOString(),
        pendingCount: await this.contarPendentes(),
        canRetry: result.canRetry,
      });
      return result;
    } catch (err) {
      // Rede fora ou servidor indisponível contam como offline: a fila espera o backoff
      console.error('[Sync] Falha na sincronização:', err);
      await enviarFotosPendentes(); // falha da API não segura fotos de laudos que já estão no servidor
      this.setState({
        isSyncing: false,
        pendingCount: await this.contarPendentes(),
        lastError: 'Servidor indisponível. Nova tentativa será feita.',
        canRetry: true,
      });
      return null;
    } finally {
      this.syncLock = false;
    }
  }

  /* ─────────────────────────────────────────────────────────
   * Envio da fila
   * ───────────────────────────────────────────────────────── */
  private async processOutbox(token: string): Promise<SyncBatchResult> {
    const total: SyncBatchResult = { total: 0, ok: 0, error: 0, items: [], canRetry: false };

    for (;;) {
      const now = Date.now();
      const pending = (await db.outbox.toArray())
        .filter((item) => !item.backoffUntil || now >= item.backoffUntil)
        .sort((a, b) => ENTITY_PRIORITY[a.entity] - ENTITY_PRIORITY[b.entity] || a.createdAt.localeCompare(b.createdAt));
      if (pending.length === 0) return total;

      const batch = pending.slice(0, BATCH_SIZE);
      const sent: Array<{ item: OutboxItem; payload: Record<string, unknown> }> = [];
      for (const item of batch) {
        const payload = await buildPayload(item);
        if (payload) {
          sent.push({ item, payload });
        } else {
          await db.outbox.delete(item.id); // o registro local não existe mais: nada a enviar
        }
      }
      if (sent.length === 0) continue;

      let response: Response;
      try {
        response = await fetch(`${API_BASE_URL}/api/sync/reports`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ items: sent.map((s) => s.payload) }),
        });
        if (!response.ok) throw new Error(`Resposta ${response.status} do servidor`);
      } catch (err) {
        for (const { item } of sent) {
          const attempts = item.attempts + 1;
          await db.outbox.update(item.id, { attempts, backoffUntil: backoffFor(attempts) });
        }
        throw err;
      }

      const { items } = (await response.json()) as { items: ServerItemResult[] };
      for (let i = 0; i < sent.length; i++) {
        const result = await this.applyResult(sent[i].item, sent[i].payload, items[i]);
        total.items.push(result);
        total.total += 1;
        if (result.ok) total.ok += 1;
        else total.error += 1;
      }
      total.canRetry = (await db.outbox.toArray()).some((item) => item.backoffUntil !== BLOCKED_UNTIL);
    }
  }

  private async applyResult(item: OutboxItem, payload: Record<string, unknown>, res: ServerItemResult): Promise<SyncItemResult> {
    const report = item.entity === 'report' && item.op !== 'delete' ? await db.reports.get(item.entityId) : undefined;

    if (res.ok) {
      // Editado enquanto o envio estava no ar: mantém na fila para subir a versão nova
      const editedMeanwhile = report && report.clientRevision > (payload.client_revision as number);
      if (!editedMeanwhile) await db.outbox.delete(item.id);

      if (report) {
        const workflow = res.workflow_status ?? 'draft';
        const reportNumber = res.report_number ?? report.reportNumber;
        await db.reports.update(report.id, {
          serverStatus: SERVER_STATUS[workflow],
          serverRevision: res.server_revision ?? null,
          reportNumber,
          localStatus: editedMeanwhile ? report.localStatus : 'sincronizado',
          lastSyncAt: new Date().toISOString(),
          lastError: null,
          data: { ...report.data, status: SCREEN_STATUS[workflow], code: reportNumber ?? report.data.code },
        });
      }
      return { entity: item.entity, entityId: item.entityId, ok: true, serverId: item.entityId, serverRevision: res.server_revision ?? undefined };
    }

    const errorCode = res.error_code ?? 'UNKNOWN';
    const message = res.message ?? 'Erro ao sincronizar';
    const attempts = item.attempts + 1;
    await db.outbox.update(item.id, {
      attempts,
      lastError: `${errorCode}: ${message}`,
      backoffUntil: RETRYABLE_CODES.includes(errorCode) ? backoffFor(attempts) : BLOCKED_UNTIL,
    });
    if (report) {
      await db.reports.update(report.id, { localStatus: 'erro', lastError: { code: errorCode, message } });
    }
    return { entity: item.entity, entityId: item.entityId, ok: false, errorCode, message };
  }

  /* ─────────────────────────────────────────────────────────
   * Atualização do cache local (RLS limita ao que o usuário pode ver)
   * ───────────────────────────────────────────────────────── */
  private async refreshCache(): Promise<void> {
    const pendentes = new Set((await db.outbox.toArray()).map((item) => item.entityId));
    const semPendentes = <T extends { id: string }>(rows: T[] | null): T[] => (rows ?? []).filter((r) => !pendentes.has(r.id));

    const [clients, sites, workOrders, linhas, revisoes] = await Promise.all([
      supabase.from('clients').select('*'),
      supabase.from('sites').select('*'),
      supabase.from('work_orders').select('*'),
      supabase.from('obra_escopo_linha').select('*'),
      supabase.from('obra_escopo_revisao').select('*'),
    ]);
    await db.clients.bulkPut(semPendentes(clients.data as Client[] | null));
    await db.sites.bulkPut(semPendentes(sites.data as Site[] | null));
    await db.workOrders.bulkPut(semPendentes(workOrders.data as WorkOrder[] | null));
    await db.obraEscopoLinhas.bulkPut(semPendentes(linhas.data as ObraEscopoLinha[] | null));
    await db.obraEscopoRevisoes.bulkPut(semPendentes(revisoes.data as ObraEscopoRevisao[] | null));

    // Laudos: só o que mudou no servidor desde a última leitura
    const inicio = new Date().toISOString();
    let query = supabase.from('reports').select('id, tenant_id, status, report_number, client_revision, work_order_id, technical_data, administrative_data');
    if (this.lastReportPullAt) query = query.gt('updated_at', this.lastReportPullAt);
    const { data: rows, error } = await query;
    if (error) return;

    for (const row of rows ?? []) {
      if (pendentes.has(row.id)) continue;
      const local = await db.reports.get(row.id);
      const laudo = (row.administrative_data as { laudo?: InspectionReport } | null)?.laudo;
      if (local && row.client_revision < local.clientRevision) continue;
      if (!local && !laudo) continue;

      const data = { ...(local?.data ?? laudo!), id: row.id, status: SCREEN_STATUS[row.status], code: row.report_number ?? local?.data.code ?? 'RASCUNHO' };
      const verdict = (row.technical_data as { veredito?: LocalReport['verdict'] } | null)?.veredito ?? local?.verdict ?? null;
      await db.reports.put({
        id: row.id,
        tenantId: row.tenant_id,
        method: data.method,
        workOrderId: row.work_order_id,
        data: local ? data : { ...data, technicalData: row.technical_data },
        verdict,
        localStatus: 'sincronizado',
        serverStatus: SERVER_STATUS[row.status],
        clientRevision: row.client_revision,
        serverRevision: row.client_revision,
        reportNumber: row.report_number,
        updatedAt: local?.updatedAt ?? inicio,
        lastSyncAt: inicio,
        lastError: null,
      });
    }
    this.lastReportPullAt = inicio;
  }

  /* ─────────────────────────────────────────────────────────
   * Helpers de estado
   * ───────────────────────────────────────────────────────── */
  private setState(partial: Partial<SyncState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((fn) => fn(this.state));
  }

  subscribe(callback: (state: SyncState) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((fn) => fn !== callback);
    };
  }

  private async contarPendentes(): Promise<number> {
    return (await db.outbox.count()) + (await contarFotosPendentes());
  }

  async refreshPendingCount(): Promise<void> {
    this.setState({ pendingCount: await this.contarPendentes() });
  }

  destroy(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    this.listeners = [];
  }
}

export const syncManager = SyncManager.getInstance();
export default syncManager;

/**
 * Coloca um registro local na fila de envio. Se ele já está na fila, libera
 * de novo (uma edição é o que destrava um erro não retryable).
 */
export async function enqueueSync(entity: OutboxItem['entity'], entityId: string, op: OutboxItem['op'] = 'create'): Promise<void> {
  const existing = await db.outbox.where('entityId').equals(entityId).first();
  if (existing) {
    await db.outbox.update(existing.id, { op, attempts: 0, lastError: null, backoffUntil: null });
  } else {
    await db.outbox.add({
      id: crypto.randomUUID(),
      entity,
      entityId,
      op,
      createdAt: new Date().toISOString(),
      attempts: 0,
      lastError: null,
      backoffUntil: null,
    });
  }
  await syncManager.refreshPendingCount();
  void syncManager.syncNow();
}

/**
 * Todo laudo no servidor pertence a uma OS. Enquanto a tela de OS não entra no
 * fluxo, cada inspetor tem uma OS própria por obra, criada aqui uma única vez.
 */
export async function ensureObraWorkOrder(obra: Site, userId: string): Promise<string> {
  const todas = await db.workOrders.toArray();
  const existente = todas.find((w) => w.site_id === obra.id && w.assigned_to === userId);
  if (existente) return existente.id;

  const agora = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.workOrders.put({
    id,
    tenant_id: obra.tenant_id,
    client_id: obra.client_id,
    code: `OS-${obra.id.slice(0, 8)}-${userId.slice(0, 8)}`.toUpperCase(),
    site_id: obra.id,
    assigned_to: userId,
    created_by: userId,
    created_in_field: false,
    needs_review: false,
    created_at: agora,
    updated_at: agora,
  });
  await enqueueSync('work_order', id);
  return id;
}
