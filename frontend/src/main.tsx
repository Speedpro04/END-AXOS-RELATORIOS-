import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { ThemeProvider } from './contexts/ThemeContext'
import './index.css'
import App from './App.tsx'
import { VerificarPage } from './pages/VerificarPage'

// Verificação pública (QR do PDF oficial): abre sem login
const paginaPublica = window.location.pathname.startsWith('/verificar/')

// Ativação imediata do Service Worker PWA para operação 99% offline em campo
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      {paginaPublica ? <VerificarPage /> : <App />}
    </ThemeProvider>
  </StrictMode>,
)

