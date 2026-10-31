#!/usr/bin/env bash
# Renderiza artes de um produto com as CLIs do ArtCraft. Uso: scripts/render.sh <produto> [escala]
set -euo pipefail
P="${1:?uso: render.sh <produto> [escala]}"; S="${2:-2}"
SRC="products/$P/src"; OUT="products/$P/exports"; mkdir -p "$OUT"
shopt -s nullglob
for f in "$SRC"/*.figcraft; do
  figcraft-cli render "$f" -o "$OUT/$(basename "${f%.figcraft}").png" --scale "$S"
  figcraft-cli export "$f" -o "$OUT/" --format svg
done
echo "Render concluido: $P (vectorcraft/photocraft: ver docs/ferramentas.md)"
