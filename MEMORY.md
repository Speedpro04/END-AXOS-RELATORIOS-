# MEMORY – AXOS Relatórios (Contexto e Memória Arquitetural)

## 1. Resumo do Repositório e Missão
O **AXOS Relatórios** é uma solução de software para o segmento de Integridade Estrutural e Ensaios Não Destrutivos. O sistema opera tanto em modo PWA offline no campo quanto em servidores gerenciados no EasyPanel via Docker.

---

## 2. Decisões Recentes de Arquitetura e Implementação

### 2.1. Fila de Espera Redis + FastAPI + ARQ
- **Motivação**: Evitar sobrecarga e deadlocks no PostgreSQL/Supabase quando múltiplos inspetores sincronizam dezenas de medições simultaneamente ao retornar de áreas industriais sem internet.
- **Implementação**:
  - `backend/app/core/redis.py`: Pool assíncrono com conexão resiliente e ping healthcheck.
  - `backend/app/queues/enqueue.py`: Enfileiramento de laudos individuais e em lote (`batch`), com deduplicação por hash SHA-256 e TTL de 24h.
  - `backend/app/queues/worker.py`: Configuração de worker ARQ com prioridade em `queue_laudos_priority` e `queue_laudos_default`.
  - `backend/app/routers/sync.py`: Endpoints REST para ingestão imediata e consulta assíncrona por `job_id`.
  - Pacotes instalados: `redis[hiredis]`, `arq`, `tenacity`.

### 2.2. Armazenamento Offline com Dexie.js
- **Motivação**: Compatibilidade total com `verbatimModuleSyntax` e persistência robusta de anexos pesados (fotos de ensaio, relatórios visuais).
- **Implementação**:
  - `frontend/src/services/dbDexie.ts`: Utilização de `import Dexie, { type Table } from 'dexie'` e schema `axos-anexos` indexado por `laudoId`.

### 2.3. Design System & Tela de Login
- **Tema Escuro Padrão**: Sincronizado com `ThemeContext.tsx`, inicializa sempre em `dark` na primeira visita e persiste a chave `axos_theme` no `localStorage`.
- **Layout Unificado 1140px**:
  - Container delimitado em `maxWidth: 1140px` com centralização automática.
  - Painéis unidos sem lacunas (`login-brand-panel` em grafite `#0D0F11` e `login-form-panel` em `#1A1C1F` no escuro ou `#FFFFFF` no claro).
  - Alinhamento superior: O topo do formulário ("Portal de Acesso" e título) está alinhado com a logo Axos.
  - Alinhamento inferior: O rodapé de links e segurança está alinhado com as três linhas de bullets técnicos do painel esquerdo.
  - Gráfico animado de ultrassom A-scan centralizado no painel esquerdo.
  - Logo oficial AXOS Relatórios centralizada no painel de login e inserida no rodapé (`TenantFooter`).

### 2.4. Cards de Métricas Operacionais (Alto Contraste)
- Redesenho completo do `DashboardMetrics.tsx` eliminando o visual leitoso/apagado anterior (`rgba(255,255,255,0.45)`).
- Cards em grafite escuro sólido (`#1C1F24` a `#15171A`), com faixa de destaque superior colorida (3px), ícones Lucide específicos por status, números em Archivo de alto contraste e tipografia mono nítida sem truncamentos.

### 2.5. Deploy e Containers (EasyPanel)
- `backend/Dockerfile`: Imagem multi-stage Python 3.11 compartilhada entre API (Uvicorn) e Worker (ARQ).
- `frontend/Dockerfile` + `frontend/nginx.conf`: Servidor Nginx configurado com rotas SPA, gzip e headers de segurança.
- `docker-compose.yml`: Orquestração local completa para testes de integração.

---

## 3. Estrutura de Arquivos Relevantes

```
END-AXOS-RELATORIOS/
├── PRD.md                               ← Documento de Requisitos do Produto
├── MEMORY.md                            ← Histórico de decisões e arquitetura
├── docker-compose.yml                   ← Ambiente local (Redis, API, Worker, Front)
├── backend/
│   ├── Dockerfile                       ← Build da API e Worker ARQ
│   ├── pyproject.toml                   ← Dependências Python
│   └── app/
│       ├── main.py                      ← FastAPI e lifespan do Redis
│       ├── core/
│       │   ├── config.py                ← Settings e variáveis de ambiente
│       │   └── redis.py                 ← Pool de conexão Redis
│       ├── queues/
│       │   ├── enqueue.py               ← Enfileiramento de laudos
│       │   ├── worker.py                ← Worker ARQ
│       │   └── workers/
│       │       ├── sync_worker.py       ← Gravação no Supabase
│       │       ├── pdf_worker.py        ← Worker de geração de laudos em PDF
│       │       └── email_worker.py      ← Worker de e-mails
│       └── routers/
│           └── sync.py                  ← Rotas /api/sync
└── frontend/
    ├── Dockerfile                       ← Build do Vite + Nginx
    ├── nginx.conf                       ← Configuração Nginx para PWA SPA
    └── src/
        ├── contexts/
        │   └── ThemeContext.tsx         ← Tema dark padrão e alternância
        ├── pages/
        │   └── LoginPage.tsx            ← Tela de login unificada 1140px
        └── services/
            ├── dbDexie.ts               ← Banco IndexedDB tipado Dexie
            └── anexos.ts                ← Gerenciamento de anexos offline
```

---

## 4. Próximos Passos Sugeridos
1. Integrar geração definitiva de PDF no `pdf_worker.py` (usando ReportLab ou WeasyPrint).
2. Conectar envio real de e-mails (Resend, SendGrid ou SES) em `email_worker.py`.
3. Adicionar testes unitários e de integração para a fila Redis com pytest.

---

## 5. Regra Permanente — Terminologia END (valida para esta e todas as tarefas futuras)

- **Nunca escrever a sigla inglesa proibida (nenhuma capitalização)** em UI, textos, comentários, identificadores, mocks, testes ou docs. Usar sempre "END".
- Se o usuário ou exemplo externo usar a sigla inglesa proibida, converter para "END" sem perguntar.
- Antes de concluir qualquer tarefa futura, rodar busca por a sigla inglesa proibida (case-insensitive, palavra inteira) excluindo node_modules, dev-dist e .git → resultado esperado: ZERO ocorrências.

## 6. Resumo da Mudança — Padronização END (27/10/2026)

Remoção da sigla inglesa proibida e padronização para "END" em todo o frontend:

- `frontend/src/types/tenant.ts`: adicionado `reportPrefix: string` (padrão `'END'`); `tradeName` → `QUALITEC END & INSPEÇÕES`; `contractRef` → `CT-PETRO-2026/0892`; `contactEmail` → `operacoes@qualitec-end.com.br`.
- `frontend/src/types/inspection.ts`: tipo de método (sigla antiga em inglês) → `ENDMethod`; comentário de `code` → `// Ex: END-LP-2026-0042`.
- `frontend/src/utils/buildReportCode.ts`: novo util `buildReportCode(prefix, method, year, seq)` → `{PREFIXO}-{MÉTODO}-{ANO}-{SEQ(3 dígitos)}`.
- `frontend/src/App.tsx`: mocks atualizados para códigos `END-...-2026-...` (e `NR13-VASO-2026-08`); `handleSaveReport` usa `buildReportCode(tenant.reportPrefix, ...)`; título fallback → `Laudo Técnico END`.
- `frontend/src/pages/HubPage.tsx`: `sigla antiga em inglês / NR-13` → `END / NR-13`.
- `frontend/src/components/TenantFooter.tsx`: `& sigla antiga em inglês` → `& END`.
- `frontend/src/components/InspectionModal.tsx`: comentário `Método END`; tipo de método (sigla antiga em inglês) → `ENDMethod`.
- `frontend/src/components/InspectionTable.tsx`: tipo de método (sigla antiga em inglês) → `ENDMethod`.
- `frontend/src/pages/LPPage.tsx`: `procedureCode` → `PR-END-LP-002 Rev. 04`; contrato fallback → `CTR-2026-END-089`; `LAUDO Nº` gerado via `buildReportCode`.
- `PRD.md`: seção 6 "Terminologia — END".
- `AGENTS.md`: criado na raiz com a regra permanente.

**Pendência (banco/backend):** não há verificação de campo `reportPrefix` na tabela `tenants` do Supabase. Não foi criada migration nesta tarefa. Pendente: confirmar existência do campo em `tenants` e, se ausente, adicionar migration correspondente.

Todas as operações neste repositório são regidas pela skill **andrej-karpathy-skills** (https://github.com/multica-ai/andrej-karpathy-skills.git), inspirada nas observações de Andrej Karpathy sobre armadilhas comuns de LLMs em programação. Ela é a **base obrigatória** para qualquer alteração, implementação ou revisão de código.

### 5.1. Think Before Coding (Pense Antes de Codificar)
- Não faça suposições silenciosas. Se houver dúvida, pergunte antes de implementar.
- Apresente múltiplas interpretações quando houver ambiguidade; não escolha silenciosamente.
- Exponha tradeoffs e contras antes de decidir um caminho.
- Se algo estiver confuso, pare. Nomeie o que não está claro e peça esclarecimento.
- Se houver uma abordagem mais simples, diga isso e resista à sobreengenharia.

### 5.2. Simplicity First (Simplicidade em Primeiro Lugar)
- Código mínimo que resolve o problema. Nada especulativo.
- Sem funcionalidades além do que foi solicitado.
- Sem abstrações para código de uso único.
- Sem "flexibilidade" ou "configurabilidade" não solicitadas.
- Sem tratamento de erro para cenários impossíveis.
- Se 200 linhas pudessem ser 50, reescreva em 50.
- Pergunta de validação: "Um engenheiro sênior diria que isso está supercomplicado?" Se sim, simplifique.

### 5.3. Surgical Changes (Mudanças Cirúrgicas)
- Toque apenas o que é necessário. Limpe apenas a sua própria bagunça.
- Não "melhore" código, comentários ou formatação adjacentes.
- Não refatore o que não está quebrado.
- Mantenha o estilo existente, mesmo que faria diferente.
- Se notar código morto não relacionado, mencione — não apague.
- Remova apenas imports/variáveis/funções que **SUAS** mudanças tornaram órfãos.
- Teste de validação: toda linha alterada deve rastrear diretamente à solicitação do usuário.

### 5.4. Goal-Driven Execution (Execução Guiada por Objetivos)
- Defina critérios de sucesso verificáveis. Loop até verificar.
- Transforme tarefas imperativas em objetivos declarativos com verificação:
  - "Adicionar validação" → "Escrever testes para entradas inválidas, então fazê-las passar"
  - "Corrigir o bug" → "Escrever um teste que reproduza o bug, então fazê-lo passar"
  - "Refatorar X" → "Garantir que os testes passem antes e depois"
- Para tarefas de múltiplas etapas, apresente um plano breve:
  ```
  1. [Etapa] → verificar: [checagem]
  2. [Etapa] → verificar: [checagem]
  3. [Etapa] → verificar: [checagem]
  ```
- Critérios de sucesso fortes permitem execução autônoma. Critérios fracos ("faça funcionar") exigem esclarecimento constante.

### 5.5. Sinais de que as Diretrizes Estão Funcionando
- Menos alterações desnecessárias nos diffs (apenas o solicitado aparece).
- Menos reescritas por supercomplicação (código simples de primeira).
- Perguntas de esclarecimento vêm **antes** da implementação, não depois dos erros.
- PRs limpos e minimalistas — sem refatoração "de passagem" ou "melhorias" não solicitadas.

### 5.6. Fonte da Skill
- Repositório: https://github.com/multica-ai/andrej-karpathy-skills.git
- Arquivo base: `CLAUDE.md` (quatro princípios detalhados)
- Exemplos: `EXAMPLES.md` (anti-padrões e correções)
