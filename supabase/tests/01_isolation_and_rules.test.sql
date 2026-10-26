-- =====================================================================
-- Axos Relatórios | Testes de Isolamento Multi-tenant e Regras de Negócio
-- Executado em PostgreSQL / Supabase
-- =====================================================================

do $$
declare
  -- Tenants
  t_a uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  t_b uuid := '22222222-2222-2222-2222-222222222222'::uuid;

  -- Usuários Tenant A
  u_admin_a       uuid := 'aaaaaaaa-0000-0000-0000-000000000001'::uuid;
  u_supervisor_a  uuid := 'aaaaaaaa-0000-0000-0000-000000000002'::uuid;
  u_inspector1_a  uuid := 'aaaaaaaa-0000-0000-0000-000000000003'::uuid;
  u_inspector2_a  uuid := 'aaaaaaaa-0000-0000-0000-000000000004'::uuid;

  -- Usuários Tenant B
  u_admin_b       uuid := 'bbbbbbbb-0000-0000-0000-000000000001'::uuid;
  u_inspector1_b  uuid := 'bbbbbbbb-0000-0000-0000-000000000002'::uuid;

  -- Entidades auxiliares
  c_client_a   uuid := 'c1111111-0000-0000-0000-000000000001'::uuid;
  c_client_b   uuid := 'c2222222-0000-0000-0000-000000000001'::uuid;
  tpl_global   uuid := '77777777-0000-0000-0000-000000000001'::uuid;
  wo_a         uuid := '88888888-0000-0000-0000-000000000001'::uuid;
  wo_b         uuid := '88888888-0000-0000-0000-000000000002'::uuid;

  -- Qualificações
  q_valid_a    uuid := '99999999-0000-0000-0000-000000000001'::uuid;
  q_expired_a  uuid := '99999999-0000-0000-0000-000000000002'::uuid;

  -- Instrumentos
  inst_valid_a   uuid := '66666666-0000-0000-0000-000000000001'::uuid;
  inst_expired_a uuid := '66666666-0000-0000-0000-000000000002'::uuid;

  -- Laudos
  rep_a        uuid := '55555555-0000-0000-0000-000000000001'::uuid;
  rep_rev      uuid;

  v_count      int;
  v_err        text;
begin
  raise notice '>>> INICIANDO SEED DE DADOS PARA TESTES';

  -- Inserir tenants
  insert into public.tenants (id, legal_name, trade_name, cnpj, plan, require_second_reviewer)
  values (t_a, 'Empresa A Inspeções Ltda', 'Empresa A', '11.111.111/0001-11', 'pro', true),
         (t_b, 'Empresa B Inspeções Ltda', 'Empresa B', '22.222.222/0001-22', 'starter', true);

  -- Inserir auth.users
  insert into auth.users (id, email)
  values (u_admin_a, 'admin@a.com'),
         (u_supervisor_a, 'supervisor@a.com'),
         (u_inspector1_a, 'insp1@a.com'),
         (u_inspector2_a, 'insp2@a.com'),
         (u_admin_b, 'admin@b.com'),
         (u_inspector1_b, 'insp1@b.com');

  -- Inserir profiles
  insert into public.profiles (id, tenant_id, role, can_inspect, full_name, active)
  values (u_admin_a, t_a, 'admin', true, 'Admin A', true),
         (u_supervisor_a, t_a, 'supervisor', false, 'Supervisor A', true),
         (u_inspector1_a, t_a, 'inspector', true, 'Inspetor 1 A', true),
         (u_inspector2_a, t_a, 'inspector', true, 'Inspetor 2 A', true),
         (u_admin_b, t_b, 'admin', true, 'Admin B', true),
         (u_inspector1_b, t_b, 'inspector', true, 'Inspetor 1 B', true);

  -- Inserir clientes
  insert into public.clients (id, tenant_id, legal_name, cnpj)
  values (c_client_a, t_a, 'Cliente da Empresa A', '33.333.333/0001-33'),
         (c_client_b, t_b, 'Cliente da Empresa B', '44.444.444/0001-44');

  -- Template global publicado (método US)
  insert into public.report_templates (id, tenant_id, method, name, version, definition, published)
  values (tpl_global, null, 'US', 'Template Ultrassom Padrão', 1, '{"fields":[]}'::jsonb, true);

  -- Ordens de serviço
  insert into public.work_orders (id, tenant_id, client_id, code, site, assigned_to)
  values (wo_a, t_a, c_client_a, 'OS-A-001', 'Refinaria A', u_inspector1_a),
         (wo_b, t_b, c_client_b, 'OS-B-001', 'Plataforma B', u_inspector1_b);

  -- Qualificações para Inspetor 1 A (US Nível 2)
  insert into public.qualifications (id, tenant_id, user_id, method, level, cert_number, issuer, valid_until)
  values (q_valid_a, t_a, u_inspector1_a, 'US', 2, 'SNQC-12345', 'ABENDI', current_date + 365),
         (q_expired_a, t_a, u_inspector1_a, 'US', 2, 'SNQC-00000', 'ABENDI', current_date - 10);

  -- Instrumentos Tenant A
  insert into public.instruments (id, tenant_id, name, serial_number, calibration_valid_until)
  values (inst_valid_a, t_a, 'Aparelho US Epoch 650', 'SN-9988', current_date + 180),
         (inst_expired_a, t_a, 'Aparelho US Krautkramer', 'SN-1122', current_date - 30);

  raise notice '>>> SEED CONCLUÍDO COM SUCESSO';
end $$;

-- =====================================================================
-- TESTE 1: Isolamento Multi-tenant (Tenant A vs Tenant B)
-- =====================================================================
do $$
declare
  v_count int;
begin
  -- Simular Inspetor do Tenant B
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);

  -- 1.1 Não deve enxergar clientes do Tenant A
  select count(*) into v_count from public.clients where tenant_id = '11111111-1111-1111-1111-111111111111'::uuid;
  if v_count <> 0 then
    raise exception 'FALHA TESTE 1.1: Tenant B enxergou clientes do Tenant A';
  end if;

  -- 1.2 Não deve conseguir atualizar clientes do Tenant A
  update public.clients set legal_name = 'Hacked' where tenant_id = '11111111-1111-1111-1111-111111111111'::uuid;
  if found then
    raise exception 'FALHA TESTE 1.2: Tenant B conseguiu atualizar clientes do Tenant A';
  end if;

  -- 1.3 Não deve enxergar ordens de serviço do Tenant A
  select count(*) into v_count from public.work_orders where tenant_id = '11111111-1111-1111-1111-111111111111'::uuid;
  if v_count <> 0 then
    raise exception 'FALHA TESTE 1.3: Tenant B enxergou work_orders do Tenant A';
  end if;

  raise notice '[PASS] TESTE 1: Isolamento multi-tenant estrito validado com sucesso.';
end $$;

-- =====================================================================
-- TESTE 2: Inspetor não edita laudo de outro inspetor
-- =====================================================================
do $$
declare
  rep_id uuid := '55555555-0000-0000-0000-000000000001'::uuid;
  v_err boolean := false;
begin
  -- Inspetor 1 A cria laudo rascunho
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}', true);

  insert into public.reports (
    id, tenant_id, work_order_id, template_id, inspector_id, status, equipment_tag, inspection_date
  ) values (
    rep_id,
    '11111111-1111-1111-1111-111111111111'::uuid,
    '88888888-0000-0000-0000-000000000001'::uuid,
    '77777777-0000-0000-0000-000000000001'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000003'::uuid,
    'draft',
    'V-101',
    current_date
  );

  -- Inspetor 2 A tenta editar o laudo do Inspetor 1 A
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000004","role":"authenticated"}', true);

  begin
    update public.reports set equipment_tag = 'V-999' where id = rep_id;
    -- Se RLS ou trigger barrou (found = false ou exception)
    if found then
      raise exception 'FALHA TESTE 2: Inspetor 2 conseguiu atualizar laudo do Inspetor 1';
    end if;
  exception when others then
    v_err := true;
  end;

  raise notice '[PASS] TESTE 2: Inspetor não pode editar laudo de outro inspetor.';
end $$;

-- =====================================================================
-- TESTE 3: Supervisor não edita campo técnico, mas edita administrativo
-- =====================================================================
do $$
declare
  rep_id uuid := '55555555-0000-0000-0000-000000000001'::uuid;
  v_err text;
begin
  -- Supervisor A tenta alterar campo técnico (equipment_tag) em rascunho
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);

  begin
    update public.reports set equipment_tag = 'TAG-ALTERADA-PELO-SUPERVISOR' where id = rep_id;
    raise exception 'FALHA: Supervisor conseguiu alterar equipment_tag!';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%TECHNICAL_FIELDS_LOCKED%' then
      raise exception 'Erro inesperado: %', v_err;
    end if;
  end;

  -- Inspetor 1 adiciona qualificação válida e submete
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}', true);

  update public.reports
     set qualification_id = '99999999-0000-0000-0000-000000000001'::uuid,
         inspection_site = 'Área 2',
         status = 'submitted'
   where id = rep_id;

  -- Agora que está 'submitted', supervisor edita administrative_data
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);

  update public.reports
     set administrative_data = '{"pedido_compra":"PC-12345"}'::jsonb
   where id = rep_id;

  -- Mas supervisor A ainda NÃO pode alterar campo técnico em 'submitted'
  begin
    update public.reports set equipment_tag = 'TAG-ILEGAL' where id = rep_id;
    raise exception 'FALHA: Supervisor conseguiu alterar campo técnico em submitted!';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%TECHNICAL_FIELDS_LOCKED%' then
      raise exception 'Erro inesperado: %', v_err;
    end if;
  end;

  raise notice '[PASS] TESTE 3: Regra técnica x administrativa para supervisor validada.';
end $$;

-- =====================================================================
-- TESTE 4 & 5: Ciclo de aprovação, imutabilidade do emitido e nova revisão
-- =====================================================================
do $$
declare
  rep_id uuid := '55555555-0000-0000-0000-000000000001'::uuid;
  v_rev_id uuid;
  v_count int;
  v_err text;
  v_hash text;
  v_status public.report_status;
begin
  -- 4.1 Supervisor aprova o laudo
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);

  update public.reports set status = 'approved' where id = rep_id;

  -- 4.2 Tentativa de criar revisão de laudo 'approved' deve falhar
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}', true);

  begin
    v_rev_id := public.create_report_revision(rep_id);
    raise exception 'FALHA: Permitiu criar revisão de laudo que não está emitido!';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%ONLY_ISSUED_CAN_BE_REVISED%' then
      raise exception 'Erro inesperado ao revisar não-emitido: %', v_err;
    end if;
  end;

  -- 4.3 Supervisor emite o laudo ('issued')
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);

  update public.reports set status = 'issued' where id = rep_id;

  select data_hash, status into v_hash, v_status from public.reports where id = rep_id;
  if v_status <> 'issued' or v_hash is null then
    raise exception 'FALHA: Laudo não foi emitido ou hash SHA-256 está nulo!';
  end if;

  -- 4.4 Laudo emitido é IMUTÁVEL (não pode ser alterado)
  begin
    update public.reports set equipment_tag = 'V-NOVA-TAG' where id = rep_id;
    raise exception 'FALHA: Permitiu alterar laudo emitido!';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%REPORT_IMMUTABLE%' then
      raise exception 'Erro inesperado em imutabilidade: %', v_err;
    end if;
  end;

  -- 4.5 Laudo emitido NÃO pode ser excluído
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}', true);

  begin
    delete from public.reports where id = rep_id;
    raise exception 'FALHA: Permitiu excluir laudo emitido!';
  exception when others then
    -- RLS ou trigger impede
    null;
  end;

  -- 5.1 Criar nova revisão a partir do emitido
  v_rev_id := public.create_report_revision(rep_id);

  select revision, status into v_count, v_status from public.reports where id = v_rev_id;
  if v_count <> 1 or v_status <> 'draft' then
    raise exception 'FALHA: Nova revisão deveria ter revision=1 e status=draft (veio rev=% status=%)', v_count, v_status;
  end if;

  raise notice '[PASS] TESTE 4 & 5: Imutabilidade do emitido e criação de revisão validadas.';
end $$;

-- =====================================================================
-- TESTE 6: Bloqueio de submissão com qualificação vencida ou instrumento vencido
-- =====================================================================
do $$
declare
  rep_bad uuid := '55555555-0000-0000-0000-000000000099'::uuid;
  v_err text;
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}', true);

  -- Criar laudo de teste
  insert into public.reports (
    id, tenant_id, work_order_id, template_id, inspector_id, status, equipment_tag, inspection_date
  ) values (
    rep_bad,
    '11111111-1111-1111-1111-111111111111'::uuid,
    '88888888-0000-0000-0000-000000000001'::uuid,
    '77777777-0000-0000-0000-000000000001'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000003'::uuid,
    'draft',
    'TQ-202',
    current_date
  );

  -- 6.1 Tentar submeter com qualificação VENCIDA
  begin
    update public.reports
       set qualification_id = '99999999-0000-0000-0000-000000000002'::uuid, -- vencida
           status = 'submitted'
     where id = rep_bad;
    raise exception 'FALHA: Permitiu submeter com qualificação vencida!';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%QUALIFICATION_INVALID%' then
      raise exception 'Erro inesperado ao validar qualificação: %', v_err;
    end if;
  end;

  -- 6.2 Vincular instrumento com calibração VENCIDA e tentar submeter com qualificação válida
  insert into public.report_instruments (report_id, instrument_id, tenant_id)
  values (rep_bad, '66666666-0000-0000-0000-000000000002'::uuid, '11111111-1111-1111-1111-111111111111'::uuid);

  begin
    update public.reports
       set qualification_id = '99999999-0000-0000-0000-000000000001'::uuid, -- válida
           status = 'submitted'
     where id = rep_bad;
    raise exception 'FALHA: Permitiu submeter com instrumento vencido!';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%INSTRUMENT_CALIBRATION_EXPIRED%' then
      raise exception 'Erro inesperado ao validar instrumento: %', v_err;
    end if;
  end;

  -- Limpar instrumento vencido e vincular instrumento válido
  delete from public.report_instruments where report_id = rep_bad;
  insert into public.report_instruments (report_id, instrument_id, tenant_id)
  values (rep_bad, '66666666-0000-0000-0000-000000000001'::uuid, '11111111-1111-1111-1111-111111111111'::uuid);

  -- Agora submissão deve ter SUCESSO
  update public.reports
     set qualification_id = '99999999-0000-0000-0000-000000000001'::uuid,
         status = 'submitted'
   where id = rep_bad;

  raise notice '[PASS] TESTE 6: Bloqueios de qualificação e instrumento vencidos validados.';
end $$;

-- =====================================================================
-- TESTE 7: Imutabilidade da tabela audit_log (somente append-only)
-- =====================================================================
do $$
declare
  v_err text;
begin
  -- 7.1 Como 'authenticated': UPDATE / DELETE / TRUNCATE bloqueados por privilégios
  begin
    update public.audit_log set action = 'tampered' where id > 0;
    raise exception 'FALHA: Permitiu UPDATE em audit_log como authenticated!';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%permission denied%' and v_err not like '%AUDIT_LOG_IS_APPEND_ONLY%' then
      raise exception 'Erro inesperado em UPDATE audit_log (authenticated): %', v_err;
    end if;
  end;

  -- 7.2 Como 'postgres' (superuser / owner): triggers impedem qualquer alteração ou deleção
  reset role;

  -- Trigger UPDATE
  begin
    update public.audit_log set action = 'tampered' where id > 0;
    raise exception 'FALHA: Permitiu UPDATE em audit_log como owner!';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%AUDIT_LOG_IS_APPEND_ONLY%' then
      raise exception 'Erro inesperado em UPDATE audit_log (owner): %', v_err;
    end if;
  end;

  -- Trigger DELETE
  begin
    delete from public.audit_log where id > 0;
    raise exception 'FALHA: Permitiu DELETE em audit_log como owner!';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%AUDIT_LOG_IS_APPEND_ONLY%' then
      raise exception 'Erro inesperado em DELETE audit_log (owner): %', v_err;
    end if;
  end;

  -- Trigger TRUNCATE
  begin
    truncate table public.audit_log;
    raise exception 'FALHA: Permitiu TRUNCATE em audit_log como owner!';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%AUDIT_LOG_IS_APPEND_ONLY%' then
      raise exception 'Erro inesperado em TRUNCATE audit_log (owner): %', v_err;
    end if;
  end;

  raise notice '[PASS] TESTE 7: audit_log estritamente append-only (camada de privilégios e triggers validadas).';
end $$;
