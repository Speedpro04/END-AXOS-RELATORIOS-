export type SiteSituation = 'active' | 'concluded' | 'cancelled'

export interface Client {
  id: string
  tenant_id: string
  legal_name: string
  cnpj?: string | null
  address?: string | null
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  active: boolean
  created_by: string
  created_in_field: boolean
  needs_review: boolean
  created_at: string
  updated_at: string
}

export interface Site {
  id: string
  tenant_id: string
  client_id: string
  name: string
  address?: string | null
  city?: string | null
  uf?: string | null
  contract_ref?: string | null
  situation: SiteSituation
  created_by: string
  created_in_field: boolean
  needs_review: boolean
  created_at: string
  updated_at: string
}

export interface WorkOrder {
  id: string
  tenant_id: string
  client_id: string
  code: string
  site?: string | null
  site_id?: string | null
  scheduled_for?: string | null
  assigned_to?: string | null
  method?: string | null
  notes?: string | null
  created_by: string
  created_in_field: boolean
  needs_review: boolean
  created_at: string
  updated_at: string
}

export interface SyncClientItem {
  client_id: string
  client_revision: number
  legal_name: string
  cnpj?: string | null
  address?: string | null
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  active?: boolean
}

export interface SyncSiteItem {
  client_id: string
  client_revision: number
  name: string
  address?: string | null
  city?: string | null
  uf?: string | null
  contract_ref?: string | null
  situation?: SiteSituation
}

export interface SyncWorkOrderItem {
  client_id: string
  client_revision: number
  client_name?: string | null
  code: string
  site_id?: string | null
  scheduled_for?: string | null
  assigned_to?: string | null
  method?: string | null
  notes?: string | null
}

export interface SyncItemResponse {
  client_id: string
  ok: boolean
  server_id?: string
  server_revision?: number
  error_code?: string
  message?: string
}

export interface SyncBatchResponse {
  clients: SyncItemResponse[]
  sites: SyncItemResponse[]
  work_orders: SyncItemResponse[]
  reports: SyncItemResponse[]
}
