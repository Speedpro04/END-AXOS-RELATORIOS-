# PRD – AXOS Relatórios (Plataforma de Integridade & END)

## 1. Visão Geral do Produto
O **AXOS Relatórios** é uma plataforma SaaS e PWA (Progressive Web App) voltada para o setor de Ensaios Não Destrutivos (END) e Inspeção de Integridade de Equipamentos Industriais (Caldeiras, Vasos de Pressão, Tubulações e Tanques de Armazenamento – NR-13, ASME, Petrobras, ISO).

O sistema resolve os gargalos de digitalização de laudos em campo, permitindo coleta offline-first sem perda de dados, sincronização idempotente em lote, fila de espera assíncrona com Redis para proteger o banco de dados relacional e geração automatizada de relatórios técnicos padronizados e assinados.

---

## 2. Personas e Perfis Operacionais

| Perfil | Código | Responsabilidades Principais |
|---|---|---|
| **Inspetor N2** | `INSP-N2` | Operação em campo, preenchimento de medições (ultrassom, líquido penetrante, partícula magnética), captura de evidências fotográficas offline, submissão para sincronização. |
| **Engenheiro PH** | `ENG-PH` | Profissional Habilitado (Engenheiro Mecânico/Metalúrgico), revisão técnica de laudos, emissão de parecer conclusivo, cálculo de taxa de corrosão/vida residual e assinatura com ART. |
| **Gestor de Planta** | `GSTOR` | Diretoria e gerência industrial, acompanhamento de KPIs, conformidade de prazos, controle de vencimento de laudos e visualização de plantas industriais. |

---

## 3. Requisitos Funcionais e Arquitetura

### 3.1. Frontend PWA (Offline-First)
- **Tecnologias**: React 18, TypeScript, Vite, Dexie.js (IndexedDB).
- **Operação Offline**: Armazenamento de dados de inspeção e imagens/anexos localmente no IndexedDB via Dexie (`axos-anexos`).
- **Design System & Estética**:
  - Tema escuro por padrão (grafite neutro `#121315`, campos `#24272B`, acento ciano `#2FB8D6`).
  - Modo claro alternável (`#F1F3F4`, `#FFFFFF`) com botão Sol/Lua (mínimo 44px) no canto superior direito.
  - Sincronização de tema instantânea sem flash via chave `axos_theme` no `localStorage`.
  - Fontes tipográficas industriais: **Archivo** (títulos e botões de ação) e **IBM Plex Sans** (textos, campos e leitura técnica).
  - Tela de login unificada e delimitada em **1140px** no desktop, com painel de marca (grafite constante com animação A-Scan de ultrassom) alinhado horizontalmente topo-a-topo com a logo e base-a-base com as linhas inferiores de rodapé.

### 3.2. Backend & Fila de Espera Redis
- **Tecnologias**: Python 3.11+, FastAPI, Redis 7+ (hiredis), ARQ (Async Redis Queue), Tenacity.
- **Objetivo da Fila**: Amortecer picos de concorrência quando inspetores reconectam à rede simultaneamente, organizando uma fila de espera ordenada e segura antes da gravação no Supabase/PostgreSQL.
- **Endpoints de Sincronização (`/api/sync`)**:
  - `POST /api/sync/laudo`: Enfileiramento de laudo unitário com verificação de idempotência (hash SHA-256 no Redis com TTL de 24h).
  - `POST /api/sync/batch`: Ingestão atômica de lotes de até 50 inspeções de campo.
  - `GET /api/sync/status/{job_id}`: Consulta do status do processamento (queued, in_progress, completed, failed).
  - `GET /api/sync/dlq`: Monitoramento de Dead Letter Queue para auditoria de falhas irrecuperáveis.
- **Workers Assíncronos**:
  - `sync_worker.py`: Descarrega laudos da fila e persiste no Supabase com transação e retry inteligente.
  - `pdf_worker.py`: Renderização e compressão de laudos técnicos em PDF com QR Code de integridade.
  - `email_worker.py`: Envio de notificações e alertas operacionais.

### 3.3. Deploy e Infraestrutura (EasyPanel / Docker)
- **Suporte Nativo a EasyPanel**:
  - `backend/Dockerfile`: Imagem Python multi-estágio otimizada que serve tanto a API FastAPI quanto o Worker ARQ.
  - `frontend/Dockerfile` & `frontend/nginx.conf`: Build SPA estático com Nginx, compressão gzip e fallback para rotas SPA.
  - `docker-compose.yml`: Ambiente de orquestração local espelhando os serviços de produção (Redis, FastAPI, ARQ Worker e Frontend).

---

## 4. Requisitos Não Funcionais
1. **Segurança**: Criptografia de ponta a ponta, token JWT Supabase e comunicação segura HTTPS/WSS.
2. **Resiliência**: Políticas de retry exponencial via `tenacity` em conexões de banco e Redis; isolamento de falhas em DLQ.
3. **Performance**: Ingestão de laudos no endpoint `/sync` respondendo em menos de 50ms (enfileiramento assíncrono).
4. **Compliance**: Rastreabilidade completa de auditoria em conformidade com normas regulamentadoras (NR-13).

---

## 5. Diretrizes Comportamentais — Base para Todas as Operações (Karpathy Guidelines)

Todas as operações de desenvolvimento neste repositório são regidas pela skill **andrej-karpathy-skills** (https://github.com/multica-ai/andrej-karpathy-skills.git), inspirada nas observações de Andrej Karpathy sobre armadilhas comuns de LLMs em programação. Ela é a **base obrigatória** para qualquer alteração, implementação ou revisão de código.

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

## 6. Terminologia — END (Ensaios Não Destrutivos)

O produto é brasileiro. O termo correto é **END** (Ensaios Não Destrutivos). A sigla inglesa proibida é vedada em qualquer capitalização, em UI, textos, comentários, identificadores, mocks, testes ou documentação.

- **END** = Ensaios Não Destrutivos (sempre usar esta sigla).
- Sigla inglesa proibida = vedada. Converter para `END` sem perguntar.
- Prefixo do número do laudo: configurável por tenant via campo `reportPrefix` (padrão `'END'`). Formato do código de laudo: `{PREFIXO}-{MÉTODO}-{ANO}-{SEQ}` (SEQ com 3 dígitos, ex: `END-LP-2026-0042`). Ano vem de `new Date().getFullYear()`.
- Função única de geração: `buildReportCode(prefix, method, year, seq)` em `frontend/src/utils/buildReportCode.ts`, usada em todos os lugares que montam código de laudo.

---

## 7. Autenticação

O login é feito exclusivamente via `supabase.auth.signInWithPassword` (Supabase Auth).

Em ambiente de desenvolvimento, um bloco de login direto pode estar ativo apenas quando `import.meta.env.DEV` for verdadeiro, lendo `VITE_DEMO_EMAIL` e `VITE_DEMO_PASSWORD` do ambiente (arquivo `.env.local`, não versionado). Em build de produção (`!DEV`) esse bloco não existe. Não há sessão simulada, token falso (`mock-access-token`) nem credencial hardcoded em nenhum ambiente. Qualquer referência a `mock-access-token`, `axos-demo` ou e-mail/senha de exemplo deve ser removida sem perguntar.

---

## 8. Hub — Catálogo de Métodos (6 grupos, busca e cascata)

O Hub exibe os modelos técnicos organizados em 6 grupos:
1. Superfície: LP (Líquido Penetrante), PM (Partícula Magnética)
2. Ultrassom: US (Ultrassom Industrial), ME (Medição de Espessura)
3. Radiográfico: Radiografia Industrial (disponível em breve)
4. Visual & Solda: EVS (Inspeção Visual de Solda)
5. Pintura & Revestimento: PINT (Pintura & Aderência)
6. Vasos de Pressão (NR-13): NR-13

Funcionalidades:
- Barra de busca larga com atalho "/" (foco) e Esc (limpa). Busca normalizada (sem acento, minúsculas) casando em nome, sigla, normas e aliases.
- Linha "Usados recentemente" (até 3 chips), persistidos em `localStorage` (`axos_recent_methods`).
- Grade de 6 quadros de grupo, cada um com borda lateral colorida, nome do grupo e contador de laudos emitidos.
- Cascata: clicar no grupo expõe a lista de métodos do grupo abaixo da grade; só um grupo aberto por vez.
- Métodos `available:false` aparecem desabilitados com "Em breve".

Catálogo em `frontend/src/data/methodsCatalog.ts`. Função `getEnabledMethods(tenant)` retorna os métodos disponíveis, com ponto de extensão para habilitação por tenant.

---

## 9. Página de Ultrassom (US) — Feixe Angular

Página dedicada ao ensaio de Ultrassom com feixe angular, baseada no protótipo de mercado `axos-us-feixe-angular.html`.

Blocos da página:
1. **Peça e ensaio:** contratante, nº do desenho, descrição, material, nº da OP/OS, condição da superfície, temperatura, procedimento (nº e revisão), norma de referência, nível de aceitação, data do ensaio, técnica (feixe angular / feixe normal; PAUT e TOFD desabilitados "em breve"), bloco de referência, acoplante.
2. **Transdutores:** tabela de 1 a 5 linhas com identificação, ângulo real (°), frequência (MHz), dimensão, GP (dB), PT (dB), GC (dB).
3. **Registro de calibração detalhado:** seção recolhida (opcional) com aparelho, blocos, velocidade/distância, ganhos, curva DAC (pontos de profundidade/amplitude/ganho), verificações de calibração.
4. **Croqui da junta:** gabarito de junta em V com pointer events, ferramentas "Marcar Indicação", "Lápis", "Desfazer traço", "Limpar traços". Marcador no croqui ligado à tabela de descontinuidades (mesmo número).
5. **Descontinuidades:** tabela com Nº, Local, Comp., Prof., amplitude (%) e dB, Transdutor (seleção entre linhas da tabela), Obs. Colunas avançadas opcionais: classificação (planar/volumétrica), avaliação (aceita/rejeitada), ação (nenhuma/reparo/reensaio). Contadores de total e rejeitadas.
6. **Evidências:** anexos com legenda (tela do aparelho, fotos, relatório de calibração).
7. **Conclusão:** observações e limitações de acesso, veredito com 4 opções (Aprovado, Reprovado, NEC, Aprovado condicional). Alerta vermelho se houver indicação rejeitada e veredito Aprovado. Bloco de liberação condicional (responsável, cargo, data, motivo obrigatório).
8. **Assinatura:** executante, nível (N1/N2/N3), nº do certificado, órgão certificador (campo livre), validade da qualificação com selo calculado (vencido bloqueia emissão), data de emissão, vistos opcionais (responsável, contratante), espaço para hash e QR.

Tipos: `frontend/src/types/us.ts` (`UsTechnicalData`). Configuração de obrigatórios: `frontend/src/config/usFieldConfig.ts`. Componentes compartilhados em `frontend/src/components/laudo/` (`Croqui`, `ValidityBadge`, `VerdictBlock`, `EvidenceBlock`, `SignatureCard`).

O veredito é do inspetor e não é o status de workflow. O status de workflow (draft, submitted, approved, issued, returned) é do servidor.

---

## 10. Configuração da Empresa Emissora

Dados da empresa emissora (tenant) armazenados em `tenants` do Supabase:

- Razão social, nome fantasia, CNPJ (14 dígitos, validado)
- Endereço: logradouro, número, complemento, bairro, cidade, UF, CEP
- Telefone, e-mail
- Responsável técnico: nome e registro profissional
- Prefixo do relatório: 2 a 6 caracteres (A-Z, 0-9), padrão `END`
- Logo: caminho (`logo_path`) e SHA-256 (`logo_sha256`)

Storage:
- Bucket privado `tenant-assets`, caminho `{tenant_id}/logo/{sha256}.{ext}`
- Somente PNG e JPG (não SVG), limite 1 MB
- Escrita só do admin do tenant; leitura dos membros do tenant
- Nunca sobrescrever: cada logo nova é um arquivo novo, com o hash no nome

RLS:
- Todos do tenant leem `tenants`; só o papel admin do próprio tenant atualiza

Componentes:
- `DocumentHeader` (`frontend/src/components/laudo/DocumentHeader.tsx`): logo empresa emissora (máx 64px), razão social/nome fantasia, CNPJ, endereço, contato; direita com título do modelo, código do laudo, folha. Aviso "Complete em Configurações" quando faltar dado (só tela). Suporta prop `snapshot`.
- `DocumentFooter` (`frontend/src/components/laudo/DocumentFooter.tsx`): "Gerado por Axos Relatórios", página x de y, trecho do hash, espaço QR. Modo impressão: tema claro, sem avisos.

Vocabulário: empresa emissora = o tenant que usa o app e assina o laudo. Contratante = cliente da inspeção. Obra = local/projeto do contratante. OS = ordem de serviço. Hierarquia: Contratante > Obra > OS > Laudos.

---

## 11. Emissão do Laudo — Snapshot, Número do Servidor e PDF

**Snapshot do cabeçalho (servidor):**
- Em `reports`, a coluna `header_snapshot` (JSONB) armazena os dados da empresa emissora congelados no momento da emissão (transição `approved → issued`): razão social, nome fantasia, CNPJ, endereço completo, telefone, e-mail, responsável técnico, prefixo, logo_path, logo_sha256.
- Preenchido SEMPRE pelo servidor (trigger SQL); o cliente não envia nem altera (campo imutável).
- O snapshot entra no cálculo do `data_hash` (SHA-256), tornando o laudo emitido imutável.

**Número do laudo pelo servidor:**
- O rascunho local mostra "RASCUNHO". O número definitivo `{PREFIXO}-{MÉTODO}-{ANO}-{SEQ(3 dígitos))}` é atribuído pelo servidor na emissão.
- Sequência atômica por tenant/método/ano via função SQL `public.next_report_number(p_tenant, p_method, p_year)` com upsert em `report_number_counters`.
- Prefixo configurável por tenant (`report_prefix`, padrão `END`).
- Não alterar o `sync_worker` nesta tarefa; a chamada à função deve ser documentada na tarefa F (backend de sincronização).

**PDF (cabeçalho e rodapé):**
- `pdf_worker.py` reescrito com Jinja2 + WeasyPrint.
- Cabeçalho e rodapé alimentados pelo `header_snapshot` (nunca pela configuração atual).
- Logo buscada no Storage (`tenant-assets`) pelo `logo_path`; SHA-256 conferido contra o snapshot (falha se divergir).
- QR code apontando para `axosrelatorios.com/verificar/{documento}/{revisao}`.
- Upload para bucket privado `report-pdfs`; registro em `report_pdfs` (apenas inserção).
- `QR_BASE_URL` = `https://axosrelatorios.com/verificar`.

**Tabelas/Storage:**
- `report_pdfs`: id, tenant_id, report_id, storage_path, sha256, generated_at. Só inserção (trigger bloqueia update/delete). RLS de leitura por tenant.
- `report_number_counters`: tenant_id, method, year, seq (único por tenant+method+year).

---

## 12. Contratantes, Obras e Ordens de Serviço

**Modelo de dados:**
- `clients` (contratantes): id, tenant_id, legal_name, cnpj, address, contact_name, contact_email, contact_phone, active, created_by, created_in_field, needs_review.
- `sites` (obras): id, tenant_id, client_id, name, address, city, uf, contract_ref, situation (active/concluded/cancelled), created_by, created_in_field, needs_review.
- `work_orders` (ordens de serviço): id, tenant_id, client_id, code, site_id, scheduled_for, assigned_to, method (end_method opcional), notes, created_by, created_in_field, needs_review.

**Campos controlados pelo servidor:**
- `tenant_id`, `created_by`, `created_in_field`, `needs_review` são definidos pelo servidor a partir do token JWT e do papel do usuário. O cliente nunca envia esses valores.
- `created_in_field` = true quando o criador tem papel de inspetor.
- `needs_review` = true sempre para criação em campo; supervisor/admin marca como revisado (false).

**Regras de negócio (RLS):**
- Admin e supervisor: ler, criar e editar tudo do próprio tenant.
- Inspetor: ler contratantes e obras ativas do tenant e as OS atribuídas a ele ou criadas por ele. Pode criar contratante, obra e OS somente se `allow_field_creation` estiver ligado (needs_review e created_in_field nascem verdadeiros). Pode editar apenas o que criou enquanto needs_review for verdadeiro. Não apaga nada.
- Nenhuma leitura ou escrita entre tenants.

**Telas (Cadastros):**
- Abas: Contratantes, Obras, Ordens de serviço.
- Lista, busca, criar e editar, validação.
- Filtro "Pendentes de revisão" com contador para supervisor e admin.
- Marca "Criada em campo" para itens criados pelo inspetor.

**Cabeçalho do laudo:**
- `DocumentHeader` exibe bloco de serviço: contratante, obra, local, número do contrato, número da OS (lidos da OS do laudo, somente leitura).
- `header_snapshot` inclui esses campos, preenchido pelo servidor na emissão e incluído no hash. Depois de emitido, alterar contratante/obra/OS não muda o laudo.

**Sincronização (documentado em docs/obras-os.md):**
- Ordem de envio: contratantes, obras, OS, laudos.
- UUID do cliente como identidade. Reenvio idempotente.
- Códigos de erro: CLIENT_NOT_FOUND, SITE_NOT_FOUND, WORK_ORDER_NOT_FOUND, DUPLICATE_NUMBER, FIELD_CREATION_DISABLED, DEPENDENCY_FAILED, FORBIDDEN, VALIDATION_ERROR, UNKNOWN.

**Vocabulário:** Contratante > Obra > OS > Laudos. Nunca usar "cliente" sem deixar claro qual dos dois (empresa emissora = tenant; contratante = cliente da inspeção).

---

## 13. Backend de Sincronização e Contrato (Tarefa F)

**Arquitetura:**
- Gravação síncrona na requisição `POST /api/sync/reports`, com JWT do usuário repassado ao Supabase (RLS e triggers enxergam o usuário real). Sem `service_role` para gravar laudos.
- Lote de até 20 itens por requisição, cada item em sua própria transação (um erro não bloqueia os outros).
- Itens processados nesta ordem: clients, sites, work_orders, reports.

**Contrato de sincronização (docs/sync-contract.md):**
- Tipos de item: clients, sites, work_orders, reports.
- Cada item tem `client_id` (UUID gerado pelo cliente) e `client_revision` (inteiro crescente para idempotência).
- Campos controlados pelo servidor (ignorados/sobrescritos se enviados pelo cliente): `tenant_id`, `inspector_id`, `created_by`, `created_in_field`, `needs_review`, `id`, `created_at`, `updated_at`, `report_number`, `data_hash`, `header_snapshot`, status além de `draft`/`submitted`.

**Regras de gravação:**
- Idempotente por `client_id`: se `client_revision` <= revisão gravada, responder `ok` sem alterar.
- Criar laudo: status `draft`; `tenant_id` e `inspector_id` do token; `work_order_id` validado pelo tenant; `template_id` resolvido pelo servidor (template ativo do tenant para o método); `TEMPLATE_NOT_FOUND` se não houver.
- Atualizar: só quando `draft` ou `returned` e pertence ao inspetor. Caso contrário → `LOCKED`.
- `submit=true`: transição `draft → submitted` pelo caminho normal (gatilhos do banco rodam).
- Veredito do inspetor (A, R, NEC, AC) NÃO é status de workflow. `approved` e `issued` só o servidor define.

**Códigos de erro de laudo:**
- `QUALIFICATION_EXPIRED`, `INSTRUMENT_EXPIRED`, `MISSING_REQUIRED`, `LOCKED`, `WORK_ORDER_NOT_FOUND`, `TEMPLATE_NOT_FOUND`, `FORBIDDEN`, `VALIDATION_ERROR`, `UNKNOWN`.
- Códigos de obras/OS: `CLIENT_NOT_FOUND`, `SITE_NOT_FOUND`, `DUPLICATE_NUMBER`, `FIELD_CREATION_DISABLED`, `DEPENDENCY_FAILED`.

**Schema SQL:**
- Tabela `reports` ganha coluna `report_number text` (número definitivo do laudo, atribuído pelo servidor).
- Tabela `report_number_counters` (tenant_id, method, year, seq) para sequência atômica.
- Função `public.next_report_number(p_tenant, p_method, p_year)` retorna `{PREFIXO}-{MÉTODO}-{ANO}-{SEQ(3 dígitos)}`.

**Commits da tarefa:**
- `891792b` (db: reports ganha coluna report_number e índice)
- `287dda9` (feat(sync): rota síncrona POST /api/sync/reports com transações por item)
- `5e1c62f` (docs: contrato de sincronização)

---

## 14. Dexie, Fila de Sincronização e Estados do Laudo (Tarefa E)

**Banco local (Dexie):**
- Tabela `reports`: id (UUID), tenantId, method, workOrderId, data, verdict, localStatus, serverStatus, clientRevision, serverRevision, reportNumber, updatedAt, lastSyncAt, lastError.
- Tabelas `clients`, `sites`, `workOrders`, `qualifications`, `instruments`, `tenantConfig` para cache offline.
- Anexos existentes ficam ligados ao laudo por `id`.
- Migração única dos laudos do `localStorage` para o Dexie.

**Gerenciador de sincronização (`services/sync.ts`):**
- Disparo: ao abrir o app logado, evento online, aba volta a ficar visível, botão "Sincronizar agora", a cada 60s com aba visível e conexão.
- `navigator.onLine` como dica, não como verdade: erro de rede conta como offline.
- Lote de até 20 itens por requisição para `POST /api/sync/reports`.
- Uma execução por vez (trava).
- Ordem: clients, sites, work_orders, reports.
- Erros retryable (rede, 5xx): backoff 15s, 30s, 1min, 2min, até 5min.
- Erros não retryable (qualificação vencido, dado obrigatório faltando, bloqueado, duplicidade): param até o inspetor editar.
- Nunca apagar dados locais por ter sincronizado.

**Estados do laudo:**
- `localStatus`: rascunho, pronto, enviando, sincronizado, erro.
- `serverStatus`: rascunho, enviado, aprovado, emitido, returned, superseded.
- Número exibido como "RASCUNHO" até o servidor devolver o definitivo.

**Interface:**
- Indicador global no cabeçalho: online/offline, número de pendentes e botão "Sincronizar agora".
- Chip de estado em cada laudo.
- Filtro "Pendentes".
- Faixa de erro com mensagem e ação para corrigir.
- "Finalizar laudo": valida campos obrigatórios e confere qualificação e instrumentos no cache.
- "Novo laudo": escolher OS do cache (Minhas OS). Se não houver, criar OS: escolher obra do cache ou criar obra rápida (nome e contratante), e contratante do cache ou novo só com o nome. Tudo gravado localmente com UUID e marcado como pendente. Quando `allow_field_creation` estiver desligado, esconder a criação e mostrar "Peça ao supervisor para cadastrar a obra e a OS".
- PDF oficial: botão habilitado só quando o servidor marcar emitido. Antes disso, "Disponível após sincronizar". Sem via de campo.

**Atualização de cache:**
- Atualizar cache (OS, obras, contratantes, qualificações, instrumentos, configuração da empresa) após o login e após cada sincronização bem-sucedida.

**PWA:**
- `vite.config.ts`: remover cache de rotas inexistentes (ordem_servico, template). Dexie guarda os dados, não cachear a API REST.
- Dados de exemplo só atrás da flag de desenvolvimento.

**Commits da tarefa:**
- `5a34ded` (feat(db): Dexie schema com stores reports, outbox, clients, sites, workOrders, tenantConfig + migração do localStorage)
- `cfe3327` (feat(sync): SyncManager com outbox, backoff exponencial e sincronização offline-first)
- `78b5ea5` (feat(frontend): Dexie substituindo localStorage para laudos)
- `940556d` (feat(frontend): SyncStatusIndicator, ReportStatusChip e status de laudo no Hub)
- `92fc597` (feat(pwa): remover cache de rotas inexistentes do Service Worker)

**Pendências:**
- Testes SQL para sites/RLS não executados (banco não aplicado em ambiente de teste).
- Telas de cadastro usam dados mockados — integração real com Supabase na Tarefa F.
- Substituir cabeçalho/rodapé nas demais páginas de método.

---

**Arquitetura:**
- Gravação síncrona na requisição `POST /api/sync/reports`, com JWT do usuário repassado ao Supabase (RLS e triggers enxergam o usuário real). Sem `service_role` para gravar laudos.
- Lote de até 20 itens por requisição, cada item em sua própria transação (um erro não bloqueia os outros).
- Itens processados nesta ordem: clients, sites, work_orders, reports.

**Contrato de sincronização (docs/sync-contract.md):**
- Tipos de item: clients, sites, work_orders, reports.
- Cada item tem `client_id` (UUID gerado pelo cliente) e `client_revision` (inteiro crescente para idempotência).
- Campos controlados pelo servidor (ignorados/sobrescritos se enviados pelo cliente): `tenant_id`, `inspector_id`, `created_by`, `created_in_field`, `needs_review`, `id`, `created_at`, `updated_at`, `report_number`, `data_hash`, `header_snapshot`, status além de `draft`/`submitted`.

**Regras de gravação:**
- Idempotente por `client_id`: se `client_revision` <= revisão gravada, responder `ok` sem alterar.
- Criar laudo: status `draft`; `tenant_id` e `inspector_id` do token; `work_order_id` validado pelo tenant; `template_id` resolvido pelo servidor (template ativo do tenant para o método); `TEMPLATE_NOT_FOUND` se não houver.
- Atualizar: só quando `draft` ou `returned` e pertence ao inspetor. Caso contrário → `LOCKED`.
- `submit=true`: transição `draft → submitted` pelo caminho normal (gatilhos do banco rodam).
- Veredito do inspetor (A, R, NEC, AC) NÃO é status de workflow. `approved` e `issued` só o servidor define.

**Códigos de erro de laudo:**
- `QUALIFICATION_EXPIRED`, `INSTRUMENT_EXPIRED`, `MISSING_REQUIRED`, `LOCKED`, `WORK_ORDER_NOT_FOUND`, `TEMPLATE_NOT_FOUND`, `FORBIDDEN`, `VALIDATION_ERROR`, `UNKNOWN`.
- Códigos de obras/OS: `CLIENT_NOT_FOUND`, `SITE_NOT_FOUND`, `DUPLICATE_NUMBER`, `FIELD_CREATION_DISABLED`, `DEPENDENCY_FAILED`.

**Segurança:**
- `/api/sync/dlq` e `/api/sync/status/{job_id}` exigem papel supervisor ou admin.
- JWT valida audiência (verificar_aud habilitado).
- CORS com origens da configuração.
- Pool ARQ criado uma vez por processo (lifespan).
- Erros ao cliente com mensagem genérica; detalhes só no log.

**Schema SQL:**
- Tabela `reports` ganha coluna `report_number text` (número definitivo do laudo, atribuído pelo servidor).
- Tabela `report_number_counters` (tenant_id, method, year, seq) para sequência atômica.
- Função `public.next_report_number(p_tenant, p_method, p_year)` retorna `{PREFIXO}-{MÉTODO}-{ANO}-{SEQ(3 dígitos)}`.

**Commits da tarefa:**
- `891792b` (db: reports ganha coluna report_number e índice)
- `287dda9` (feat(sync): rota síncrona POST /api/sync/reports com transações por item)
- `5e1c62f` (docs: contrato de sincronização)

