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

  const activeRoleData = ROLES.find((r) => r.id === activeRole)!

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8fafc',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif",
      color: '#1e293b',
      padding: '32px 16px',
    }}>
      {/* ── CONTAINER UNIFICADO DELIMITADO EM 1210px ── */}
      <div style={{
        width: '100%',
        maxWidth: '1210px',
        display: 'flex',
        backgroundColor: '#ffffff',
        borderRadius: '3px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.04), 0 8px 10px -6px rgba(15, 23, 42, 0.02)',
        overflow: 'hidden',
      }}>

        {/* ── PAINEL ESQUERDO: Logo de 370px e Saudação ── */}
        <div
          className="login-hero-panel"
          style={{
            background: 'linear-gradient(160deg, #ffffff 0%, #f8fafc 60%, #f1f5f9 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '36px',
            borderRight: '1px solid #e2e8f0',
          }}
        >
          <img
            src="/logo-seal.jpg"
            alt="AXOS Relatórios"
            style={{
              width: '370px',
              height: '370px',
              objectFit: 'contain',
              borderRadius: '50%',
              boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.06), 0 8px 10px -6px rgba(15, 23, 42, 0.03)',
            }}
          />
          <h2 style={{
            marginTop: '30px',
            fontSize: '34px',
            fontWeight: 600,
            color: '#1e293b',
            letterSpacing: '-0.02em',
            textAlign: 'center',
            margin: '30px 0 0 0',
          }}>
            Seja bem vindo
          </h2>
        </div>

        {/* ── PAINEL DIREITO: Formulário de Autenticação ── */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '44px 36px',
          backgroundColor: '#ffffff',
        }}>
          <div style={{
            width: '100%',
            maxWidth: '440px',
          }}>
            
            {/* Header do Card */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                display: 'inline-block',
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: '#0284c7',
                backgroundColor: '#f0f9ff',
                padding: '4px 10px',
                borderRadius: '3px',
                marginBottom: '10px',
                border: '1px solid #bae6fd',
              }}>
                Portal de Acesso
              </div>
              <h1 style={{
                fontSize: '28px',
                fontWeight: 600,
                color: '#1e293b',
                letterSpacing: '-0.02em',
                margin: '0 0 6px 0',
              }}>
                Acessar Sistema
              </h1>
              <p style={{ fontSize: '16px', color: '#64748b', margin: 0 }}>
                Selecione o perfil operacional para acessar a plataforma.
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Credenciais */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '16px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    E-mail do Usuário
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="input-clean"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '16px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Senha de Acesso
                  </label>
                  <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="input-clean"
                      style={{ width: '100%', paddingRight: '46px' }}
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

                <div>
                  <label style={{ display: 'block', fontSize: '16px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Unidade Operacional / Planta
                  </label>
                  <select
                    value={selectedPlant}
                    onChange={(e) => setSelectedPlant(e.target.value)}
                    className="input-clean"
                    style={{ width: '100%', cursor: 'pointer' }}
                  >
                    <option value="Unidade Operacional Principal">Unidade Operacional Principal</option>
                    <option value="Área de Processamento Industrial">Área de Processamento Industrial</option>
                    <option value="Terminal Logístico / Setor Central">Terminal Logístico / Setor Central</option>
                    <option value="Planta Industrial 02">Planta Industrial 02</option>
                  </select>
                </div>
              </div>

              {/* Toggle de Modo Offline */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '3px',
              }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
                    Modo Offline
                  </div>
                  <div style={{ fontSize: '15px', color: '#64748b' }}>
                    Armazena medições localmente sem internet
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={offlineBufferEnabled}
                  onChange={(e) => setOfflineBufferEnabled(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#0284c7' }}
                />
              </div>

              {/* Botão de Entrar */}
              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary-action"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '18px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  backgroundColor: '#1e293b',
                  border: 'none',
                  borderRadius: '3px',
                  color: '#ffffff',
                  cursor: 'pointer',
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
              marginTop: '20px',
              textAlign: 'center',
              fontSize: '15px',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Conexão criptografada TLS 1.3 · Acesso Seguro
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
