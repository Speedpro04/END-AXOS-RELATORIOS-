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
