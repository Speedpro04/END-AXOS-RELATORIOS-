// src/services/dbDexie.ts
import Dexie, { type Table } from 'dexie';
import type { AnexoMeta } from './anexos';
import type { LocalReport, OutboxItem, TenantConfig } from '../types/sync';
import type { Client, Site, WorkOrder } from '../types/os';

/** Registro completo armazenado no IndexedDB para anexos */
export interface AnexoRecord {
  meta: AnexoMeta;
  blob: Blob;
}

/**
 * Classe Dexie que representa o banco de dados local (offline-first).
 * Nome: "axos" (único banco para todas as stores).
 * Versão 1: anexos, reports, outbox, clients, sites, workOrders, qualifications, instruments, tenantConfig.
 *
 * Estratégia de migração do localStorage:
 * - Na primeira abertura da versão 2, dados em axos_reports_list e axos_reports
 *   são lidos e gravados na tabela reports.
 * - Depois, as chaves antigas são removidas.
 */
export class AxosDB extends Dexie {
  /** Stores tipadas */
  anexos!: Table<AnexoRecord, string>;
  reports!: Table<LocalReport, string>;
  outbox!: Table<OutboxItem, string>;
  clients!: Table<Client, string>;
  sites!: Table<Site, string>;
  workOrders!: Table<WorkOrder, string>;
  qualifications!: Table<any, string>;
  instruments!: Table<any, string>;
  tenantConfig!: Table<TenantConfig, string>;

  constructor() {
    super('axos');
    this.version(1).stores({
      anexos: 'meta.id, meta.laudoId',
      reports: 'id, tenantId, localStatus, serverStatus, updatedAt',
      outbox: 'id, entity, entityId, createdAt, attempts',
      clients: 'id, tenantId, active, needs_review',
      sites: 'id, tenantId, clientId, situation',
      workOrders: 'id, tenantId, clientId, siteId, code',
      qualifications: 'id, tenantId, userId',
      instruments: 'id, tenantId, calibrationValidUntil',
      tenantConfig: 'id',
    });
  }

  /** Migração única de dados do localStorage para Dexie */
  async migrateFromLocalStorage(): Promise<void> {
    const reportsKey = 'axos_reports_list';
    const anexosKey = 'axos_reports';

    const saved = localStorage.getItem(reportsKey);
    if (!saved) return;

    try {
      const reports: LocalReport[] = JSON.parse(saved);
      if (!Array.isArray(reports) || reports.length === 0) return;

      // Converte formato antigo (InspectionReport flat) para LocalReport
      const toInsert: LocalReport[] = reports.map((r: any) => ({
        id: r.id,
        tenantId: r.tenantId || '',
        method: r.method || '',
        workOrderId: r.workOrderId || null,
        data: r,
        verdict: r.verdict || null,
        localStatus: 'rascunho',
        serverStatus: r.serverStatus || null,
        clientRevision: r.clientRevision || 0,
        serverRevision: r.serverRevision || null,
        reportNumber: r.reportNumber || null,
        updatedAt: r.updatedAt || new Date().toISOString(),
        lastSyncAt: null,
        lastError: null,
      }));

      await this.transaction('rw', this.reports, async () => {
        await this.reports.bulkPut(toInsert);
      });

      // Remove chaves antigas do localStorage após confirmação de gravação
      localStorage.removeItem(reportsKey);
      localStorage.removeItem(anexosKey);
    } catch (err) {
      console.error('[Dexie] Falha na migração do localStorage:', err);
      throw err;
    }
  }
}

/** Instância única a ser importada pelos serviços */
export const db = new AxosDB();