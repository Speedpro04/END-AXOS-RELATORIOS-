-- AXOS Relatórios | instalação completa do banco (migrações 0001 a 0010)
-- Rode uma vez, no SQL Editor do projeto ygijmtzipvsvdcbvurhg, com o projeto vazio.
-- Roda como um bloco só: se der erro, nada fica pela metade.

begin;

-- ===== 0001_initial_schema.sql =====
-- =====================================================================
-- Axos Relatórios | migração 0001: modelo de dados, RLS e auditoria
-- Alvo: Supabase (PostgreSQL 15+)
--
-- STATUS: escrita, mas NÃO executada. Rode primeiro em um projeto de
-- teste e execute os testes de isolamento listados no final do arquivo.
--
-- Decisões de desenho
--  1. Multi-tenant por tenant_id em toda tabela, RLS ligado e negado por padrão.
--  2. Tenant e papel do usuário vêm da tabela profiles (função private.*),
--     não de claims do JWT: desativar um usuário vale na hora, sem esperar
--     o token expirar. Nunca usar user_metadata para autorização.
--  3. FKs compostas (id, tenant_id) impedem referência entre empresas, que
--     o RLS sozinho não barra (checagem de FK ignora RLS).
--  4. Conteúdo do laudo separado em colunas técnicas (só o inspetor edita)
--     e administrative_data (supervisor edita enquanto estiver com ele).
--  5. Ciclo: draft -> submitted -> (returned -> submitted)* -> approved -> issued.
--     Emitido é imutável. Correção = nova revisão (revision + 1).
--     A revisão numerada só nasce DEPOIS da emissão; cada ida e volta
--     da revisão fica na trilha de auditoria com hash.
--  6. Auditoria append-only, escrita só por trigger.
-- =====================================================================

do $$
begin
  create extension if not exists pgcrypto with schema extensions;
exception when others then
  null;
end $$;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 1. TIPOS
-- ---------------------------------------------------------------------
create type public.app_role as enum ('admin', 'supervisor', 'inspector');

create type public.report_status as enum
  ('draft', 'submitted', 'returned', 'approved', 'issued', 'superseded');

create type public.end_method as enum
  ('VT', 'PT', 'MT', 'UT', 'RT', 'ET', 'LT', 'LT_VACUO',
   'PAUT', 'TOFD', 'CRDR', 'ECA', 'EA', 'IRT', 'ACFM', 'TFM');

-- ---------------------------------------------------------------------
-- 2. TABELAS
-- ---------------------------------------------------------------------
create table public.tenants (
  id                      uuid primary key default gen_random_uuid(),
  legal_name              text not null,
  trade_name              text,
  cnpj                    text unique,
  address_street          text,
  address_number          text,
  address_complement      text,
  address_neighborhood    text,
  address_city            text,
  address_uf              text check (length(address_uf) = 2),
  address_cep             text,
  phone                   text,
  email                   text,
  responsible_name        text,
  responsible_register    text,
  logo_path               text,
  logo_sha256             text,
  report_prefix           text not null default 'END' check (length(report_prefix) between 2 and 6),
  plan                    text not null default 'trial'
                          check (plan in ('trial', 'starter', 'pro', 'enterprise')),
  require_second_reviewer boolean not null default true,  -- quem inspecionou não aprova o próprio laudo
  allow_field_creation    boolean not null default true,  -- permite contratante/obra/OS criados em campo
  created_at              timestamptz not null default now()
);

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete restrict,
  tenant_id   uuid not null references public.tenants (id) on delete restrict,
  role        public.app_role not null,
  can_inspect boolean not null default false,  -- permite supervisor/admin também inspecionar (empresa pequena)
  full_name   text not null,
  active      boolean not null default true,   -- desativar em vez de apagar, para preservar autoria
  created_at  timestamptz not null default now(),
  unique (id, tenant_id)
);
create index on public.profiles (tenant_id);

create table public.clients (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete restrict,
  legal_name    text not null,
  cnpj          text,
  address       text,
  contact_name  text,
  contact_email text,
  contact_phone text,
  active        boolean not null default true,
  created_by    uuid not null default auth.uid(),
  created_in_field boolean not null default false,
  needs_review   boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, tenant_id)
);
create index on public.clients (tenant_id);
comment on column public.clients.contact_name  is 'LGPD: dado pessoal';
comment on column public.clients.contact_email is 'LGPD: dado pessoal';
comment on column public.clients.contact_phone is 'LGPD: dado pessoal';
comment on column public.clients.created_by      is 'Servidor: UUID do usuário que criou (cliente não envia)';
comment on column public.clients.created_in_field is 'Servidor: true se criado em campo pelo inspetor';
comment on column public.clients.needs_review     is 'Servidor: true se precisa de revisão do supervisor';

-- Obras (sites) pertencem a um contratante (client) de um tenant
create table public.sites (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete restrict,
  client_id     uuid not null references public.clients (id) on delete restrict,
  name          text not null,
  address       text,
  city          text,
  uf            text check (length(uf) = 2),
  contract_ref  text,           -- número ou referência do contrato nesta obra
  situation     text not null default 'active'
                          check (situation in ('active', 'concluded', 'cancelled')),
  created_by    uuid not null default auth.uid(),
  created_in_field boolean not null default false,
  needs_review   boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id)
);
create index on public.sites (tenant_id);
create index on public.sites (client_id);
comment on column public.sites.created_by      is 'Servidor: UUID do usuário que criou';
comment on column public.sites.created_in_field is 'Servidor: true se criado em campo';
comment on column public.sites.needs_review     is 'Servidor: true se precisa de revisão';

create table public.qualifications (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete restrict,
  user_id     uuid not null,
  method      public.end_method not null,
  level       smallint check (level between 1 and 3),
  cert_number text not null,
  issuer      text not null,
  valid_until date not null,
  created_at  timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (user_id, tenant_id) references public.profiles (id, tenant_id)
);
create index on public.qualifications (tenant_id, user_id);

create table public.instruments (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants (id) on delete restrict,
  name                    text not null,
  kind                    text,
  serial_number           text,
  calibration_certificate text,
  calibration_valid_until date not null,
  active                  boolean not null default true,
  created_at              timestamptz not null default now(),
  unique (id, tenant_id)
);
create index on public.instruments (tenant_id);

-- tenant_id nulo = modelo global mantido pela Axos
create table public.report_templates (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references public.tenants (id) on delete restrict,
  method     public.end_method not null,
  name       text not null,
  version    int not null default 1,
  definition jsonb not null,    -- campos do formulário; cada campo marcado kind = technical | administrative
  published  boolean not null default false,
  created_at timestamptz not null default now(),
  unique nulls not distinct (tenant_id, name, version)
);

create table public.work_orders (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete restrict,
  client_id    uuid not null,
  code         text not null,
  site         text,
  site_id      uuid,                                -- referência à tabela sites (obra)
  scheduled_for date,
  assigned_to  uuid,
  method       public.end_method,                   -- método previsto (opcional)
  notes        text,
  created_by   uuid not null default auth.uid(),
  created_in_field boolean not null default false,
  needs_review   boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (id, tenant_id),
  unique (tenant_id, code),
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id),
  foreign key (site_id, tenant_id) references public.sites (id, tenant_id),
  foreign key (assigned_to, tenant_id) references public.profiles (id, tenant_id)
);
create index on public.work_orders (tenant_id, assigned_to);
create index on public.work_orders (client_id);
create index on public.work_orders (site_id);

-- Cada linha é uma REVISÃO de um documento (document_id agrupa as revisões).
create table public.reports (
  id                  uuid primary key default gen_random_uuid(),  -- o app pode gerar o id offline (idempotência)
  tenant_id           uuid not null references public.tenants (id) on delete restrict,
  work_order_id       uuid not null,
  template_id         uuid not null references public.report_templates (id) on delete restrict,
  document_id         uuid not null default gen_random_uuid(),
  revision            int not null default 0 check (revision >= 0),
  client_revision     int not null default 0 check (client_revision >= 0),  -- contador do aparelho (idempotência da sincronização)
  inspector_id        uuid not null,
  status              public.report_status not null default 'draft',
  report_number       text,                              -- número definitivo do laudo, atribuído pelo servidor na emissão ({PREFIXO}-{MÉTODO}-{ANO}-{SEQ})

  -- campos TÉCNICOS: só o inspetor responsável altera (rascunho ou devolvido)
  equipment_tag       text,
  inspection_date     date,
  inspection_site     text,
  qualification_id    uuid,
  technical_data      jsonb not null default '{}'::jsonb,
  croqui              jsonb,   -- croqui vetorial (traços, formas, pinos), não imagem

  -- campos ADMINISTRATIVOS: supervisor edita só com o laudo em submitted/approved
  administrative_data jsonb not null default '{}'::jsonb,

  -- controlados pelo servidor: o cliente nunca consegue defini-los
  submitted_at        timestamptz,
  approved_at         timestamptz,
  approved_by         uuid references public.profiles (id),
  issued_at           timestamptz,
  issued_by           uuid references public.profiles (id),
  data_hash           text,
  client_snapshot     jsonb,   -- cópia de cliente/emitente/inspetor/qualificação/instrumentos no momento da emissão
  header_snapshot     jsonb,   -- dados da empresa emissora congelados pelo servidor na emissão (cliente não define)

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (id, tenant_id),
  unique (document_id, revision),
  foreign key (work_order_id, tenant_id) references public.work_orders (id, tenant_id),
  foreign key (inspector_id, tenant_id) references public.profiles (id, tenant_id),
  foreign key (qualification_id, tenant_id) references public.qualifications (id, tenant_id)
);
create index on public.reports (tenant_id, status);
create index on public.reports (inspector_id);
create index on public.reports (work_order_id);
create index on public.reports (report_number);
-- no máximo uma revisão em andamento por documento
create unique index reports_one_open_revision
  on public.reports (document_id)
  where status in ('draft', 'submitted', 'returned', 'approved');

-- ---------------------------------------------------------------------
-- Contadores atômicos de número de laudo por tenant / método / ano
-- Número definitivo: {PREFIXO}-{MÉTODO}-{ANO}-{SEQ com 3 dígitos}
-- Chamada pelo servidor no momento da emissão (aprovado → issued).
-- ---------------------------------------------------------------------
create table public.report_number_counters (
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  method    text not null,
  year      int not null check (year between 2000 and 2100),
  seq       int not null default 1,
  primary key (tenant_id, method, year),
  unique (tenant_id, method, year)
);
create index on public.report_number_counters (tenant_id);
alter table public.report_number_counters enable row level security;  -- sem política: só a função abaixo grava

create or replace function public.next_report_number(
  p_tenant uuid,
  p_method text,
  p_year int
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_prefix text;
  v_seq    int;
  v_number text;
begin
  -- Só revisor do próprio tenant consome número (a emissão roda como o usuário logado)
  if p_tenant is distinct from private.my_tenant_id() or not private.is_reviewer() then
    raise exception 'FORBIDDEN';
  end if;

  -- Prefixo configurável por tenant (padrão END)
  select coalesce(t.report_prefix, 'END') into v_prefix
    from public.tenants t where t.id = p_tenant;

  if v_prefix is null then
    v_prefix := 'END';
  end if;

  -- Upsert atômico: incrementa sequência ou cria se não existir
  insert into public.report_number_counters (tenant_id, method, year, seq)
  values (p_tenant, p_method, p_year, 1)
  on conflict (tenant_id, method, year)
  do update set seq = report_number_counters.seq + 1
  returning seq into v_seq;

  v_number := v_prefix || '-' || upper(p_method) || '-' || p_year || '-' || lpad(v_seq::text, 3, '0');
  return v_number;
end $$;

-- ---------------------------------------------------------------------
-- Tabela de PDFs emitidos (somente inserção; não permite update/delete)
-- ---------------------------------------------------------------------
create table public.report_pdfs (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete restrict,
  report_id    uuid not null,
  storage_path text not null,   -- report-pdfs/{tenant_id}/{report_id}.pdf
  sha256       text not null,   -- hash do PDF gerado
  generated_at timestamptz not null default now(),
  unique (id, tenant_id),
  unique (report_id, tenant_id),
  foreign key (report_id, tenant_id) references public.reports (id, tenant_id) on delete cascade
);
create index on public.report_pdfs (tenant_id);
create index on report_pdfs (report_id);

-- Somente inserção: bloqueia update e delete
create or replace function private.report_pdfs_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'REPORT_PDFS_IS_APPEND_ONLY';
end $$;

create trigger report_pdfs_no_update before update on public.report_pdfs
  for each row execute function private.report_pdfs_immutable();
create trigger report_pdfs_no_delete before delete on public.report_pdfs
  for each row execute function private.report_pdfs_immutable();
create trigger report_pdfs_no_truncate before truncate on public.report_pdfs
  for each statement execute function private.report_pdfs_immutable();

create table public.report_instruments (
  report_id     uuid not null,
  instrument_id uuid not null,
  tenant_id     uuid not null,
  primary key (report_id, instrument_id),
  foreign key (report_id, tenant_id) references public.reports (id, tenant_id) on delete cascade,
  foreign key (instrument_id, tenant_id) references public.instruments (id, tenant_id)
);

create table public.report_attachments (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null,
  report_id    uuid not null,
  kind         text not null check (kind in ('photo', 'sketch', 'document')),
  storage_path text not null,   -- <tenant_id>/<report_id>/<arquivo> no bucket report-files
  sha256       text not null,
  caption      text,
  taken_at     timestamptz,
  created_by   uuid not null default auth.uid(),
  created_at   timestamptz not null default now(),
  unique (report_id, sha256),   -- reenvio do mesmo arquivo não duplica
  foreign key (report_id, tenant_id) references public.reports (id, tenant_id) on delete cascade
);
create index on public.report_attachments (report_id);
comment on table public.report_attachments is 'LGPD: fotos podem conter pessoas identificáveis';

create table public.report_comments (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null,
  report_id  uuid not null,
  author_id  uuid not null default auth.uid(),
  field_path text,   -- ponto do laudo comentado (ex.: technical.indicacoes[2])
  body       text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now(),
  foreign key (report_id, tenant_id) references public.reports (id, tenant_id) on delete cascade,
  foreign key (author_id, tenant_id) references public.profiles (id, tenant_id)
);
create index on public.report_comments (report_id, created_at);

create table public.audit_log (
  id         bigint generated always as identity primary key,
  tenant_id  uuid,
  actor_id   uuid,
  actor_role text,
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  details    jsonb not null default '{}'::jsonb,
  at         timestamptz not null default now()
);
create index on public.audit_log (tenant_id, at desc);
create index on public.audit_log (entity, entity_id);
comment on table public.audit_log is 'LGPD: contém dados pessoais; definir política de retenção/anonimização';

-- ---------------------------------------------------------------------
-- 3. FUNÇÕES AUXILIARES (consultas ao perfil do usuário logado)
-- ---------------------------------------------------------------------
create or replace function private.my_tenant_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.tenant_id from public.profiles p where p.id = auth.uid() and p.active
$$;

create or replace function private.my_role()
returns public.app_role language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.active
$$;

create or replace function private.is_reviewer()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.role in ('admin', 'supervisor') from public.profiles p
      where p.id = auth.uid() and p.active),
    false)
$$;

create or replace function private.can_inspect()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select (p.role = 'inspector' or p.can_inspect) from public.profiles p
      where p.id = auth.uid() and p.active),
    false)
$$;

-- RLS: leitura só por membros do tenant
alter table public.report_pdfs enable row level security;
create policy report_pdfs_select on public.report_pdfs for select to authenticated
  using (tenant_id = (select private.my_tenant_id()));
create policy report_pdfs_insert on public.report_pdfs for insert to authenticated
  with check (tenant_id = (select private.my_tenant_id()));

-- ---------------------------------------------------------------------
-- Storage: bucket privado report-pdfs (escrita só pelo backend)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-pdfs', 'report-pdfs', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy report_pdfs_storage_select on storage.objects for select to authenticated
  using (
    bucket_id = 'report-pdfs'
    and (storage.foldername(name))[1] = ((select private.my_tenant_id())::text)
  );

-- Hash SHA-256 do conteúdo do laudo (inclui hashes dos anexos e o snapshot, quando existir)
create or replace function private.report_hash(r public.reports)
returns text language sql stable security definer set search_path = '' as $$
  select encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'document_id',      r.document_id,
          'revision',         r.revision,
          'template_id',      r.template_id,
          'equipment_tag',    r.equipment_tag,
          'inspection_date',  r.inspection_date,
          'inspection_site',  r.inspection_site,
          'qualification_id', r.qualification_id,
          'technical',        r.technical_data,
          'croqui',           r.croqui,
          'administrative',   r.administrative_data,
          'client_snapshot',  r.client_snapshot,
          'header_snapshot',  r.header_snapshot,
          'attachments', (
            select coalesce(jsonb_agg(a.sha256 order by a.sha256), '[]'::jsonb)
              from public.report_attachments a where a.report_id = r.id)
        )::text,
        'UTF8'),
      'sha256'),
    'hex')
$$;

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 4. REGRAS DO LAUDO (triggers: o RLS só enxerga linha, não coluna nem transição)
-- ---------------------------------------------------------------------

-- 4.1 Inserção: sempre rascunho; revisão só a partir de laudo emitido
create or replace function private.reports_before_insert()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_tpl         public.report_templates%rowtype;
  v_prev_status public.report_status;
begin
  -- Regra inviolável: todo novo laudo nasce como draft e sem carimbos de servidor
  if new.status <> 'draft' then
    raise exception 'NEW_REPORT_MUST_BE_DRAFT';
  end if;

  new.submitted_at := null;  new.approved_at := null;  new.approved_by := null;
  new.issued_at := null;     new.issued_by := null;
  new.data_hash := null;     new.client_snapshot := null;
  new.header_snapshot := null;
  new.report_number := null;

  select * into v_tpl from public.report_templates t
   where t.id = new.template_id and t.published;
  if not found or (v_tpl.tenant_id is not null and v_tpl.tenant_id <> new.tenant_id) then
    raise exception 'TEMPLATE_NOT_AVAILABLE';
  end if;

  if new.revision > 0 then
    select r.status into v_prev_status from public.reports r
     where r.document_id = new.document_id
       and r.revision = new.revision - 1
       and r.tenant_id = new.tenant_id;
    if v_prev_status is distinct from 'issued' then
      raise exception 'REVISION_BASE_NOT_ISSUED'
        using hint = 'Só é possível criar revisão a partir de um laudo emitido.';
    end if;
  end if;

  return new;
end $$;

-- 4.2 Atualização: campos técnicos x administrativos, transições, emissão
create or replace function private.reports_before_update()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_uid           uuid := auth.uid();
  v_owner         boolean;
  v_reviewer      boolean;
  v_tech_changed  boolean;
  v_admin_changed boolean;
begin
  -- (1) campos que nunca mudam
  if new.id            is distinct from old.id
     or new.tenant_id     is distinct from old.tenant_id
     or new.work_order_id is distinct from old.work_order_id
     or new.template_id   is distinct from old.template_id
     or new.document_id   is distinct from old.document_id
     or new.revision      is distinct from old.revision
     or new.inspector_id  is distinct from old.inspector_id
     or new.created_at    is distinct from old.created_at
     or new.header_snapshot is distinct from old.header_snapshot then
    raise exception 'FIELD_IMMUTABLE';
  end if;

  -- (2) emitido/substituído é imutável. Única exceção: marcar o emitido como
  --     substituído, feito pela emissão da revisão seguinte (trigger aninhado).
  if old.status in ('issued', 'superseded') then
    if old.status = 'issued'
       and new.status = 'superseded'
       and pg_trigger_depth() > 1
       and (to_jsonb(new) - 'status' - 'updated_at') = (to_jsonb(old) - 'status' - 'updated_at') then
      new.updated_at := now();
      return new;
    end if;
    raise exception 'REPORT_IMMUTABLE'
      using hint = 'Laudo emitido não pode ser alterado. Crie uma nova revisão.';
  end if;

  new.updated_at := now();

  -- (3) campos controlados pelo servidor nunca vêm do cliente/chamador
  new.submitted_at    := old.submitted_at;
  new.approved_at     := old.approved_at;
  new.approved_by     := old.approved_by;
  new.issued_at       := old.issued_at;
  new.issued_by       := old.issued_by;
  new.data_hash       := old.data_hash;
  new.client_snapshot := old.client_snapshot;
  new.header_snapshot := old.header_snapshot;
  new.report_number   := old.report_number;

  v_tech_changed :=
    (new.equipment_tag, new.inspection_date, new.inspection_site,
     new.qualification_id, new.technical_data, new.croqui)
    is distinct from
    (old.equipment_tag, old.inspection_date, old.inspection_site,
     old.qualification_id, old.technical_data, old.croqui);

  v_admin_changed := new.administrative_data is distinct from old.administrative_data;

  v_owner    := (v_uid is not null and old.inspector_id = v_uid);
  v_reviewer := (v_uid is not null and (select private.is_reviewer()));

  -- (4) quem pode editar o quê
  if v_tech_changed and not (v_owner and old.status in ('draft', 'returned')) then
    raise exception 'TECHNICAL_FIELDS_LOCKED'
      using hint = 'Só o inspetor responsável altera dados técnicos, em rascunho ou devolvido.';
  end if;

  if v_admin_changed and not (
       (v_owner    and old.status in ('draft', 'returned'))
    or (v_reviewer and old.status in ('submitted', 'approved'))
  ) then
    raise exception 'ADMIN_FIELDS_LOCKED';
  end if;

  -- (6) transições de estado
  if new.status is distinct from old.status then

    if old.status in ('draft', 'returned') and new.status = 'submitted' then
      if not v_owner then
        raise exception 'ONLY_OWNER_CAN_SUBMIT';
      end if;
      if coalesce(btrim(new.equipment_tag), '') = ''
         or new.inspection_date is null
         or new.qualification_id is null then
        raise exception 'REPORT_INCOMPLETE'
          using hint = 'Informe TAG do equipamento, data da inspeção e qualificação do inspetor.';
      end if;
      if not exists (
        select 1
          from public.qualifications q
          join public.report_templates t on t.id = new.template_id
         where q.id = new.qualification_id
           and q.user_id = new.inspector_id
           and q.method = t.method
           and q.valid_until >= new.inspection_date
      ) then
        raise exception 'QUALIFICATION_INVALID'
          using hint = 'Qualificação ausente, de outro método ou vencida na data da inspeção.';
      end if;
      if exists (
        select 1
          from public.report_instruments ri
          join public.instruments i on i.id = ri.instrument_id
         where ri.report_id = new.id
           and i.calibration_valid_until < new.inspection_date
      ) then
        raise exception 'INSTRUMENT_CALIBRATION_EXPIRED'
          using hint = 'Há instrumento com calibração vencida na data da inspeção.';
      end if;
      new.submitted_at := now();
      new.data_hash    := private.report_hash(new);

    elsif old.status = 'submitted' and new.status = 'returned' then
      if not v_reviewer then
        raise exception 'ONLY_REVIEWER_CAN_RETURN';
      end if;
      if not exists (
        select 1 from public.report_comments c
         where c.report_id = old.id and c.created_at >= old.submitted_at
      ) then
        raise exception 'RETURN_REQUIRES_COMMENT'
          using hint = 'Registre ao menos um comentário explicando a devolução.';
      end if;

    elsif old.status = 'submitted' and new.status = 'approved' then
      if not v_reviewer then
        raise exception 'ONLY_REVIEWER_CAN_APPROVE';
      end if;
      if old.inspector_id = v_uid
         and (select t.require_second_reviewer from public.tenants t where t.id = old.tenant_id) then
        raise exception 'SELF_APPROVAL_NOT_ALLOWED'
          using hint = 'Outro revisor precisa aprovar o laudo que você inspecionou.';
      end if;
      new.approved_at := now();
      new.approved_by := v_uid;

    elsif old.status = 'approved' and new.status = 'issued' then
      if not v_reviewer then
        raise exception 'ONLY_REVIEWER_CAN_ISSUE';
      end if;

      new.client_snapshot := jsonb_build_object(
        'issuer', (
          select jsonb_build_object('legal_name', t.legal_name, 'cnpj', t.cnpj)
            from public.tenants t where t.id = new.tenant_id),
        'client', (
          select jsonb_build_object('legal_name', c.legal_name, 'cnpj', c.cnpj, 'address', c.address)
            from public.work_orders w
            join public.clients c on c.id = w.client_id
           where w.id = new.work_order_id),
        'inspector', (
          select jsonb_build_object('full_name', p.full_name)
            from public.profiles p where p.id = new.inspector_id),
        'qualification', (
          select jsonb_build_object(
                   'method', q.method, 'level', q.level, 'cert_number', q.cert_number,
                   'issuer', q.issuer, 'valid_until', q.valid_until)
            from public.qualifications q where q.id = new.qualification_id),
        'instruments', (
          select coalesce(jsonb_agg(jsonb_build_object(
                   'name', i.name, 'serial_number', i.serial_number,
                   'calibration_certificate', i.calibration_certificate,
                   'calibration_valid_until', i.calibration_valid_until) order by i.name),
                 '[]'::jsonb)
            from public.report_instruments ri
            join public.instruments i on i.id = ri.instrument_id
           where ri.report_id = new.id),
        'captured_at', now()
      );
      new.header_snapshot := jsonb_build_object(
        'legal_name', (select legal_name from public.tenants where id = new.tenant_id),
        'trade_name', (select trade_name from public.tenants where id = new.tenant_id),
        'cnpj', (select cnpj from public.tenants where id = new.tenant_id),
        'address_street', (select address_street from public.tenants where id = new.tenant_id),
        'address_number', (select address_number from public.tenants where id = new.tenant_id),
        'address_complement', (select address_complement from public.tenants where id = new.tenant_id),
        'address_neighborhood', (select address_neighborhood from public.tenants where id = new.tenant_id),
        'address_city', (select address_city from public.tenants where id = new.tenant_id),
        'address_uf', (select address_uf from public.tenants where id = new.tenant_id),
        'address_cep', (select address_cep from public.tenants where id = new.tenant_id),
        'phone', (select phone from public.tenants where id = new.tenant_id),
        'email', (select email from public.tenants where id = new.tenant_id),
        'responsible_name', (select responsible_name from public.tenants where id = new.tenant_id),
        'responsible_register', (select responsible_register from public.tenants where id = new.tenant_id),
        'logo_path', (select logo_path from public.tenants where id = new.tenant_id),
        'logo_sha256', (select logo_sha256 from public.tenants where id = new.tenant_id),
        'report_prefix', (select report_prefix from public.tenants where id = new.tenant_id),
        'client_name', (select c.legal_name from public.work_orders w join public.clients c on c.id = w.client_id where w.id = new.work_order_id),
        'site_name', (select s.name from public.work_orders w left join public.sites s on s.id = w.site_id where w.id = new.work_order_id),
        'site_address', (select s.address from public.work_orders w left join public.sites s on s.id = w.site_id where w.id = new.work_order_id),
        'contract_ref', (select s.contract_ref from public.work_orders w left join public.sites s on s.id = w.site_id where w.id = new.work_order_id),
        'work_order_code', (select w.code from public.work_orders w where w.id = new.work_order_id)
      );
      -- número definitivo: revisão mantém o número do documento; a primeira emissão gera um novo
      if new.revision > 0 then
        select r.report_number into new.report_number from public.reports r
         where r.document_id = new.document_id and r.revision = new.revision - 1;
      else
        new.report_number := public.next_report_number(
          new.tenant_id,
          (select t.method::text from public.report_templates t where t.id = new.template_id),
          extract(year from now())::int);
      end if;

      new.issued_at := now();
      new.issued_by := v_uid;
      new.data_hash := private.report_hash(new);

      -- a revisão anterior passa a "substituída"
      if new.revision > 0 then
        update public.reports
           set status = 'superseded'
         where document_id = new.document_id
           and revision = new.revision - 1
           and status = 'issued';
      end if;

    else
      raise exception 'INVALID_TRANSITION'
        using hint = format('Transição %s -> %s não é permitida.', old.status, new.status);
    end if;
  end if;

  return new;
end $$;

-- 4.3 Exclusão: só rascunho
create or replace function private.reports_before_delete()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status <> 'draft' then
    raise exception 'ONLY_DRAFT_CAN_BE_DELETED';
  end if;
  return old;
end $$;

create trigger reports_bi before insert on public.reports
  for each row execute function private.reports_before_insert();
create trigger reports_bu before update on public.reports
  for each row execute function private.reports_before_update();
create trigger reports_bd before delete on public.reports
  for each row execute function private.reports_before_delete();

-- 4.4 Nova revisão a partir de um laudo emitido (roda com as permissões de quem chama)
create or replace function public.create_report_revision(p_report_id uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_src public.reports%rowtype;
  v_new uuid := gen_random_uuid();
begin
  select * into v_src from public.reports where id = p_report_id;
  if not found then
    raise exception 'REPORT_NOT_FOUND';
  end if;
  if v_src.status <> 'issued' then
    raise exception 'ONLY_ISSUED_CAN_BE_REVISED';
  end if;

  insert into public.reports
    (id, tenant_id, work_order_id, template_id, document_id, revision, inspector_id,
     equipment_tag, inspection_date, inspection_site, qualification_id,
     technical_data, croqui, administrative_data)
  values
    (v_new, v_src.tenant_id, v_src.work_order_id, v_src.template_id, v_src.document_id,
     v_src.revision + 1, auth.uid(),
     v_src.equipment_tag, v_src.inspection_date, v_src.inspection_site, v_src.qualification_id,
     v_src.technical_data, v_src.croqui, v_src.administrative_data);

  insert into public.report_instruments (report_id, instrument_id, tenant_id)
    select v_new, ri.instrument_id, ri.tenant_id
      from public.report_instruments ri where ri.report_id = p_report_id;

  insert into public.report_attachments (tenant_id, report_id, kind, storage_path, sha256, caption, taken_at)
    select a.tenant_id, v_new, a.kind, a.storage_path, a.sha256, a.caption, a.taken_at
      from public.report_attachments a where a.report_id = p_report_id;

  return v_new;
end $$;

-- ---------------------------------------------------------------------
-- 5. PERFIS E AUDITORIA
-- ---------------------------------------------------------------------
create or replace function private.profiles_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id
     or new.tenant_id is distinct from old.tenant_id
     or new.created_at is distinct from old.created_at then
    raise exception 'FIELD_IMMUTABLE';
  end if;

  if current_user = 'authenticated'
     and (new.role is distinct from old.role
          or new.can_inspect is distinct from old.can_inspect
          or new.active is distinct from old.active) then
    if (select private.my_role()) is distinct from 'admin'::public.app_role
       or old.id = auth.uid() then
      raise exception 'ONLY_ADMIN_CAN_CHANGE_ROLES'
        using hint = 'Papéis só são alterados por um admin, e nunca no próprio usuário.';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_bu before update on public.profiles
  for each row execute function private.profiles_guard();
create trigger clients_touch before update on public.clients
  for each row execute function private.touch_updated_at();

-- Auditoria genérica (tabelas pequenas: guarda linha antiga e nova)
create or replace function private.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new); end if;
  v_row := coalesce(v_new, v_old);

  insert into public.audit_log (tenant_id, actor_id, actor_role, action, entity, entity_id, details)
  values (
    coalesce((v_row ->> 'tenant_id')::uuid,
             case when tg_table_name = 'tenants' then (v_row ->> 'id')::uuid end),
    auth.uid(),
    private.my_role()::text,
    lower(tg_op),
    tg_table_name,
    (v_row ->> 'id')::uuid,
    jsonb_strip_nulls(jsonb_build_object('old', v_old, 'new', v_new))
  );
  return null;
end $$;

create trigger tenants_audit          after insert or update or delete on public.tenants          for each row execute function private.audit_row();
create trigger profiles_audit         after insert or update or delete on public.profiles         for each row execute function private.audit_row();
create trigger clients_audit          after insert or update or delete on public.clients          for each row execute function private.audit_row();
create trigger qualifications_audit   after insert or update or delete on public.qualifications   for each row execute function private.audit_row();
create trigger instruments_audit      after insert or update or delete on public.instruments      for each row execute function private.audit_row();
create trigger work_orders_audit      after insert or update or delete on public.work_orders      for each row execute function private.audit_row();
create trigger sites_audit            after insert or update or delete on public.sites              for each row execute function private.audit_row();
create trigger report_templates_audit after insert or update or delete on public.report_templates for each row execute function private.audit_row();

-- Auditoria do laudo (não guarda o conteúdo inteiro: eventos, colunas alteradas e hashes)
create or replace function private.audit_report()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_action  text;
  v_details jsonb;
  v_changed jsonb;
begin
  if tg_op = 'INSERT' then
    v_action  := 'report_created';
    v_details := jsonb_build_object('document_id', new.document_id, 'revision', new.revision);

  elsif new.status is distinct from old.status then
    v_action  := 'report_' || new.status::text;
    v_details := jsonb_build_object(
      'from', old.status, 'to', new.status,
      'revision', new.revision, 'data_hash', new.data_hash);

  elsif new.status in ('draft', 'returned') then
    return null;   -- autosave de rascunho não polui a trilha

  else
    v_action := 'report_edited';
    select coalesce(jsonb_agg(n.key), '[]'::jsonb) into v_changed
      from jsonb_each(to_jsonb(new)) as n(key, value)
      join jsonb_each(to_jsonb(old)) as o(key, value) on o.key = n.key
     where n.value is distinct from o.value
       and n.key <> 'updated_at';
    v_details := jsonb_build_object('changed_columns', v_changed);
    if new.administrative_data is distinct from old.administrative_data then
      v_details := v_details || jsonb_build_object(
        'administrative_before', old.administrative_data,
        'administrative_after',  new.administrative_data);
    end if;
  end if;

  insert into public.audit_log (tenant_id, actor_id, actor_role, action, entity, entity_id, details)
  values (new.tenant_id, auth.uid(), private.my_role()::text, v_action, 'reports', new.id, v_details);
  return null;
end $$;

create trigger reports_audit after insert or update on public.reports
  for each row execute function private.audit_report();

-- audit_log: somente inserção
create or replace function private.audit_log_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'AUDIT_LOG_IS_APPEND_ONLY';
end $$;

create trigger audit_log_no_change before update or delete on public.audit_log
  for each row execute function private.audit_log_immutable();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function private.audit_log_immutable();

-- ---------------------------------------------------------------------
-- 6. RLS: ligado em tudo. Sem política = sem acesso.
-- ---------------------------------------------------------------------
alter table public.tenants            enable row level security;
alter table public.profiles           enable row level security;
alter table public.clients            enable row level security;
alter table public.qualifications     enable row level security;
alter table public.instruments        enable row level security;
alter table public.report_templates   enable row level security;
alter table public.work_orders        enable row level security;
alter table public.sites              enable row level security;
alter table public.reports            enable row level security;
alter table public.report_instruments enable row level security;
alter table public.report_attachments enable row level security;
alter table public.report_comments    enable row level security;
alter table public.audit_log          enable row level security;

-- tenants
create policy tenants_select on public.tenants for select to authenticated
  using (id = (select private.my_tenant_id()));
create policy tenants_update on public.tenants for update to authenticated
  using (id = (select private.my_tenant_id()) and (select private.my_role()) = 'admin')
  with check (id = (select private.my_tenant_id()));

-- profiles (criação de usuários é feita no servidor, com service_role)
create policy profiles_select on public.profiles for select to authenticated
  using (tenant_id = (select private.my_tenant_id()));
create policy profiles_update on public.profiles for update to authenticated
  using (tenant_id = (select private.my_tenant_id())
         and (id = (select auth.uid()) or (select private.my_role()) = 'admin'))
  with check (tenant_id = (select private.my_tenant_id()));

-- clients (sem delete: desative)
create policy clients_select on public.clients for select to authenticated
  using (tenant_id = (select private.my_tenant_id()));
create policy clients_insert on public.clients for insert to authenticated
  with check (
    tenant_id = (select private.my_tenant_id())
    and (
      (select private.is_reviewer())
      or (
        (select private.can_inspect())
        and (select (t.allow_field_creation) from public.tenants t where t.id = (select private.my_tenant_id()))
      )
    )
  );
create policy clients_update on public.clients for update to authenticated
  using (
    tenant_id = (select private.my_tenant_id())
    and (
      (select private.is_reviewer())
      or (
        created_by = (select auth.uid())
        and needs_review = true
      )
    )
  )
  with check (tenant_id = (select private.my_tenant_id()));

-- qualifications
create policy qualifications_select on public.qualifications for select to authenticated
  using (tenant_id = (select private.my_tenant_id())
         and (user_id = (select auth.uid()) or (select private.is_reviewer())));
create policy qualifications_insert on public.qualifications for insert to authenticated
  with check (tenant_id = (select private.my_tenant_id()) and (select private.is_reviewer()));
create policy qualifications_update on public.qualifications for update to authenticated
  using (tenant_id = (select private.my_tenant_id()) and (select private.is_reviewer()))
  with check (tenant_id = (select private.my_tenant_id()));
create policy qualifications_delete on public.qualifications for delete to authenticated
  using (tenant_id = (select private.my_tenant_id()) and (select private.is_reviewer()));

-- instruments
create policy instruments_select on public.instruments for select to authenticated
  using (tenant_id = (select private.my_tenant_id()));
create policy instruments_insert on public.instruments for insert to authenticated
  with check (tenant_id = (select private.my_tenant_id()) and (select private.is_reviewer()));
create policy instruments_update on public.instruments for update to authenticated
  using (tenant_id = (select private.my_tenant_id()) and (select private.is_reviewer()))
  with check (tenant_id = (select private.my_tenant_id()));

-- report_templates
create policy templates_select on public.report_templates for select to authenticated
  using (tenant_id is null or tenant_id = (select private.my_tenant_id()));
create policy templates_insert on public.report_templates for insert to authenticated
  with check (tenant_id = (select private.my_tenant_id())
              and (select private.my_role()) = 'admin' and not published);
create policy templates_update on public.report_templates for update to authenticated
  using (tenant_id = (select private.my_tenant_id())
         and (select private.my_role()) = 'admin' and not published)
  with check (tenant_id = (select private.my_tenant_id()));
create policy templates_delete on public.report_templates for delete to authenticated
  using (tenant_id = (select private.my_tenant_id())
         and (select private.my_role()) = 'admin' and not published);

-- work_orders
create policy work_orders_select on public.work_orders for select to authenticated
  using (tenant_id = (select private.my_tenant_id())
         and ((select private.is_reviewer()) or assigned_to = (select auth.uid()) or assigned_to is null));
create policy work_orders_insert on public.work_orders for insert to authenticated
  with check (
    tenant_id = (select private.my_tenant_id())
    and (
      (select private.is_reviewer())
      or (
        (select private.can_inspect())
        and (select (t.allow_field_creation) from public.tenants t where t.id = (select private.my_tenant_id()))
      )
    )
  );
create policy work_orders_update on public.work_orders for update to authenticated
  using (
    tenant_id = (select private.my_tenant_id())
    and (
      (select private.is_reviewer())
      or (
        created_by = (select auth.uid())
        and needs_review = true
      )
    )
  )
  with check (tenant_id = (select private.my_tenant_id()));

-- sites (obras)
create policy sites_select on public.sites for select to authenticated
  using (tenant_id = (select private.my_tenant_id())
         and ((select private.is_reviewer()) or situation = 'active'));
create policy sites_insert on public.sites for insert to authenticated
  with check (
    tenant_id = (select private.my_tenant_id())
    and (
      (select private.is_reviewer())
      or (
        (select private.can_inspect())
        and (select (t.allow_field_creation) from public.tenants t where t.id = (select private.my_tenant_id()))
      )
    )
  );
create policy sites_update on public.sites for update to authenticated
  using (
    tenant_id = (select private.my_tenant_id())
    and (
      (select private.is_reviewer())
      or (
        created_by = (select auth.uid())
        and needs_review = true
      )
    )
  )
  with check (tenant_id = (select private.my_tenant_id()));

-- reports
create policy reports_select on public.reports for select to authenticated
  using (tenant_id = (select private.my_tenant_id())
         and (inspector_id = (select auth.uid()) or (select private.is_reviewer())));
create policy reports_insert on public.reports for insert to authenticated
  with check (
    tenant_id = (select private.my_tenant_id())
    and inspector_id = (select auth.uid())
    and (select private.can_inspect())
    and status = 'draft'
    and exists (select 1 from public.work_orders w
                 where w.id = work_order_id and (w.assigned_to = (select auth.uid()) or w.assigned_to is null))
  );
create policy reports_update on public.reports for update to authenticated
  using (tenant_id = (select private.my_tenant_id())
         and (inspector_id = (select auth.uid()) or (select private.is_reviewer())))
  with check (tenant_id = (select private.my_tenant_id()));
create policy reports_delete on public.reports for delete to authenticated
  using (tenant_id = (select private.my_tenant_id())
         and inspector_id = (select auth.uid()) and status = 'draft');

-- report_instruments
create policy report_instruments_select on public.report_instruments for select to authenticated
  using (tenant_id = (select private.my_tenant_id())
         and exists (select 1 from public.reports r where r.id = report_id));
create policy report_instruments_insert on public.report_instruments for insert to authenticated
  with check (tenant_id = (select private.my_tenant_id())
              and exists (select 1 from public.reports r
                           where r.id = report_id and r.inspector_id = (select auth.uid())
                             and r.status in ('draft', 'returned')));
create policy report_instruments_delete on public.report_instruments for delete to authenticated
  using (tenant_id = (select private.my_tenant_id())
         and exists (select 1 from public.reports r
                      where r.id = report_id and r.inspector_id = (select auth.uid())
                        and r.status in ('draft', 'returned')));

-- report_attachments
create policy report_attachments_select on public.report_attachments for select to authenticated
  using (tenant_id = (select private.my_tenant_id())
         and exists (select 1 from public.reports r where r.id = report_id));
create policy report_attachments_insert on public.report_attachments for insert to authenticated
  with check (tenant_id = (select private.my_tenant_id())
              and created_by = (select auth.uid())
              and exists (select 1 from public.reports r
                           where r.id = report_id and r.inspector_id = (select auth.uid())
                             and r.status in ('draft', 'returned')));
create policy report_attachments_delete on public.report_attachments for delete to authenticated
  using (tenant_id = (select private.my_tenant_id())
         and exists (select 1 from public.reports r
                      where r.id = report_id and r.inspector_id = (select auth.uid())
                        and r.status in ('draft', 'returned')));

-- report_comments
create policy report_comments_select on public.report_comments for select to authenticated
  using (tenant_id = (select private.my_tenant_id())
         and exists (select 1 from public.reports r where r.id = report_id));
create policy report_comments_insert on public.report_comments for insert to authenticated
  with check (tenant_id = (select private.my_tenant_id())
              and author_id = (select auth.uid())
              and exists (select 1 from public.reports r
                           where r.id = report_id
                             and r.status in ('submitted', 'returned', 'approved')));

-- audit_log
create policy audit_log_select on public.audit_log for select to authenticated
  using (tenant_id = (select private.my_tenant_id()) and (select private.is_reviewer()));

-- ---------------------------------------------------------------------
-- 7. PRIVILÉGIOS
-- ---------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

revoke all on public.tenants from authenticated;
grant select on public.tenants to authenticated;
grant update (legal_name, trade_name, cnpj, require_second_reviewer, allow_field_creation,
  address_street, address_number, address_complement, address_neighborhood,
  address_city, address_uf, address_cep, phone, email,
  responsible_name, responsible_register, logo_path, logo_sha256, report_prefix)
  on public.tenants to authenticated;

revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, role, can_inspect, active) on public.profiles to authenticated;

revoke all on public.audit_log from authenticated;
grant select on public.audit_log to authenticated;

revoke execute on all functions in schema private from public;
grant execute on all functions in schema private to authenticated, service_role;

revoke all on function public.create_report_revision(uuid) from public, anon;
grant execute on function public.create_report_revision(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 8. STORAGE
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-files', 'report-files', false, 15728640,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tenant-assets', 'tenant-assets', false, 1048576,
        array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- tenant-assets: caminho {tenant_id}/logo/{sha256}.{ext}
-- leitura: membros do tenant
-- escrita: só admin do próprio tenant
-- nunca sobrescrever: cada logo nova é um arquivo novo, com o hash no nome
create policy tenant_assets_select on storage.objects for select to authenticated
  using (
    bucket_id = 'tenant-assets'
    and (storage.foldername(name))[1] = ((select private.my_tenant_id())::text)
  );

create policy tenant_assets_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'tenant-assets'
    and (storage.foldername(name))[1] = ((select private.my_tenant_id())::text)
    and (select private.my_role()) = 'admin'
  );

create policy tenant_assets_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'tenant-assets'
    and (storage.foldername(name))[1] = ((select private.my_tenant_id())::text)
    and (select private.my_role()) = 'admin'
  );

create policy report_files_select on storage.objects for select to authenticated
  using (
    bucket_id = 'report-files'
    and (storage.foldername(name))[1] = ((select private.my_tenant_id())::text)
    and exists (select 1 from public.reports r where r.id::text = (storage.foldername(name))[2])
  );

create policy report_files_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'report-files'
    and (storage.foldername(name))[1] = ((select private.my_tenant_id())::text)
    and exists (select 1 from public.reports r
                 where r.id::text = (storage.foldername(name))[2]
                   and r.inspector_id = (select auth.uid())
                   and r.status in ('draft', 'returned'))
  );

create policy report_files_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'report-files'
    and (storage.foldername(name))[1] = ((select private.my_tenant_id())::text)
    and exists (select 1 from public.reports r
                 where r.id::text = (storage.foldername(name))[2]
                   and r.inspector_id = (select auth.uid())
                   and r.status in ('draft', 'returned'))
  );


-- ===== 0002_obra_escopo.sql =====
-- =====================================================================
-- Axos Relatórios | migração 0002: módulo de Obras / Escopo / Avanço
-- Alvo: Supabase (PostgreSQL 15+)
-- STATUS: escrita, mas NÃO executada.
--
-- Módulo exclusivo do plano Empresas. Permite à empresa informar a
-- quantidade de serviço contratada por obra e acompanhar o andamento
-- medido pelos laudos emitidos.
--
-- Decisões de desenho:
--  1. Multi-tenant por tenant_id em toda tabela, RLS ligado e negado por padrão.
--  2. Laudo emitido continua imutável: o vínculo laudo<>escopo grava em
--     tabela separada, nunca alterando reports.
--  3. Todo aditivo/supressão de escopo gera registro em obra_escopo_revisao
--     (histórico append-only). Nunca editar a linha sem gravar o histórico.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ESCOPO DA OBRA (linhas de serviço contratado por obra)
-- ---------------------------------------------------------------------
create table public.obra_escopo_linha (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete restrict,
  site_id         uuid not null references public.sites (id) on delete restrict,
  method          public.end_method not null,              -- um dos 16 métodos END
  unidade         text not null check (unidade in ('junta','ponto_medicao','peca','metro_linear','m2','filme','equipamento')),
  quantidade_prevista numeric not null check (quantidade_prevista > 0),
  referencia_tag   text,                                     -- área ou TAG de referência (opcional)
  ativo            boolean not null default true,
  created_by       uuid not null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (site_id, tenant_id) references public.sites (id, tenant_id)
);
create index on public.obra_escopo_linha (tenant_id);
create index on public.obra_escopo_linha (site_id);
create index on public.obra_escopo_linha (site_id, method);

comment on table public.obra_escopo_linha is 'Escopo de serviço contratado por obra (linha de escopo).';
comment on column public.obra_escopo_linha.method is 'Método END (um dos 16).';
comment on column public.obra_escopo_linha.unidade is 'Unidade de medida: junta, ponto_medicao, peca, metro_linear, m2, filme, equipamento.';
comment on column public.obra_escopo_linha.quantidade_prevista is 'Quantidade contratada/prevista para a linha.';
comment on column public.obra_escopo_linha.referencia_tag is 'Área ou TAG de referência (opcional).';

-- ---------------------------------------------------------------------
-- 2. HISTÓRICO DE ESCOPO (aditivos / supressões)
-- Todo aditivo ou supressão gera um registro. Nunca editar a linha sem gravar histórico.
-- ---------------------------------------------------------------------
create table public.obra_escopo_revisao (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete restrict,
  linha_id        uuid not null references public.obra_escopo_linha (id) on delete restrict,
  quantidade_anterior numeric,
  quantidade_nova   numeric not null check (quantidade_nova > 0),
  motivo            text not null,                          -- motivo obrigatório do aditivo/supressão
  created_by       uuid not null default auth.uid(),
  created_at       timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (linha_id, tenant_id) references public.obra_escopo_linha (id, tenant_id)
);
create index on public.obra_escopo_revisao (tenant_id);
create index on public.obra_escopo_revisao (linha_id);

comment on table public.obra_escopo_revisao is 'Histórico de aditivos e supressões de escopo de obra.';
comment on column public.obra_escopo_revisao.quantidade_anterior is 'Quantidade antes da mudança (null em criação inicial).';
comment on column public.obra_escopo_revisao.quantidade_nova is 'Quantidade após a mudança.';
comment on column public.obra_escopo_revisao.motivo is 'Motivo do aditivo ou supressão (obrigatório).';

-- ---------------------------------------------------------------------
-- 3. VÍNCULO LAUDO <> ESCOPO (tabela separada, não altera reports)
-- Permite vincular laudos já emitidos depois, sem tocar no laudo.
-- ---------------------------------------------------------------------
create table public.laudo_escopo_vinculo (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants (id) on delete restrict,
  laudo_id         uuid not null references public.reports (id) on delete restrict,
  linha_id         uuid not null references public.obra_escopo_linha (id) on delete restrict,
  quantidade_inspecionada numeric not null check (quantidade_inspecionada >= 0),
  quantidade_aprovada  numeric not null check (quantidade_aprovada >= 0),
  quantidade_reprovada numeric not null check (quantidade_reprovada >= 0),
  laudo_origem_id   uuid references public.reports (id) on delete restrict, -- reinspeção de itens reprovados antes
  created_by        uuid not null default auth.uid(),
  created_at        timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (laudo_id, tenant_id) references public.reports (id, tenant_id),
  foreign key (linha_id, tenant_id) references public.obra_escopo_linha (id, tenant_id),
  foreign key (laudo_origem_id, tenant_id) references public.reports (id, tenant_id),
  check (quantidade_aprovada + quantidade_reprovada = quantidade_inspecionada)
);
create index on public.laudo_escopo_vinculo (tenant_id);
create index on public.laudo_escopo_vinculo (laudo_id);
create index on public.laudo_escopo_vinculo (linha_id);

comment on table public.laudo_escopo_vinculo is 'Vínculo entre laudo e linha de escopo (tabela separada, não altera reports).';
comment on column public.laudo_escopo_vinculo.quantidade_inspecionada is 'Quantidade inspecionada (aprovada + reprovada).';
comment on column public.laudo_escopo_vinculo.quantidade_aprovada is 'Quantidade aprovada.';
comment on column public.laudo_escopo_vinculo.quantidade_reprovada is 'Quantidade reprovada.';
comment on column public.laudo_escopo_vinculo.laudo_origem_id is 'Laudo de origem (reinspeção de itens reprovados antes).';

-- ---------------------------------------------------------------------
-- 3.1 RLS e políticas de acesso (por tenant)
-- ---------------------------------------------------------------------
alter table public.obra_escopo_linha enable row level security;
alter table public.obra_escopo_revisao enable row level security;
alter table public.laudo_escopo_vinculo enable row level security;

create policy obra_escopo_linha_select on public.obra_escopo_linha for select to authenticated
  using (tenant_id = (select private.my_tenant_id()));
create policy obra_escopo_linha_insert on public.obra_escopo_linha for insert to authenticated
  with check (tenant_id = (select private.my_tenant_id()) and (select private.is_reviewer()));
create policy obra_escopo_linha_update on public.obra_escopo_linha for update to authenticated
  using (tenant_id = (select private.my_tenant_id()) and (select private.is_reviewer()))
  with check (tenant_id = (select private.my_tenant_id()) and (select private.is_reviewer()));
create policy obra_escopo_linha_delete on public.obra_escopo_linha for delete to authenticated
  using (tenant_id = (select private.my_tenant_id()) and (select private.is_reviewer()));

create policy obra_escopo_revisao_select on public.obra_escopo_revisao for select to authenticated
  using (tenant_id = (select private.my_tenant_id()));
create policy obra_escopo_revisao_insert on public.obra_escopo_revisao for insert to authenticated
  with check (tenant_id = (select private.my_tenant_id()) and (select private.is_reviewer()));
-- histórico é append-only: não permite update/delete
create or replace function private.obra_escopo_revisao_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'OBRA_ESCOPO_REVISAO_IS_APPEND_ONLY';
end $$;
create trigger obra_escopo_revisao_no_update before update on public.obra_escopo_revisao
  for each row execute function private.obra_escopo_revisao_immutable();
create trigger obra_escopo_revisao_no_delete before delete on public.obra_escopo_revisao
  for each row execute function private.obra_escopo_revisao_immutable();

create policy laudo_escopo_vinculo_select on public.laudo_escopo_vinculo for select to authenticated
  using (tenant_id = (select private.my_tenant_id()));
create policy laudo_escopo_vinculo_insert on public.laudo_escopo_vinculo for insert to authenticated
  with check (tenant_id = (select private.my_tenant_id()));
create policy laudo_escopo_vinculo_update on public.laudo_escopo_vinculo for update to authenticated
  using (tenant_id = (select private.my_tenant_id()))
  with check (tenant_id = (select private.my_tenant_id()));
create policy laudo_escopo_vinculo_delete on public.laudo_escopo_vinculo for delete to authenticated
  using (tenant_id = (select private.my_tenant_id()));

-- ---------------------------------------------------------------------
-- 4. AUDITORIA (append-only, como nas demais tabelas)
-- ---------------------------------------------------------------------
create trigger obra_escopo_linha_audit after insert or update or delete on public.obra_escopo_linha
  for each row execute function private.audit_row();
create trigger obra_escopo_revisao_audit after insert on public.obra_escopo_revisao
  for each row execute function private.audit_row();
create trigger laudo_escopo_vinculo_audit after insert or update or delete on public.laudo_escopo_vinculo
  for each row execute function private.audit_row();


-- ===== 0003_obra_ocultar_producao.sql =====
-- =====================================================================
-- Axos Relatórios | migração 0003: ocultar produção de colegas
-- Alvo: Supabase (PostgreSQL 15+)
-- STATUS: escrita, mas NÃO executada.
--
-- Adiciona coluna ocultar_producao_colegas na tabela tenants.
-- Quando true, o inspetor não vê a produção de colegas, apenas a própria.
-- Quando false (padrão), todos veem a produção de todos.
--
-- Proteção da coluna: a política tenants_update (0001) já exige o papel
-- admin para atualizar a linha; aqui a coluna entra na lista de colunas
-- que o papel authenticated pode gravar — combinando as duas regras,
-- só o administrador altera a coluna.
-- =====================================================================

-- Coluna de ocultação de produção por colega
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS ocultar_producao_colegas boolean NOT NULL DEFAULT false;

-- Comentário na coluna
COMMENT ON COLUMN public.tenants.ocultar_producao_colegas IS
  'Quando true, o inspetor não vê a produção de colegas, apenas a própria. Default: false (visível para todos).';

-- Libera a gravação da coluna para authenticated (a política tenants_update
-- da migração 0001 já limita a atualização da linha ao papel admin).
GRANT UPDATE (ocultar_producao_colegas) ON public.tenants TO authenticated;


-- ===== 0004_modelos_metodos.sql =====
-- =====================================================================
-- Axos Relatórios | migração 0004: modelos globais dos 16 métodos END
-- Alvo: Supabase (PostgreSQL 15+)
-- STATUS: escrita, mas NÃO executada.
--
-- Todo laudo exige um modelo publicado do método (reports.template_id).
-- tenant_id nulo = modelo global. Os campos de cada método entram em
-- "definition" quando os formulários forem refinados.
-- =====================================================================
insert into public.report_templates (tenant_id, method, name, version, definition, published)
select null, m::public.end_method, 'Modelo padrão ' || m, 1, '{"campos": []}'::jsonb, true
  from unnest(enum_range(null::public.end_method)::text[]) as m
on conflict do nothing;


-- ===== 0005_cadastro_empresa.sql =====
-- =====================================================================
-- Axos Relatórios | migração 0005: cadastro da própria empresa
--
-- Quem cria a conta pela tela de cadastro confirma o e-mail e, no primeiro
-- acesso, recebe uma empresa nova em teste, como administrador. Tabelas
-- tenants e profiles seguem sem insert direto: só esta função cria os dois.
-- =====================================================================

create or replace function public.criar_empresa_inicial(
  p_empresa text,
  p_nome text,
  p_cnpj text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_empresa text := nullif(btrim(p_empresa), '');
  v_nome text := nullif(btrim(p_nome), '');
  v_cnpj text := nullif(regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g'), '');
  v_tenant uuid;
begin
  if v_usuario is null then
    raise exception 'Entre na sua conta para concluir o cadastro.';
  end if;

  select tenant_id into v_tenant from public.profiles where id = v_usuario;
  if found then
    return v_tenant;
  end if;

  if v_empresa is null or v_nome is null then
    raise exception 'Informe o nome da empresa e o seu nome.';
  end if;

  if v_cnpj is not null and length(v_cnpj) <> 14 then
    raise exception 'CNPJ inválido.';
  end if;

  if v_cnpj is not null and exists (select 1 from public.tenants where cnpj = v_cnpj) then
    raise exception 'Este CNPJ já está cadastrado. Fale com o administrador da sua empresa.';
  end if;

  insert into public.tenants (legal_name, trade_name, cnpj, plan)
  values (v_empresa, v_empresa, v_cnpj, 'trial')
  returning id into v_tenant;

  insert into public.profiles (id, tenant_id, role, can_inspect, full_name)
  values (v_usuario, v_tenant, 'admin', true, v_nome);

  return v_tenant;
end;
$$;

revoke all on function public.criar_empresa_inicial(text, text, text) from public, anon;
grant execute on function public.criar_empresa_inicial(text, text, text) to authenticated;


-- ===== 0006_lgpd_e_reforcos.sql =====
-- =====================================================================
-- Axos Relatórios | migração 0006: LGPD e reforços de segurança
--
-- 1. Fecha a numeração de laudos para quem não está logado
-- 2. Índices nas chaves estrangeiras que ainda não tinham
-- 3. Registro dos aceites de Termos e Política
-- 4. Pedidos de titulares de dados (art. 18 da LGPD)
-- 5. Anonimização de usuário desligado
-- =====================================================================

-- 1. A função já recusa quem não é revisor, mas não precisa ficar exposta
revoke all on function public.next_report_number(uuid, text, int) from public, anon;
grant execute on function public.next_report_number(uuid, text, int) to authenticated, service_role;

-- 2. Índices de chaves estrangeiras
create index if not exists laudo_escopo_vinculo_laudo_origem_idx on public.laudo_escopo_vinculo (laudo_origem_id);
create index if not exists qualifications_user_idx on public.qualifications (user_id);
create index if not exists report_comments_author_idx on public.report_comments (author_id);
create index if not exists report_instruments_instrument_idx on public.report_instruments (instrument_id);
create index if not exists reports_approved_by_idx on public.reports (approved_by);
create index if not exists reports_issued_by_idx on public.reports (issued_by);
create index if not exists reports_qualification_idx on public.reports (qualification_id);
create index if not exists reports_template_idx on public.reports (template_id);
create index if not exists work_orders_assigned_to_idx on public.work_orders (assigned_to);

-- 3. Aceites: prova de quem aceitou qual versão e quando. Sem update nem delete.
create table public.lgpd_aceites (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants (id) on delete restrict,
  user_id    uuid not null,
  documento  text not null check (documento in ('termos_de_uso', 'politica_de_privacidade')),
  versao     text not null check (length(versao) between 1 and 40),
  aceito_em  timestamptz not null default now(),
  unique (user_id, documento, versao),
  foreign key (user_id, tenant_id) references public.profiles (id, tenant_id) on delete restrict
);
create index lgpd_aceites_tenant_idx on public.lgpd_aceites (tenant_id, aceito_em desc);
create index lgpd_aceites_usuario_idx on public.lgpd_aceites (user_id, tenant_id);
comment on table public.lgpd_aceites is 'LGPD: registro de aceite de Termos e Política';

alter table public.lgpd_aceites enable row level security;
create policy lgpd_aceites_select on public.lgpd_aceites for select to authenticated
  using (tenant_id = (select private.my_tenant_id())
         and (user_id = (select auth.uid()) or (select private.my_role()) = 'admin'));
revoke all on public.lgpd_aceites from anon, authenticated;
grant select on public.lgpd_aceites to authenticated;

create or replace function public.registrar_aceites(p_versao text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_tenant uuid := private.my_tenant_id();
begin
  if v_usuario is null or v_tenant is null then
    raise exception 'Entre na sua conta para registrar o aceite.';
  end if;
  insert into public.lgpd_aceites (tenant_id, user_id, documento, versao)
  values (v_tenant, v_usuario, 'termos_de_uso', p_versao),
         (v_tenant, v_usuario, 'politica_de_privacidade', p_versao)
  on conflict (user_id, documento, versao) do nothing;
end;
$$;
revoke all on function public.registrar_aceites(text) from public, anon;
grant execute on function public.registrar_aceites(text) to authenticated;

-- 4. Pedidos de titulares. O prazo padrão de 15 dias segue o art. 19, II da LGPD.
create table public.lgpd_solicitacoes (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete restrict,
  titular_nome  text not null,
  titular_email text not null,
  tipo          text not null check (tipo in ('confirmacao', 'acesso', 'correcao', 'anonimizacao', 'eliminacao', 'portabilidade', 'compartilhamento', 'revogacao', 'oposicao')),
  detalhes      text,
  situacao      text not null default 'aberta' check (situacao in ('aberta', 'em_andamento', 'concluida', 'recusada')),
  resposta      text,
  recebida_em   timestamptz not null default now(),
  prazo_em      timestamptz not null default (now() + interval '15 days'),
  concluida_em  timestamptz,
  criada_por    uuid default auth.uid(),
  check ((situacao in ('concluida', 'recusada')) = (concluida_em is not null))
);
create index lgpd_solicitacoes_tenant_idx on public.lgpd_solicitacoes (tenant_id, situacao, prazo_em);
comment on table public.lgpd_solicitacoes is 'LGPD: contém dados pessoais do titular que fez o pedido';

alter table public.lgpd_solicitacoes enable row level security;
create policy lgpd_solicitacoes_select on public.lgpd_solicitacoes for select to authenticated
  using (tenant_id = (select private.my_tenant_id()) and (select private.my_role()) = 'admin');
create policy lgpd_solicitacoes_insert on public.lgpd_solicitacoes for insert to authenticated
  with check (tenant_id = (select private.my_tenant_id()) and (select private.my_role()) = 'admin');
create policy lgpd_solicitacoes_update on public.lgpd_solicitacoes for update to authenticated
  using (tenant_id = (select private.my_tenant_id()) and (select private.my_role()) = 'admin')
  with check (tenant_id = (select private.my_tenant_id()) and (select private.my_role()) = 'admin');
revoke all on public.lgpd_solicitacoes from anon, authenticated;
grant select, insert, update on public.lgpd_solicitacoes to authenticated;

-- 5. Anonimização: tira o nome e o acesso, e preserva laudos e auditoria já registrados
create or replace function public.anonimizar_usuario(p_usuario uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.my_role() is distinct from 'admin'::public.app_role then
    raise exception 'FORBIDDEN';
  end if;
  if p_usuario = auth.uid() then
    raise exception 'Você não pode anonimizar a própria conta.';
  end if;
  update public.profiles
     set full_name = 'Usuário anonimizado', active = false, can_inspect = false
   where id = p_usuario and tenant_id = private.my_tenant_id();
  if not found then
    raise exception 'Usuário não encontrado na sua empresa.';
  end if;
end;
$$;
revoke all on function public.anonimizar_usuario(uuid) from public, anon;
grant execute on function public.anonimizar_usuario(uuid) to authenticated;

comment on column public.profiles.full_name is 'LGPD: dado pessoal';
comment on column public.qualifications.cert_number is 'LGPD: dado pessoal, necessário como evidência do laudo';
comment on column public.tenants.responsible_name is 'LGPD: dado pessoal';
comment on column public.tenants.responsible_register is 'LGPD: dado pessoal';


-- ===== 0007_teste_e_contratacao.sql =====
-- =====================================================================
-- Axos Relatórios | migração 0007: teste de 30 dias e pedido de contratação
--
-- Toda empresa nova começa em teste por 30 dias. Terminado o prazo, os dados
-- continuam disponíveis, mas não entra laudo novo até contratar um plano.
-- O plano é liberado pela AXOS: o usuário não altera plano nem prazo.
-- =====================================================================

alter table public.tenants
  add column trial_ends_at timestamptz default (now() + interval '30 days');
comment on column public.tenants.trial_ends_at is 'Fim do teste grátis. Nulo em plano contratado.';

alter table public.tenants drop constraint tenants_plan_check;
alter table public.tenants add constraint tenants_plan_check
  check (plan in ('trial', 'starter', 'pro', 'enterprise', 'individual', 'equipe_3', 'equipe_5', 'equipe_10', 'sob_consulta'));

-- Pedidos de contratação: gravados só pela função abaixo
create table public.pedidos_contratacao (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants (id) on delete restrict,
  plano         text not null check (plano in ('individual', 'equipe_3', 'equipe_5', 'equipe_10', 'sob_consulta')),
  razao_social  text not null,
  documento     text not null check (length(documento) in (11, 14)),
  responsavel   text not null,
  telefone      text,
  email         text,
  endereco      text,
  situacao      text not null default 'recebido' check (situacao in ('recebido', 'em_andamento', 'concluido', 'cancelado')),
  criado_por    uuid not null default auth.uid(),
  criado_em     timestamptz not null default now()
);
create index pedidos_contratacao_tenant_idx on public.pedidos_contratacao (tenant_id, criado_em desc);
comment on table public.pedidos_contratacao is 'LGPD: contém dados pessoais do responsável e, no plano individual, CPF';

alter table public.pedidos_contratacao enable row level security;
create policy pedidos_contratacao_select on public.pedidos_contratacao for select to authenticated
  using (tenant_id = (select private.my_tenant_id()) and (select private.my_role()) = 'admin');
revoke all on public.pedidos_contratacao from anon, authenticated;
grant select on public.pedidos_contratacao to authenticated;

create or replace function public.solicitar_contratacao(
  p_plano text,
  p_razao_social text,
  p_documento text,
  p_responsavel text,
  p_telefone text default null,
  p_email text default null,
  p_endereco text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := private.my_tenant_id();
  v_razao text := nullif(btrim(p_razao_social), '');
  v_responsavel text := nullif(btrim(p_responsavel), '');
  v_documento text := regexp_replace(coalesce(p_documento, ''), '\D', '', 'g');
  v_pedido uuid;
begin
  if v_tenant is null or private.my_role() is distinct from 'admin'::public.app_role then
    raise exception 'Só o administrador da conta pode contratar um plano.';
  end if;
  if p_plano not in ('individual', 'equipe_3', 'equipe_5', 'equipe_10', 'sob_consulta') then
    raise exception 'Escolha um plano.';
  end if;
  if v_razao is null or v_responsavel is null then
    raise exception 'Informe o nome da empresa e o responsável.';
  end if;
  if length(v_documento) not in (11, 14) then
    raise exception 'Informe um CPF ou CNPJ válido.';
  end if;
  if length(v_documento) = 11 and p_plano <> 'individual' then
    raise exception 'Para este plano, informe o CNPJ.';
  end if;
  if length(v_documento) = 14 and exists (
    select 1 from public.tenants where cnpj = v_documento and id <> v_tenant
  ) then
    raise exception 'Este CNPJ já está cadastrado. Fale com o suporte.';
  end if;

  insert into public.pedidos_contratacao (tenant_id, plano, razao_social, documento, responsavel, telefone, email, endereco, criado_por)
  values (v_tenant, p_plano, v_razao, v_documento, v_responsavel,
          nullif(btrim(p_telefone), ''), nullif(btrim(p_email), ''), nullif(btrim(p_endereco), ''), auth.uid())
  returning id into v_pedido;

  update public.tenants
     set legal_name = v_razao,
         trade_name = v_razao,
         responsible_name = v_responsavel,
         cnpj = case when length(v_documento) = 14 then v_documento else cnpj end,
         phone = coalesce(nullif(btrim(p_telefone), ''), phone),
         email = coalesce(nullif(btrim(p_email), ''), email)
   where id = v_tenant;

  return v_pedido;
end;
$$;
revoke all on function public.solicitar_contratacao(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.solicitar_contratacao(text, text, text, text, text, text, text) to authenticated;

-- Teste encerrado: laudo novo não entra. Laudos existentes continuam acessíveis.
create or replace function private.exigir_teste_ativo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.tenants t
     where t.id = new.tenant_id and t.plan = 'trial' and t.trial_ends_at < now()
  ) then
    raise exception 'TESTE_ENCERRADO: escolha um plano para continuar registrando laudos.';
  end if;
  return new;
end;
$$;

create trigger reports_exige_teste_ativo before insert on public.reports
  for each row execute function private.exigir_teste_ativo();


-- ===== 0008_convites_equipe.sql =====
-- =====================================================================
-- Axos Relatórios | migração 0008: convites da equipe e limite de inspetores
--
-- O administrador gera um link de convite. Quem entra por ele fica na empresa
-- que convidou, sem criar outra conta de empresa. O token só existe no link:
-- o banco guarda o hash.
-- =====================================================================

create table public.convites (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete restrict,
  email        text not null check (email = lower(btrim(email)) and email like '%@%'),
  papel        public.app_role not null check (papel in ('inspector', 'supervisor')),
  token_hash   text not null unique,
  criado_por   uuid not null,
  criado_em    timestamptz not null default now(),
  expira_em    timestamptz not null default (now() + interval '7 days'),
  aceito_em    timestamptz,
  aceito_por   uuid,
  cancelado_em timestamptz
);
create index convites_tenant_idx on public.convites (tenant_id, criado_em desc);
create unique index convites_um_aberto_por_email on public.convites (tenant_id, email)
  where aceito_em is null and cancelado_em is null;
comment on table public.convites is 'LGPD: contém o e-mail da pessoa convidada';

alter table public.convites enable row level security;
create policy convites_select on public.convites for select to authenticated
  using (tenant_id = (select private.my_tenant_id()) and (select private.my_role()) = 'admin');
create policy convites_update on public.convites for update to authenticated
  using (tenant_id = (select private.my_tenant_id()) and (select private.my_role()) = 'admin')
  with check (tenant_id = (select private.my_tenant_id()) and (select private.my_role()) = 'admin');
revoke all on public.convites from anon, authenticated;
grant select (id, tenant_id, email, papel, criado_em, expira_em, aceito_em, cancelado_em) on public.convites to authenticated;
grant update (cancelado_em) on public.convites to authenticated;

-- Quantos inspetores cada plano permite. Nulo: sem limite definido.
create or replace function private.limite_inspetores(p_plano text)
returns int language sql immutable set search_path = '' as $$
  select case p_plano
    when 'individual' then 1
    when 'equipe_3' then 3
    when 'equipe_5' then 5
    when 'equipe_10' then 10
    when 'trial' then 10
    else null
  end
$$;

-- Vale para convite aceito, reativação e mudança de função
create or replace function private.checar_limite_inspetores()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limite int;
  v_ativos int;
begin
  if not new.active or not (new.role = 'inspector' or new.can_inspect) then
    return new;
  end if;
  select private.limite_inspetores(t.plan) into v_limite from public.tenants t where t.id = new.tenant_id;
  if v_limite is null then
    return new;
  end if;
  select count(*) into v_ativos from public.profiles p
   where p.tenant_id = new.tenant_id and p.active and (p.role = 'inspector' or p.can_inspect) and p.id <> new.id;
  if v_ativos >= v_limite then
    raise exception 'Limite de inspetores do plano atingido. Fale com o administrador da conta.';
  end if;
  return new;
end;
$$;

create trigger profiles_limite_inspetores before insert or update of active, role, can_inspect on public.profiles
  for each row execute function private.checar_limite_inspetores();

create or replace function public.criar_convite(p_email text, p_papel text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := private.my_tenant_id();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_limite int;
  v_usados int;
begin
  if v_tenant is null or private.my_role() is distinct from 'admin'::public.app_role then
    raise exception 'Só o administrador da conta pode convidar.';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Informe um e-mail válido para o convite.';
  end if;
  if p_papel not in ('inspector', 'supervisor') then
    raise exception 'Escolha a função da pessoa convidada.';
  end if;

  if p_papel = 'inspector' then
    select private.limite_inspetores(t.plan) into v_limite from public.tenants t where t.id = v_tenant;
    select (select count(*) from public.profiles p
             where p.tenant_id = v_tenant and p.active and (p.role = 'inspector' or p.can_inspect))
         + (select count(*) from public.convites c
             where c.tenant_id = v_tenant and c.papel = 'inspector' and c.aceito_em is null
               and c.cancelado_em is null and c.expira_em > now())
      into v_usados;
    if v_limite is not null and v_usados >= v_limite then
      raise exception 'Limite de inspetores do plano atingido. Cancele um convite ou contrate um plano maior.';
    end if;
  end if;

  -- Convite vencido não segura o e-mail
  update public.convites set cancelado_em = now()
   where tenant_id = v_tenant and email = v_email and aceito_em is null and cancelado_em is null and expira_em <= now();

  begin
    insert into public.convites (tenant_id, email, papel, token_hash, criado_por)
    values (v_tenant, v_email, p_papel::public.app_role,
            encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex'), auth.uid());
  exception when unique_violation then
    raise exception 'Já existe um convite aberto para este e-mail.';
  end;
  return v_token;
end;
$$;
revoke all on function public.criar_convite(text, text) from public, anon;
grant execute on function public.criar_convite(text, text) to authenticated;

create or replace function public.aceitar_convite(p_token text, p_nome text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_email text;
  v_nome text := nullif(btrim(p_nome), '');
  v_convite public.convites;
begin
  if v_usuario is null then
    raise exception 'Entre na sua conta para aceitar o convite.';
  end if;
  if exists (select 1 from public.profiles where id = v_usuario) then
    raise exception 'Esta conta já pertence a uma empresa. Use outro e-mail para aceitar o convite.';
  end if;
  select lower(u.email) into v_email from auth.users u where u.id = v_usuario;

  select * into v_convite from public.convites c
   where c.token_hash = encode(extensions.digest(convert_to(coalesce(p_token, ''), 'UTF8'), 'sha256'), 'hex')
   for update;
  if not found or v_convite.aceito_em is not null or v_convite.cancelado_em is not null or v_convite.expira_em <= now() then
    raise exception 'Este convite não é válido ou já venceu. Peça um novo convite.';
  end if;
  if v_convite.email is distinct from v_email then
    raise exception 'Este convite foi enviado para outro e-mail. Entre com o e-mail do convite.';
  end if;

  insert into public.profiles (id, tenant_id, role, can_inspect, full_name)
  values (v_usuario, v_convite.tenant_id, v_convite.papel, v_convite.papel = 'inspector', coalesce(v_nome, split_part(v_email, '@', 1)));

  update public.convites set aceito_em = now(), aceito_por = v_usuario where id = v_convite.id;
  return v_convite.tenant_id;
end;
$$;
revoke all on function public.aceitar_convite(text, text) from public, anon;
grant execute on function public.aceitar_convite(text, text) to authenticated;


-- ===== 0009_fecha_escopo_para_visitante.sql =====
-- =====================================================================
-- Axos Relatórios | migração 0009: fecha as tabelas de escopo para visitante
--
-- Estas 3 tabelas nasceram depois da retirada geral de permissões da 0001 e
-- ficaram com a permissão padrão do Supabase para visitante. As regras de
-- linha já bloqueavam o acesso; aqui elas ficam iguais às demais tabelas.
-- =====================================================================

revoke all on public.obra_escopo_linha, public.obra_escopo_revisao, public.laudo_escopo_vinculo from anon;


-- ===== 0010_contratacao_sem_conta.sql =====
-- =====================================================================
-- Axos Relatórios | migração 0010: contratação antes de existir conta
--
-- Quem clica em um plano na página inicial preenche os dados da empresa e
-- paga. A conta só nasce depois do pagamento, quando a Stripe avisa o
-- servidor. Visitante não grava no banco: todas estas funções são só do
-- servidor (service_role). O plano só é liberado por aqui.
-- =====================================================================

alter table public.pedidos_contratacao
  alter column tenant_id drop not null,
  alter column criado_por drop not null,
  add column if not exists aceite_versao          text check (length(aceite_versao) between 1 and 40),
  add column if not exists pago_em                timestamptz,
  add column if not exists observacao             text,
  add column if not exists stripe_session_id      text unique,
  add column if not exists stripe_customer_id     text,
  add column if not exists stripe_subscription_id text,
  drop constraint if exists pedidos_sem_conta_dados_check,
  add constraint pedidos_sem_conta_dados_check
    check (tenant_id is not null or pago_em is not null or (email is not null and aceite_versao is not null));

create index if not exists pedidos_contratacao_assinatura_idx on public.pedidos_contratacao (stripe_subscription_id)
  where stripe_subscription_id is not null;

comment on column public.pedidos_contratacao.observacao is 'Motivo de o pedido pago depender de análise da AXOS';

-- Grava o pedido de quem ainda não tem conta
create or replace function public.registrar_pedido_sem_conta(
  p_plano text,
  p_razao_social text,
  p_documento text,
  p_responsavel text,
  p_email text,
  p_aceite_versao text,
  p_telefone text default null,
  p_endereco text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_razao text := nullif(btrim(p_razao_social), '');
  v_responsavel text := nullif(btrim(p_responsavel), '');
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_documento text := regexp_replace(coalesce(p_documento, ''), '\D', '', 'g');
  v_pedido uuid;
begin
  if p_plano is null or p_plano not in ('individual', 'equipe_3', 'equipe_5', 'equipe_10') then
    raise exception 'Escolha um plano.';
  end if;
  if v_razao is null or v_responsavel is null then
    raise exception 'Informe o nome da empresa e o responsável.';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Informe um e-mail válido.';
  end if;
  if length(v_documento) not in (11, 14) then
    raise exception 'Informe um CPF ou CNPJ válido.';
  end if;
  if length(v_documento) = 11 and p_plano <> 'individual' then
    raise exception 'Para este plano, informe o CNPJ.';
  end if;
  if nullif(btrim(p_aceite_versao), '') is null then
    raise exception 'Para contratar, aceite os Termos de Uso e a Política de Privacidade.';
  end if;

  -- LGPD: pedido que não virou pagamento não fica guardado
  delete from public.pedidos_contratacao
   where tenant_id is null and pago_em is null and criado_em < now() - interval '7 days';

  insert into public.pedidos_contratacao (plano, razao_social, documento, responsavel, telefone, email, endereco, aceite_versao)
  values (p_plano, v_razao, v_documento, v_responsavel,
          nullif(btrim(p_telefone), ''), v_email, nullif(btrim(p_endereco), ''), btrim(p_aceite_versao))
  returning id into v_pedido;

  return v_pedido;
end;
$$;

-- Antes de criar a conta: diz se o pedido pode seguir sozinho e se o e-mail já tem usuário
create or replace function public.conferir_pedido_pago(p_pedido uuid)
returns table (usuario uuid, impedimento text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.pedidos_contratacao;
begin
  select * into v_pedido from public.pedidos_contratacao where id = p_pedido;
  if not found then
    raise exception 'PEDIDO_NAO_ENCONTRADO';
  end if;

  if v_pedido.tenant_id is null then
    select u.id into usuario from auth.users u where lower(u.email) = lower(v_pedido.email);
    if usuario is not null and exists (select 1 from public.profiles p where p.id = usuario) then
      impedimento := 'CONTA_JA_EXISTE';
    elsif length(v_pedido.documento) = 14 and exists (select 1 from public.tenants t where t.cnpj = v_pedido.documento) then
      impedimento := 'CNPJ_JA_CADASTRADO';
    end if;
  end if;
  return next;
end;
$$;

-- Pagamento confirmado: libera o plano e, para quem não tinha conta, cria empresa e perfil.
-- Repetir o aviso da Stripe não muda nada.
create or replace function public.liberar_pedido_pago(
  p_pedido uuid,
  p_session text,
  p_customer text,
  p_subscription text,
  p_usuario uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.pedidos_contratacao;
  v_tenant uuid;
begin
  select * into v_pedido from public.pedidos_contratacao where id = p_pedido for update;
  if not found then
    raise exception 'PEDIDO_NAO_ENCONTRADO';
  end if;
  if v_pedido.pago_em is not null then
    return v_pedido.tenant_id;
  end if;
  if v_pedido.plano = 'sob_consulta' then
    raise exception 'PLANO_SEM_PAGAMENTO_DIRETO';
  end if;

  v_tenant := v_pedido.tenant_id;
  if v_tenant is null then
    if p_usuario is null then
      raise exception 'USUARIO_OBRIGATORIO';
    end if;
    if exists (select 1 from public.profiles where id = p_usuario) then
      raise exception 'CONTA_JA_EXISTE';
    end if;
    if length(v_pedido.documento) = 14 and exists (select 1 from public.tenants where cnpj = v_pedido.documento) then
      raise exception 'CNPJ_JA_CADASTRADO';
    end if;

    insert into public.tenants (legal_name, trade_name, cnpj, plan, trial_ends_at, phone, email, responsible_name)
    values (v_pedido.razao_social, v_pedido.razao_social,
            case when length(v_pedido.documento) = 14 then v_pedido.documento end,
            v_pedido.plano, null, v_pedido.telefone, v_pedido.email, v_pedido.responsavel)
    returning id into v_tenant;

    insert into public.profiles (id, tenant_id, role, can_inspect, full_name)
    values (p_usuario, v_tenant, 'admin', true, v_pedido.responsavel);

    insert into public.lgpd_aceites (tenant_id, user_id, documento, versao)
    values (v_tenant, p_usuario, 'termos_de_uso', v_pedido.aceite_versao),
           (v_tenant, p_usuario, 'politica_de_privacidade', v_pedido.aceite_versao);
  else
    update public.tenants set plan = v_pedido.plano, trial_ends_at = null where id = v_tenant;
  end if;

  update public.pedidos_contratacao
     set tenant_id = v_tenant,
         criado_por = coalesce(criado_por, p_usuario),
         pago_em = now(),
         situacao = 'concluido',
         observacao = null,
         stripe_session_id = p_session,
         stripe_customer_id = p_customer,
         stripe_subscription_id = p_subscription
   where id = p_pedido;

  -- Evidência para auditoria, sem dados pessoais
  insert into public.audit_log (tenant_id, actor_id, actor_role, action, entity, entity_id, details)
  values (v_tenant, p_usuario, 'servidor', 'plano_liberado', 'pedidos_contratacao', p_pedido,
          jsonb_build_object('plano', v_pedido.plano, 'origem', 'stripe'));

  return v_tenant;
end;
$$;

-- Assinatura encerrada: novos laudos param e os dados continuam guardados.
-- Assinatura mais nova da mesma empresa continua valendo.
create or replace function public.encerrar_assinatura(p_subscription text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.pedidos_contratacao;
begin
  select * into v_pedido from public.pedidos_contratacao
   where stripe_subscription_id = p_subscription
   order by pago_em desc limit 1
   for update;
  if not found or v_pedido.situacao = 'cancelado' then
    return false;
  end if;

  update public.pedidos_contratacao set situacao = 'cancelado' where id = v_pedido.id;

  if not exists (
    select 1 from public.pedidos_contratacao
     where tenant_id = v_pedido.tenant_id and situacao = 'concluido' and pago_em > v_pedido.pago_em
  ) then
    update public.tenants set plan = 'trial', trial_ends_at = now() where id = v_pedido.tenant_id;
  end if;

  insert into public.audit_log (tenant_id, actor_role, action, entity, entity_id, details)
  values (v_pedido.tenant_id, 'servidor', 'assinatura_encerrada', 'pedidos_contratacao', v_pedido.id,
          jsonb_build_object('plano', v_pedido.plano, 'origem', 'stripe'));

  return true;
end;
$$;

revoke all on function public.registrar_pedido_sem_conta(text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.conferir_pedido_pago(uuid) from public, anon, authenticated;
revoke all on function public.liberar_pedido_pago(uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.encerrar_assinatura(text) from public, anon, authenticated;
grant execute on function public.registrar_pedido_sem_conta(text, text, text, text, text, text, text, text) to service_role;
grant execute on function public.conferir_pedido_pago(uuid) to service_role;
grant execute on function public.liberar_pedido_pago(uuid, text, text, text, uuid) to service_role;
grant execute on function public.encerrar_assinatura(text) to service_role;


commit;
