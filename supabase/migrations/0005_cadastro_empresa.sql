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
