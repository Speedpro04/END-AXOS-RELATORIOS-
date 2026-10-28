/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║              GERENCIADOR DE SINCRONIZAÇÃO – Axos Relatórios      ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  CONTATO PÚBLICO:                                                ║
 * ║  - SyncManager.getInstance()                                     ║
 * ║  - syncManager.syncNow()                                         ║
 * ║  - syncManager.getState()                                        ║
 * ║                                                                  ║
 * ║  DISPARO AUTOMÁTICO:                                             ║
 * ║  - Ao abrir o app logado                                         ║
 * ║  - No evento online                                              ║
 * ║  - Quando a aba volta a ficar visível                            ║
 * ║  - Botão "Sincronizar agora"                                     ║
 * ║  - A cada 60s com aba visível e conexão                          ║
 * ║                                                                  ║
 * ║  ORDEM DE ENVIO: clients → sites → work_orders → reports         ║
 * ║  LOTE: até 20 itens por requisição                               ║
 * ║  BACKOFF: 15s, 30s, 1min, 2min, até 5min (erros retryable)      ║
 * ║  NUNCA apagar dados locais após sincronizar                      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { supabase } from '../lib/supabase';
import { db } from './dbDexie';
import type { LocalReport, OutboxItem, SyncBatchResult, SyncItemResult, SyncState } from '../types/sync';
import type { Client, Site, WorkOrder } from '../types/os';

const BATCH_SIZE = 20;
const BACKOFF_DELAYS_MS = [15_000, 30_000, 60_000, 120_000, 300_000]; // 15s, 30s, 1m, 2m, 5m
const RETRYABLE_CODES = ['QUALIFICATION_EXPIRED', 'INSTRUMENT_EXPIRED', 'MISSING_REQUIRED', 'LOCKED', 'FIELD_CREATION_DISABLED', 'DUPLICATE_NUMBER', 'TEMPLATE_NOT_FOUND', 'FORBIDDEN', 'VALIDATION_ERROR'];
const RETRYABLE_PREFIXES = ['429', '500', '502', '503', '504'];
const NON_RETRYABLE_CODES = RETRYABLE_CODES;

interface QueuedItem {
  id: string;
  entity: 'client' | 'site' | 'work_order' | 'report';
  entityId: string;
  op: 'create' | 'update' | 'delete';
  attempts: number;
  lastError: string | null;
  backoffUntil: number | null; // timestamp ms
  payload: any;
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

    this.syncLock = true;
    this.setState({ isSyncing: true, lastError: null });

    try {
      const result = await this.processOutbox();
      this.setState({
        isSyncing: false,
        lastSyncAt: new Date().toISOString(),
        pendingCount: result.total - result.ok,
        canRetry: result.canRetry,
      });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido na sincronização';
      this.setState({
        isSyncing: false,
        lastError: msg,
        canRetry: true,
      });
      return null;
    } finally {
      this.syncLock = false;
    }
  }

  /* ─────────────────────────────────────────────────────────
   * Processamento do outbox
   * ───────────────────────────────────────────────────────── */
  private async processOutbox(): Promise<SyncBatchResult> {
    const allItems = await db.outbox.toArray();
    const now = Date.now();

    const pending = allItems.filter((item) => {
      if (item.backoffUntil && now < item.backoffUntil) return false;
      return true;
    });

    if (pending.length === 0) {
      return { total: 0, ok: 0, error: 0, items: [], canRetry: false };
    }

    const entityPriority: Record<string, number> = {
      client: 0,
      site: 1,
      work_order: 2,
      report: 3,
    };
    pending.sort((a, b) => (entityPriority[a.entity] ?? 99) - (entityPriority[b.entity] ?? 99) || a.createdAt.localeCompare(b.createdAt));

    const batch = pending.slice(0, BATCH_SIZE);

    const results: SyncItemResult[] = [];

    for (const item of batch) {
      try {
        const result = await this.processSingleItem(item);
        results.push(result);
      } catch (err) {
        results.push({
          entity: item.entity,
          entityId: item.entityId,
          ok: false,
          errorCode: 'UNKNOWN',
          message: err instanceof Error ? err.message : 'Erro desconhecido',
        });
      }
    }

    await this.updateOutboxAfterBatch(results, batch);

    const remaining = await db.outbox.toArray();
    const canRetry = remaining.some((item) => {
      if (!item.lastError) return false;
      return NON_RETRYABLE_CODES.every((code) => !item.lastError!.includes(code));
    });

    return {
      total: pending.length,
      ok: results.filter((r) => r.ok).length,
      error: results.filter((r) => !r.ok).length,
      items: results,
      canRetry,
    };
  }

  private async processSingleItem(item: OutboxItem): Promise<SyncItemResult> {
    const { data: session } = await supabase.auth.getSession();
    const token = (session as { access_token?: string } | null)?.access_token;
    if (!token) {
      return {
        entity: item.entity,
        entityId: item.entityId,
        ok: false,
        errorCode: 'FORBIDDEN',
        message: 'Sessão inválida: faça login novamente',
      };
    }

    switch (item.entity) {
      case 'client':
        return this.syncClient(item, token);
      case 'site':
        return this.syncSite(item, token);
      case 'work_order':
        return this.syncWorkOrder(item, token);
      case 'report':
        return this.syncReport(item, token);
      default:
        return {
          entity: item.entity,
          entityId: item.entityId,
          ok: false,
          errorCode: 'VALIDATION_ERROR',
          message: `Tipo de entidade desconhecido: ${item.entity}`,
        };
    }
  }

  /* ─────────────────────────────────────────────────────────
   * Processadores por tipo de entidade
   * ───────────────────────────────────────────────────────── */
  private async syncClient(item: OutboxItem, token: string): Promise<SyncItemResult> {
    const client = await db.clients.get(item.entityId);
    if (!client) {
      return { entity: item.entity, entityId: item.entityId, ok: false, errorCode: 'UNKNOWN', message: 'Cliente não encontrado localmente' };
    }

    try {
      const res = await supabase
        .from('clients')
        .upsert({
          id: client.id,
          tenant_id: client.tenant_id,
          legal_name: client.legal_name,
          cnpj: client.cnpj,
          address: client.address,
          contact_name: client.contact_name,
          contact_email: client.contact_email,
          contact_phone: client.contact_phone,
          active: client.active,
          created_by: client.created_by,
          created_in_field: client.created_in_field,
          needs_review: client.needs_review,
          created_at: client.created_at,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (res.error) throw res.error;

      await db.outbox.update(item.id, { attempts: item.attempts + 1, lastError: null });

      return { entity: item.entity, entityId: item.entityId, ok: true, serverId: client.id, serverRevision: item.attempts + 1 };
    } catch (err: any) {
      return this.handleOutboxError(item, err);
    }
  }

  private async syncSite(item: OutboxItem, token: string): Promise<SyncItemResult> {
    const site = await db.sites.get(item.entityId);
    if (!site) {
      return { entity: item.entity, entityId: item.entityId, ok: false, errorCode: 'UNKNOWN', message: 'Obra não encontrada localmente' };
    }

    try {
      const res = await supabase
        .from('sites')
        .upsert({
          id: site.id,
          tenant_id: site.tenant_id,
          client_id: site.client_id,
          name: site.name,
          address: site.address,
          city: site.city,
          uf: site.uf,
          contract_ref: site.contract_ref,
          situation: site.situation,
          created_by: site.created_by,
          created_in_field: site.created_in_field,
          needs_review: site.needs_review,
          created_at: site.created_at,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (res.error) throw res.error;

      await db.outbox.update(item.id, { attempts: item.attempts + 1, lastError: null });

      return { entity: item.entity, entityId: item.entityId, ok: true, serverId: site.id, serverRevision: item.attempts + 1 };
    } catch (err: any) {
      return this.handleOutboxError(item, err);
    }
  }

  private async syncWorkOrder(item: OutboxItem, token: string): Promise<SyncItemResult> {
    const wo = await db.workOrders.get(item.entityId);
    if (!wo) {
      return { entity: item.entity, entityId: item.entityId, ok: false, errorCode: 'UNKNOWN', message: 'OS não encontrada localmente' };
    }

    try {
      const res = await supabase
        .from('work_orders')
        .upsert({
          id: wo.id,
          tenant_id: wo.tenant_id,
          client_id: wo.client_id,
          code: wo.code,
          site_id: wo.site_id,
          scheduled_for: wo.scheduled_for,
          assigned_to: wo.assigned_to,
          method: wo.method,
          notes: wo.notes,
          created_by: wo.created_by,
          created_in_field: wo.created_in_field,
          needs_review: wo.needs_review,
          created_at: wo.created_at,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (res.error) throw res.error;

      await db.outbox.update(item.id, { attempts: item.attempts + 1, lastError: null });

      return { entity: item.entity, entityId: item.entityId, ok: true, serverId: wo.id, serverRevision: item.attempts + 1 };
    } catch (err: any) {
      return this.handleOutboxError(item, err);
    }
  }

  private async syncReport(item: OutboxItem, token: string): Promise<SyncItemResult> {
    const report = await db.reports.get(item.entityId);
    if (!report) {
      return { entity: item.entity, entityId: item.entityId, ok: false, errorCode: 'UNKNOWN', message: 'Laudo não encontrado localmente' };
    }

    try {
      const res = await supabase
        .from('reports')
        .upsert({
          id: report.id,
          tenant_id: report.tenantId,
          method: report.method,
          work_order_id: report.workOrderId,
          inspector_id: report.data.inspectorName ? 'current-user' : null,
          status: report.serverStatus || 'draft',
          equipment_tag: report.data.equipmentTag,
          inspection_date: report.data.date,
          technical_data: report.data.technicalData,
          administrative_data: {},
        }, { onConflict: 'id' });

      if (res.error) throw res.error;

      await db.reports.update(report.id, {
        serverStatus: report.serverStatus || 'rascunho',
        serverRevision: item.attempts + 1,
        lastSyncAt: new Date().toISOString(),
        lastError: null,
      });

      await db.outbox.update(item.id, { attempts: item.attempts + 1, lastError: null });

      return {
        entity: item.entity,
        entityId: item.entityId,
        ok: true,
        serverId: report.id,
        serverRevision: item.attempts + 1,
      };
    } catch (err: any) {
      return this.handleOutboxError(item, err);
    }
  }

  /* ─────────────────────────────────────────────────────────
   * Tratamento de erros com backoff
   * ───────────────────────────────────────────────────────── */
  private async handleOutboxError(item: OutboxItem, err: any): Promise<SyncItemResult> {
    const errorCode = err?.error?.code || err?.code || 'UNKNOWN';
    const message = err?.error?.message || err?.message || String(err);

    const attempts = item.attempts + 1;
    let backoffUntil: number | null = null;

    if (NON_RETRYABLE_CODES.includes(errorCode)) {
      backoffUntil = null;
    } else if (RETRYABLE_PREFIXES.some((p) => String(errorCode).startsWith(p)) || RETRYABLE_CODES.includes(errorCode)) {
      const delayIndex = Math.min(attempts - 1, BACKOFF_DELAYS_MS.length - 1);
      backoffUntil = Date.now() + BACKOFF_DELAYS_MS[delayIndex];
    } else {
      backoffUntil = null;
    }

    await db.outbox.update(item.id, { attempts, lastError: message, backoffUntil });

    return {
      entity: item.entity,
      entityId: item.entityId,
      ok: false,
      errorCode,
      message,
    };
  }

  private async updateOutboxAfterBatch(results: SyncItemResult[], batch: OutboxItem[]): Promise<void> {
    for (const result of results) {
      if (result.ok) {
        await db.outbox.delete(result.entityId);
      }
    }
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

  async refreshPendingCount(): Promise<void> {
    const count = await db.outbox.count();
    this.setState({ pendingCount: count });
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