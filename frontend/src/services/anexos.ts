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
 * ║  Armazenamento: primeiro no aparelho (IndexedDB), para funcionar ║
 * ║  sem internet. A sincronização leva a foto ao bucket privado     ║
 * ║  report-files quando o laudo já está no servidor. O caminho fica ║
 * ║  em report_attachments, e a leitura exige login: não há link     ║
 * ║  público. Nenhuma tela acessa o IndexedDB diretamente.           ║
 * ║                                                                  ║
 * ║  Fotos: redimensionadas para max 1600px, qualidade 0.8 (JPEG)    ║
 * ║  SHA-256: calculado no navegador via SubtleCrypto                 ║
 * ║  Imutabilidade: anexos só podem ser removidos em status           ║
 * ║                 'rascunho'. Fora dele, a operação lança erro.     ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */
import { supabase } from '../lib/supabase';
import { db, type AnexoRecord as RegistroAnexo } from './dbDexie';
// ────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────

export type TipoAnexo = 'foto' | 'croqui_json' | 'croqui_png'

export interface AnexoMeta {
  id: string
  laudoId: string
  tipo: TipoAnexo
  caminho: string          // chave no aparelho; depois do envio, caminho no bucket
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

const BUCKET = 'report-files'
// O bucket só aceita estes formatos: os demais são convertidos para JPEG
const FORMATOS_DO_BUCKET = ['image/jpeg', 'image/png', 'image/webp']
const STATUS_QUE_ACEITA_FOTO = ['draft', 'returned']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_LAUDOS_POR_CONSULTA = 100

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

      // Já está dentro do limite e o servidor aceita o formato — retorna original
      if (width <= FOTO_MAX_PX && height <= FOTO_MAX_PX && FORMATOS_DO_BUCKET.includes(blob.type)) {
        resolve(blob)
        return
      }

      // Calcula nova dimensão mantendo proporção
      const scale = Math.min(1, FOTO_MAX_PX / Math.max(width, height))
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

  // A mesma imagem repetida no laudo é um anexo só (o servidor também não aceita duas)
  if (input.tipo === 'foto') {
    const doLaudo = await db.anexos.where('meta.laudoId').equals(input.laudoId).toArray()
    const igual = doLaudo.find((r) => r.meta.hashSha256 === hashSha256)
    if (igual) return igual.meta
  }

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

  // Persiste no IndexedDB e coloca na fila de envio, juntos
  await db.transaction('rw', db.anexos, db.fotosFila, async () => {
    await db.anexos.put({ meta, blob: blobFinal });
    if (input.tipo === 'foto') await db.fotosFila.put({ anexoId: id, laudoId: input.laudoId, acao: 'enviar' });
  });
  return meta;
}

/** Hash que a foto terá depois de gravada (mesmo redimensionamento de salvarAnexo). */
export async function hashDaFoto(arquivo: File | Blob): Promise<string> {
  const blob = await redimensionarFoto(arquivo);
  return calcularSha256(await blob.arrayBuffer());
}

/** Indica se a mesma imagem já está anexada a outro laudo neste aparelho. */
export async function imagemUsadaEmOutroLaudo(hashSha256: string, laudoId: string): Promise<boolean> {
  const todos = await db.anexos.toArray();
  return todos.some(r => r.meta.hashSha256 === hashSha256 && r.meta.laudoId !== laudoId);
}

/**
 * Lista todos os anexos vinculados a um laudo.
 * Retorna apenas os metadados (sem o blob).
 */
export async function listarAnexos(laudoId: string): Promise<AnexoMeta[]> {
  const records = await db.anexos.where('meta.laudoId').equals(laudoId).toArray();
  return records.map(r => r.meta);
}

/**
 * Lê o conteúdo binário de um anexo pelo ID.
 * Fora do aparelho onde a foto foi tirada, baixa do servidor (exige login),
 * confere o hash e guarda no aparelho para funcionar sem internet.
 */
export async function lerAnexo(id: string): Promise<File> {
  const record = (await db.anexos.get(id)) ?? (await baixarDoServidor(id));
  return new File([record.blob], record.meta.nomeOriginal, {
    type: record.meta.mimeType,
    lastModified: new Date(record.meta.criadoEm).getTime(),
  });
}

async function baixarDoServidor(id: string): Promise<RegistroAnexo> {
  const { data: linha, error } = await supabase
    .from('report_attachments')
    .select('report_id, storage_path, sha256, created_at')
    .eq('id', id)
    .maybeSingle();
  if (error || !linha) throw new Error(`Anexo não encontrado: ${id}`);

  const { data: blob, error: erroArquivo } = await supabase.storage.from(BUCKET).download(linha.storage_path);
  if (erroArquivo || !blob) throw new Error(`Não foi possível baixar o anexo: ${id}`);
  if ((await calcularSha256(await blob.arrayBuffer())) !== linha.sha256) {
    throw new Error(`O arquivo do anexo não confere com o registro: ${id}`);
  }

  const registro: RegistroAnexo = {
    meta: {
      id,
      laudoId: linha.report_id,
      tipo: 'foto',
      caminho: linha.storage_path,
      nomeOriginal: linha.storage_path.split('/').pop() ?? id,
      mimeType: blob.type,
      hashSha256: linha.sha256,
      tamanhoBytes: blob.size,
      criadoEm: linha.created_at,
    },
    blob,
  };
  await db.anexos.put(registro);
  return registro;
}

/**
 * Remove um anexo pelo ID. A foto sai do aparelho na hora e do servidor na
 * próxima sincronização. `laudoId` é necessário quando o arquivo não está aqui.
 *
 * ⚠️  Imutabilidade: só permite remoção se o laudo estiver em status 'rascunho'.
 * Fora desse status, lança erro. No servidor, quem garante isso é a RLS.
 */
export async function removerAnexo(id: string, laudoId?: string): Promise<void> {
  const record = await db.anexos.get(id);
  const laudo = record?.meta.laudoId ?? laudoId;
  if (!laudo) {
    throw new Error(`Anexo não encontrado: ${id}`);
  }
  if (!laudoEhRascunho(laudo)) {
    throw new Error(`Não é possível remover anexo: o laudo "${laudo}" não está em rascunho.`);
  }
  await db.transaction('rw', db.anexos, db.fotosFila, async () => {
    const naFila = await db.fotosFila.get(id);
    if (naFila?.acao === 'enviar') await db.fotosFila.delete(id); // nunca chegou ao servidor
    else await db.fotosFila.put({ anexoId: id, laudoId: laudo, acao: 'remover' });
    await db.anexos.delete(id);
  });
}

// ────────────────────────────────────────────────────
// Sincronização das fotos (chamada pelo SyncManager)
// ────────────────────────────────────────────────────

/** Reenvio depois de uma falha no meio do caminho: o arquivo já está no bucket. */
function arquivoJaExiste(erro: { message?: string; statusCode?: string }): boolean {
  return erro.statusCode === '409' || Boolean(erro.message?.toLowerCase().includes('already exists'));
}

async function enviarFoto(anexoId: string, tenantId: string, laudoId: string): Promise<void> {
  const record = await db.anexos.get(anexoId);
  if (!record) {
    await db.fotosFila.delete(anexoId);
    return;
  }
  const { hashSha256, mimeType } = record.meta;
  const extensao = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const caminho = `${tenantId}/${laudoId}/${hashSha256}.${extensao}`;

  const { error: erroArquivo } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, record.blob, { contentType: mimeType, upsert: false });
  if (erroArquivo && !arquivoJaExiste(erroArquivo)) throw erroArquivo;

  const { error: erroRegistro } = await supabase.from('report_attachments').insert({
    id: anexoId,
    tenant_id: tenantId,
    report_id: laudoId,
    kind: 'photo',
    storage_path: caminho,
    sha256: hashSha256,
  });
  if (erroRegistro && erroRegistro.code !== '23505') throw erroRegistro; // 23505: já registrado

  await db.anexos.update(anexoId, { 'meta.caminho': caminho });
  await db.fotosFila.delete(anexoId);
}

/** Envia as fotos dos laudos que já estão no servidor. Falha fica na fila para a próxima vez. */
export async function enviarFotosPendentes(): Promise<void> {
  const fila = await db.fotosFila.where('acao').equals('enviar').toArray();
  const laudoIds = [...new Set(fila.map((f) => f.laudoId))].filter((id) => UUID.test(id)).slice(0, MAX_LAUDOS_POR_CONSULTA);
  if (laudoIds.length === 0) return;

  const { data, error } = await supabase.from('reports').select('id, tenant_id, status').in('id', laudoIds);
  if (error) {
    console.warn('[Fotos] Não foi possível consultar os laudos:', error.message);
    return;
  }
  const laudos = new Map((data ?? []).map((l) => [l.id as string, l]));

  for (const item of fila) {
    const laudo = laudos.get(item.laudoId);
    if (!laudo || !STATUS_QUE_ACEITA_FOTO.includes(laudo.status)) continue;
    try {
      await enviarFoto(item.anexoId, laudo.tenant_id, item.laudoId);
    } catch (err) {
      console.warn('[Fotos] Falha ao enviar foto, nova tentativa na próxima sincronização:', err);
    }
  }
}

/** Apaga do servidor as fotos removidas. Roda antes dos laudos: apagar o laudo tira o registro do caminho. */
export async function processarRemocoesDeFotos(): Promise<void> {
  const fila = await db.fotosFila.where('acao').equals('remover').toArray();
  for (const item of fila) {
    try {
      const { data: linha, error } = await supabase.from('report_attachments').select('storage_path').eq('id', item.anexoId).maybeSingle();
      if (error) throw error;
      if (linha) {
        // O arquivo sai primeiro: se o registro falhar, a nova tentativa ainda acha o caminho.
        // Em laudo já enviado, a RLS não deixa apagar nenhum dos dois.
        const { error: erroArquivo } = await supabase.storage.from(BUCKET).remove([linha.storage_path]);
        if (erroArquivo) throw erroArquivo;
        const { error: erroRegistro } = await supabase.from('report_attachments').delete().eq('id', item.anexoId);
        if (erroRegistro) throw erroRegistro;
      }
      await db.fotosFila.delete(item.anexoId);
    } catch (err) {
      console.warn('[Fotos] Falha ao remover foto, nova tentativa na próxima sincronização:', err);
    }
  }
}

/** Fotos à espera. Laudo sem obra não vai ao servidor, então não conta como pendência. */
export async function contarFotosPendentes(): Promise<number> {
  let total = 0;
  for (const item of await db.fotosFila.toArray()) {
    if (item.acao === 'remover' || (await db.reports.get(item.laudoId))?.workOrderId) total += 1;
  }
  return total;
}
