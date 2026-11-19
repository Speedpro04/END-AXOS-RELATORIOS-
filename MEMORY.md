# MEMORY – AXOS Relatórios (Contexto e Memória Arquitetural)

## 1. Resumo do Repositório e Missão
O **AXOS Relatórios** é uma solução de software para o segmento de Integridade Estrutural e Ensaios Não Destrutivos. O sistema opera tanto em modo PWA offline no campo quanto em servidores gerenciados no EasyPanel via Docker.

---

## 1.a Correções do Painel de Avanço, Fila de Sync e Ocultador (04/11/2026)

**Backend `backend/app/routers/avanco.py` — função `avanco_obra` corrigida:**
- Consulta a `reports` usava colunas inexistentes (`method`, `date`, `inspector_name`); corrigida para as colunas reais da 0001: `inspection_date`, `inspector_id` (nome em `profiles.full_name`), método via `template_id` → `report_templates.method` (duas consultas de mapa: templates e perfis).
- Revisões: busca por `document_id` de todos os laudos vinculados (2 consultas encadeadas), não só pelos ids ligados; conta a revisão `issued` de maior `revision` por documento, herdando vínculo da revisão anterior quando a atual não tem.
- Bugs adicionais fechados no mesmo trecho: `laudo.get("code")` → `report_number`; `laudo_origem_id` lido do **vínculo** (coluna da `laudo_escopo_vinculo`, 0002) e não do laudo; status em português (`enviado`/`reprovado`) → enum real (`submitted`/`returned`).
- **Ocultador:** quando `tenants.ocultar_producao_colegas=true` e o usuário é `inspector`, a lista Produção por Inspetor e as Pendências mostram só o próprio trabalho; o painel da obra (totais, Curva S, rosca, linhas) permanece completo. Consulta a `tenants` com fallback tolerante caso a migração 0003 ainda não tenha sido executada no banco.

**Migração `supabase/migrations/0003_obra_ocultar_producao.sql` reescrita:**
- Índice removido (referenciava coluna `tenant_id` inexistente em `tenants` — a chave é `id`).
- Bug de sintaxe corrigido: faltava ponto e vírgula no fim do `COMMENT`.
- Proteção da coluna: `GRANT UPDATE (ocultar_producao_colegas) ... TO authenticated` — combinado com a política `tenants_update` da 0001 (que exige papel `admin`), só o administrador altera a coluna. 0001 e 0002 não foram alteradas.

**Frontend:**
- `NovaObraPage.tsx`: obra e contratante agora enfileirados no `db.outbox` (entidades `site` e `client`, `op: create`) — antes nada no app inteiro gravava na fila (o `sync.ts` consumia um outbox sem produtores). Helper local `enfileirarSync` com a forma `OutboxItem` exata; ordem de envio já garantida pela prioridade do sync.ts (clients → sites → work_orders → reports). Sem caminho paralelo novo.
- `pages/ObraAvancoPage.tsx` removido e seu import tirado do `App.tsx` (tela substituída por `components/obra/ObraResumoAvanco.tsx`).
- Nova constante centralizada: `frontend/src/config.ts` (`API_BASE_URL`); `ObraResumoAvanco.tsx` importa de lá (antes a URL estava repetida nos dois arquivos).
- `ObraResumoAvanco.tsx` não precisou mudar para o ocultador: exibe o que o endpoint devolve já filtrado.
- `.gitignore`: confirmado já cobrir `*.egg-info/` e `__pycache__/` — sem alteração.

**Verificação:** `python -m py_compile app/routers/avanco.py` OK; `npx tsc -b` OK; busca pela sigla inglesa proibida → ZERO ocorrências. Pendente: migrações 0001/0002/0003 ainda não executadas no banco Supabase real; backend não rodando na máquina do usuário (falha do endpoint é tratada silenciosamente pelo frontend).

---

## 1.b Fundação de Dados e 16 Métodos (05/11/2026)

**Decisão do dono do produto:** ficam os 16 métodos do app. Telas aprovadas: não redesenhar. Formulários de cada método serão refinados depois, em conjunto.

**Banco:** `0001` agora instala de verdade (tipo `end_method` com os 16 códigos, quebra de linha literal removida do gatilho, políticas de `report_pdfs` depois das funções que usam). Nova coluna `reports.client_revision`. Número do laudo gerado no gatilho de emissão; `next_report_number` é `security definer` e exige revisor do próprio tenant; `report_number_counters` com RLS. `tenants` libera gravação de endereço, logo e prefixo. `0002`: chaves estrangeiras corrigidas, `method` usa o tipo do banco, escopo só por revisor. Nova `0004_modelos_metodos.sql` (16 modelos globais). `run_tests.mjs` aplica todas as migrações; `@electric-sql/pglite` entrou nas dependências de desenvolvimento; teste 8 novo.

**Backend:** `SUPABASE_ANON_KEY` nova em `config.py` e `.env`; cliente com JWT do usuário via `ClientOptions`; obra e OS usam `contratante_id` (antes o mesmo campo guardava duas coisas); idempotência do laudo por `client_revision`; itens de escopo, vínculo e exclusão de rascunho; erros genéricos ao aparelho; `/status` restrito a revisor; pool ARQ único; emissão com JWT do revisor e PDF real na fila; fila de PDF e e-mail corrigida para a fila que o worker consome; caminho do PDF e URL do QR corrigidos.

**Frontend:** as 16 telas salvam (antes descartavam tudo); método clicado chega ao formulário rápido; `sync.ts` reescrito (envia pelo backend, atualiza cache, backoff correto); `App.tsx` sincroniza ao entrar e separa laudos por empresa; dados de exemplo só em desenvolvimento; `VITE_API_URL` unificada; painel Escopo da obra ligado à tela real; obra concluída/reativada e escopo entram na fila.

**Verificação:** `npm run test:db` passa (8 grupos); `pytest` 19 passam; `npx tsc -b` sem erros; fluxo testado no navegador em modo demonstração (salvar laudo, criar contratante e obra, OS automática, fila com 4 itens).

**Não verificado:** envio real ao Supabase (o projeto do `.env` não está na conta conectada e as migrações não foram aplicadas). `pdf_worker` não roda nesta máquina (faltam `jinja2` e `weasyprint` no `.venv`).

**Pendências:** telas de aprovação e emissão; qualificações e instrumentos (sem eles o laudo não pode ser submetido); painéis Laudos, Novo laudo e Ordens de serviço da obra são textos provisórios; corpo do PDF por método; `Cadastros.tsx`, `USPage`, `LPPage`, `MEPage`, `EVSPage`, `NR13Page`, `PMPage` e `PinturaPage` seguem sem acesso; dados da empresa ainda só no aparelho; decidir login de demonstração, padrão do ocultador e bloqueio por plano.

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

### 2.3. Design System (repositório `design/` e regras em `.agents/skills/design-frontend/skill.md`)
- **Fonte única de tokens**: `design/tokens/products/axos-relatorios.tokens.json`, compilado via `node design/scripts/build-tokens.mjs` para `design/tokens/dist/axos-relatorios.css`.
- **Tema único nas telas**: escuro (dark mode) em todos os sistemas operacionais e PWA. Não existe tema claro na interface de campo.
- **Tema de impressão claro (`theme-print`)**: papel `#FFFFFF` e texto `#111111` exclusivamente para laudos impressos e geração de PDFs técnicos (normas NR-13, ASME, Petrobras).
- **Raio de borda**: 5px em tudo (botão, input, card, modal, badge, tabela, menu). Exceção: avatar circular.
- **Nunca usar emojis** (interface, mensagens ou dados de exemplo). Ícones apenas em SVG de traço uniforme (Lucide ou catálogo de métodos de END em `design/brand/icons/end/`), 16px ou 20px, traço 1.75, cor via `currentColor`.
- **Cores de superfície**: fundo `#0B0F14`, superfície `#121821`, superfície-muted `#1A2230`, borda `#263042`, texto `#E8ECF2`, texto-muted `#9AA6B8`.
- **Acento**: `#2F6FDB` (botão primário, texto branco).
- **Controles**: altura 40px, raio 5px. Padding de card/modal: 24px.
- **Sem gradientes, glassmorphism, sombras pesadas ou animação decorativa**.
- **Controle de qualidade**: validado contra `design/docs/qualidade-checklist.md`.

### 2.4. Cards de Métricas Operacionais
- Card de KPI: rótulo 14px `--text-muted`, valor 28px peso 600, variação opcional em 14px com cor de status.
- Cards seguem as regras do Design System: raio 5px, fundo `--surface`, borda 1px `--border`, sem sombra.
- Ícones apenas em SVG de traço (Lucide), 16px ou 20px, traço 1.75.
- Números com `font-variant-numeric: tabular-nums`.

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
├── design/                              ← Design System oficial Axos Hub
│   ├── README.md                        ← Guia de integração e uso do design
│   ├── tokens/                          ← Tokens base e do produto (axos-relatorios.tokens.json)
│   ├── brand/icons/end/                 ← Catálogo de ícones de métodos de END
│   ├── docs/                            ← Especificação de ícones, QA checklist e PDCA
│   └── scripts/                         ← build-tokens.mjs e check-assets.mjs
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

## 7. Registro de Execução — Tarefas Concluídas

**T-01 · Remover login de demonstração (27/10/2026)**
- `frontend/src/contexts/AuthContext.tsx`: removido o bloco de login direto para demonstração (e-mail/senha hardcoded e sessão simulada com `mock-access-token`) da função `signIn`; o login passa a ser exclusivamente `supabase.auth.signInWithPassword`.
- `frontend/src/pages/LoginPage.tsx`: placeholder do campo de email alterado de `axosrelatorios@gmail.com` para `seu@email.com`.
- Verificação: busca por `mock-access-token`, `axos-demo` e `axosrelatorios@gmail.com` no código e no bundle `dist/` → zero ocorrências; `npm run build` passa.
- Commit: `2d5742d` (T-01: Remover login de demonstração e placeholder de credencial).
- Nota: o commit histórico `f1eef30` já continha essas credenciais; responsável foi avisado (senha não impressa).

**Tarefa 0 · Segurança rápida: login demo só em desenvolvimento e arquivos gerados fora do git (27/10/2026)**
- `frontend/src/contexts/AuthContext.tsx`: o bloco de login demo foi re-adicionado envolvido em `import.meta.env.DEV`, lendo `VITE_DEMO_EMAIL` e `VITE_DEMO_PASSWORD` do ambiente. Em produção (`!DEV`) o bloco não existe.
- `frontend/.env.local`: criado localmente com os valores atuais (não versionado; coberto por `*.local` no `.gitignore`).
- `frontend/.env.example`: adicionadas `VITE_DEMO_EMAIL` e `VITE_DEMO_PASSWORD` vazias, com comentário "somente desenvolvimento, nunca em produção".
- `.gitignore`: já cobria `*.local`, `dist/`, `dev-dist/` e `node_modules/`; nenhuma alteração necessária.
- Verificação: `npm run build` passa; busca por `axosrelatorios@gmail.com`, `mock-access-token` e `axos-demo` no bundle `dist/` → zero ocorrências.
- Senha antiga NÃO foi impressa no terminal nem no resumo. O histórico do git ainda contém a senha antiga (commit `f1eef30`); responsável deve trocá-la.
- Commits: `2537ffb` (feat(auth): login demo em dev via variáveis de ambiente), `52ace26` (feat(env): variáveis de demo de desenvolvimento no .env.example).

**Tarefa A · Terminologia END e remoção de ABENDI dos textos (27/10/2026)**
- Textos de interface: HubPage.tsx (`sigla antiga em inglês / NR-13` → `END / NR-13`), TenantFooter.tsx (`& sigla antiga em inglês` → `& END`), App.tsx (`Laudo Técnico sigla antiga em inglês` → `Laudo Técnico END`), InspectionModal.tsx (comentário `Seletor de Método END`), LPPage.tsx (`PR-sigla antiga em inglês-LP-002 Rev. 04` → `PR-END-LP-002 Rev. 04`).
- Identificadores: tipo antigo de método → `ENDMethod` em types/inspection.ts, InspectionModal.tsx, InspectionTable.tsx.
- Prefixo do laudo: campo `reportPrefix: string` (padrão `'END'`) adicionado a `TenantProfile`; util `buildReportCode(prefix, method, year, seq)` criado em `frontend/src/utils/buildReportCode.ts`; `LAUDO Nº` na LPPage gerado via `buildReportCode`; mocks de App.tsx atualizados para ano 2026 (ex: `END-LP-2026-001`, `NR13-VASO-2026-08`); `contractRef` → `CT-PETRO-2026/0892`; fallback contrato → `CTR-2026-END-089`.
- ABENDI removido: LPPage.tsx linhas 510 e 687 (`SNQC-ABENDI Nº 14892` → `SNQC Nº 14892`); types/tenant.ts `creaRegister` (`SNQC-ABENDI 4812` → `SNQC 4812`).
- Verificação padrão: `grep -rniE "\bndt" frontend/src` → zero; busca por `abendi` em `frontend/src` → zero; `npm run build` passa.
- Commit: `54d6417` (feat(terminologia): remover ABENDI de textos e tipos).
- Pendências: enum SQL `public.sigla_antiga_em_inglês` → `public.end_method` não verificado/alterado (banco); tipo `ENDMethod` (maiúsculo) usado em vez de `EndMethod` (camelCase) conforme literal do TAREFAS.md — funcionais equivalentes, sem a sigla inglesa proibida no identificador.

**Tarefa B · Hub com 6 grupos em cascata e busca (27/10/2026)**
- `frontend/src/data/methodsCatalog.ts`: novo catálogo com 6 grupos (Superfície, Ultrassom, Radiográfico, Visual & Solda, Pintura & Revestimento, Vasos de Pressão NR-13) e 8 itens de método (incluindo Radiografia Industrial com available:false). Função `getEnabledMethods(tenant)` retorna todos os available, com ponto de extensão para habilitação por tenant.
- `frontend/src/pages/HubPage.tsx`: refatorado para usar o catálogo. Barra de busca larga com atalho "/" (foco) e Esc (limpa). Linha "Usados recentemente" (até 3 chips, `localStorage axos_recent_methods` com try/catch). Grade de 6 quadros de grupo com borda lateral colorida e contador de emitidos. Cascata: clicar no grupo abre/fecha lista de métodos abaixo da grade; só um grupo aberto por vez. Busca normalizada (NFD, sem acento, minúsculas) casando em name, code, aliases e norm; resultados mostram caminho "Grupo › Método". Sem resultado: "Nenhum método encontrado". Removido código duplicado e link "Abrir →" dos cards.
- Verificação padrão: `grep -rniE "\bndt" frontend/src` → zero; busca por `abendi` em `frontend/src` → zero; `npm run build` passa.
- Commit: `62678e8` (feat(hub): catálogo de métodos em 6 grupos com busca e cascata).
- Pendências: divergências de norma entre card do Hub e modal (ex.: norma do PM) a serem validadas pelo dono do produto.

**Tarefa US · Página de Ultrassom (feixe angular) (27/10/2026)**
- `frontend/src/types/us.ts`: novo tipo `UsTechnicalData` com todos os campos da peça e ensaio, transdutores (1 a 5), calibração (opcional), croqui, descontinuidades, evidências, conclusão (veredito A/R/NEC/AC), assinatura (executante, nível, certificado, órgão certificador, validade).
- `frontend/src/config/usFieldConfig.ts`: configuração de campos obrigatórios para US (`US_FIELD_CONFIG` + `isFieldConfig`).
- `frontend/src/components/laudo/Croqui.tsx`: canvas com pointer events, ferramentas "Marcar Indicação" e "Lápis", coordenadas normalizadas.
- `frontend/src/components/laudo/ValidityBadge.tsx`: selo de validade da qualificação (conforme/vencido), bloqueia emissão quando vencido.
- `frontend/src/components/laudo/VerdictBlock.tsx`: veredito com 4 opções (Aprovado, Reprovado, NEC, Aprovado condicional), bloco de liberação condicional (responsável, cargo, data, motivo obrigatório), alerta vermelho se indicação rejeitada + veredito Aprovado.
- `frontend/src/components/laudo/EvidenceBlock.tsx`: anexos com legenda, adicionar/remover/editar legenda.
- `frontend/src/components/laudo/SignatureCard.tsx`: assinatura do executante com nível (N1/N2/N3), certificado, órgão certificador, validade, data de emissão, vistos opcionais.
- `frontend/src/pages/USPage.tsx`: reescrita completa baseada no protótipo `axos-us-feixe-angular.html`. Blocos: peça e ensaio, transdutores, croqui, descontinuidades (com colunas avançadas opcionais), evidências, conclusão, assinatura, rodapé fixo com código do laudo e pendências. Rascunho salvo em `localStorage` (`axos_us_draft`). Código do laudo via `buildReportCode` (prefixo do tenant, método US, ano corrente, seq).
- Verificação padrão: `grep -rniE "\bndt" frontend/src` → zero; busca por `abendi` em `frontend/src` → zero; `npm run build` passa.
- Commit: `9177ccc` (feat(us): página de ultrassom feixe angular com croqui, transdutores, descontinuidades, veredito e assinatura).
- Pendências: protótipo HTML (`docs/prototipos/axos-us-feixe-angular.html`) não foi encontrado no repositório — a implementação segue a especificação da TAREFAS.md; revisar contra o protótipo quando disponível. PAUT e TOFD estão desabilitados ("Em breve") no seletor de técnica. Refatorar LPPage para usar componentes compartilhados de laudo.

**Tarefa C · Configuração da empresa emissora (header) alimentando todos os formulários (27/10/2026)**
- `supabase/migrations/0001_initial_schema.sql`: tabela `tenants` ganha colunas address_street/number/complement/neighborhood/city/uf/cep, phone, email, responsible_name, responsible_register, logo_path, logo_sha256, report_prefix (2-6 chars, padrão 'END'). Bucket privado `tenant-assets` criado com políticas de Storage (leitura membros do tenant, escrita só admin, caminho {tenant_id}/logo/{sha256}.{ext}, somente PNG/JPG, max 1 MB, nunca sobrescrever).
- `frontend/src/types/tenant.ts`: TenantProfile ganha logoPath, logoSha256, addressStreet/Number/Complement/Neighborhood/City/Uf/Cep, responsibleName, responsibleRegister.
- `frontend/src/components/laudo/DocumentHeader.tsx`: novo componente — logo empresa emissora (máx 64px), razão social/nome fantasia, CNPJ formatado, endereço, telefone, e-mail; direita com título do modelo, código do laudo, folha. Aviso "Complete em Configurações" quando faltar dado (só tela, não impressão). Suporta prop `snapshot` para dados congelados na emissão.
- `frontend/src/components/laudo/DocumentFooter.tsx`: novo componente — "Gerado por Axos Relatórios", página x de y, trecho do hash, espaço QR. Suporta prop `print` (tema claro, sem avisos).
- `frontend/src/components/TenantHeader.tsx`: modal de configurações com novos campos (endereço completo, responsável técnico, prefixo), upload de logo com redimensionamento cliente (máx 400x160), SHA-256, validação PNG/JPG (máx 1 MB), máscaras CNPJ/CEP/telefone, validação dígito CNPJ, UF 2 letras, prefixo 2-6 alfanuméricos. Somente admin edita (conforme RLS do banco); botão Salvar desabilitado até alteração válida.
- `frontend/src/pages/USPage.tsx`: usa DocumentHeader e DocumentFooter no lugar do bloco de cabeçalho/rodapé fixo.
- Verificação padrão: `grep -rniE "\bndt" frontend/src` → zero; busca por `abendi` em `frontend/src` → zero; `npm run build` passa.
- Commits: `f6e0a71` (db), `f143b22` (types), `ee3c27a` (componentes), `98cee78` (TenantHeader), `50e2012` (USPage).
- Pendências: testes SQL (não-admin não atualiza tenants; outro tenant não lê/escreve bucket; tipo/tamanho inválido de logo recusados) não executados (banco não aplicado em ambiente de teste). Substituir cabeçalho/rodapé nas demais páginas de método (LPPage, MEPage, EVSPage, PMPage, NR13Page, PinturaPage).

**Tarefa D · Congelar o cabeçalho na emissão, número pelo servidor e cabeçalho/rodapé do PDF (27/10/2026)**
- `supabase/migrations/0001_initial_schema.sql`: tabela `reports` ganha coluna `header_snapshot jsonb` (dados da empresa emissora congelados pelo servidor na emissão; cliente não define). Tabela `report_number_counters` (tenant_id, method, year, seq) para sequência atômica. Função `public.next_report_number(p_tenant, p_method, p_year)` retorna `{PREFIXO}-{MÉTODO}-{ANO}-{SEQ(3 dígitos)}` com upsert atômico. Tabela `report_pdfs` (id, tenant_id, report_id, storage_path, sha256, generated_at) — só inserção, trigger bloqueia update/delete, RLS por tenant. Bucket privado `report-pdfs`. Trigger `reports_before_update` grava `header_snapshot` na transição `approved → issued` (dados do tenant via subqueries) e torna o campo imutável pelo cliente. `private.report_hash()` inclui `header_snapshot`.
- `backend/app/queues/workers/pdf_worker.py`: reescrito com Jinja2 + WeasyPrint. Cabeçalho e rodapé alimentados por `header_snapshot`. Busca logo no Storage (`tenant-assets`) pelo `logo_path` e confere SHA-256 contra o snapshot (falha se divergir). QR code apontando para `axosrelatorios.com/verificar/{documento}/{revisao}`. Upload para bucket `report-pdfs` e registro em `report_pdfs`.
- `backend/app/core/config.py`, `backend/.env.example`: `QR_BASE_URL` alterado de `https://axos.app/verificar` para `https://axosrelatorios.com/verificar`.
- `backend/app/queues/workers/sync_worker.py`: comentário "Método sigla antiga em inglês" → "Método END".
- Verificação padrão: `grep -rniE "\bndt" frontend/src backend` → zero; busca por `abendi` → zero; `npm run build` passa; `py_compile pdf_worker.py sync_worker.py` OK; `pytest backend/tests` → 5 passam, 1 falha pré-existente (mock ARQ/Redis, não relacionado).
- Commits: `6011bd0` (db report_pdfs), `77a29c1` (db header_snapshot/contadores), `5b498a8` (pdf_worker), `dd89576` (fix terminologia sync_worker).
- Pendências: testes SQL de report_pdfs/next_report_number não executados (banco não aplicado em ambiente de teste). Documentar onde `next_report_number` deve ser chamada no fluxo de sync (a tarefa F trata do backend de sync). Substituir cabeçalho/rodapé nas demais páginas de método.

**Tarefa G · Contratantes, obras e ordens de serviço (27/10/2026)**
- `supabase/migrations/0001_initial_schema.sql`: tabela `tenants` ganha `allow_field_creation` (boolean, padrão true). Nova tabela `public.sites` (obras) com tenant_id, client_id, name, address, city, uf, contract_ref, situation (active/concluded/cancelled), created_by, created_in_field, needs_review. Tabelas `clients` e `work_orders` ganham created_by, created_in_field, needs_review; `work_orders` ganha site_id (FK para sites) e method (end_method opcional). RLS para sites: select todos do tenant, insert para revisor ou inspetor se allow_field_creation, update para revisor ou criador se needs_review. Triggers de auditoria para sites.
- `frontend/src/types/os.ts`: novo tipo Client, Site, WorkOrder e tipos de item de sincronização (SyncClientItem, SyncSiteItem, SyncWorkOrderItem, SyncItemResponse, SyncBatchResponse).
- `frontend/src/pages/Cadastros.tsx`: nova tela com abas Contratantes, Obras e Ordens de serviço. Lista, busca, filtro "Pendentes de revisão", marca "Criada em campo", botão Novo (desabilitado se allow_field_creation=false e papel inspetor).
- `frontend/src/components/laudo/DocumentHeader.tsx`: prop `service` opcional com clientName, siteName, siteAddress, contractRef, workOrderCode; renderiza bloco de serviço abaixo da empresa emissora (só em tela, não impressão).
- `frontend/src/pages/USPage.tsx`: passa prop `service` ao DocumentHeader com contractor e opOrOsNumber do rascunho.
- `supabase/migrations/0001_initial_schema.sql`: `header_snapshot` estendido com client_name, site_name, site_address, contract_ref, work_order_code (buscados via JOIN em work_orders/clients/sites na transição approved → issued).
- `docs/obras-os.md`: novo documento com regras de sincronização (ordem de envio clients→sites→work_orders→reports, UUID do cliente, idempotência por client_revision, campos controlados pelo servidor, códigos de erro: CLIENT_NOT_FOUND, SITE_NOT_FOUND, WORK_ORDER_NOT_FOUND, DUPLICATE_NUMBER, FIELD_CREATION_DISABLED, DEPENDENCY_FAILED, FORBIDDEN, VALIDATION_ERROR, UNKNOWN).
- Verificação padrão: `grep -rniE "\bndt" frontend/src backend` → zero; busca por `abendi` → zero; `npm run build` passa; `pytest backend/tests` → 5 passam, 1 falha pré-existente (mock ARQ/Redis).
- Commits: `d839ddf` (db sites/allow_field_creation), `e2dbf5b` (docs/obras-os.md), `a1fe006` (types os.ts), `4f543d1` (página Cadastros), `26d2251` (DocumentHeader service), `6e3c7f2` (header_snapshot serviço).
- Pendências: testes SQL para sites/RLS não executados (banco não aplicado em ambiente de teste). Telas de cadastro usam dados mockados — integração real com Supabase na Tarefa F.

**Tarefa E · Dexie, fila de sincronização e estados do laudo (27/10/2026)**
- `frontend/src/types/sync.ts`: novo tipo LocalReport, OutboxItem, SyncBatchResult, SyncItemResult, SyncState, LocalStatus, ServerStatus.
- `frontend/src/services/dbDexie.ts`: Dexie schema expandido com stores reports, outbox, clients, sites, workOrders, qualifications, instruments, tenantConfig (além da existente anexos). Versão 1 do schema. Migração única do localStorage para Dexie na primeira abertura.
- `frontend/src/services/sync.ts`: SyncManager com gerenciamento de sincronização offline-first. Disparo: ao abrir app logado, evento online, aba volta a ficar visível, botão "Sincronizar agora", a cada 60s com aba visível e conexão. Lote de até 20 itens. Ordem: clients → sites → work_orders → reports. Backoff exponencial 15s, 30s, 1m, 2m, 5m (erros retryable). Erros não retryable param até o inspetor editar. Nunca apagar dados locais.
- `frontend/src/pages/App.tsx`: substituído localStorage `axos_reports_list` por Dexie (tabela `reports`). Carregamento inicial do Dexie. `handleSaveReport` e `handleDeleteReport` usam Dexie. Código do laudo mostra "RASCUNHO" até o servidor devolver o definitivo.
- `frontend/src/components/laudo/SyncStatusIndicator.tsx`: novo componente - indicador global online/offline com contador de pendentes.
- `frontend/src/components/laudo/ReportStatusChip.tsx`: novo componente - chip de estado do laudo (rascunho, pronto, enviando, sincronizado, erro).
- `frontend/src/pages/HubPage.tsx`: integrado SyncStatusIndicator no cabeçalho e ReportStatusChip nos cards de método, mostrando o status do último laudo por método.
- `frontend/vite.config.ts`: removido runtimeCaching de rotas inexistentes (ordem_servico, template). Dexie guarda os dados, não cachear a API REST.
- Verificação padrão: `grep -rniE "\bndt" frontend/src backend` → zero; busca por `abendi` → zero; `npm run build` passa; `pytest backend/tests` → 15 passam.
- Commits: `5a34ded` (db: Dexie schema), `cfe3327` (feat(sync): SyncManager), `78b5ea5` (feat(frontend): Dexie substituindo localStorage), `940556d` (feat(frontend): SyncStatusIndicator e ReportStatusChip), `92fc597` (feat(pwa): remover cache de rotas inexistentes).
- Pendências: testes SQL para sites/RLS não executados (banco não aplicado em ambiente de teste). Telas de cadastro usam dados mockados — integração real com Supabase na Tarefa F. Substituir cabeçalho/rodapé nas demais páginas de método.

**Tarefa F · Correção do backend de sincronização e contrato (27/10/2026)**
- `supabase/migrations/0001_initial_schema.sql`: tabela `reports` ganha coluna `report_number text` (número definitivo do laudo, atribuído pelo servidor). Tabela `report_number_counters` (tenant_id, method, year, seq) para sequência atômica. Função `public.next_report_number(p_tenant, p_method, p_year)` retorna `{PREFIXO}-{MÉTODO}-{ANO}-{SEQ(3 dígitos)}` com upsert atômico.
- `backend/app/routers/sync.py`: reescrito com rota síncrona `POST /api/sync/reports` (lote de até 20 itens), cada item em sua própria transação. Usa JWT do usuário (sem service_role). Detecção automática de tipo de item (client, site, work_order, report). Regras de idempotência, LOCKED, QUALIFICATION_EXPIRED, INSTRUMENT_EXPIRED, TEMPLATE_NOT_FOUND, WORK_ORDER_NOT_FOUND, DUPLICATE_NUMBER, FORBIDDEN, VALIDATION_ERROR, UNKNOWN.
- `backend/app/routers/sync.py`: rotas `GET /api/sync/status/{job_id}` e `GET /api/sync/dlq` (apenas supervisor/admin).
- `docs/sync-contract.md`: novo documento com contrato completo de sincronização (tipos de item, campos controlados pelo servidor, códigos de erro, regras de gravação, isolamento por tenant, exemplo de fluxo).
- Verificação padrão: `grep -rniE "\bndt" frontend/src backend` → zero; busca por `abendi` → zero; `npm run build` passa; `pytest backend/tests` → 15 passam (6 test_auth + 9 test_sync).
- Commits: `891792b` (db: reports ganha coluna report_number e índice), `287dda9` (feat(sync): rota síncrona POST /api/sync/reports), `5e1c62f` (docs: contrato de sincronização).
- Pendências: testes SQL de report_pdfs/next_report_number não executados (banco não aplicado em ambiente de teste). Documentar onde next_report_number deve ser chamada no fluxo de sync. Implementar rota de emissão (approved → issued) para preencher header_snapshot e report_number.

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

---

## Tarefa H · Correção e evolução do Hub, catálogo e cards (31/10/2026)

- `frontend/src/pages/HubPage.tsx`: removido o estado falso `reportsLoaded` que travava a tela eternamente em "Carregando catálogo de métodos…"; o conteúdo agora renderiza direto. Catálogo redesenhado em **grade única de botões** (todos visíveis de uma vez, um clique), ordem alfabética `localeCompare('pt-BR')` com "Em breve" no final, busca que também casa o nome da família, contagem "N método(s) disponível(ões)" / "N resultado(s)" abaixo do campo, rota `/laudo/{code}` preservada. Wrapper da página com largura máxima 1280px, centralizado, padding lateral 32px — mesma régua do cabeçalho.
- `frontend/src/components/catalog/MethodButton.tsx`: botão 52px, raio 5px, nome 16px/500 à esquerda e sigla 14px `tabular-nums` à direita, sem ícone, sem caixa alta, sem monoespaçada; hover com borda no tom de acento; desabilitado ("Em breve") texto secundário sem hover.
- `frontend/src/components/catalog/MethodSection.tsx`: removido (não usado mais).
- `frontend/src/components/catalog/SearchField.tsx`: campo na largura total do contêiner, 48px, ícone de lupa à esquerda, dica "/" dentro do campo, placeholder completo "Buscar por método, sigla ou norma"; props `style` adicionada.
- `frontend/src/components/catalog/EmptyState.tsx`: botão "Limpar busca" discreto (sem borda, texto secundário).
- `frontend/src/components/InspectionTable.tsx`: reescrita. Tabela com `table-layout: fixed`, larguras proporcionais por coluna, sem `overflow-x` nem `min-width` forçado (zero rolagem horizontal na tabela e na página). Cabeçalhos em uma linha: Código, Ensaio, Tag, Unidade / área, Emissão, Inspetor, Veredito — sem caixa alta, sem monoespaçada. Células longas com `text-overflow: ellipsis` e tooltip completo. Coluna Ensaio mostra só a sigla uma vez. Ações: "Abrir" visível; PDF e Remover movidas para menu de três pontos (todas as ações e permissões preservadas). Abaixo de 768px, cada laudo vira card empilhado, sem rolagem horizontal.
- `frontend/src/components/DashboardMetrics.tsx`: cards de KPI com única cor de detalhe (azul acento `--accent-text`) na faixa superior, número e barra de progresso; "Não-conformes" em vermelho (`--danger`) só quando valor > 0.
- `frontend/src/components/TenantHeader.tsx`: selo de papel do usuário (Administrador/Supervisor/Inspetor) em azul escuro (`#0C4A6E`) para todos os papéis; largura dos containers de header alinhada em 1280px.
- `frontend/src/index.css`: adicionados tokens `--card-met-azul`, `--card-met-azul-hover`, `--card-met-azul-texto`, `--accent-text`; removidos tokens órfãos de chip verde.
- `frontend/vite.config.ts`: service worker desativado em desenvolvimento (`devOptions.enabled = false`); `includeAssets` corrigido para os arquivos existentes (`favicon.png`, `favicon.svg`).
- `frontend/public/pwa-192x192.png` e `pwa-512x512.png`: gerados a partir do `logo-axos.png` sobre fundo `#0f172a`, substituindo ícones ausentes/inexistentes que causavam erro de ícone inválido no PWA.
- Verificação padrão: `grep -rniE "\bndt" frontend/src backend` → zero; busca por `abendi` → zero; `npm run build` passa.
- Commits pendentes: tudo abaixo em um único commit.

**Pendências:** banco (Supabase) não aplicado em ambiente de teste; migrations de `tenants`, `report_pdfs`, `sites`, `work_orders` não verificadas contra o projeto real. Telas de cadastro usam dados mockados. Pendente: rotacionar senha do demo (commit `f1eef30` ainda contém senha antiga no histórico do git).


## 7. Integração do Design System Oficial Axos Hub (31/10/2026)

- Incorporação do repositório `design/` (originado de `axos-design`):
  - Tokens semânticos e overrides consolidados em `design/tokens/products/axos-relatorios.tokens.json`.
  - Compilação automatizada via `node design/scripts/build-tokens.mjs` gerando `design/tokens/dist/axos-relatorios.css` (25 overrides validados com zero pendências).
  - Regra de dualidade: tema escuro exclusivo para PWA e telas operacionais em campo; `theme-print` (papel `#FFFFFF`, tinta `#111111`) exclusivo para geração de PDFs e relatórios impressos (NR-13, ASME, Petrobras).
  - Catálogo de ícones de Ensaios Não Destrutivos em `design/brand/icons/end/end-methods.json` com especificações em `design/docs/icones-end.md` (grade 24x24, traço uniforme 1.75px, `currentColor`).
  - Checklist de controle de qualidade e QA visual documentado em `design/docs/qualidade-checklist.md`.

## 8. Padronização Tipográfica: Arial (31/10/2026)

- Aprovada substituição da tipografia do frontend para **Arial** (sans-serif nativa de sistema, fallbacks `Helvetica, sans-serif`).
- Removido import externo de fontes do Google Fonts (`Archivo`, `Inter`), garantindo carregamento instantâneo offline em campo e consistência multiplataforma.
- Atualizados: `frontend/src/index.css`, `DashboardMetrics.tsx`, `InspectionTable.tsx`, `HubPage.tsx`, `LoginPage.tsx`, `PRD.md` e `.agents/skills/design-frontend/skill.md`.

## 9. Elevação Visual e Acabamento Industrial — Design System Axos (31/10/2026)

- Aplicação cirúrgica dos tokens do `axos-design` em toda a interface do Hub e componentes operacionais:
  - **DashboardMetrics**:
    - Removidas sombras difusas pesadas (`box-shadow`), alinhando ao princípio de profundidade por contraste de superfícies e divisores de 1px.
    - Rótulos ajustados de caixa alta para *sentence case* (`Total de laudos`, `Em coleta / campo`, `Em revisão técnica`, `Conformes / aprovados`, `Não-conformes`).
    - Número de destaque calibrado para 28px peso 600 com `tabular-nums`.
    - Ícones Lucide padronizados em 16px com traço 1.75px.
  - **MethodButton e SearchField**:
    - Remoção de fontes residuais (`Archivo`), unificando em Arial nativa.
    - Raio de 5px estrito e anel de foco acessível de 3px.
    - Estado desabilitado com superfície atenuada e cursor `not-allowed`.
  - **InspectionTable**:
    - Substituição de classes Tailwind com hexadecimais soltos por tokens semânticos (`--bg-surface`, `--bg-surface-alt`, `--border`, `--text-primary`, `--text-secondary`, `--text-muted`).
    - Badges de status semânticos refinados com fundo `-soft`, raio de 5px e peso 500.
    - Botões de ação ("Abrir", menu "...") e campos de filtro alinhados aos tokens e raio de 5px.
    - Versão mobile com cards perfeitamente integrados aos temas claro/escuro.
  - **TenantHeader**:
    - Normalização de raios residuais (3px/4px/6px) para 5px em todos os elementos, botões e modal de configurações.
  - Verificação: `npm run build` passa com sucesso; busca pela sigla em inglês proibida com ZERO ocorrências.

## 10. Módulo de Obras / Escopo / Avanço (planos de Equipe (ver valores.md)) (31/10/2026)

- `supabase/migrations/0002_obra_escopo.sql`: nova migração com 3 tabelas:
  - `obra_escopo_linha`: linha de serviço contratado por obra (método END, unidade, quantidade prevista, referência TAG, ativo).
  - `obra_escopo_revisao`: histórico append-only de aditivos/supressões (quantidade anterior, nova, motivo).
  - `laudo_escopo_vinculo`: vínculo entre laudo e linha de escopo (quantidades inspecionada/aprovada/reprovada, laudo de origem para reinspeção). Tabela separada: não altera `reports`.
  - RLS por tenant em todas as 3 tabelas; auditoria via `audit_row`.
- `frontend/src/types/obra.ts`: tipos `ObraEscopoLinha`, `ObraEscopoRevisao`, `LaudoEscopoVinculo`, `AvançoResumo`, `AvançoObra`, `PrevisaoTermino`, `ProducaoInspetor`, `PendenciaLaudo`, `ObraEscopoUnidade`.
- `frontend/src/services/dbDexie.ts`: stores `obraEscopoLinhas` e `obraEscopoRevisoes` adicionadas ao Dexie.
- `frontend/src/pages/ObrasPage.tsx`: nova página de cadastro, listagem, edição e exclusão de obras (sites).
- `frontend/src/pages/ObraEscopoPage.tsx`: nova página de cadastro de linhas de escopo e histórico de aditivos por obra.
- `frontend/src/pages/ObraAvancoPage.tsx`: nova página de avanço com gráficos reais em CSS puro (Curva S, rosca/donut 3 fatias, barras por método, previsão de término, pendências), filtros por período/método.
- `frontend/src/components/laudo/ObraEscopoVinculo.tsx`: componente reutilizável para vincular laudo com linha de escopo (será usado nos 16 modelos).
- `frontend/src/App.tsx`: rotas `OBRAS`, `OBRA_ESCOPO`, `OBRA_AVANCO` no menu de navegação.
- `backend/app/routers/avanco.py`: endpoint `GET /api/avanco/{obra_id}` com cálculo de avanço seguindo as 7 regras (só laudos emitidos, revisão mais recente, reprovado como inspecionado, reinspeção, excesso de escopo, previsão por ritmo médio 4 semanas).
- `backend/app/main.py`: registro do router `avanco`.
- Verificação padrão: `grep -rniE "\bndt" frontend/src backend` → zero; busca por `abendi` → zero.

**Pendências:** banco (Supabase) não aplicado em ambiente de teste; migrations de `tenants`, `report_pdfs`, `sites`, `work_orders`, `obra_escopo_linha`, `obra_escopo_revisao`, `laudo_escopo_vinculo` não verificadas contra o projeto real. Telas de cadastro usam dados mockados no Dexie. Pendente: rotacionar senha do demo (commit `f1eef30` ainda contém senha antiga no histórico do git). Regra de visibilidade: inspetor vê o painel completo da obra (incluindo colunas dos colegas), com ocultador nas configurações da empresa (ligado por padrão); gerente e administrador veem também metas, preços e painel de todas as obras.

## 11. Fluxo de Três Páginas, Correção do Modal e Uniformidade de Cabeçalhos (04/11/2026)

**Bug corrigido — modal abrindo após o login:** o `InspectionModal` (`frontend/src/components/InspectionModal.tsx`) não verificava a prop `isOpen` no JSX — o overlay "NOVO LAUDO / REGISTRO DE LAUDO END" era renderizado sempre que o App montava (após o login), sobre qualquer página. Corrigido com `if (!isOpen) return null` após os hooks. Reproduzido e verificado no navegador (login com Enter → página Obras sem modal; HUB íntegro).

**Fluxo de 3 páginas — Login → Obras → Painel Operacional:**
- Login (com Enter) abre a página de Obras.
- `ObrasPage.tsx`: prop nova `onAbrirPainel`; botão "Selecionar"/"Abrir Painel" marca a obra atual (ObraContext, `localStorage axos_obra_atual`) e vai direto ao HUB (catálogo dos 16 métodos). Guard do HUB mantida: com obra selecionada, clique em método abre o modal de laudo (vínculo com escopo); sem obra, abre a página dedicada do método.
- `HubPage.tsx`: prop nova `onVoltarObras` — botão "Voltar às Obras" no topo do catálogo (seta Lucide, traço 1.75).
- Flexo de teste no Dexie local do navegador de testes: obra "Plataforma Virtual PC-77" (contratante "Construtora Alvorada Ltda", Macau/RN, CT-ALV-2026/0412).

**Status da obra — Reativar:** `ObrasPage.tsx` — o botão anteriormente só marcava "concluded"; agora alterna: "Concluir" (confirm) e, na obra concluída, "Reativar" (volta para `status ativo`).

**Uniformidade de cabeçalhos (igualdade medida nas duas páginas):**
- HUB: `h1` "Painel Operacional" 29px peso 600; linha do botão com `h2` "Catálogo de modelos" 24px; contêiner padding `32px 32px`.
- Obras: `h1` "Obras" 29px; linha do botão com `h2` "Obras e Escopo" 24px + botão "Voltar ao Catálogo"; padding `32px 32px`; espaçamento título → caixa de voltar de 32px nas duas (verificado por `getBoundingClientRect`).

**Botão Gerar PDF (`InspectionTable.tsx`):** nas duas ocorrências de linha, adicionado `display: inline-flex; align-items/justify-content: center` (ícone e texto na mesma linha) e cor de texto/ícone `#FFFFFF` (antes `#06222B` sobre fundo azul).

**Arquivos alterados:** `frontend/src/components/InspectionModal.tsx`, `frontend/src/pages/ObrasPage.tsx`, `frontend/src/pages/HubPage.tsx`, `frontend/src/components/InspectionTable.tsx`, `frontend/src/App.tsx`.

**Verificação padrão:** `npx tsc -b` OK; busca pela sigla inglesa proibida → ZERO ocorrências; fluxo completo testado no navegador (login Enter → Obras → Selecionar → HUB 16 métodos → Voltar às Obras).

**Pendências permanecem:** migrações 0001/0002/0003 não executadas no banco; enum do método antigo na 0001 (6 métodos, com termo proibido) a tratar em migração própria; telas de cadastro em Dexie local; integrar backend de avanço novamente quando o servidor FastAPI estiver em execução na máquina do usuário.

## 12. Landing Page Comercial (05/11/2026)

Criada em `landing/` (`index.html`, `assets/`, `robots.txt`, `sitemap.xml`). Prévia local pela configuração `landing` de `.claude/launch.json`, porta 5500. Conferida em 1280px e 375px.

**Pendências:** 3 imagens definitivas; WhatsApp comercial, quando houver número (o contato comercial definido pelo dono do produto é `suporte@axosrelatorios.com`); endereço do app para o link "Entrar"; revisão jurídica e razão social em `landing/politica-de-privacidade.html` e `landing/termos-de-uso.html`; publicação no EasyPanel. Recursos ainda não construídos (aprovação, emissão e `/verificar`) aparecem na página como "Em desenvolvimento": ao entregar cada um, tire a marca.

## 13. Deploy do Frontend (06/11/2026)

EasyPanel builda a `main` pela raiz do repositório: `Dockerfile` e `.dockerignore` da raiz geram o frontend. `main` atualizada com a `opencode-obras-wip`. `frontend/nginx.conf`: regra do service worker movida para antes da regra de assets (o arquivo ficaria um ano em cache). Variáveis do serviço: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`. A chave `service_role` nunca entra no frontend.

## 14. LP na Raiz do Domínio (08/11/2026)

A LP de `landing/index.html` abre em `https://axosrelatorios.com/` e o app em `/app`, no mesmo serviço (decisão do dono do produto: sem subdomínio; LP provisória descartada a pedido dele). O `Dockerfile` da raiz copia a LP como `lp.html` e `landing/assets/` para `assets/`. As 3 imagens definitivas estão em `landing/assets/fotos/`. O dono do produto decidiu publicar mesmo com a pendência da seção 12 (recursos citados ainda não construídos).

**Pendências:** registro A `@` da Hostinger ainda em `2.57.91.91`; certificado da raiz; conferir no Supabase se a Site URL aponta para `/app`; confirmar a caixa `suporte@axosrelatorios.com`.

## 15. Acessibilidade e LGPD (08/11/2026)

Referência adotada: ABNT NBR 17225:2025. Fontes do Google removidas do app (`frontend/index.html` e `LoginPage.tsx`); tela de login com área principal, título próprio e links de Termos e Política; atalho para o conteúdo nas páginas legais.

**Pendências:** revisão manual completa da NBR 17225, inclusive telas internas do app; prazos de guarda dos dados; responsável por privacidade; região do Supabase; contratos com clientes e fornecedores. Sem selo: não exibir marca da ABNT nem declarar conformidade.

## Regra Permanente: Testar Sempre (08/11/2026)

Regra permanente, definida pelo dono do produto em 08/11/2026: **testar sempre**. Nenhuma alteração é dada como pronta sem teste.

- Toda mudança visível é testada no navegador, no computador e no celular, em todas as telas afetadas.
- Depois de cada publicação, o resultado é conferido também no site no ar.
- O resumo final diz o que foi testado, o resultado e o que ficou sem teste.
- Complemento de 18/11/2026: em campo as empresas usam notebook, tablet e iPad, mas o AXOS inteiro tem de funcionar também no celular. Testar sempre nos três tamanhos: computador, tablet e celular.

## Responsivo do App (08/11/2026)

Regras em `frontend/src/index.css` (`.laudo-grid`, `.campos-2`, `.campos-vinculo`, `.catalogo-grid`, `.app-main`, `.tenant-*`). Testadas 18 abas em 320, 375, 768, 1024 e 1280 px, mais lista de obras, nova obra e configurações em 375 px.

**Pendências de teste:** obras e laudos com dados, janela de inspeção e tabelas com conteúdo.

## Formulários de UT e PAUT (08/11/2026)

`UTPage.tsx` e `PAUTPage.tsx` agora têm campos próprios (`types/laudoEnsaio.ts`, esquemas `ut-solda-v1` e `paut-v1`), com componentes em `components/laudo/CamposLaudo.tsx` e impressão em `utils/impressaoLaudo.ts`. Abrem e editam na página (`FORMULARIO_PROPRIO` em `App.tsx`), inclusive com obra selecionada. Campos baseados em relatórios reais de campo, sem dados dos exemplos no código. `USPage.tsx` continua sem uso: não salva no laudo.

**Pendências:** revisão por profissional de END; outros 14 métodos seguem com campos de ensaio visual e dependem de exemplos; janela geral de laudo ainda oferece o UT antigo; coluna Veredito da lista mostra Rascunho até o servidor mudar o status; anexos ficam só no aparelho, sem envio ao servidor; PDF não testado em impressão real; vínculo com escopo da obra não testado nos formulários novos.

## Cadastro e Recuperação de Senha (08/11/2026)

Tela de login com "Criar conta" e tela de nova senha em `/redefinir-senha` (`pages/AcessoForms.tsx`). Migração `0005_cadastro_empresa.sql`: `criar_empresa_inicial` cria a empresa em teste e o perfil de administrador no primeiro acesso, depois da confirmação do e-mail. Mensagens de erro em `utils/errosAuth.ts`.

**Pendências no ar:** corrigir `VITE_SUPABASE_ANON_KEY` no EasyPanel (estava com a URL `/rest/v1/`); aplicar as migrações 0001 a 0005 no projeto Supabase, cujas tabelas não existiam em 08/11/2026; liberar `https://axosrelatorios.com/app` e `/redefinir-senha` nas URLs de redirecionamento do Supabase; envio real de e-mails não testado.

## Banco: Projeto Novo e LGPD (08/11/2026)

Projeto novo: `ygijmtzipvsvdcbvurhg`, ligado em `.mcp.json`. Migrações 0001 a 0006 testadas só em banco local (`npm run test:db`): 20 tabelas com RLS, sem acesso de visitante e sem chave estrangeira sem índice. `0006_lgpd_e_reforcos.sql` traz `lgpd_aceites`, `lgpd_solicitacoes`, `registrar_aceites` e `anonimizar_usuario`.

**Pendências:** aplicar no projeto novo; definir prazos de guarda (o `audit_log` é imutável e não expira); telas de pedidos de titulares; `backend/app/queues/workers/sync_worker.py` chama `upsert_laudo`, que não existe (o envio atual usa `routers/sync.py`); planos do banco (`trial`, `starter`, `pro`, `enterprise`) não batem com a tabela de valores.

## Conformidade: ISO 27001, ISO 9001 e ABNT (08/11/2026)

Objetivo definido pelo dono do produto em 08/11/2026: preparar o AXOS para auditoria e futuras certificações **ISO/IEC 27001 e ISO 9001**, com possibilidade de certificação pela ABNT.

- Essas normas certificam o sistema de gestão da empresa, não o software. Nenhum código, sozinho, torna o AXOS conforme.
- Nenhuma tela, texto ou documento pode declarar conformidade, certificação ou exibir selo antes do certificado emitido.
- Toda mudança de backend, banco ou infraestrutura deve considerar segurança, rastreabilidade e evidência para auditoria.
- Situação e prioridades: `docs/conformidade/analise-de-lacunas.md`. Atualize esse arquivo quando uma lacuna for fechada.

**Situação:** análise de lacunas feita. Nada certificado. Correções técnicas e documentos de gestão ainda pendentes.

## Teste Grátis e Contratação (08/11/2026)

Decisão do dono do produto: teste de 30 dias, sem cartão, com PDF provisório. Login só com e-mail e senha. Cadastro só com nome, e-mail, senha e aceite. Dados da empresa, CPF ou CNPJ e pagamento ficam na contratação (`pages/ContratarPage.tsx`), aberta pelo aviso de teste ou pelos cards da LP (`/app?plano=...&criar=1`). Migração `0007_teste_e_contratacao.sql`: `tenants.trial_ends_at`, `pedidos_contratacao`, `solicitar_contratacao` e bloqueio de laudo novo com teste encerrado. CPF só no plano Individual.

**Pendências:** sem liberação automática: o pedido é registrado, o cliente paga pelo link da Stripe e a AXOS libera o plano no banco (`plan` e `trial_ends_at` nulo), e não há aviso automático de pedido novo; aviso por e-mail do fim do teste.

## Convites da Equipe (08/11/2026)

Tela Equipe só para administrador (`pages/EquipePage.tsx`). Migração `0008_convites_equipe.sql`: link de uso único, por 7 dias, preso ao e-mail, com hash no banco. Quem entra pelo link fica na empresa que convidou. Limite por plano no banco: Individual 1, Equipe 3, 5 e 10, teste 10. Conta inspetor quem tem papel de inspetor ou `can_inspect`, inclusive o administrador criador.

**Pendências:** envio do convite é manual (copiar o link), porque não há serviço de e-mail; confirmar se o administrador deve contar no limite.

## Banco no Projeto Novo (08/11/2026)

`supabase/instalacao_completa.sql` (0001 a 0008) rodado pelo dono do produto no projeto `ygijmtzipvsvdcbvurhg`: 22 tabelas e 8 funções conferidas de fora, como visitante. O conector desta conta não tem permissão nesse projeto, então SQL novo é colado no SQL Editor.

No Supabase, tabela nova nasce liberada para visitante, e só a RLS segurava as 3 tabelas de escopo da 0002. `0009_fecha_escopo_para_visitante.sql` tira essa permissão, e o teste 13 passa a acusar qualquer tabela ou função aberta a visitante. `tests/bootstrap.sql` agora imita esse padrão do Supabase.

## Pagamento pela Stripe (08/11/2026)

Os links de pagamento do dono do produto estão em `PLANOS`, em `pages/ContratarPage.tsx`, e foram conferidos um a um: plano, valor e descrição batem. Depois de gravar o pedido, o app abre o link do plano com `client_reference_id` igual ao id do pedido. Nome e e-mail não vão no endereço. "Sob consulta" não tem link. Política de Privacidade e Termos citam a Stripe.

Card da LP com a conta já logada abre direto a contratação, com o plano do card (`App.tsx`).

**Contratação sem conta (09/11/2026), decisão do dono do produto:** sem login, o card abre o formulário da empresa e o pagamento. A Stripe dá os 30 dias grátis, com cartão. Depois do pagamento, a pessoa volta à LP (`/?pagamento=ok` mostra o aviso), recebe o e-mail para criar a senha e entra pelo botão Entrar (`/app?entrar=1`, que sempre abre o login). Quem chega pelo link do e-mail e salva a senha já entra em Obras.

- `0010_contratacao_sem_conta.sql`: pedido sem empresa e 4 funções só para `service_role` (teste 15). Visitante continua sem nenhuma permissão: o formulário fala com a API.
- `backend/app/routers/contratacao.py`: `POST /api/contratacao/pedido` (10 por hora por origem, no Redis) e `POST /api/stripe/webhook`. O número do pedido viaja no endereço, então o webhook confere o valor pago na Stripe antes de liberar.
- Conta já existente com aquele e-mail, CNPJ já cadastrado ou valor diferente: `situacao = em_andamento` e motivo em `observacao`, para a AXOS resolver. Ainda não há aviso automático: consultar o log da API e a tabela.
- Cancelamento (`customer.subscription.deleted` ou situação `canceled`, `unpaid`, `incomplete_expired`) volta a empresa a `trial` com prazo vencido: dados guardados, sem laudo novo. O aviso na tela ainda diz "teste grátis terminou".

Testado no computador e no tamanho de celular com servidor simulado, e com 28 testes novos da API e o teste 15 do banco. O link real da Stripe abriu. Nenhum pagamento foi feito. Sem teste: Stripe real, e-mail real, Supabase real e site no ar.

**Ordem para publicar (se o site for antes da API, o card para de funcionar para quem não tem login):**
1. Rodar `0010_contratacao_sem_conta.sql` no SQL Editor.
2. Publicar a API no EasyPanel com `backend/Dockerfile`, Redis, e as variáveis `FRONTEND_URL=https://axosrelatorios.com`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` (opcional desde 18/11/2026), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `REDIS_URL`. Domínio `axosrelatorios.com`, caminho `/api`: sem subdomínio.
3. Stripe: 30 dias grátis nos 4 links; depois do pagamento, ir para `https://axosrelatorios.com/?pagamento=ok`; webhook em `https://axosrelatorios.com/api/stripe/webhook` com `checkout.session.completed`, `customer.subscription.updated` e `customer.subscription.deleted`.
4. Supabase: e-mail próprio (SMTP), porque o envio padrão não atende clientes; traduzir o modelo "Invite user"; confirmar `/redefinir-senha` em Redirect URLs.
5. `VITE_API_URL=https://axosrelatorios.com` no site e Deploy do site por último.

**Situação em 19/11/2026:**
- Feito: a API no ar tem `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET`; um aviso falso enviado ao webhook recebe 400 "Assinatura inválida", então a assinatura é conferida. O destino do webhook foi criado na Stripe com os 3 eventos; os eventos de cartão e de conta bancária que ficaram marcados junto são ignorados pela API. Os 4 links enviados pelo dono do produto foram conferidos de novo: são os mesmos do código e abrem a página de pagamento.
- Decidido: a página de pagamento continua mostrando "Axos Hub". A Axos Hub é a empresa dona dos produtos e da conta Stripe, e o nome e a logo da conta valem para todos os produtos. O que identifica o AXOS Relatórios é o nome de cada produto na Stripe (ex.: "AXOS Relatórios — Plano Individual").
- Falta, com o dono do produto:
  1. Nos 4 links, ajustar três coisas: em "Após o pagamento", ir para `https://axosrelatorios.com/?pagamento=ok`; dar 30 dias grátis; tirar o " -" do fim do nome do produto.
  2. Supabase: pôr `https://axosrelatorios.com/redefinir-senha` em Redirect URLs.
  3. Confirmar se 0009 e 0010 já foram rodados.
  4. Configurar e-mail próprio (SMTP). Sem ele o convite só chega a quem é da equipe do projeto Supabase; sugestão: Resend ou Brevo, com DNS na Hostinger.
  5. Teste completo no modo de teste da Stripe, nunca com pagamento real.
- Falta no código (opcional): o aviso de cancelamento ainda diz "teste grátis terminou" também para quem pagou e cancelou; a AXOS não recebe aviso quando um pedido pago fica em análise.

## Fotos de Campo (08/11/2026)

A foto é gravada primeiro no aparelho (`services/anexos.ts`, IndexedDB) e entra na fila `fotosFila` (Dexie versão 2, que também enfileira as fotos antigas). O `SyncManager` apaga as removidas antes de enviar os laudos e envia as novas depois, porque a RLS só aceita foto de laudo que já está no servidor, é do próprio inspetor e está em `draft` ou `returned`.

Bucket privado `report-files`, caminho `<tenant>/<laudo>/<sha256>.<ext>` em `report_attachments.storage_path`. O id da linha é o `anexoId` guardado no JSON do laudo. Em outro aparelho, `lerAnexo` baixa com login, confere o SHA-256 e guarda localmente. Não há link público nem temporário: o arquivo só sai com a sessão do usuário, porque as fotos podem mostrar pessoas e dados de clientes (LGPD). Excluir o laudo apaga as fotos dele. Teste 14 cobre o isolamento.

**Testado** no navegador, no computador e no tamanho de celular, com Supabase e API simulados em servidor local, mais as regras de acesso no banco local (`npm run test:db`).

**Pendências:**
- Sem a API publicada nenhum laudo chega ao servidor, então as fotos ficam na fila, no aparelho. Depois de publicar, testar com Storage real e ajustar a frase da seção de campo em `landing/index.html`, que hoje diz que só os dados do laudo sobem.
- Laudo sem obra não vai ao servidor, nem as fotos dele.
- Quando o envio do laudo para revisão (`submit`) for ligado na tela, ele precisa esperar a fila de fotos zerar: com o laudo enviado, a RLS recusa foto nova.
- `SyncStatusIndicator` não é usado em nenhuma tela. O contador de pendências, que agora inclui fotos, aparece no cabeçalho (`TenantHeader`), com ou sem internet.
- Conferir o espaço de arquivos do plano do Supabase antes de vender.

## Croqui e Formulário Padrão dos 14 Métodos (18/11/2026)

**Croqui:** `components/laudo/DesenhoCroqui.tsx` abre em tela cheia pelo botão "Desenhar croqui" do `BlocoFotos` (lápis em 3 cores, 2 espessuras, borracha, desfazer, limpar, quadriculado). Salva PNG de até 1600 px que entra como foto do laudo (mesmo caminho das fotos: aparelho, fila de envio e impressão).

**Fase 1 da padronização:** os 14 métodos sem formulário próprio (todos menos UT e PAUT) usam `pages/LaudoPadraoPage.tsx`, esquema `padrao-v1` em `types/laudoEnsaio.ts`: identificação, condições do ensaio, aparelho, indicações (peça, localização, tipo, dimensões, resultado), fotos e croqui, responsável, medição da obra e conclusão. Campos próprios por método em `CAMPOS_POR_METODO` (por enquanto VT e PT, com as mesmas chaves dos laudos antigos). Impressão em `utils/impressaoLaudo.ts` (`secoesPadrao`).
- Removidos: as 14 páginas antigas (cópias do VT, gravavam `metodo: 'Visual'` em todos) e `InspectionModal.tsx` (janela geral; descartava os campos de RT, ET e LT e apagava o vínculo com a obra ao editar). "Novo laudo" no histórico rola até o catálogo; editar abre o formulário do método.
- `App.tsx` não inventa mais valores ao salvar (antes gravava "TAG-PENDENTE", "Área Industrial", "Critério" etc.). Laudos antigos guardados mantêm o que já tinham.
- Laudo antigo abre no formulário novo: campos do PT voltam (temperatura vinha em `surfaceTemp`), contagem de indicações é mantida e o `metodo: 'Visual'` some ao salvar.

**Testado** no navegador (computador e tamanho de celular): os 14 métodos abrem com croqui; MT preenchido, registrado, reaberto e impresso com croqui; laudo antigo de PT aberto e salvo; UT, PAUT e "Novo laudo" conferidos. Não testado: celular de verdade, impressão em papel/PDF real e site no ar.

**Fase 2 concluída** para os 14 métodos (ver seções seguintes). Laudos antigos de métodos que não são VT guardam campos do VT que não aparecem mais na tela (ficam nos dados). `USPage`, `MEPage`, `EVSPage`, `NR13Page`, `PMPage` e `PinturaPage` seguem sem acesso: decidir se viram métodos ou são apagadas. Gerar a imagem do croqui leva alguns segundos em aparelho lento.

## Fase 2: MT, PT e VT (18/11/2026)

Proposta baseada na ASME V (art. 7, 6 e 9) e nas Petrobras N-1598 e N-1596, aprovada pelo dono do produto sem alterações. Em `CAMPOS_POR_METODO` (`types/laudoEnsaio.ts`): MT ganhou 12 campos (técnica de magnetização, corrente, partículas, marca e lote, contraste, concentração, verificação do campo, força de levantamento, espaçamento, luz branca, UV-A, desmagnetização); PT ganhou tipo de penetrante, método de remoção, limpeza prévia e UV-A (chaves antigas mantidas). `TIPOS_INDICACAO` dá sugestões ao "Tipo de indicação" (MT e PT: linear, arredondada; VT: descontinuidades de solda). Escolhas saem por extenso na impressão.

**Testado** no navegador (computador e tamanho de celular): MT preenchido, registrado, reaberto e impresso; campos e sugestões de PT e VT conferidos. Não testado: celular de verdade e site no ar.

**Observação:** no MT, o campo geral "Técnica" convive com "Técnica de magnetização"; serve para contínua ou residual, se o dono do produto quiser.

## Fase 2: RT, CR/DR e ToFD (18/11/2026)

Proposta baseada na ASME V (art. 2 e apêndices de radiografia digital; art. 4, apêndice de ToFD), Petrobras N-1595, ISO 17636-2 e ISO 10863, aprovada pelo dono do produto sem alterações. RT: 16 campos (fonte, atividade ou tensão, ponto focal, tempo, técnica de exposição, distância fonte-filme, espessura, filme, filmes por chassi, écran, IQI e posição, fio essencial, densidade, densitômetro, penumbra). CR/DR: mesma base com detector, leitor, pixel, duplo fio, SNRn e software no lugar do filme. ToFD: 12 campos (sondas, ângulo, PCS, foco, pares e zonas, varredura, passo, acoplante, bloco, ganho, espessura, software).
- Tabela de indicações com colunas por método: `colunasIndicacao()` em `types/laudoEnsaio.ts` (padrão: localização e dimensões; RT: localização com filme e posição; ToFD: posição inicial, comprimento, profundidade e altura). Tela e impressão usam a mesma ordem. `CampoMetodo.numerico` abre o teclado numérico no celular.
- Sugestões de descontinuidades de solda no tipo de indicação de RT, CR/DR e ToFD.

**Testado** no navegador (computador e tamanho de celular): campos de RT, CR/DR e ToFD conferidos; ToFD preenchido, registrado, reaberto e impresso com a tabela própria; MT sem mudança. Não testado: celular de verdade e site no ar.

## Fase 2: ET, ECA, LT, LT Vácuo, EA, IRT, ACFM e TFM (18/11/2026)

Feito direto, sem rodada de aprovação, porque o dono do produto disse que segue a sugestão ("confio em vc"); a lista foi apresentada a ele no fim. Base: ASME V (art. 8, 10 e 12, apêndice de TFM do art. 4), ISO 18434-1, ASTM E1934, ASTM E2928 e ISO 18563-3.
- Campos próprios: ET 8, ECA 10, LT 8, LT Vácuo 7, EA 9, IRT 11, ACFM 5, TFM 12 (constantes compartilhadas em `types/laudoEnsaio.ts`: bloco de calibração, revestimento, frequência, ganho, rotação de fase, configuração da sonda, solução de bolhas, passo).
- Colunas próprias de indicação: TFM igual ao ToFD (`DIMENSIONAMENTO_ALTURA`); EA: localização e classificação da fonte; IRT: temperatura máxima, de referência e ΔT; ACFM: comprimento e profundidade estimada.
- Sugestões de tipo de indicação para todos os 14 métodos.

**Aparelhos:** no campo usam notebook, tablet e iPad, mas o AXOS inteiro deve ser totalmente responsivo também no celular (dono do produto, 18/11/2026). Testar nos três tamanhos.

**Testado** no navegador: os 8 métodos com campos, colunas e sugestões; IRT preenchido, registrado, reaberto e impresso com a tabela de temperaturas; tablet em pé (768 × 1024) e deitado (1024 × 768), celular e computador sem rolagem lateral; croqui desenhado no tamanho de tablet. Não testado: aparelho real (iPad, tablet, celular) e site no ar.

## Preparação para publicar a API (18/11/2026)

- O projeto Supabase `ygijmtzipvsvdcbvurhg` assina o login com **ES256** (chave em `/auth/v1/.well-known/jwks.json`) e usa chaves novas (`sb_publishable_`, `sb_secret_`). A API só aceitava HS256 e recusaria todo inspetor. `app/core/security.py` agora valida ES256/RS256 pela chave pública do projeto (guardada 10 min, nova consulta se a chave mudar) e mantém HS256 se `SUPABASE_JWT_SECRET` existir; essa variável passou a ser opcional. 3 testes novos em `tests/test_auth.py` (50 testes passam).
- Conferido de fora: o gateway do Supabase aceita a chave nova no `apikey` e no `Authorization`, então a chave secreta funciona como `SUPABASE_SERVICE_ROLE_KEY` sem mudar o código.
- `/api/sync/reports` grava direto no banco e não depende do Redis; o Redis serve ao limite do formulário de contratação e à fila de PDF.
- `0010_contratacao_sem_conta.sql` (e a cópia em `instalacao_completa.sql`) pode ser rodado de novo sem erro; 0009 já podia. Testado duas vezes seguidas no banco local, e `npm run test:db` passa.
- Sem Docker nesta máquina: a imagem não foi montada aqui; só a instalação do `pyproject.toml` foi simulada.

**API publicada (18/11/2026):** serviço separado no EasyPanel, Caminho de Build `/backend`, domínio `axosrelatorios.com`, caminho público `/api` com destino porta 8000 e caminho `/api` (o `/api` chega inteiro à API). Variáveis da API sem prefixo `VITE_` (o primeiro Deploy caiu com 502 porque estavam como `VITE_...`). Conferido no ar: `/api/sync/healthz` responde, sem login e com login falso dá 401, `/api/docs` escondido (404), CORS libera só `https://axosrelatorios.com`, site normal.
- Incidente no mesmo dia: o Deploy do site foi feito sem as variáveis `VITE_` (página em branco, "Invalid URL") e depois com `VITE_SUPABASE_URL` terminando em `/rest/v1/` ("Falha ao carregar dados do usuário"). Corrigido pelo dono do produto; o app abriu normal com login real. Regra: site usa `VITE_SUPABASE_URL` (só até `.supabase.co`), `VITE_SUPABASE_ANON_KEY` e, se quiser, `VITE_API_URL` (opcional desde 19/11/2026, ver "Endereço da API no site"); API usa `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `FRONTEND_URL` e `REDIS_URL`, sem `VITE_`.
- Não testado no ar: envio real de laudo com login de verdade (ES256) e fotos para o Storage. Lembrar: laudo sem obra não sobe.

## Varredura completa no ar e no código (18/11/2026)

**Aprovado:** páginas no ar; http vira https; certificado Let's Encrypt até 06/02/2027; arquivos sensíveis (`/.env`, `/.git/config`, SQL) não são servidos (cai na página do app); API recusa sem login em todas as rotas protegidas, valida o formulário de contratação e esconde a documentação; banco visto como visitante com a chave pública: 22 tabelas e 12 funções fechadas, buckets privados; tipos, 50 testes da API e testes do banco passam; `npm audit` sem falhas; nenhum `.env` nem chave secreta no repositório. A sigla proibida aparece só como bytes ao acaso em `landing/assets/fotos/liquido-penetrante.webp` (imagem, não é texto).

**Pendências por gravidade:**
- Importante: webhook da Stripe responde 503 porque a API não tem `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET`; quem pagar pelo card da LP não recebe conta. O dono do produto vai finalizar os pagamentos depois.
- Importante: envio real de laudo e fotos ao servidor ainda não testado com conta de verdade.
- Importante: sem e-mail próprio (SMTP); o cadastro público do Supabase fica aberto (o convite da equipe usa `signUp`), então o limite de e-mails padrão pode ser consumido por abuso.
- Feito em seguida (falta Deploy e conferir no ar): `frontend/nginx.conf` com HSTS de 1 ano e CSP em modo de observação (`Content-Security-Policy-Report-Only`, porque a LP tem 3 scripts escritos na página), `/favicon.ico` entregando o `favicon.png` e manifest com tipo `application/manifest+json`. `lib/supabase.ts` limpa o endereço (`/rest/v1/`, espaço, barra no fim) e, sem endereço válido, o site mostra o aviso de configuração em vez de ficar em branco; `AuthContext` usa os mesmos valores. Sem nginx nesta máquina: a configuração só foi revisada à mão.
- Conferido no ar depois do Deploy (commits 695352b e 5ee04a2): HSTS ativo no site e no app, CSP em observação, `/favicon.ico` 200 `image/png`, manifest `application/manifest+json`, endereço do Supabase limpo, caixa Medição da obra nova. A CSP só acusa os 3 scripts escritos na LP (hashes no console); a tela de login do app não acusa nada. App logado não conferido.
- Melhoria ainda aberta: `www.axosrelatorios.com` não abre (domínio no EasyPanel); páginas inexistentes respondem 200; API mostra `Server: uvicorn`; ativar a CSP de verdade depois de tirar os scripts da LP para arquivos.

## PDF oficial: plano em 4 fases (18/11/2026)

Diagnóstico aprovado pelo dono do produto. O banco já garante: emitido travado, correção por nova revisão (`document_id` + `revision`), número dado pelo servidor na emissão, `data_hash` SHA-256 do conteúdo (dados técnicos, croqui, anexos, cabeçalho), `report_pdfs` só inserção, `audit_log` imutável e aprovação por outra pessoa opcional (`require_second_reviewer`). Faltava: qualificações (o banco exige para enviar à revisão), telas de enviar/devolver/aprovar/emitir, corpo técnico do PDF (o `pdf_worker` só monta cabeçalho e rodapé e não imprime o QR), página `/verificar` e o serviço do worker. Fases: 1 qualificações, 2 fluxo na tela, 3 PDF completo gerado na API na emissão (com fotos e croqui/esboço, pedido do dono do produto), 4 verificação pública com conferência do arquivo no navegador. Não é assinatura ICP-Brasil; nenhum texto promete validade jurídica.

**Fase 1 feita (qualificações):**
- `services/qualificacoes.ts`: lista, cadastra e remove; as do próprio usuário ficam guardadas no aparelho (Dexie `qualifications`) para uso sem internet.
- Equipe (só administrador): seção "Qualificações (SNQC)" com pessoa, método, nível, número, órgão certificador e validade; avisa vencida e "vence em N dias" (até 30). Remoção recusada se a qualificação já foi usada em laudo (chave estrangeira).
- Laudo (UT, PAUT e formulário padrão): "Qualificação usada neste laudo" no bloco Responsável técnico, só do próprio inspetor e do mesmo método; vencida na data do ensaio aparece marcada e avisa; escolher preenche o Registro SNQC. Guardado em `InspectionReport.qualificationId`.
- Envio: `services/sync.ts` manda `qualification_id`; `routers/sync.py` só grava se for do próprio inspetor, do tenant e do método (senão fica vazio e o rascunho segue). Teste novo, 51 testes passam.
- Testado no navegador (computador, tablet, celular) com qualificações de teste no aparelho. Não testado com conta real: cadastro na Equipe e envio ao servidor (a conta de demonstração não fala com o servidor).

**Fase 2 feita (fluxo de emissão na tela):**
- `services/fluxoLaudo.ts`: enviar para revisão (antes sincroniza e confere que laudo e fotos daquele laudo já subiram; laudo fora de obra ou sem qualificação é recusado com explicação), aprovar, devolver (grava o motivo em `report_comments` e depois muda o status), emitir (rota `/api/sync/emitir`), nova revisão (`create_report_revision`). Mudanças de status vão direto ao banco com o login do usuário; o gatilho decide. Recusas do banco viram mensagens em português (`REPORT_INCOMPLETE`, `QUALIFICATION_INVALID`, `SELF_APPROVAL_NOT_ALLOWED` etc.).
- `components/laudo/FluxoLaudo.tsx`: painel "Situação do laudo" no topo das 3 telas de laudo, com a situação real do servidor (ou a do aparelho sem conexão) e os botões por papel e etapa. Em revisão, aprovado, emitido ou substituído o formulário fica só leitura (`fieldset disabled`, classe `lf-fieldset`).
- Lista: "Emitido" aparecia como "Rascunho" (sem rótulo); agora mostra Emitido, Devolvido, Substituído e Aprovado, com filtros. `ReportStatus` ganhou `devolvido` e `substituido`; `SCREEN_STATUS` e `SERVER_STATUS` exportados em `services/sync.ts`.
- API: laudo devolvido pode ser reenviado para revisão (antes só rascunho). Teste novo; 52 testes passam.
- Testado no navegador com laudos de exemplo no aparelho (em revisão, devolvido, emitido): rótulos da lista, travamento, botões por etapa, devolução exige motivo, mensagens; computador, tablet e celular. Não testado com conta real: as ações no servidor (a conta de demonstração não fala com o servidor). "Enviar para revisão" usa a última versão registrada.

**Fase 3 feita (PDF oficial):**
- `backend/app/pdf/laudo_pdf.py`: monta o HTML em Python puro (testável sem WeasyPrint) e gera o PDF só com dados do servidor: cabeçalho congelado (`header_snapshot`), cliente, obra, contrato, OS, inspetor e qualificação (`client_snapshot`), corpo técnico dos 3 formatos (`ut-solda-v1`, `paut-v1`, `padrao-v1`), conclusão, **fotos, croqui e esboço** (baixados do Storage e conferidos pelo SHA-256 de `report_attachments`; foto alterada impede o PDF; reduzidas a 1200 px só no PDF), responsáveis (inspetor, aprovador, emissor, responsável técnico), tabela de SHA-256 das evidências e quadro de autenticidade com QR para `/verificar/{document_id}/{revision}`, SHA-256 do conteúdo (`data_hash`) e aviso de que não é assinatura ICP-Brasil. Layout em tabelas (o flex do WeasyPrint é limitado).
- Nomes dos campos por método: `backend/app/pdf/campos_metodo.json`, gerado do app por `npm run gerar:campos-pdf` (Node lê o TS direto). Rodar sempre que mudar `CAMPOS_POR_METODO`, `colunasIndicacao` ou `TIPOS_DEFEITO`.
- API: o PDF é gerado **na emissão** (`/api/sync/emitir`, em thread), guardado em `report-pdfs/{tenant}/{laudo}.pdf` sem sobrescrever e registrado em `report_pdfs`; falha não desfaz a emissão. `GET /api/sync/pdf/{id}` entrega o PDF só a quem enxerga o laudo e confere o SHA-256 antes (arquivo trocado dá 409). `POST /api/sync/pdf/{id}/gerar` (revisor) refaz se faltou. `pdf_worker` virou só um atalho para a mesma geração (o worker nunca foi publicado).
- `backend/Dockerfile`: instala `fonts-dejavu-core` (sem fonte o PDF sairia sem texto).
- App: painel do laudo emitido ou substituído tem "Baixar PDF oficial" (e "Gerar PDF oficial" para o revisor quando falta); na lista, "Gerar PDF" de laudo emitido baixa o oficial em vez da impressão provisória.
- Testes: 9 novos em `tests/test_pdf.py`; 61 passam. Prévia do HTML conferida no navegador. Não testado: o PDF real (WeasyPrint só existe no servidor) e o fluxo completo com conta real.

**Fase 4 feita (verificação pública):**
- API `routers/verificacao.py`: `GET /api/verificar/{document_id}/{revision}` sem login, com limite de 120 consultas por hora por origem (Redis; o IP não é guardado, só o resumo SHA-256). Responde situação (válido ou substituído, com a revisão vigente), número, revisão, método, data de emissão, empresa emissora (nome e CNPJ) e os SHA-256 do conteúdo e do PDF. Rascunho, revisão em andamento e endereço inválido dão 404. Não expõe pessoas, cliente nem obra. 4 testes novos; 65 passam.
- Site: `pages/VerificarPage.tsx`, aberta por `main.tsx` quando o endereço começa com `/verificar/` (sem login, fora do `App`). "Conferir arquivo" calcula o SHA-256 do PDF no próprio navegador e compara com o oficial; o arquivo não sai do aparelho. Aviso de que não substitui assinatura ICP-Brasil.
- Testado no navegador com resposta simulada (a API não roda nesta máquina): válido, substituído, sem conexão, conferência de arquivo igual e alterado (uma letra trocada é detectada); computador, tablet e celular; `/app` continua normal.
- `docs/conformidade/analise-de-lacunas.md` atualizado com o que mudou em 18/11/2026.

**Pendente (adiado pelo dono do produto em 19/11/2026):** testar o caminho completo no ar com conta real: cadastrar a qualificação na Equipe, criar obra e laudo com fotos e croqui, enviar para revisão, aprovar, emitir, baixar o PDF oficial, abrir o QR e conferir o arquivo. Conferido no ar em 19/11/2026: site e API já têm as fases 1 a 4 (`/api/verificar` responde 404 "Laudo não encontrado" para código inexistente, `/api/sync/pdf` pede login, telas novas no código publicado). O laudo de teste, depois de emitido, fica registrado para sempre: combinar com o dono do produto antes de emitir.

## Páginas dos métodos para o Google e as IAs (19/11/2026)

- 17 páginas estáticas em `landing/laudos/`: o índice `/laudos/` e uma por método (`/laudos/liquidos-penetrantes/` etc.). Geradas por `npm run gerar:paginas-metodos` (`frontend/scripts/gerar-paginas-metodos.mjs`) com os campos do próprio app (`laudoEnsaio.ts`) e os textos de `frontend/scripts/textos-metodos.mjs`. UT e PAUT têm formulário próprio, então os campos deles estão escritos à mão nesse arquivo. Rodar o gerador sempre que mudar campos ou textos.
- Cada página tem:
  - título e descrição próprios e trilha Início › Métodos END › método (BreadcrumbList);
  - explicação do método e o que o laudo registra, nos mesmos blocos do formulário;
  - fluxo do campo à emissão, com os mesmos avisos "Em desenvolvimento" da LP;
  - 4 perguntas (FAQPage), métodos relacionados e rodapé com os 16 links.
  - Não tem script, então não há nada para a CSP barrar.
- LP: a lista dos 16 métodos e o rodapé ligam às páginas. Também foram atualizados `sitemap.xml` (20 endereços) e `llms.txt`, e o `Dockerfile` da raiz passou a copiar `landing/laudos/`.
- Testado no navegador pelo servidor local da LP: computador, tablet e celular sem rolagem lateral, links e cliques, console sem erro. Dados estruturados conferidos por script: um H1 por página, perguntas iguais às visíveis, nenhum link quebrado. Não testado no ar, porque falta o Deploy do site.
- Pendente:
  - revisão do texto técnico por profissional de END;
  - depois do teste do PDF no ar, tirar os avisos "Em desenvolvimento" da LP e das páginas (no gerador, `FLUXO`);
  - enviar o mapa do site no Google Search Console e no Bing Webmaster Tools.
- Conferido no ar depois do Deploy (commit b5a6a95): as 17 páginas respondem 200 com o título certo; a LP liga a elas; `sitemap.xml` e `llms.txt` estão atualizados; celular e computador sem rolagem lateral nem erro no console.
- Problemas achados nessa conferência, corrigidos em `frontend/nginx.conf` (falta Deploy e conferir no ar):
  - Sem `Cache-Control`, o navegador guardava a LP por horas e mostrava a versão antiga depois do Deploy. Agora a LP (`location = /`) e o resto das páginas (`location /`) têm `expires -1`: o navegador sempre confere e recebe 304 se nada mudou. `expires` não é `add_header`, então os cabeçalhos de segurança continuam.
  - Endereço sem barra final redirecionava para `http://…/` antes do https. Agora `absolute_redirect off` faz o endereço seguir direto para a mesma página com a barra no final.
  - Sem nginx nesta máquina: a configuração só foi revisada à mão.
- Achado, não corrigido: a norma padrão de ET é "ASME V Art. 7" em `types/inspection.ts` (`METHOD_LABELS`) e em `data/methodsCatalog.ts`, mas o Art. 7 é de partículas magnéticas e correntes parasitas é o Art. 8. Ela entra como "Norma de referência" inicial do laudo de ET (`CamposLaudo.tsx`). RT traz "ASME V Art. 2 / 3", que também merece conferência.

## Endereço da API no site (19/11/2026)

- Achado na conferência do Deploy: o site publicado chamava a API em `http://localhost:8000`. O site tinha sido montado no EasyPanel sem `VITE_API_URL`, e o código usava o endereço de teste como reserva. Por isso falhavam no ar o formulário de contratação (o cliente não chegava ao pagamento), o envio de laudos ao servidor, emitir, baixar o PDF oficial, a verificação pelo QR e o avanço da obra. O login funcionava porque fala direto com o Supabase.
- Corrigido em `frontend/src/config.ts`:
  - fora do computador de teste, sem a variável, a API é o próprio endereço do site (caminho relativo `/api/...`, que o EasyPanel já leva à API);
  - em `localhost` e `127.0.0.1`, continua `http://localhost:8000`;
  - `VITE_API_URL`, se existir, ainda vale, e o código tira espaços e a barra do fim.
- Testado antes de publicar: o site foi montado sem a variável (`VITE_API_URL= npx vite build`) e aberto em `http://producao.localhost:4173` (configuração `frontend-producao` em `.claude/launch.json`). A página do QR chamou `/api/verificar/...` no próprio endereço. Tipos conferidos (`npx tsc -b`).
- Falta: Deploy do site e conferir no ar a página do QR, o formulário de contratação até a página da Stripe (sem pagar) e o envio de um laudo.
