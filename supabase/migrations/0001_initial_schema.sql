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

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 1. TIPOS
-- ---------------------------------------------------------------------
create type public.app_role as enum ('admin', 'supervisor', 'inspector');

create type public.report_status as enum
  ('draft', 'submitted', 'returned', 'approved', 'issued', 'superseded');

create type public.ndt_method as enum
  ('US', 'LP', 'PM', 'VS', 'ME', 'PINTURA', 'VASO_PRESSAO');

-- ---------------------------------------------------------------------
-- 2. TABELAS
-- ---------------------------------------------------------------------
create table public.tenants (
  id                      uuid primary key default gen_random_uuid(),
  legal_name              text not null,
  trade_name              text,
  cnpj                    text unique,
  plan                    text not null default 'trial'
                          check (plan in ('trial', 'starter', 'pro', 'enterprise')),
  require_second_reviewer boolean not null default true,  -- quem inspecionou não aprova o próprio laudo
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
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (id, tenant_id)
);
create index on public.clients (tenant_id);
comment on column public.clients.contact_name  is 'LGPD: dado pessoal';
comment on column public.clients.contact_email is 'LGPD: dado pessoal';
comment on column public.clients.contact_phone is 'LGPD: dado pessoal';

create table public.qualifications (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants (id) on delete restrict,
  user_id     uuid not null,
  method      public.ndt_method not null,
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
  method     public.ndt_method not null,
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
  scheduled_for date,
  assigned_to  uuid,
  notes        text,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  unique (id, tenant_id),
  unique (tenant_id, code),
  foreign key (client_id, tenant_id) references public.clients (id, tenant_id),
  foreign key (assigned_to, tenant_id) references public.profiles (id, tenant_id)
);
create index on public.work_orders (tenant_id, assigned_to);
create index on public.work_orders (client_id);

-- Cada linha é uma REVISÃO de um documento (document_id agrupa as revisões).
create table public.reports (
  id                  uuid primary key default gen_random_uuid(),  -- o app pode gerar o id offline (idempotência)
  tenant_id           uuid not null references public.tenants (id) on delete restrict,
  work_order_id       uuid not null,
  template_id         uuid not null references public.report_templates (id) on delete restrict,
  document_id         uuid not null default gen_random_uuid(),
  revision            int not null default 0 check (revision >= 0),
  inspector_id        uuid not null,
  status              public.report_status not null default 'draft',

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
-- no máximo uma revisão em andamento por documento
create unique index reports_one_open_revision
  on public.reports (document_id)
  where status in ('draft', 'submitted', 'returned', 'approved');

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
  if current_user <> 'authenticated' then
    return new;   -- service_role e migrações são confiáveis
  end if;

  if new.status <> 'draft' then
    raise exception 'NEW_REPORT_MUST_BE_DRAFT';
  end if;

  new.submitted_at := null;  new.approved_at := null;  new.approved_by := null;
  new.issued_at := null;     new.issued_by := null;
  new.data_hash := null;     new.client_snapshot := null;

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
     or new.created_at    is distinct from old.created_at then
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

  -- (3) papéis de servidor (service_role, migrações) não passam pelas regras de papel
  if current_user <> 'authenticated' then
    return new;
  end if;

  v_owner    := (old.inspector_id = v_uid);
  v_reviewer := (select private.is_reviewer());

  -- (4) campos controlados pelo servidor nunca vêm do cliente
  new.submitted_at    := old.submitted_at;
  new.approved_at     := old.approved_at;
  new.approved_by     := old.approved_by;
  new.issued_at       := old.issued_at;
  new.issued_by       := old.issued_by;
  new.data_hash       := old.data_hash;
  new.client_snapshot := old.client_snapshot;

  v_tech_changed :=
    (new.equipment_tag, new.inspection_date, new.inspection_site,
     new.qualification_id, new.technical_data, new.croqui)
    is distinct from
    (old.equipment_tag, old.inspection_date, old.inspection_site,
     old.qualification_id, old.technical_data, old.croqui);

  v_admin_changed := new.administrative_data is distinct from old.administrative_data;

  -- (5) quem pode editar o quê
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
  with check (tenant_id = (select private.my_tenant_id()) and (select private.is_reviewer()));
create policy clients_update on public.clients for update to authenticated
  using (tenant_id = (select private.my_tenant_id()) and (select private.is_reviewer()))
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
         and ((select private.is_reviewer()) or assigned_to = (select auth.uid())));
create policy work_orders_insert on public.work_orders for insert to authenticated
  with check (tenant_id = (select private.my_tenant_id()) and (select private.is_reviewer()));
create policy work_orders_update on public.work_orders for update to authenticated
  using (tenant_id = (select private.my_tenant_id()) and (select private.is_reviewer()))
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
                 where w.id = work_order_id and w.assigned_to = (select auth.uid()))
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
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

revoke all on public.tenants from authenticated;
grant select on public.tenants to authenticated;
grant update (legal_name, trade_name, cnpj, require_second_reviewer) on public.tenants to authenticated;

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
