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
- Textos de interface: HubPage.tsx (`NDT / NR-13` → `END / NR-13`), TenantFooter.tsx (`& NDT` → `& END`), App.tsx (`Laudo Técnico NDT` → `Laudo Técnico END`), InspectionModal.tsx (comentário `Seletor de Método END`), LPPage.tsx (`PR-NDT-LP-002 Rev. 04` → `PR-END-LP-002 Rev. 04`).
- Identificadores: tipo `NDTMethod` → `ENDMethod` em types/inspection.ts, InspectionModal.tsx, InspectionTable.tsx.
- Prefixo do laudo: campo `reportPrefix: string` (padrão `'END'`) adicionado a `TenantProfile`; util `buildReportCode(prefix, method, year, seq)` criado em `frontend/src/utils/buildReportCode.ts`; `LAUDO Nº` na LPPage gerado via `buildReportCode`; mocks de App.tsx atualizados para ano 2026 (ex: `END-LP-2026-001`, `NR13-VASO-2026-08`); `contractRef` → `CT-PETRO-2026/0892`; fallback contrato → `CTR-2026-END-089`.
- ABENDI removido: LPPage.tsx linhas 510 e 687 (`SNQC-ABENDI Nº 14892` → `SNQC Nº 14892`); types/tenant.ts `creaRegister` (`SNQC-ABENDI 4812` → `SNQC 4812`).
- Verificação padrão: `grep -rniE "\bndt" frontend/src` → zero; busca por `abendi` em `frontend/src` → zero; `npm run build` passa.
- Commit: `54d6417` (feat(terminologia): remover ABENDI de textos e tipos).
- Pendências: enum SQL `public.ndt_method` → `public.end_method` não verificado/alterado (banco); tipo `ENDMethod` (maiúsculo) usado em vez de `EndMethod` (camelCase) conforme literal do TAREFAS.md — funcionais equivalentes, sem "NDT" no identificador.

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
- `backend/app/queues/workers/sync_worker.py`: comentário "Método NDT" → "Método END".
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
