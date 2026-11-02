import React, { useState, useEffect } from 'react'
import { ArrowLeft, FileText, Search, Clock, Printer } from 'lucide-react'
import { InspectionTable } from '../components/InspectionTable'
import type { InspectionReport } from '../types/inspection'
import { useAuth } from '../contexts/AuthContext'

interface HistoricoPageProps {
  onBack: () => void
  tenant: { tradeName?: string | null; reportPrefix?: string | null }
  tenantName: string | null
}

export const HistoricoPage: React.FC<HistoricoPageProps> = ({ onBack, tenant, tenantName }) => {
  const { user, profile } = useAuth()
  const [reports, setReports] = useState<InspectionReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        // Tenta carregar do Dexie (offline-first)
        const { db } = await import('../services/dbDexie')
        const all = await db.reports.toArray()
        setReports(all.map((r: any) => r.data as InspectionReport))
      } catch (err) {
        console.error('[Historico] Falha ao carregar:', err)
        setReports([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleNewReport = () => {
    // Abre o modal de novo laudo via App (onNewReport é passado pelo App)
    // Aqui apenas placeholder; o App controla o modal
  }

  const handleEditReport = (report: InspectionReport) => {
    // Navega para a página do método correspondente
    // Implementado pelo App via onEditReport
  }

  const handleDeleteReport = (id: string) => {
    if (confirm('Remover permanentemente este laudo?')) {
      // Implementado pelo App
    }
  }

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 32px', minHeight: 'calc(100vh - 200px)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', borderRadius: '5px', border: '1px solid var(--border)',
            background: 'var(--bg-surface)', color: 'var(--text-primary)',
            fontFamily: 'Archivo, system-ui, sans-serif', fontSize: '14px', fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={16} strokeWidth={1.75} /> Voltar ao Catálogo
        </button>
        <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-surface-alt)', padding: '2px 8px', borderRadius: '5px' }}>
          REGISTRO CENTRAL
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 600, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          Histórico e Registro Central de Laudos
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '10px 18px', borderRadius: '5px', border: '1px solid var(--border)',
              background: 'var(--bg-surface)', color: 'var(--text-primary)',
              fontFamily: 'Archivo, system-ui, sans-serif', fontSize: '14px', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <FileText size={16} strokeWidth={1.75} /> Emitir Novo Laudo
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', color: 'var(--text-muted)', fontFamily: 'Archivo, sans-serif' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid rgba(47, 184, 214, 0.2)', borderTopColor: '#2FB8D6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '12px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ fontSize: '14px' }}>Carregando laudos...</span>
        </div>
      ) : (
        <InspectionTable
          reports={reports}
          onNewReport={handleNewReport}
          onEditReport={handleEditReport}
          onDeleteReport={handleDeleteReport}
        />
      )}
    </div>
  )
}
