/**
 * Configuração central do frontend.
 * URL da API backend (FastAPI) usada por todos os consumidores de /api/*.
 *
 * No ar, a API fica no mesmo endereço do site (axosrelatorios.com/api), então o padrão é o próprio
 * endereço ('' = caminho relativo). VITE_API_URL só é preciso para apontar outro servidor.
 * No computador de teste (localhost), sem a variável, usa a API local na porta 8000.
 */
const noComputadorDeTeste = ['localhost', '127.0.0.1'].includes(globalThis.location?.hostname ?? '')

export const API_BASE_URL: string = (
  import.meta.env.VITE_API_URL || (noComputadorDeTeste ? 'http://localhost:8000' : '')
).trim().replace(/\/+$/, '')
