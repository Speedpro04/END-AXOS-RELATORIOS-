-- =====================================================================
-- Axos Relatórios | migração 0011: teste grátis só com cartão
--
-- Decisão do dono do produto (19/11/2026): os 30 dias grátis existem só na
-- contratação pela Stripe, com cartão. A conta criada pela tela de cadastro
-- (sem convite) nasce sem dias grátis: entra, vê o sistema e, para
-- registrar laudo, contrata um plano. Fecha dois abusos: criar contas novas
-- para usar de graça sem fim e somar 30 dias do cadastro com 30 da Stripe.
--
-- Empresas que já estão em teste continuam com o prazo que têm.
-- Pode ser rodado de novo sem erro (create or replace).
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

  -- Sem dias grátis: o prazo já nasce vencido (o gatilho de reports pede plano)
  insert into public.tenants (legal_name, trade_name, cnpj, plan, trial_ends_at)
  values (v_empresa, v_empresa, v_cnpj, 'trial', now())
  returning id into v_tenant;

  insert into public.profiles (id, tenant_id, role, can_inspect, full_name)
  values (v_usuario, v_tenant, 'admin', true, v_nome);

  return v_tenant;
end;
$$;

revoke all on function public.criar_empresa_inicial(text, text, text) from public, anon;
grant execute on function public.criar_empresa_inicial(text, text, text) to authenticated;

-- Prazo vencido inclui o próprio instante (antes era só "menor que agora"),
-- e a mensagem serve para quem nunca teve teste e para quem cancelou.
create or replace function private.exigir_teste_ativo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.tenants t
     where t.id = new.tenant_id and t.plan = 'trial' and t.trial_ends_at <= now()
  ) then
    raise exception 'TESTE_ENCERRADO: sua conta está sem plano ativo. Escolha um plano para registrar laudos.';
  end if;
  return new;
end;
$$;
