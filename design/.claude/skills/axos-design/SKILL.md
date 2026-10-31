---
name: axos-design
description: Regras de design da Axos Hub. Use em qualquer tela, arte, logo, template ou documento visual dos produtos Axos (paineis, SaaS, marketing, laudos).
---

# Axos Design

Fonte unica: `tokens/axos.tokens.json` (gere CSS com `node scripts/build-tokens.mjs`). Nunca invente cor, fonte ou raio fora dos tokens.

## Regras fixas
- Dark mode como tema unico. Sem tema claro.
- Paineis e produtos: Archivo (sem serifa), raio de borda 5px, texto nitido, negrito sem exagero e sem peso fino demais, bons espacamentos, poucas cores.
- Marca e marketing: Cormorant Garamond (display) + Montserrat; azul marinho #0A2540 com acentos dourados.
- Emojis nunca. Icones vetoriais com traco uniforme.
- Contraste minimo WCAG AA. Alvo de toque minimo de 44px no mobile.

## Fluxo
1. Ler tokens e `docs/qualidade-checklist.md`.
2. Criar/editar em `products/<produto>/src`.
3. Exportar com `scripts/render.sh <produto>`.
4. Rodar `node scripts/check-assets.mjs`.
5. Registrar aprendizado em `docs/melhorias/registro.md`.
