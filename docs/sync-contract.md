# Contrato de Sincronização — AXOS Relatórios

Este documento especifica o contrato de sincronização offline-first para clientes, obras, ordens de serviço e laudos, conforme a **Tarefa F** do `TAREFAS.md`.

A gravação é **síncrona** na requisição `POST /api/sync/reports`, com o JWT do usuário repassado ao Supabase (RLS e triggers enxergam o usuário real). Sem `service_role` para gravar laudos.

---

## Endpoint

```
POST /api/sync/reports
Content-Type: application/json
Authorization: Bearer <JWT do usuário>
```

**Payload:** lote de até 20 itens, processados nesta ordem:
1. clients (contratantes)
2. sites (obras)
3. work_orders (ordens de serviço)
4. reports (laudos)

Cada item deve conter `client_id` (UUID gerado pelo cliente) e `client_revision` (inteiro crescente).

---

## Itens de entrada

### Client (contratante)
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| client_id | UUID | Sim | Identidade gerada pelo cliente |
| client_revision | int | Sim | Revisão crescente (idempotência) |
| legal_name | string | Sim | Nome do contratante |
| cnpj | string | Não | CNPJ (14 dígitos, validado) |
| address | string | Não | Endereço |
| contact_name | string | Não | Nome do contato |
| contact_email | string | Não | E-mail |
| contact_phone | string | Não | Telefone |
| active | bool | Não | Ativo (padrão true) |

### Site (obra)
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| client_id | UUID | Sim | Identidade do contratante (mesmo UUID usado ao criar) |
| client_revision | int | Sim | Revisão crescente |
| name | string | Sim | Nome da obra |
| address | string | Não | Logradouro |
| city | string | Não | Cidade |
| uf | string | Não | UF (2 letras) |
| contract_ref | string | Não | Referência do contrato |
| situation | string | Não | active/concluded/cancelled (padrão active) |

### Work Order (ordem de serviço)
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| client_id | UUID | Sim | Identidade do contratante |
| client_revision | int | Sim | Revisão crescente |
| code | string | Sim | Número da OS (único por tenant) |
| site_id | UUID | Não | ID da obra (referência) |
| scheduled_for | date | Não | Data agendada |
| assigned_to | UUID | Não | Inspetor responsável |
| method | string | Não | Método previsto (código end_method) |
| notes | string | Não | Observações |

### Report (laudo)
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| client_id | UUID | Sim | Identidade do laudo (virou o id no servidor) |
| client_revision | int | Sim | Revisão crescente |
| method | string | Sim | Código do método (LP, PM, EVS, ME, US, PINTURA, VASO_PRESSAO) |
| work_order_id | UUID | Sim | ID da OS vinculada |
| equipment_tag | string | Sim | TAG do equipamento |
| inspection_date | date | Sim | Data da inspeção |
| technical_data | object | Não | Dados técnicos do formulário (inclui veredito A/R/NEC/AC) |
| administrative_data | object | Não | Dados administrativos |
| submit | bool | Não | Se true, transição draft → submitted |

---

## Resposta de cada item

| Campo | Tipo | Descrição |
|-------|------|-----------|
| client_id | UUID | Identidade do cliente (eco) |
| ok | bool | Sucesso ou falha |
| server_id | UUID | ID definitivo atribuído pelo servidor (quando ok) |
| server_revision | int | Revisão gravada no servidor |
| error_code | string | Código de erro (quando falha) |
| message | string | Mensagem legível |

---

## Códigos de erro

### Gerais
| Código | Significado | Retry? |
|--------|-------------|--------|
| VALIDATION_ERROR | Dados inválidos | Não |
| UNKNOWN | Erro inesperado | Sim (com backoff) |
| FORBIDDEN | Usuário sem papel para a operação | Não |

### Contratantes
| Código | Significado | Retry? |
|--------|-------------|--------|
| DUPLICATE_NUMBER | CNPJ já cadastrado neste tenant | Não |

### Obras
| Código | Significado | Retry? |
|--------|-------------|--------|
| CLIENT_NOT_FOUND | Contratante referenciado não existe | Não |

### OS
| Código | Significado | Retry? |
|--------|-------------|--------|
| CLIENT_NOT_FOUND | Contratante não existe | Não |
| SITE_NOT_FOUND | Obra não existe | Não |
| DUPLICATE_NUMBER | Número de OS duplicado | Não |

### Laudos
| Código | Significado | Retry? |
|--------|-------------|--------|
| WORK_ORDER_NOT_FOUND | OS não encontrada | Não |
| TEMPLATE_NOT_FOUND | Nenhum template publicado para o método | Não |
| QUALIFICATION_EXPIRED | Qualificação ausente/outro método/vencida | Não |
| INSTRUMENT_EXPIRED | Instrumento com calibração vencida | Não |
| LOCKED | Laudo não está em draft/returned (não pode alterar) | Não |
| MISSING_REQUIRED | Campo obrigatório faltando | Não |

---

## Regras de gravação (servidor)

### Idempotência
- Processado por `client_id`.
- Se `client_revision` <= revisão já gravada no servidor, responder `ok` sem alterar nada (reenvio seguro).
- Se `client_revision` > revisão gravada, gravar/atualizar e retornar o novo `server_id` e `server_revision`.

### Criar laudo
- Status inicial: `draft`.
- `tenant_id` e `inspector_id` vêm do token JWT, **nunca** do payload.
- `work_order_id` validado pelo tenant (deve pertencer ao mesmo tenant).
- `template_id` resolvido pelo servidor (template ativo do tenant para o método). Se não houver → `TEMPLATE_NOT_FOUND`.

### Atualizar laudo
- Só quando o laudo está em `draft` ou `returned` e pertence ao inspetor autenticado.
- Em qualquer outro estado → `LOCKED` e não sobrescreve.

### Submit (submit=true)
- Depois de gravar o conteúdo, faz a transição `draft → submitted` pelo caminho normal (gatilhos do banco rodam).
- Mapeia exceções dos triggers para os códigos acima.

### Veredito vs Status de workflow
- O veredito do inspetor (A, R, NEC, AC) **não** é o status de workflow.
- `approved` e `issued` só o revisor define no servidor.
- O cliente nunca envia estes estados.

### Campos ignorados/sobrescritos pelo servidor
- `tenant_id` (do token)
- `inspector_id` (do token)
- `created_by` (usuário autenticado)
- `created_in_field` (true se papel inspetor)
- `needs_review` (true para criação em campo)
- `id` (UUID do cliente usado como identidade, servidor gera definitivo)
- Número do laudo (`report_number`, atribuído pelo servidor via `next_report_number`)
- Hash (`data_hash`, calculado pelos triggers)
- Status além de `draft` e `submitted` (cliente não envia `approved`/`issued`)

---

## Isolamento entre tenants

- `tenant_id` vem sempre do token JWT, nunca do payload.
- Nenhuma leitura ou escrita entre tenants.
- Chave de idempotência dos jobs inclui `tenant_id`.

---

## Exemplo de fluxo de criação em campo

1. Inspetor cria contratante localmente (`client_id: c1`, `client_revision: 1`).
2. Inspetor cria obra vinculada a `c1` (`client_id: s1`, `client_revision: 1`).
3. Inspetor cria OS vinculada a `s1` (`client_id: w1`, `client_revision: 1`).
4. Inspetor cria laudo vinculado à OS `w1` (`client_id: r1`, `client_revision: 1`).
5. Ao sincronizar: enviar `c1` → servidor retorna `server_id: C-001`; enviar `s1` com referência a `C-001` → `server_id: S-001`; enviar `w1` com referência a `S-001` → `server_id: WO-001`; enviar laudo `r1` com referência a `WO-001`.

Se qualquer passo falhar, os dependentes respondem `DEPENDENCY_FAILED` (quando implementado no backend completo).
