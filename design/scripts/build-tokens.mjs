// Gera tokens/dist/tokens.css (base) e tokens/dist/<produto>.css (camada por produto, escopo [data-product]).
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
const read = p => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const flatten = src => { const f = {};
  for (const [g, items] of Object.entries(src)) { if (g.startsWith('_')) continue;
    for (const [k, v] of Object.entries(items)) f[`${g}-${k}`] = v.value; }
  return f; };
const decl = f => Object.entries(f).map(([k, v]) => `  --axos-${k}: ${v};`).join('\n');
const out = new URL('../tokens/dist/', import.meta.url);
mkdirSync(out, { recursive: true });

const base = flatten(read('../tokens/axos.tokens.json'));
writeFileSync(new URL('tokens.css', out), `:root {\n${decl(base)}\n  color-scheme: dark;\n}\n`);
writeFileSync(new URL('tokens.json', out), JSON.stringify(base, null, 2) + '\n');
console.log(`base: ${Object.keys(base).length} tokens`);

for (const file of readdirSync(new URL('../tokens/products/', import.meta.url)).filter(n => n.endsWith('.tokens.json'))) {
  const name = file.replace('.tokens.json', '');
  const src = read(`../tokens/products/${file}`);
  const layer = flatten(src);
  writeFileSync(new URL(`${name}.css`, out), `[data-product="${name}"] {\n${decl(layer)}\n}\n`);
  console.log(`${name}: ${Object.keys(layer).length} overrides`);
  (src._pendente || []).forEach(p => console.warn(`  PENDENTE (${name}): ${p}`));
}
