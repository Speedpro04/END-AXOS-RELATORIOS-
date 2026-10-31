# Icones dos metodos de END (Axos Relatorios)

Conjunto unico no VectorCraft. Lista em `brand/icons/end/end-methods.json` (confirmar contra `metodos_end_16.md`; o rascunho tem 15 entradas porque CR/DR esta junto, e a lista de 16 conta CR e DR separados).

## Especificacao
- Grade 24x24, area util 20x20, traco uniforme de 1.75px, pontas arredondadas
- Cor via `currentColor` (a cor vem do tema, nunca fixa no SVG)
- Sem preenchimento decorativo, sem gradiente, sem sombra
- Reconhecivel em 20px e nitido em 2x
- Nome: `icon-end-<sigla>.svg`; versao grande para catalogo: `icon-end-<sigla>@2x.svg`

## Fluxo
1. Desenhar no VectorCraft em `products/axos-relatorios/src/icons/`
2. Exportar SVG para `brand/icons/end/`
3. `node scripts/check-assets.mjs`
4. Revisar em 20px, 32px e no catalogo alfabetico (lado a lado, espacamento generoso)
