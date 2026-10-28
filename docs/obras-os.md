# Regras de Sincronização — Contratantes, Obras e OS

Este documento especifica o contrato de sincronização offline-first para contratantes (clients), obras (sites) e ordens de serviço (work_orders), conforme a Tarefa G do `TAREFAS.md`.

A implementação dos endpoints de sincronização fica para a Tarefa F. Este documento apenas define o contrato.

---

## Ordem de envio

O cliente deve enviar os itens nesta ordem estrita, pois cada nível depende do anterior:

1. **clients** (contratantes)
2. **sites** (obras)
3. **work_orders** (ordens de serviço)
4. **reports** (laudos) — definido na Tarefa F

Se uma dependência falhar, os itens que dependem dela respondem `DEPENDENCY_FAILED`, sem gravar nada.

---

## Identidade do cliente (offline-first)

Cada entidade é identificada pelo cliente via UUID gerado no aparelho (`crypto.randomUUID`). Esse UUID é a identidade temporária até o servidor atribuir o ID definitivo.

Cada item de envio contém:
- `client_id` (UUID): identidade gerada pelo cliente
- `client_revision` (inteiro crescente): revisão do item no cliente, usada para idempotência

---

## Idempotência

O processamento é idempotente por `client_id`:

- Se `client_revision` <= revisão já gravada no servidor, responder `ok` sem alterar nada (reenvio seguro).
- Se `client_revision` > revisão gravada, gravar/atualizar e retornar o novo `server_id` e `server_revision`.

---

## Campos controlados pelo servidor

Os seguintes campos são definidos SEMPRE pelo servidor e ignorados/sobrescritos se enviados pelo cliente:

- `tenant_id` (do token JWT do usuário)
- `created_by` (do usuário autenticado)
- `created_in_field` (true se o usuário tem papel de inspetor)
- `needs_review` (true sempre para criação em campo)
- `id` (servidor gera o UUID definitivo)
- `created_at`, `updated_at`

---

## Códigos de erro

Cada item de resposta tem um código próprio (`ok`, `server_id`, `error_code`, `message`).

### Códigos de obras e OS

| Código | Significado | Pode tentar de novo? |
|--------|-------------|---------------------|
| `CLIENT_NOT_FOUND` | Contratante referenciado não existe no tenant | Não — só após editar |
| `SITE_NOT_FOUND` | Obra referenciada não existe no tenant | Não — só após editar |
| `WORK_ORDER_NOT_FOUND` | OS referenciada não existe no tenant | Não — só após editar |
| `DUPLICATE_NUMBER` | Número de OS duplicado no tenant | Não — só após editar |
| `FIELD_CREATION_DISABLED` | `allow_field_creation` está desligado no tenant | Não — só após editar (ativar no tenant) |
| `DEPENDENCY_FAILED` | Dependência (client/site/work_order) falhou | Não — resolver a dependência primeiro |
| `FORBIDDEN` | Usuário sem papel para a operação | Não — só após editar papel/tenant |
| `VALIDATION_ERROR` | Dados inválidos | Não — só após editar |
| `UNKNOWN` | Erro inesperado | Sim (com backoff) |

---

## Regras de gravação (servidor)

### Clients (contratantes)
- Criar: `tenant_id` do token, `created_by` = usuário, `created_in_field` = papel inspetor, `needs_review` = true.
- Atualizar: só quando `needs_review = true` e pertence ao criador (ou revisor/admin). Qualquer outro estado → `LOCKED`.

### Sites (obras)
- Criar: `tenant_id` do token, `client_id` validado pelo tenant, `created_by`, `created_in_field`, `needs_review`.
- Respeitar `allow_field_creation` (se desligado → `FIELD_CREATION_DISABLED`).
- Atualizar: mesmo padrão de clients.

### Work Orders (OS)
- Criar: `tenant_id`, `client_id` validado, `site_id` validado (se informado), `number` único por tenant (erro `DUPLICATE_NUMBER` se duplicado), `assigned_to` validado pelo tenant.
- Atualizar: mesmo padrão.

---

## Isolamento entre tenants

- Nenhuma leitura ou escrita entre tenants.
- O `tenant_id` vem sempre do token JWT, nunca do payload do cliente.
- Chave de idempotência dos jobs inclui `tenant_id`.

---

## Exemplo de fluxo de criação em campo

1. Inspetor cria contratante localmente (UUID `c1`, `client_revision: 1`).
2. Inspetor cria obra vinculada a `c1` (UUID `s1`, `client_revision: 1`).
3. Inspetor cria OS vinculada a `s1` (UUID `w1`, `client_revision: 1`).
4. Inspetor cria laudo vinculado à OS `w1`.
5. Ao sincronizar: enviar `c1` → servidor retorna `server_id: C-001`; enviar `s1` com referência a `C-001` → servidor retorna `server_id: S-001`; enviar `w1` com referência a `S-001` → servidor retorna `server_id: WO-001`; enviar laudo com referência a `WO-001`.

Se qualquer passo falhar, os dependentes ficam aguardando com `DEPENDENCY_FAILED`.
