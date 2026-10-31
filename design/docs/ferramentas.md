# Ferramentas (ArtCraft)

| Ferramenta | Papel | Equivale a | Versao |
|---|---|---|---|
| FigCraft | Interface, componentes, auto layout, variaveis, prototipos | Figma | 0.13.1 |
| VectorCraft | Logos, icones, ilustracao, SVG/PDF | Illustrator | 0.19.0 |
| PhotoCraft | Imagem, camadas, PSD, lote | Photoshop | 0.18.0 |
| DesignCraft | Diagramacao (PDF, laudos, material impresso) | InDesign | 0.15.2 |

Todas: Rust, MIT OR Apache-2.0, CLI headless e servidor MCP (o Claude Code opera os mesmos comandos da interface).

## Pontos de atencao
- Maturidade: FigCraft e PhotoCraft se declaram alpha; VectorCraft esta em desenvolvimento ativo (alpha). Use com validacao humana e mantenha exports (SVG/PDF/PNG) versionados.
- Nao copiamos o codigo dos kits para este repo. Instale o binario (release ou `cargo build --release`) e fixe a versao em `tools.lock.json`.
- A licenca permite uso comercial; preserve NOTICE/ATTRIBUTION se redistribuir qualquer parte.
- Fontes (Archivo, Cormorant Garamond, Montserrat): confirmar licenca antes de embutir em PDFs distribuidos.
