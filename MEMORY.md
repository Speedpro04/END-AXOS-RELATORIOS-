# MEMORY – AXOS Relatórios (Contexto e Memória Arquitetural)

## 1. Resumo do Repositório e Missão
O **AXOS Relatórios** é uma solução de software para o segmento de Integridade Estrutural e NDT. O sistema opera tanto em modo PWA offline no campo quanto em servidores gerenciados no EasyPanel via Docker.

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

### 2.4. Deploy e Containers (EasyPanel)
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
