/**
 * Configuração central do frontend.
 * URL da API backend (FastAPI) usada por todos os consumidores de /api/*.
 */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
