---
name: design-frontend
description: Regras de design do painel operacional (tipografia, cores, espaçamento, raio, componentes, estados). Use ao criar, alterar ou revisar qualquer tela, componente ou estilo do frontend.
---

# Design do painel operacional

Objetivo: interface sóbria, nítida e rápida de ler. Consistência vale mais que criatividade. Estas regras têm prioridade sobre qualquer preferência estética genérica.

## Regras inegociáveis

1. Raio de borda: **5px** em tudo (botão, input, card, modal, badge, tabela, menu). Única exceção: avatar circular.
2. **Nunca usar emojis**, nem na interface, nem em mensagens, nem em dados de exemplo. Ícones apenas em SVG de traço (Lucide), 16px ou 20px, traço 1.75.
3. Nunca valores soltos: toda cor, tamanho, espaçamento e raio vem dos tokens abaixo.
4. Poucas cores. Cor só existe quando comunica algo (ação principal, status, erro).
5. Sem gradientes, sem glassmorphism, sem sombras pesadas, sem animação decorativa.
6. Tema único: **escuro (dark mode)** em todos os sistemas. Não existe tema claro nem botão de alternar tema.

## Tipografia

Uma única família: **Archivo** (Google Fonts), largura normal, em fonte variável com os pesos 400 a 600. Fallback: system-ui, -apple-system, Segoe UI, sans-serif. Nada de serifa no painel. Carregar com `font-display: swap` e hospedar localmente (next/font ou arquivo próprio) para evitar atraso e quebra de layout.

Texto nítido: `-webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;`

| Uso | Tamanho | Peso | Altura de linha |
|---|---|---|---|
| Texto base (corpo, células, inputs) | 16px | 400 | 1.5 |
| Texto secundário (legendas, ajuda, metadados) | 14px | 400 | 1.45 |
| Rótulo de campo, cabeçalho de tabela | 14px | 500 | 1.4 |
| Título de seção | 18px | 600 | 1.35 |
| Título de página | 24px | 600 | 1.25 |
| Número de destaque (KPI) | 28px | 600 | 1.2 |

- Pesos permitidos: 400, 500 e 600. Nunca 300 ou menos (fino demais) e nunca 700 ou mais (pesado demais).
- Negrito só para títulos e valores importantes, nunca em frases inteiras.
- Tamanho mínimo de qualquer texto: 13px, e só para rodapé de tabela ou legenda.
- Sem caixa alta em rótulos. Frases em sentence case.
- Números em tabelas e KPIs com `font-variant-numeric: tabular-nums`.
- Linhas de texto corrido com no máximo 75 caracteres.

## Cores

Tema escuro único. Base neutra, um acento e quatro cores de status. Nada além disso.

```css
:root {
  color-scheme: dark;

  /* Superfícies e texto (camadas: bg < surface < surface-muted) */
  --bg: #0B0F14;            /* fundo da aplicação */
  --surface: #121821;       /* cards, tabelas, modais, sidebar */
  --surface-muted: #1A2230; /* hover de linha, áreas secundárias */
  --border: #263042;        /* bordas e divisores */
  --text: #E8ECF2;          /* texto principal */
  --text-muted: #9AA6B8;    /* texto secundário */

  /* Acento (ação principal, link, foco) */
  --accent: #2F6FDB;        /* fundo do botão primário, texto branco */
  --accent-hover: #2A64C8;
  --accent-text: #6FA8FF;   /* links e item ativo sobre fundo escuro */
  --accent-soft: #16263F;   /* fundo de item selecionado */

  /* Status (sempre com texto, nunca só cor) */
  --success: #3DBE7A;  --success-soft: #11271C;
  --warning: #E0A93B;  --warning-soft: #2B2210;
  --danger:  #F06A6A;  --danger-soft:  #2E1618;
  --info:    #6FA8FF;  --info-soft:    #14253D;
}
```

- Nunca usar preto puro (`#000`) nem branco puro (`#FFF`) como texto. O texto principal é `--text`.
- Profundidade vem da camada de superfície e da borda, não de sombra: quanto mais elevado, mais claro o fundo.
- Botão primário: fundo `--accent`, texto `#FFFFFF`. Um único botão primário por área de ação.
- Contraste mínimo de texto: 4.5:1. Texto secundário nunca mais escuro que `--text-muted`.
- Status nunca depende só da cor: sempre badge com texto (ex.: "Pago", "Pendente", "Atrasado").
- O dourado da identidade fica fora do painel. Se for usado, apenas no logotipo.
- Gráficos: usar `--accent-text` como série principal e tons neutros para o resto; cor de status só quando o dado for status.
- Imagens e logotipos precisam ter versão legível sobre fundo escuro.

## Espaçamento

Escala base de 4px: `4, 8, 12, 16, 24, 32, 48`.

- Padding de card: 24px. Padding de modal: 24px.
- Espaço entre campos de formulário: 16px. Entre rótulo e campo: 6px.
- Espaço entre seções de uma página: 32px.
- Margem lateral do conteúdo: 32px no desktop, 16px no mobile.
- Altura de controles (botão, input, select): 40px. Versão compacta: 32px.
- Altura de linha de tabela: 48px. Padding horizontal de célula: 16px.
- Largura máxima do conteúdo: 1280px, exceto tabelas largas.

## Superfície e profundidade

- Card: fundo `--surface`, borda 1px `--border`, raio 5px, **sem sombra**.
- Sombra só em elementos flutuantes (menu suspenso, modal): `0 8px 24px rgba(0,0,0,0.5)`, sempre com borda 1px `--border`.
- Divisores 1px `--border`. Sem bordas grossas e sem bordas coloridas decorativas.

## Layout do painel

- Sidebar fixa à esquerda, 240px, fundo `--surface`, item ativo com `--accent-soft` e texto `--accent-text`.
- Cabeçalho de página: título, descrição curta opcional e ações à direita.
- Conteúdo em grade de 12 colunas, alinhado à esquerda. Nada centralizado, exceto estados vazios.
- Hierarquia: o que exige ação do operador aparece primeiro e no topo.
- Densidade: mostrar o necessário para decidir, sem rolar para achar o essencial.

## Componentes

**Botão**: primário (fundo accent, texto branco), secundário (borda `--border`, fundo surface), texto (sem borda), destrutivo (fundo `--danger-soft`, texto e borda `--danger`, só em confirmação). Peso 500, 16px. Rótulo com verbo claro: "Salvar alterações", nunca "Enviar" ou "OK".

**Input / select / textarea**: 40px, borda 1px `--border`, raio 5px, fundo branco. Foco: borda `--accent-text` e anel `0 0 0 3px var(--accent-soft)`. Erro: borda `--danger` e mensagem abaixo em 14px. Rótulo sempre visível acima; placeholder nunca substitui o rótulo.

**Tabela**: cabeçalho 14px peso 500 em `--text-muted` sobre `--surface-muted`; linhas com divisor 1px; hover em `--surface-muted`; texto alinhado à esquerda, números à direita; ações da linha à direita; cabeçalho fixo em listas longas; paginação ou rolagem infinita com contagem total visível.

**Badge de status**: 14px, peso 500, padding 2px 8px, raio 5px, fundo `-soft` e texto na cor do status.

**Modal**: largura 480px (formulário) ou 720px (conteúdo extenso), título 18px, ações no rodapé alinhadas à direita, botão primário por último. Fecha com Esc.

**Card de KPI**: rótulo 14px `--text-muted`, valor 28px peso 600, variação opcional em 14px com cor de status.

**Toast**: canto superior direito, texto curto no mesmo verbo da ação ("Alterações salvas"), some em 5s, erros permanecem até fechar.

## Estados obrigatórios

Todo componente e toda tela de dados precisam de:

- **Carregando**: skeleton no formato do conteúdo, nunca spinner solto em tela vazia.
- **Vazio**: uma frase explicando o que falta e um botão com a ação que resolve.
- **Erro**: o que aconteceu e como resolver, sem pedir desculpas e sem texto técnico. Botão "Tentar novamente".
- **Foco visível por teclado**: anel de 3px em todos os elementos interativos.
- **Desabilitado**: opacidade 0.5, cursor `not-allowed`.
- **Hover**: mudança sutil de fundo, sem movimento.

## Movimento

Apenas transições de 120ms a 160ms (`ease-out`) em hover, foco, abrir e fechar. Respeitar `prefers-reduced-motion`.

## Textos da interface

- Português do Brasil, sentence case, voz ativa, linguagem do operador e não do sistema.
- Uma ação mantém o mesmo nome em todo o fluxo: botão "Publicar" gera toast "Publicado".
- Datas `dd/mm/aaaa`, hora `24h`, moeda `R$ 1.234,56`.
- Sem pontos de exclamação, sem humor, sem emoji.

## Responsivo e acessibilidade

- Funciona de 360px a 1920px. Abaixo de 768px a sidebar vira menu recolhível e tabelas viram lista de cards ou rolam na horizontal dentro do próprio contêiner.
- Alvos de toque de pelo menos 40px.
- Contraste AA em tudo, navegação completa por teclado, `aria-label` em botões só com ícone.

## Como trabalhar com esta skill

1. Antes de criar tela nova, reutilize os componentes existentes. Só crie componente novo se nenhum servir.
2. Ao corrigir visual, altere o token ou o componente base, nunca a tela isolada.
3. Ao revisar, liste violações agrupadas por tipo (cor solta, raio diferente de 5px, fonte fora da escala, emoji, estado faltando) e corrija por lote: tokens, componentes base, depois páginas.
4. Antes de finalizar, confira: raio 5px, nenhum emoji, só tokens, estados de carregando/vazio/erro presentes, foco visível.
