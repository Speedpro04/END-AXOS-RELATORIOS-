/**
 * LoginPage – AXOS Relatórios
 * Layout split: painel de marca (sempre grafite) + formulário (muda com tema)
 * Fontes: Archivo (títulos) + IBM Plex Sans (texto)
 * Tema: escuro por padrão; botão lua/sol sincronizado com ThemeContext
 */

import React, { useEffect, useState } from 'react'
import { Eye, EyeOff, Moon, Sun } from 'lucide-react'
import type { TenantProfile } from '../types/tenant'
import { useTheme } from '../contexts/ThemeContext'

interface LoginPageProps {
  tenant: TenantProfile
  onLoginSuccess: (userRole: string, plant: string) => void
}

/* ─── Paletas ────────────────────────────────────────── */
const DARK = {
  pageBg:     '#121315',
  formBg:     '#1A1C1F',
  fieldBg:    '#24272B',
  border:     '#34383D',
  text:       '#E6E8EA',
  textSec:    '#9AA0A6',
  cyan:       '#2FB8D6',
  btnText:    '#06222B',
  labelColor: '#9AA0A6',
  pillBg:     '#1e3a40',
  pillBorder: '#2FB8D6',
  pillText:   '#2FB8D6',
}

const LIGHT = {
  pageBg:     '#F1F3F4',
  formBg:     '#FFFFFF',
  fieldBg:    '#F1F3F4',
  border:     '#D5DADD',
  text:       '#14181B',
  textSec:    '#5A646B',
  cyan:       '#2FB8D6',
  btnBg:      '#0B3A5B',
  btnText:    '#FFFFFF',
  labelColor: '#5A646B',
  pillBg:     '#e8f4f8',
  pillBorder: '#2FB8D6',
  pillText:   '#0B3A5B',
}

/* ─── Painel Esquerdo (sempre grafite) ───────────────── */
const BRAND = {
  bg:       '#0D0F11',
  stripe:   '#16191D',
  text:     '#E6E8EA',
  textSec:  '#9AA0A6',
  cyan:     '#2FB8D6',
}

/* ─── Dados de perfis de acesso ─────────────────────── */
const ROLES = [
  { id: 'inspetor'    as const, label: 'Inspetor N2',    code: 'INSP-N2', email: 'carlos.silva@empresa.com.br'  },
  { id: 'supervisor'  as const, label: 'Engenheiro PH',  code: 'ENG-PH',  email: 'paulo.mendes@empresa.com.br'  },
  { id: 'gestor'      as const, label: 'Gestor de Planta', code: 'GSTOR', email: 'diretoria@empresa.com.br'      },
]

/* ─── A-Scan SVG animado ─────────────────────────────── */
function AScanLine({ color }: { color: string }) {
  // Linha tipo A-scan de ultrassom
  const path =
    'M0,40 L60,40 L70,40 L75,10 L80,70 L85,40 L130,40 L140,40 ' +
    'L145,25 L150,55 L155,40 L200,40 L215,40 L220,15 L225,65 ' +
    'L230,40 L280,40 L285,38 L290,42 L340,40 L360,40'

  return (
    <svg
      viewBox="0 0 360 80"
      width="100%"
      height="80"
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <style>{`
          @media (prefers-reduced-motion: no-preference) {
            .ascan-path {
              stroke-dasharray: 700;
              stroke-dashoffset: 700;
              animation: drawLine 3s ease forwards, pulse 4s 3s ease-in-out infinite;
            }
            @keyframes drawLine {
              to { stroke-dashoffset: 0; }
            }
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50%       { opacity: 0.55; }
            }
          }
          @media (prefers-reduced-motion: reduce) {
            .ascan-path { stroke-dasharray: none; stroke-dashoffset: 0; }
          }
        `}</style>
      </defs>
      <path
        className="ascan-path"
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ─── Componente principal ───────────────────────────── */
export const LoginPage: React.FC<LoginPageProps> = ({ tenant, onLoginSuccess }) => {
  const { theme, toggleTheme } = useTheme()
  const C = theme === 'dark' ? DARK : LIGHT

  const [email, setEmail]               = useState(ROLES[0].email)
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [selectedPlant, setSelectedPlant] = useState(
    tenant.operationalUnit || 'Unidade Operacional Principal'
  )
  const [offlineEnabled, setOfflineEnabled] = useState(true)
  const [activeRole, setActiveRole]     = useState<'inspetor' | 'supervisor' | 'gestor'>('inspetor')
  const [isLoading, setIsLoading]       = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)

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

  // Injetar fontes do Google
  useEffect(() => {
    const id = 'axos-login-fonts'
    if (!document.getElementById(id)) {
      const link = document.createElement('link')
      link.id   = id
      link.rel  = 'stylesheet'
      link.href = 'https://fonts.googleapis.com/css2?family=Archivo:wght@700;800&family=IBM+Plex+Sans:wght@400;500;600&display=swap'
      document.head.appendChild(link)
    }
  }, [])

  /* ── Estilos compartilhados dos campos ── */
  const fieldStyle = (name: string): React.CSSProperties => ({
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: C.fieldBg,
    border: `1.5px solid ${focusedField === name ? C.cyan : C.border}`,
    borderRadius: '6px',
    color: C.text,
    fontSize: '15px',
    fontFamily: "'IBM Plex Sans', sans-serif",
    padding: '11px 14px',
    outline: 'none',
    transition: 'border-color 0.15s ease, background-color 0.15s ease',
  })

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    fontFamily: "'IBM Plex Sans', sans-serif",
    color: C.labelColor,
    marginBottom: '6px',
    letterSpacing: '0.03em',
  }

  return (
    <>
      {/* Injeção de CSS global para transição sem piscar */}
      <style>{`
        .login-root * { box-sizing: border-box; }
        .login-root { transition: background-color 0.2s ease, color 0.2s ease; }
        .login-form-panel { transition: background-color 0.2s ease; }
        .login-field-select option { background: ${C.fieldBg}; color: ${C.text}; }
        .login-toggle-btn { cursor: pointer; transition: opacity 0.15s ease; }
        .login-toggle-btn:hover { opacity: 0.75; }
        /* Toggle switch offline */
        .offline-toggle {
          position: relative; width: 44px; height: 24px;
          flex-shrink: 0;
        }
        .offline-toggle input { opacity: 0; width: 0; height: 0; }
        .offline-slider {
          position: absolute; inset: 0;
          background: ${offlineEnabled ? '#2FB8D6' : C.border};
          border-radius: 24px;
          transition: background 0.2s ease;
          cursor: pointer;
        }
        .offline-slider::before {
          content: '';
          position: absolute;
          left: ${offlineEnabled ? '22px' : '2px'};
          top: 2px;
          width: 20px; height: 20px;
          background: white;
          border-radius: 50%;
          transition: left 0.2s ease;
        }
      `}</style>

      <div
        className="login-root"
        style={{
          minHeight: '100vh',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: C.pageBg,
          fontFamily: "'IBM Plex Sans', sans-serif",
          position: 'relative',
          padding: '24px 16px',
        }}
      >
        {/* ── BOTÃO DE ALTERNAR TEMA ── */}
        <button
          type="button"
          aria-label="Alternar tema"
          onClick={toggleTheme}
          className="login-toggle-btn"
          style={{
            position: 'fixed',
            top: '16px',
            right: '16px',
            zIndex: 100,
            width: '44px',
            height: '44px',
            borderRadius: '8px',
            border: `1px solid ${C.border}`,
            backgroundColor: C.formBg,
            color: C.textSec,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
        >
          {theme === 'dark'
            ? <Sun  size={20} color="#E6E8EA" />
            : <Moon size={20} color="#5A646B" />
          }
        </button>

        {/* ── CONTAINER DELIMITADO EM 1140px – DOIS PAINÉIS UNIDOS ── */}
        <div
          className="login-container"
          style={{
            width: '100%',
            maxWidth: '1140px',
            minHeight: 'min(740px, calc(100vh - 48px))',
            display: 'flex',
            margin: 'auto',
            borderRadius: '16px',
            overflow: 'hidden',
            border: `1px solid ${theme === 'dark' ? '#24272B' : '#D5DADD'}`,
            boxShadow: theme === 'dark'
              ? '0 25px 70px rgba(0, 0, 0, 0.65)'
              : '0 20px 60px rgba(0, 0, 0, 0.08)',
            position: 'relative',
          }}
        >
          {/* ════════════════════════════════════════════════
              PAINEL ESQUERDO – Marca (sempre grafite)
          ════════════════════════════════════════════════ */}
          <div
            className="login-brand-panel"
            style={{
              flex: '1 1 50%',
              minWidth: 0,
              backgroundColor: BRAND.bg,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '44px 48px',
              position: 'relative',
              overflow: 'hidden',
              borderRight: `1px solid ${theme === 'dark' ? '#24272B' : '#E2E6E9'}`,
            }}
          >
          {/* Faixa decorativa */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(135deg, ${BRAND.stripe} 0%, transparent 60%)`,
            pointerEvents: 'none',
          }} />

          {/* Logo Oficial AXOS Relatórios (Centralizado no topo superior) */}
          <div style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
          }}>
            <img
              src="/logo-axos.png"
              alt="AXOS Relatórios – Tecnologia em Inspeção"
              style={{
                width: '100%',
                maxWidth: '300px',
                height: 'auto',
                display: 'block',
                margin: '0 auto',
                objectFit: 'contain',
              }}
            />
          </div>

          {/* A-Scan animado (centro do painel) */}
          <div style={{
            position: 'relative',
            zIndex: 1,
            margin: '0 -16px',
            padding: '24px 0',
          }}>
            {/* Linha base */}
            <div style={{
              position: 'absolute',
              left: '16px', right: '16px',
              top: '50%',
              height: '1px',
              background: `${BRAND.cyan}22`,
            }} />
            <AScanLine color={BRAND.cyan} />
          </div>

          {/* Headline + bullets (Alinhado no texto inferior) */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{
              fontFamily: "'Archivo', sans-serif",
              fontWeight: 800,
              fontSize: 'clamp(24px, 2.6vw, 34px)',
              color: BRAND.text,
              lineHeight: 1.15,
              margin: '0 0 20px 0',
              letterSpacing: '-0.01em',
            }}>
              Laudo rápido.<br />
              Registro que<br />
              não se altera.
            </h2>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                'Revisado pela sua empresa antes de sair',
                'Funciona sem internet no campo',
                'PDF padronizado com a marca da sua empresa',
              ].map((item) => (
                <li key={item} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  fontSize: '14px',
                  color: BRAND.textSec,
                  fontFamily: "'IBM Plex Sans', sans-serif",
                }}>
                  <span style={{ color: BRAND.cyan, marginTop: '2px', flexShrink: 0 }}>—</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ════════════════════════════════════════════════
            PAINEL DIREITO – Formulário (Unido ao painel esquerdo)
        ════════════════════════════════════════════════ */}
        <div
          className="login-form-panel"
          style={{
            flex: '1 1 50%',
            minWidth: 0,
            backgroundColor: C.formBg,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '44px 48px',
            overflowY: 'auto',
          }}
        >
          <div style={{
            width: '100%',
            maxWidth: '440px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            justifyContent: 'space-between',
          }}>
            <div>
              {/* Logo oficial no mobile quando o painel de marca está oculto */}
              <div className="login-mobile-logo" style={{ display: 'none', marginBottom: '20px', textAlign: 'center' }}>
                <img
                  src="/logo-axos.png"
                  alt="AXOS Relatórios"
                  style={{
                    maxWidth: '220px',
                    width: '100%',
                    height: 'auto',
                    margin: '0 auto',
                    display: 'block',
                  }}
                />
              </div>

              {/* Pílula "Portal de Acesso" */}
              <div style={{
                display: 'inline-block',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: C.cyan,
                backgroundColor: theme === 'dark' ? '#1e3a40' : '#e0f5f9',
                border: `1px solid ${C.cyan}44`,
                borderRadius: '4px',
                padding: '4px 12px',
                marginBottom: '12px',
                fontFamily: "'IBM Plex Sans', sans-serif",
              }}>
                Portal de Acesso
              </div>

            {/* Título */}
            <h1 style={{
              fontFamily: "'Archivo', sans-serif",
              fontWeight: 800,
              fontSize: '28px',
              color: C.text,
              letterSpacing: '-0.02em',
              margin: '0 0 6px 0',
            }}>
              Entrar na plataforma
            </h1>
            <p style={{
              fontSize: '14px',
              color: C.textSec,
              margin: '0 0 28px 0',
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}>
              Use o e-mail da sua conta para continuar.
            </p>

            {/* Seleção de perfil */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ ...labelStyle, marginBottom: '8px' }}>Perfil operacional</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {ROLES.map((role) => {
                  const sel = activeRole === role.id
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => handleRoleSelect(role.id)}
                      style={{
                        padding: '8px 4px',
                        borderRadius: '6px',
                        border: `1.5px solid ${sel ? C.cyan : C.border}`,
                        backgroundColor: sel
                          ? (theme === 'dark' ? '#1e3a40' : '#e0f5f9')
                          : C.fieldBg,
                        color: sel ? C.cyan : C.textSec,
                        fontWeight: 600,
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        fontFamily: "'IBM Plex Sans', sans-serif",
                      }}
                    >
                      <div style={{ fontSize: '12px' }}>{role.label}</div>
                      <div style={{
                        fontSize: '10px',
                        opacity: 0.7,
                        fontFamily: "'DM Mono', 'IBM Plex Mono', monospace",
                        marginTop: '2px',
                      }}>
                        {role.code}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

              {/* E-mail */}
              <div>
                <label htmlFor="login-email" style={labelStyle}>E-mail</label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={()  => setFocusedField(null)}
                  required
                  placeholder="voce@empresa.com.br"
                  style={fieldStyle('email')}
                />
              </div>

              {/* Senha */}
              <div>
                <label htmlFor="login-senha" style={labelStyle}>Senha</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="login-senha"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('senha')}
                    onBlur={()  => setFocusedField(null)}
                    required
                    placeholder="Sua senha"
                    style={{ ...fieldStyle('senha'), paddingRight: '48px' }}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute', right: '12px', top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none',
                      cursor: 'pointer', padding: '4px',
                      color: C.textSec, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Unidade Operacional */}
              <div>
                <label htmlFor="login-planta" style={labelStyle}>Unidade operacional</label>
                <select
                  id="login-planta"
                  value={selectedPlant}
                  onChange={(e) => setSelectedPlant(e.target.value)}
                  onFocus={() => setFocusedField('planta')}
                  onBlur={()  => setFocusedField(null)}
                  className="login-field-select"
                  style={{ ...fieldStyle('planta'), appearance: 'auto' }}
                >
                  {[
                    tenant.operationalUnit || 'Unidade Operacional Principal',
                    'Refinaria Norte',
                    'Plataforma P-77',
                    'Terminal de Gás Sul',
                    'Petroquímica Leste',
                  ].map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* Toggle Modo Offline */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                backgroundColor: C.fieldBg,
                border: `1px solid ${C.border}`,
                borderRadius: '6px',
                gap: '12px',
              }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>
                    Modo offline
                  </div>
                  <div style={{ fontSize: '12px', color: C.textSec, marginTop: '2px' }}>
                    Guarda as medições no aparelho quando não há sinal
                  </div>
                </div>
                <label className="offline-toggle" aria-label="Ativar modo offline">
                  <input
                    type="checkbox"
                    checked={offlineEnabled}
                    onChange={(e) => setOfflineEnabled(e.target.checked)}
                  />
                  <span className="offline-slider" />
                </label>
              </div>

              {/* Botão Entrar */}
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '13px',
                  fontSize: '16px',
                  fontWeight: 700,
                  fontFamily: "'Archivo', sans-serif",
                  letterSpacing: '0.01em',
                  backgroundColor: C.cyan,
                  color: theme === 'dark' ? '#06222B' : '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.75 : 1,
                  transition: 'opacity 0.15s ease, background-color 0.15s ease',
                  marginTop: '4px',
                }}
              >
                {isLoading ? 'Autenticando...' : 'Entrar'}
              </button>

            </form>
          </div>

          {/* Rodapé do formulário (Alinhado com o texto inferior do painel esquerdo) */}
          <div style={{ marginTop: 'auto', paddingTop: '24px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}>
              <button type="button" style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '13px', color: C.cyan, textDecoration: 'underline',
                padding: 0, fontFamily: "'IBM Plex Sans', sans-serif",
              }}>
                Esqueci minha senha
              </button>
              <button type="button" style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '13px', color: C.textSec, textDecoration: 'underline',
                padding: 0, fontFamily: "'IBM Plex Sans', sans-serif",
              }}>
                Falar com o suporte
              </button>
            </div>

            {/* Segurança */}
            <div style={{
              textAlign: 'center',
              fontSize: '12px',
              color: C.textSec,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Conexão segura. Seus laudos ficam protegidos.
            </div>
          </div>

        </div>
      </div>
    </div>

        {/* ── CSS responsivo: unificado e adaptável ── */}
        <style>{`
          @media (max-width: 900px) {
            .login-container {
              max-width: 520px !important;
              min-height: auto !important;
            }
            .login-brand-panel { display: none !important; }
            .login-mobile-logo { display: block !important; }
            .login-form-panel  {
              flex: 1 1 100% !important;
              padding: 32px 24px !important;
              border-left: none !important;
            }
          }
          @media (max-width: 540px) {
            .login-root {
              padding: 0 !important;
            }
            .login-container {
              border-radius: 0 !important;
              border: none !important;
              min-height: 100vh !important;
              box-shadow: none !important;
            }
            .login-form-panel {
              padding: 24px 16px !important;
            }
          }
        `}</style>
      </div>
    </>
  )
}
