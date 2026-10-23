import React, { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import type { TenantProfile } from '../types/tenant'

interface LoginPageProps {
  tenant: TenantProfile
  onLoginSuccess: (userRole: string, plant: string) => void
}

const ROLES = [
  {
    id: 'inspetor' as const,
    label: 'Inspetor N2',
    code: 'INSP-N2',
    email: 'carlos.silva@empresa.com.br',
    desc: 'Inspetor Qualificado · Nível 2',
    color: '#0284c7',
  },
  {
    id: 'supervisor' as const,
    label: 'Engenheiro PH',
    code: 'ENG-PH',
    email: 'paulo.mendes@empresa.com.br',
    desc: 'Engenheiro Responsável · CREA',
    color: '#0369a1',
  },
  {
    id: 'gestor' as const,
    label: 'Gestor de Planta',
    code: 'GSTOR',
    email: 'diretoria@empresa.com.br',
    desc: 'Acesso Administrativo & Operacional',
    color: '#0f766e',
  },
]

export const LoginPage: React.FC<LoginPageProps> = ({ tenant, onLoginSuccess }) => {
  const [email, setEmail] = useState(ROLES[0].email)
  const [password, setPassword] = useState('••••••••••••')
  const [showPassword, setShowPassword] = useState(false)
  const [selectedPlant, setSelectedPlant] = useState(tenant.operationalUnit || 'Unidade Operacional Principal')
  const [offlineBufferEnabled, setOfflineBufferEnabled] = useState(true)
  const [activeRole, setActiveRole] = useState<'inspetor' | 'supervisor' | 'gestor'>('inspetor')
  const [isLoading, setIsLoading] = useState(false)

  const handleRoleSelect = (role: 'inspetor' | 'supervisor' | 'gestor') => {
    setActiveRole(role)
    const found = ROLES.find((r) => r.id === role)
    if (found) setEmail(found.email)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      onLoginSuccess(activeRole, selectedPlant)
    }, 350)
  }

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f1f5f9', /* Cor gelo de fundo */
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif",
      color: '#1e293b',
      padding: '32px 16px',
    }}>
      {/* ── CARD CENTRALIZADO DE LOGIN (Quadrado: 700px x 700px) ── */}
      <div
        className="login-card"
        style={{
          width: '100%',
          maxWidth: '700px',
          height: '700px',
          minHeight: '700px',
          aspectRatio: '1 / 1',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          borderRadius: '6px', /* Raio de 6px no card principal */
          border: '1px solid #cbd5e1', /* Linha de borda de 1px cinza pra destacar */
          boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.05), 0 8px 10px -6px rgba(15, 23, 42, 0.02)',
          padding: '40px 48px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{
          width: '100%',
          maxWidth: '500px',
          display: 'flex',
          flexDirection: 'column',
        }}>
          
          {/* Header do Card */}
          <div style={{ marginBottom: '28px', textAlign: 'center' }}>
            <div style={{
              display: 'inline-block',
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#0284c7',
              backgroundColor: '#f0f9ff',
              padding: '5px 14px',
              borderRadius: '3px',
              marginBottom: '14px',
              border: '1px solid #bae6fd',
            }}>
              Portal de Acesso
            </div>
            <h1 style={{
              fontSize: '32px',
              fontWeight: 600,
              color: '#1e293b',
              letterSpacing: '-0.02em',
              margin: '0 0 8px 0',
            }}>
              Acessar Sistema
            </h1>
            <p style={{ fontSize: '16px', color: '#64748b', margin: 0 }}>
              Entre com suas credenciais para acessar a plataforma.
            </p>
          </div>

          {/* Seleção de Perfil Rápido */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
              Perfil Operacional
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {ROLES.map((role) => {
                const isSelected = activeRole === role.id
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => handleRoleSelect(role.id)}
                    style={{
                      padding: '10px 6px',
                      borderRadius: '3px',
                      border: isSelected ? '1px solid #0284c7' : '1px solid #cbd5e1',
                      backgroundColor: isSelected ? '#f0f9ff' : '#ffffff',
                      color: isSelected ? '#0284c7' : '#475569',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontSize: '14px', marginBottom: '2px' }}>{role.label}</div>
                    <div style={{ fontSize: '11px', opacity: 0.75, fontFamily: "'DM Mono', monospace" }}>{role.code}</div>
                  </button>
                )
              })}
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>

            {/* Credenciais */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '15px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  E-mail do Usuário
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="login-field"
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#1e293b',
                    borderRadius: '3px',
                    width: '100%',
                    fontSize: '15px',
                    padding: '11px 14px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '15px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Senha de Acesso
                </label>
                <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="login-field"
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#1e293b',
                      borderRadius: '3px',
                      width: '100%',
                      paddingRight: '46px',
                      fontSize: '15px',
                      paddingLeft: '14px',
                      paddingTop: '11px',
                      paddingBottom: '11px',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                    aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      background: 'none',
                      border: 'none',
                      padding: '6px',
                      cursor: 'pointer',
                      color: '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#0b3d61')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Toggle de Modo Offline */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '3px',
            }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>
                  Modo Offline
                </div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>
                  Armazena medições localmente sem internet
                </div>
              </div>
              <input
                type="checkbox"
                checked={offlineBufferEnabled}
                onChange={(e) => setOfflineBufferEnabled(e.target.checked)}
                style={{ width: '17px', height: '17px', cursor: 'pointer', accentColor: '#0284c7' }}
              />
            </div>

            {/* Botão de Entrar */}
            <button
              type="submit"
              disabled={isLoading}
              className="login-btn-submit"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '16px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: '#0284c7',
                border: '1px solid #0284c7',
                borderRadius: '3px',
                color: '#ffffff',
                cursor: 'pointer',
                marginTop: '6px',
                boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)',
              }}
            >
              {isLoading ? (
                <span>Autenticando credenciais...</span>
              ) : (
                <span>Entrar no Sistema →</span>
              )}
            </button>
          </form>

          {/* Segurança */}
          <div style={{
            marginTop: '28px',
            textAlign: 'center',
            fontSize: '14px',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Conexão criptografada TLS 1.3 · Acesso Seguro
          </div>
        </div>
      </div>
    </div>
  )
}
