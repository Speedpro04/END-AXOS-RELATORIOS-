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
