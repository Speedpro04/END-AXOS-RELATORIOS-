// Controle de qualidade basico: nomes kebab-case, tamanho e SVG sem script.
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
const MAX = 5 * 1024 * 1024; const NAME = /^[a-z0-9]+(-[a-z0-9]+)*(@[0-9]x)?\.[a-z0-9]+$/;
let bad = 0;
const walk = d => { if (!existsSync(d)) return; for (const n of readdirSync(d)) {
  const p = join(d, n); const s = statSync(p);
  if (s.isDirectory()) { walk(p); continue; }
  if (n === '.gitkeep' || n === 'README.md') continue;
  if (!NAME.test(n)) { console.error('Nome fora do padrao (kebab-case):', p); bad++; }
  if (s.size > MAX && !['.psd', '.psb'].includes(extname(n))) { console.error('Arquivo acima de 5 MB:', p); bad++; }
  if (extname(n) === '.svg' && /<script|onload=|javascript:/i.test(readFileSync(p, 'utf8'))) { console.error('SVG com script:', p); bad++; }
}};
['products', 'brand', 'templates'].forEach(walk);
if (bad) { console.error(`${bad} nao conformidade(s)`); process.exit(1); }
console.log('Assets OK');
