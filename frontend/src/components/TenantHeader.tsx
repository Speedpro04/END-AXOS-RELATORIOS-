import React, { useState, useEffect } from 'react'
import type { TenantProfile } from '../types/tenant'
import { useTheme } from '../contexts/ThemeContext'

interface TenantHeaderProps {
  tenant: TenantProfile
  onUpdateTenant: (updated: TenantProfile) => void
  isOnline: boolean
  offlineQueueCount: number
  onLogout?: () => void
}

export const TenantHeader: React.FC<TenantHeaderProps> = ({
  tenant,
  onUpdateTenant,
  isOnline,
  offlineQueueCount,
  onLogout,
}) => {
  const { theme, toggleTheme } = useTheme()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState<TenantProfile>(tenant)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const tick = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(tick)
  }, [])

  const timeStr = currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = currentTime.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, logoUrl: reader.result as string }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    onUpdateTenant(formData)
    setIsModalOpen(false)
  }

  const logoScale = tenant.logoScale || 100
  const scaleRatio = logoScale / 100

  return (
    <header className="w-full select-none sticky top-0 z-40" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif" }}>

      {/* ── STATUS BAR FINA ── */}
      <div style={{ background: 'var(--topbar-bg)', padding: '6px 0', transition: 'background 0.2s ease' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '14px', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--topbar-brand)', textTransform: 'uppercase' }}>
            AXOS&nbsp;RELATÓRIOS&nbsp;·&nbsp;v2.4
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="animate-pulse-dot" style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: isOnline ? '#10b981' : '#f59e0b' }} />
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '14px', color: isOnline ? '#34d399' : '#fbbf24', fontWeight: 500, transition: 'color 0.2s ease' }}>
                {isOnline ? 'Online' : `Offline [${offlineQueueCount}]`}
              </span>
            </div>
            <span style={{ color: 'var(--topbar-divider)' }}>·</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '14px', color: 'var(--topbar-muted)' }}>
              {dateStr}&nbsp;<span style={{ color: 'var(--topbar-time)', fontWeight: 600 }}>{timeStr}</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── BARRA PRINCIPAL DA EMPRESA ── */}
      <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(15,23,42,0.06)', transition: 'background 0.2s ease, border-color 0.2s ease' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px' }}>

          {/* Esquerda: Logo + Identidade */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', minWidth: 0 }}>
            
            {/* Logo ou sigla com Escala Dinâmica - Card Quadrado (Aspect Ratio 1:1) */}
            {tenant.logoUrl ? (
              <div
                style={{
                  flexShrink: 0,
                  width: `${Math.round(48 * scaleRatio)}px`,
                  height: `${Math.round(48 * scaleRatio)}px`,
                  minWidth: '42px',
                  minHeight: '42px',
                  aspectRatio: '1 / 1',
                  background: 'var(--bg-surface-alt)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  padding: '4px',
                  boxSizing: 'border-box',
                  transition: 'all 0.2s ease',
                }}
              >
                <img
                  src={tenant.logoUrl}
                  alt={tenant.tradeName}
                  style={{
                    maxHeight: '100%',
                    maxWidth: '100%',
                    objectFit: 'contain',
                    transition: 'all 0.15s ease',
                  }}
                />
              </div>
            ) : (
              <div
                style={{
                  flexShrink: 0,
                  width: `${Math.round(48 * scaleRatio)}px`,
                  height: `${Math.round(48 * scaleRatio)}px`,
                  minWidth: '42px',
                  minHeight: '42px',
                  aspectRatio: '1 / 1',
                  background: 'var(--btn-pri-bg)',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif",
                  fontSize: `${Math.round(20 * scaleRatio)}px`,
                  fontWeight: 600,
                  color: '#ffffff',
                  letterSpacing: '-0.02em',
                  transition: 'all 0.2s ease',
                }}
              >
                {tenant.tradeName.split(' ').slice(0, 2).map(w => w[0]).join('')}
              </div>
            )}

            {/* Separador vertical */}
            <div style={{ width: '1px', height: '40px', background: 'var(--border)', flexShrink: 0 }} />

            {/* Nome e metadados */}
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif", fontSize: '21px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 3px 0', letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {tenant.tradeName}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '15px', color: 'var(--text-muted)' }}>{tenant.operationalUnit}</span>
                <span style={{ color: 'var(--border)' }}>·</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '14px', color: 'var(--text-faint)' }}>{tenant.cnpj}</span>
                <span style={{ color: 'var(--border)' }}>·</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '14px', color: 'var(--text-faint)' }}>{tenant.contractRef}</span>
              </div>
            </div>
          </div>

          {/* Direita: Ações */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {/* Botão de Toggle Dark/Light */}
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '40px', height: '40px',
                background: 'var(--bg-surface-alt)',
                border: '1px solid var(--border)',
                borderRadius: '3px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                color: 'var(--text-muted)',
                fontSize: '18px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              {theme === 'dark' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={() => { setFormData({ ...tenant, logoScale: tenant.logoScale ?? 100 }); setIsModalOpen(true) }}
              style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 16px', background: 'var(--bg-surface-alt)', border: '1px solid var(--border)', borderRadius: '3px', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif", fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              Configurações
            </button>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                style={{ padding: '8px 16px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '3px', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif", fontSize: '15px', fontWeight: 600, color: '#ef4444', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.14)'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)' }}
              >
                Sair
              </button>
            )}
          </div>

        </div>
      </div>



      {/* ── MODAL DE CONFIGURAÇÃO (Clean White) ── */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--modal-overlay)',
          backdropFilter: 'blur(4px)',
          padding: '16px',
        }}>
          <div
            className="animate-slide-up"
            style={{
              background: 'var(--modal-bg)',
              border: '1px solid var(--border)',
              borderRadius: '3px',
              width: '100%',
              maxWidth: '580px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header do modal */}
            <div style={{
              background: 'var(--modal-header-bg)',
              borderBottom: '1px solid var(--border)',
              padding: '16px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Dados Oficiais da Empresa
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>
                  Esses dados aparecem no cabeçalho e nos laudos emitidos
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: '18px', lineHeight: 1, padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Conteúdo do modal */}
            <form onSubmit={handleSave} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>

              {/* Upload de Logo + Dispositivo de Zoom */}
              <div style={{ padding: '16px', background: 'var(--bg-surface-alt)', border: '1px solid var(--border)', borderRadius: '3px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    Logotipo da Empresa
                  </label>
                  {formData.logoUrl && (
                    <button
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, logoUrl: '' }))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '12px', fontWeight: 600 }}
                    >
                      Remover Imagem
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {/* Caixa de Visualização da Logo com Escala Aplicada - Card Quadrado */}
                  <div style={{
                    width: '64px', height: '64px', minWidth: '64px', minHeight: '64px',
                    aspectRatio: '1 / 1',
                    background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: '6px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '6px',
                    boxSizing: 'border-box',
                  }}>
                    {formData.logoUrl ? (
                      <img
                        src={formData.logoUrl}
                        alt="Logo Preview"
                        style={{
                          maxHeight: '100%',
                          maxWidth: '100%',
                          objectFit: 'contain',
                          transform: `scale(${((formData.logoScale ?? 100) / 100)})`,
                          transition: 'transform 0.15s ease',
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-faint)' }}>SEM LOGO</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label className="btn-industrial" style={{ padding: '8px 14px', borderRadius: '3px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      {formData.logoUrl ? 'Substituir Imagem' : 'Carregar Imagem'}
                      <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                    </label>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Formatos: PNG, SVG ou JPG (fundo transparente recomendado)</span>
                  </div>
                </div>

                {/* ── DISPOSITIVO DE AUMENTAR E DIMINUIR A LOGO (ZOOM & ESCALA) ── */}
                <div style={{
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        <line x1="11" y1="8" x2="11" y2="14"></line>
                        <line x1="8" y1="11" x2="14" y2="11"></line>
                      </svg>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        Dispositivo de Escala da Logo (Zoom)
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--accent)',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        padding: '2px 8px',
                        borderRadius: '3px',
                      }}>
                        {formData.logoScale ?? 100}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setFormData((p) => ({ ...p, logoScale: 100 }))}
                        title="Redefinir escala para 100%"
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        Padrão
                      </button>
                    </div>
                  </div>

                  {/* Barra de Controle: Botão [-], Slider, Botão [+] */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, logoScale: Math.max(50, (p.logoScale ?? 100) - 10) }))}
                      title="Diminuir tamanho da logo (-10%)"
                      className="btn-industrial"
                      style={{
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        fontWeight: 700,
                        padding: 0,
                        borderRadius: '3px',
                        cursor: 'pointer',
                      }}
                    >
                      −
                    </button>

                    <input
                      type="range"
                      min="50"
                      max="200"
                      step="5"
                      value={formData.logoScale ?? 100}
                      onChange={(e) => setFormData((p) => ({ ...p, logoScale: Number(e.target.value) }))}
                      style={{
                        flex: 1,
                        accentColor: 'var(--accent)',
                        cursor: 'pointer',
                        height: '6px',
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, logoScale: Math.min(200, (p.logoScale ?? 100) + 10) }))}
                      title="Aumentar tamanho da logo (+10%)"
                      className="btn-industrial"
                      style={{
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        fontWeight: 700,
                        padding: 0,
                        borderRadius: '3px',
                        cursor: 'pointer',
                      }}
                    >
                      +
                    </button>
                  </div>

                  {/* Atalhos Rápidos de Zoom */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>Predefinições:</span>
                    {[
                      { label: '70% Compacto', val: 70 },
                      { label: '100% Padrão', val: 100 },
                      { label: '130% Médio', val: 130 },
                      { label: '160% Grande', val: 160 },
                      { label: '200% Máximo', val: 200 },
                    ].map((preset) => (
                      <button
                        key={preset.val}
                        type="button"
                        onClick={() => setFormData((p) => ({ ...p, logoScale: preset.val }))}
                        style={{
                          padding: '2px 8px',
                          fontSize: '11px',
                          fontFamily: "'DM Mono', monospace",
                          fontWeight: (formData.logoScale ?? 100) === preset.val ? 700 : 500,
                          background: (formData.logoScale ?? 100) === preset.val ? 'var(--accent)' : 'var(--bg-surface)',
                          color: (formData.logoScale ?? 100) === preset.val ? '#ffffff' : 'var(--text-secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Grade de campos */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[
                  { label: 'Nome Fantasia', key: 'tradeName', fullWidth: false, mono: false },
                  { label: 'CNPJ', key: 'cnpj', fullWidth: false, mono: true },
                  { label: 'Razão Social', key: 'name', fullWidth: true, mono: false },
                  { label: 'Registro CREA/CRQ', key: 'creaRegister', fullWidth: false, mono: false },
                  { label: 'Unidade Operacional', key: 'operationalUnit', fullWidth: false, mono: false },
                  { label: 'Telefone de Contato', key: 'contactPhone', fullWidth: false, mono: true },
                  { label: 'E-mail Comercial', key: 'contactEmail', fullWidth: false, mono: false },
                ].map((field) => (
                  <div key={field.key} style={{ gridColumn: field.fullWidth ? 'span 2' : undefined }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      {field.label}
                    </label>
                    <input
                      type={field.key === 'contactEmail' ? 'email' : 'text'}
                      required={['tradeName', 'cnpj', 'name'].includes(field.key)}
                      value={(formData as unknown as Record<string, string>)[field.key] || ''}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      className="input-clean"
                      style={{
                        width: '100%',
                        fontSize: '13px',
                        fontFamily: field.mono ? "'DM Mono', monospace" : "'Plus Jakarta Sans', system-ui, sans-serif",
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Ações */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-industrial"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary-action"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  )
}
