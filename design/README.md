# Design System & Artes — AXOS Relatórios

Este diretório contém o repositório de design e identidade visual da Axos Hub integrado ao produto **AXOS Relatórios**. Ele atua como fonte única de verdade para tokens visuais, catálogo de ícones de Ensaios Não Destrutivos (END), checklist de controle de qualidade e automações para agentes.

---

## 1. Estrutura de Diretórios

```
design/
├── README.md                           ← Este guia de integração e uso
├── tokens/
│   ├── axos.tokens.json                ← Tokens base da Axos Hub
│   ├── products/
│   │   └── axos-relatorios.tokens.json ← Tokens consolidados e overrides do AXOS Relatórios
│   └── dist/
│       ├── tokens.css                  ← CSS base (:root)
│       ├── axos-relatorios.css         ← CSS de escopo [data-product="axos-relatorios"]
│       └── tokens.json                 ← JSON achatado para uso em tooling/builds
├── brand/
│   ├── logos/                          ← Identidade da marca e logotipo
│   └── icons/
│       └── end/
│           ├── end-methods.json        ← Lista oficial de métodos de END e especificações
│           └── icon-end-*.svg          ← Ícones vetoriais de cada método
├── docs/
│   ├── icones-end.md                   ← Guia de desenho e especificação dos ícones de END
│   ├── qualidade-checklist.md          ← Checklist de controle de qualidade visual e QA
│   ├── ferramentas.md                  ← Configuração de CLIs e renderizadores
│   ├── melhoria-continua.md            ← Ciclo PDCA para evolução do design
│   └── melhorias/registro.md           ← Registro histórico de alterações visuais
├── products/
│   └── axos-relatorios/
│       ├── src/                        ← Arquivos-fonte (.vectorcraft, .figcraft, vetores)
│       └── exports/                    ← SVGs e PNGs finais exportados
└── scripts/
    ├── build-tokens.mjs                ← Script gerador de CSS a partir dos tokens JSON
    ├── check-assets.mjs                ← Validador de conformidade e integridade dos assets
    └── render.sh                       ← Script de renderização automatizada
```

---

## 2. Como Usar no AXOS Relatórios

### 2.1. Compilação de Tokens

Toda alteração de cores, espaçamentos ou tamanhos é feita em `design/tokens/products/axos-relatorios.tokens.json`. Em seguida, execute:

```bash
node design/scripts/build-tokens.mjs
```

O comando gera automaticamente os arquivos em `design/tokens/dist/`.

### 2.2. Integração no Frontend

O frontend consome as variáveis geradas aplicando o atributo `data-product="axos-relatorios"` na raiz da aplicação (ou em `<html>`/`<body>`):

```html
<html lang="pt-BR" data-product="axos-relatorios">
```

As variáveis ficam disponíveis com o prefixo `--axos-*` ou mapeadas diretamente para as variáveis legadas do tema industrial (`--bg`, `--surface`, `--accent`, etc.).

---

## 3. Diretrizes de Rigor Técnico

1. **Tema Escuro em Telas**: Superfície grafite industrial (`#0B0F14`, `#121821`, `#1A2230`), texto de alto contraste (`#E8ECF2`) e acento azul (`#2F6FDB`). Sem modo claro nas interfaces operacionais do inspetor.
2. **Tema Claro em Impressão/PDF (`theme-print`)**: Exceção formal para laudos técnicos impressos ou gerados em PDF (`#FFFFFF` de papel, `#111111` de tinta) para cumprimento das normas NR-13, ASME e Petrobras.
3. **Ícones de END**: Vetoriais, traço uniforme 1.75px, grade 24x24 (área útil 20x20), sem emojis e com cor controlada via `currentColor`.
4. **Sem Elementos Decorativos Desnecessários**: Sem gradientes, sem glassmorphism, sem sombras pesadas ou animações supérfluas.
