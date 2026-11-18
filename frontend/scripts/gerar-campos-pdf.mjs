// Copia para a API os nomes dos campos de cada método, usados no PDF oficial do laudo.
// Rode depois de mudar CAMPOS_POR_METODO, colunasIndicacao ou TIPOS_DEFEITO:  npm run gerar:campos-pdf
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const campos = await import('../src/types/laudoEnsaio.ts')
const { METHOD_LABELS } = await import('../src/types/inspection.ts')

const metodos = Object.keys(METHOD_LABELS)
const dados = {
  aviso: 'Gerado por frontend/scripts/gerar-campos-pdf.mjs. Não edite à mão.',
  metodos: METHOD_LABELS,
  campos: campos.CAMPOS_POR_METODO,
  colunas: Object.fromEntries(metodos.map((m) => [m, campos.colunasIndicacao(m)])),
  tiposDefeito: campos.TIPOS_DEFEITO,
}

const destino = fileURLToPath(new URL('../../backend/app/pdf/campos_metodo.json', import.meta.url))
writeFileSync(destino, JSON.stringify(dados, null, 2) + '\n', 'utf8')
console.log('Campos do PDF gravados em', destino)
