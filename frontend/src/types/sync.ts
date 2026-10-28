import type { Client, Site, WorkOrder } from './os'
import type { InspectionReport, ReportStatus } from './inspection'

/**
 * Tipos para sincronização offline-first (Tarefa E).
 * Conforme AXOS-OPENCODE-AGENTS.md e TAREFAS.md (Tarefa E).
 */

/**
 * Estados locais do laudo.
 * rascunho: salvo localmente, não finalizado
 * pronto: finalizado pelo inspetor, aguardando envio
 * enviando: sincronização em andamento
 * sincronizado: confirmado pelo servidor
 * erro: falha na sincronização (ver lastError)
 */
export type LocalStatus = 'rascunho' | 'pronto' | 'enviando' | 'sincronizado' | 'erro'

/**
 * Status do servidor (workflow).
 * draft → submitted → (returned → submitted)* → approved → issued → superseded
 * O cliente nunca envia approved nem issued.
 */
export type ServerStatus = ReportStatus | 'enviando' | 'sincronizado' | 'erro'

/**
 * Registro local de um laudo no Dexie (tabela reports).
 * O id é UUID gerado no cliente (crypto.randomUUID) para idempotência offline.
 */
export interface LocalReport {
  id: string                 // UUID gerado no aparelho
  tenantId: string
  method: string
  workOrderId?: string | null
  data: InspectionReport     // conteúdo completo do formulário
  verdict: 'A' | 'R' | 'NEC' | 'AC' | null  // veredito do inspetor
  localStatus: LocalStatus
  serverStatus: ServerStatus | null
  clientRevision: number
  serverRevision: number | null
  reportNumber: string | null  // definitivo, só depois da emissão
  updatedAt: string            // ISO 8601
  lastSyncAt: string | null
  lastError: { code: string; message: string } | null
}

/**
 * Item da fila de pendências (outbox).
 * Cada entidade criada localmente é enfileirada para sincronização.
 */
export interface OutboxItem {
  id: string             // UUID gerado no cliente
  entity: 'client' | 'site' | 'work_order' | 'report'
  entityId: string       // UUID da entidade (mesmo do id para reports, UUID próprio para outras)
  op: 'create' | 'update' | 'delete'
  createdAt: string      // ISO 8601
  attempts: number
  lastError: string | null
  backoffUntil: number | null   // timestamp ms até quando aguardar antes de retry
}

/**
 * Configuração do tenant (cache local para uso offline).
 */
export interface TenantConfig {
  id: string
  reportPrefix: string
  legalName?: string | null
  tradeName?: string | null
  cnpj?: string | null
  allowFieldCreation?: boolean
  logoUrl?: string | null
  logoPath?: string | null
  logoSha256?: string | null
}

/**
 * Resultado de sincronização de um item.
 */
export interface SyncItemResult {
  entity: 'client' | 'site' | 'work_order' | 'report'
  entityId: string
  ok: boolean
  serverId?: string
  serverRevision?: number
  errorCode?: string
  message?: string
}

/**
 * Resultado de um lote de sincronização.
 */
export interface SyncBatchResult {
  total: number
  ok: number
  error: number
  items: SyncItemResult[]
  canRetry: boolean  // true se há erros retryable que podem ser reenviados
}

/**
 * Estado global da sincronização.
 */
export interface SyncState {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number   // itens no outbox
  lastSyncAt: string | null
  lastError: string | null
  canRetry: boolean
}