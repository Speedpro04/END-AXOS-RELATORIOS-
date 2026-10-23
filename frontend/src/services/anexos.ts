/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║              SERVIÇO DE ANEXOS – Axos Relatórios                ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║                                                                  ║
 * ║  CONTRATO PÚBLICO (4 funções):                                   ║
 * ║                                                                  ║
 * ║  salvarAnexo({ laudoId, tipo, arquivo })                         ║
 * ║    → { id, laudoId, tipo, caminho, hashSha256,                   ║
 * ║        tamanhoBytes, criadoEm }                                  ║
 * ║                                                                  ║
 * ║  listarAnexos(laudoId)                                           ║
 * ║    → AnexoMeta[]                                                 ║
 * ║                                                                  ║
 * ║  lerAnexo(id)                                                    ║
 * ║    → File                                                        ║
 * ║                                                                  ║
 * ║  removerAnexo(id)                                                ║
 * ║    → void                                                        ║
 * ║                                                                  ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  Tipos aceitos: 'foto' | 'croqui_json' | 'croqui_png'           ║
 * ║                                                                  ║
 * ║  Armazenamento atual: IndexedDB (local, offline-first)           ║
 * ║  → Para trocar para backend real, substitua APENAS este arquivo. ║
 * ║  → Nenhuma tela ou componente acessa IndexedDB diretamente.      ║
 * ║                                                                  ║
 * ║  Fotos: redimensionadas para max 1600px, qualidade 0.8 (JPEG)    ║
 * ║  SHA-256: calculado no navegador via SubtleCrypto                 ║
 * ║  Imutabilidade: anexos só podem ser removidos em status           ║
 * ║                 'rascunho'. Fora dele, a operação lança erro.     ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

// ────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────

export type TipoAnexo = 'foto' | 'croqui_json' | 'croqui_png'

export interface AnexoMeta {
  id: string
  laudoId: string
  tipo: TipoAnexo
  caminho: string          // chave interna (IndexedDB agora, URL futuramente)
  nomeOriginal: string
  mimeType: string
  hashSha256: string
  tamanhoBytes: number
  criadoEm: string         // ISO 8601
}

export interface SalvarAnexoInput {
  laudoId: string
  tipo: TipoAnexo
  arquivo: File | Blob
  nomeOriginal?: string    // Se não informado, usa File.name ou gera
}

// Registro interno completo (meta + blob)
interface AnexoRecord {
  meta: AnexoMeta
  blob: Blob
}

// ────────────────────────────────────────────────────
// Constantes
// ────────────────────────────────────────────────────

const DB_NAME = 'axos-anexos'
const DB_VERSION = 1
const STORE_NAME = 'anexos'

const FOTO_MAX_PX = 1600
const FOTO_QUALITY = 0.8

const TIPOS_ACEITOS: TipoAnexo[] = ['foto', 'croqui_json', 'croqui_png']

// Flag de modo teste (IndexedDB local)
const MODO_LOCAL = true

// ────────────────────────────────────────────────────
// Helpers internos
// ────────────────────────────────────────────────────

/** Abre (ou cria) o banco IndexedDB */
function abrirDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'meta.id' })
        store.createIndex('por_laudo', 'meta.laudoId', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error(`Erro ao abrir IndexedDB: ${request.error?.message}`))
  })
}

/** Gera UUID v4 simples */
function gerarId(): string {
  return crypto.randomUUID()
}

/** Calcula SHA-256 do conteúdo binário */
async function calcularSha256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/** Redimensiona foto para no máximo FOTO_MAX_PX mantendo proporção */
async function redimensionarFoto(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(blob)

    img.onload = () => {
      URL.revokeObjectURL(url)

      const { width, height } = img

      // Já está dentro do limite — retorna original
      if (width <= FOTO_MAX_PX && height <= FOTO_MAX_PX) {
        resolve(blob)
        return
      }

      // Calcula nova dimensão mantendo proporção
      const scale = FOTO_MAX_PX / Math.max(width, height)
      const newW = Math.round(width * scale)
      const newH = Math.round(height * scale)

      const canvas = document.createElement('canvas')
      canvas.width = newW
      canvas.height = newH

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Não foi possível criar contexto canvas'))
        return
      }

      ctx.drawImage(img, 0, 0, newW, newH)

      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result)
          } else {
            reject(new Error('Falha ao converter canvas para blob'))
          }
        },
        'image/jpeg',
        FOTO_QUALITY
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Falha ao carregar imagem para redimensionamento'))
    }

    img.src = url
  })
}

/** Executa transação no IndexedDB e retorna resultado */
function transacao<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    const store = tx.objectStore(STORE_NAME)
    const req = callback(store)

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(new Error(`Erro na transação IndexedDB: ${req.error?.message}`))
  })
}

// ────────────────────────────────────────────────────
// Funções de status do laudo (para imutabilidade)
// ────────────────────────────────────────────────────

/**
 * Verifica se o laudo está em modo rascunho.
 * Consulta o localStorage onde os relatórios são persistidos.
 */
function laudoEhRascunho(laudoId: string): boolean {
  try {
    const stored = localStorage.getItem('axos_reports')
    if (!stored) return true // Se não existe, permite (laudo novo)
    const reports = JSON.parse(stored)
    if (Array.isArray(reports)) {
      const report = reports.find((r: any) => r.id === laudoId)
      if (!report) return true // Laudo não encontrado = novo = permite
      return report.status === 'rascunho'
    }
    return true
  } catch {
    return true // Em caso de erro, permite (fail-open para não travar campo)
  }
}

// ────────────────────────────────────────────────────
// API PÚBLICA
// ────────────────────────────────────────────────────

/**
 * Salva um anexo no armazenamento local.
 *
 * - Fotos são automaticamente redimensionadas (max 1600px, quality 0.8)
 * - SHA-256 é calculado sobre o conteúdo final
 * - Tipo do anexo é validado contra a lista de tipos aceitos
 */
export async function salvarAnexo(input: SalvarAnexoInput): Promise<AnexoMeta> {
  // Validação do tipo
  if (!TIPOS_ACEITOS.includes(input.tipo)) {
    throw new Error(`Tipo de anexo inválido: "${input.tipo}". Aceitos: ${TIPOS_ACEITOS.join(', ')}`)
  }

  let blobFinal: Blob = input.arquivo

  // Redimensiona fotos
  if (input.tipo === 'foto') {
    blobFinal = await redimensionarFoto(blobFinal)
  }

  // Calcula hash
  const arrayBuffer = await blobFinal.arrayBuffer()
  const hashSha256 = await calcularSha256(arrayBuffer)

  // Determina nome original
  const nomeOriginal =
    input.nomeOriginal ||
    (input.arquivo instanceof File ? input.arquivo.name : `${input.tipo}_${Date.now()}`)

  // Determina MIME type
  const mimeType =
    blobFinal.type ||
    (input.tipo === 'croqui_json' ? 'application/json' : 'image/png')

  // Monta metadados
  const id = gerarId()
  const meta: AnexoMeta = {
    id,
    laudoId: input.laudoId,
    tipo: input.tipo,
    caminho: `indexeddb://${DB_NAME}/${STORE_NAME}/${id}`,
    nomeOriginal,
    mimeType,
    hashSha256,
    tamanhoBytes: blobFinal.size,
    criadoEm: new Date().toISOString(),
  }

  // Persiste no IndexedDB
  const db = await abrirDB()
  const record: AnexoRecord = { meta, blob: blobFinal }
  await transacao(db, 'readwrite', (store) => store.put(record))
  db.close()

  return meta
}

/**
 * Lista todos os anexos vinculados a um laudo.
 * Retorna apenas os metadados (sem o blob).
 */
export async function listarAnexos(laudoId: string): Promise<AnexoMeta[]> {
  const db = await abrirDB()

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('por_laudo')
    const req = index.getAll(laudoId)

    req.onsuccess = () => {
      const records: AnexoRecord[] = req.result || []
      const metas = records.map((r) => r.meta)
      db.close()
      resolve(metas)
    }

    req.onerror = () => {
      db.close()
      reject(new Error(`Erro ao listar anexos do laudo ${laudoId}: ${req.error?.message}`))
    }
  })
}

/**
 * Lê o conteúdo binário de um anexo pelo ID.
 * Retorna um File reconstruído com nome e tipo corretos.
 */
export async function lerAnexo(id: string): Promise<File> {
  const db = await abrirDB()
  const record = await transacao<AnexoRecord | undefined>(
    db,
    'readonly',
    (store) => store.get(id) as IDBRequest<AnexoRecord | undefined>
  )
  db.close()

  if (!record) {
    throw new Error(`Anexo não encontrado: ${id}`)
  }

  return new File([record.blob], record.meta.nomeOriginal, {
    type: record.meta.mimeType,
    lastModified: new Date(record.meta.criadoEm).getTime(),
  })
}

/**
 * Remove um anexo pelo ID.
 *
 * ⚠️  Imutabilidade: só permite remoção se o laudo estiver em status 'rascunho'.
 * Fora desse status, lança erro.
 */
export async function removerAnexo(id: string): Promise<void> {
  const db = await abrirDB()

  // Busca o registro para verificar o laudo
  const record = await transacao<AnexoRecord | undefined>(
    db,
    'readonly',
    (store) => store.get(id) as IDBRequest<AnexoRecord | undefined>
  )

  if (!record) {
    db.close()
    throw new Error(`Anexo não encontrado: ${id}`)
  }

  // Verifica imutabilidade
  if (!laudoEhRascunho(record.meta.laudoId)) {
    db.close()
    throw new Error(
      `Não é possível remover anexo: o laudo "${record.meta.laudoId}" não está em rascunho.`
    )
  }

  // Remove
  await transacao(db, 'readwrite', (store) => store.delete(id))
  db.close()
}

// ────────────────────────────────────────────────────
// Utilitário: verificação de modo (para aviso discreto)
// ────────────────────────────────────────────────────

/**
 * Retorna true se o serviço está usando armazenamento local (IndexedDB).
 * Componentes podem usar isso para exibir um aviso discreto de "modo teste".
 */
export function isArmazenamentoLocal(): boolean {
  return MODO_LOCAL
}
