# PRD – AXOS Relatórios (Plataforma de Integridade & NDT)

## 1. Visão Geral do Produto
O **AXOS Relatórios** é uma plataforma SaaS e PWA (Progressive Web App) voltada para o setor de Ensaios Não Destrutivos (END / NDT) e Inspeção de Integridade de Equipamentos Industriais (Caldeiras, Vasos de Pressão, Tubulações e Tanques de Armazenamento – NR-13, ASME, Petrobras, ISO).

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
