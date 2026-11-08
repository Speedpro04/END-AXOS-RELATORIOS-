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
