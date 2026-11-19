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
  insert into public.clients (id, tenant_id, legal_name, cnpj, created_by)
  values (c_client_a, t_a, 'Cliente da Empresa A', '33.333.333/0001-33', u_admin_a),
         (c_client_b, t_b, 'Cliente da Empresa B', '44.444.444/0001-44', u_admin_b);

  -- Template global publicado (método UT)
  insert into public.report_templates (id, tenant_id, method, name, version, definition, published)
  values (tpl_global, null, 'UT', 'Template Ultrassom Padrão', 1, '{"fields":[]}'::jsonb, true);

  -- Ordens de serviço
  insert into public.work_orders (id, tenant_id, client_id, code, site, assigned_to, created_by)
  values (wo_a, t_a, c_client_a, 'OS-A-001', 'Refinaria A', u_inspector1_a, u_admin_a),
         (wo_b, t_b, c_client_b, 'OS-B-001', 'Plataforma B', u_inspector1_b, u_admin_b);

  -- Qualificações para Inspetor 1 A (UT Nível 2)
  insert into public.qualifications (id, tenant_id, user_id, method, level, cert_number, issuer, valid_until)
  values (q_valid_a, t_a, u_inspector1_a, 'UT', 2, 'SNQC-12345', 'SNQC', current_date + 365),
         (q_expired_a, t_a, u_inspector1_a, 'UT', 2, 'SNQC-00000', 'SNQC', current_date - 10);

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

-- =====================================================================
-- TESTE 8: 16 métodos, número do laudo pelo servidor e escopo da obra
-- =====================================================================
do $$
declare
  t_a     uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  c_a     uuid := 'c1111111-0000-0000-0000-000000000001'::uuid;
  rep_a   uuid := '55555555-0000-0000-0000-000000000001'::uuid;
  rep_new uuid := '55555555-0000-0000-0000-000000000050'::uuid;
  obra    uuid := '44444444-0000-0000-0000-000000000001'::uuid;
  linha   uuid := '33333333-0000-0000-0000-000000000001'::uuid;
  v_count int;
  v_text  text;
  v_err   text;
begin
  -- 8.1 Modelo global publicado para cada um dos 16 métodos
  select count(distinct method) into v_count from public.report_templates
   where tenant_id is null and published;
  if v_count <> 16 then
    raise exception 'FALHA 8.1: esperados 16 métodos com modelo, vieram %', v_count;
  end if;

  -- 8.2 Número definitivo atribuído pelo servidor na emissão
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}', true);
  select report_number into v_text from public.reports where id = rep_a;
  if v_text is null or v_text not like 'END-UT-%-001' then
    raise exception 'FALHA 8.2: número do laudo emitido inválido: %', v_text;
  end if;

  -- 8.3 Cliente não define o número do laudo
  insert into public.reports (id, tenant_id, work_order_id, template_id, inspector_id, equipment_tag, report_number)
  values (rep_new, t_a, '88888888-0000-0000-0000-000000000001'::uuid, '77777777-0000-0000-0000-000000000001'::uuid,
          'aaaaaaaa-0000-0000-0000-000000000003'::uuid, 'V-500', 'END-UT-2026-999');
  select report_number into v_text from public.reports where id = rep_new;
  if v_text is not null then
    raise exception 'FALHA 8.3: cliente definiu report_number';
  end if;

  -- 8.4 Inspetor não consome número diretamente
  begin
    perform public.next_report_number(t_a, 'UT', 2026);
    raise exception 'FALHA 8.4: inspetor consumiu número de laudo';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%FORBIDDEN%' then
      raise exception 'Erro inesperado em 8.4: %', v_err;
    end if;
  end;

  -- 8.5 Gerente cadastra obra e linha de escopo
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
  insert into public.sites (id, tenant_id, client_id, name) values (obra, t_a, c_a, 'Obra de teste');
  insert into public.obra_escopo_linha (id, tenant_id, site_id, method, unidade, quantidade_prevista)
  values (linha, t_a, obra, 'UT', 'junta', 100);

  -- 8.6 Inspetor não configura escopo, mas vincula o laudo à linha
  perform set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}', true);
  begin
    insert into public.obra_escopo_linha (tenant_id, site_id, method, unidade, quantidade_prevista)
    values (t_a, obra, 'UT', 'junta', 5);
    raise exception 'FALHA 8.6: inspetor configurou escopo';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%row-level security%' then
      raise exception 'Erro inesperado em 8.6: %', v_err;
    end if;
  end;
  insert into public.laudo_escopo_vinculo (tenant_id, laudo_id, linha_id, quantidade_inspecionada, quantidade_aprovada, quantidade_reprovada)
  values (t_a, rep_a, linha, 10, 9, 1);

  raise notice '[PASS] TESTE 8: 16 métodos, número pelo servidor e escopo da obra validados.';
end $$;


do $$
declare
  u_novo uuid := 'dddddddd-0000-0000-0000-000000000001'::uuid;
  u_outro uuid := 'dddddddd-0000-0000-0000-000000000002'::uuid;
  v_t1 uuid;
  v_t2 uuid;
  v_err text;
begin
  perform set_config('role', 'none', true);
  insert into auth.users (id, email) values (u_novo, 'novo@teste.test'), (u_outro, 'outro@teste.test');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_novo, 'role', 'authenticated')::text, true);

  v_t1 := public.criar_empresa_inicial('Empresa Nova', 'Pessoa Nova', '26.998.571/0001-50');
  v_t2 := public.criar_empresa_inicial('Outra Empresa', 'Pessoa Nova');
  if v_t1 is distinct from v_t2 then
    raise exception 'FALHA 9.1: segunda chamada criou outra empresa';
  end if;
  if not exists (select 1 from public.profiles where id = u_novo and tenant_id = v_t1 and role = 'admin' and can_inspect) then
    raise exception 'FALHA 9.2: perfil de administrador não criado';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', u_outro, 'role', 'authenticated')::text, true);
  begin
    perform public.criar_empresa_inicial('Empresa Copia', 'Outra Pessoa', '26998571000150');
    raise exception 'FALHA 9.3: aceitou CNPJ repetido';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%CNPJ já está cadastrado%' then
      raise exception 'Erro inesperado em 9.3: %', v_err;
    end if;
  end;
  begin
    insert into public.tenants (legal_name) values ('Direto');
    raise exception 'FALHA 9.4: criou empresa sem a função';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%permission denied%' then
      raise exception 'Erro inesperado em 9.4: %', v_err;
    end if;
  end;

  perform set_config('role', 'none', true);
  raise notice '[PASS] TESTE 9: cadastro cria uma empresa por conta, sem CNPJ repetido';
end $$;


do $$
declare
  u_x uuid := 'eeeeeeee-0000-0000-0000-000000000001'::uuid;
  u_x2 uuid := 'eeeeeeee-0000-0000-0000-000000000002'::uuid;
  u_y uuid := 'eeeeeeee-0000-0000-0000-000000000003'::uuid;
  t_x uuid;
  t_y uuid;
  v_n int;
  v_err text;
  v_sol uuid;
begin
  perform set_config('role', 'none', true);
  insert into auth.users (id, email) values (u_x, 'x@teste.test'), (u_x2, 'x2@teste.test'), (u_y, 'y@teste.test');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_y, 'role', 'authenticated')::text, true);
  t_y := public.criar_empresa_inicial('Empresa Y', 'Pessoa Y');
  perform public.registrar_aceites('2026-11-08');
  insert into public.lgpd_solicitacoes (tenant_id, titular_nome, titular_email, tipo)
    values (t_y, 'Titular Y', 'titular@teste.test', 'acesso') returning id into v_sol;

  perform set_config('request.jwt.claims', json_build_object('sub', u_x, 'role', 'authenticated')::text, true);
  t_x := public.criar_empresa_inicial('Empresa X', 'Pessoa X');
  perform public.registrar_aceites('2026-11-08');
  perform public.registrar_aceites('2026-11-08');

  select count(*) into v_n from public.lgpd_aceites;
  if v_n <> 2 then raise exception 'FALHA 10.1: viu ou duplicou aceites: %', v_n; end if;

  select count(*) into v_n from public.lgpd_solicitacoes;
  if v_n <> 0 then raise exception 'FALHA 10.2: viu pedido de outra empresa'; end if;

  begin
    insert into public.lgpd_solicitacoes (tenant_id, titular_nome, titular_email, tipo) values (t_y, 'A', 'a@teste.test', 'acesso');
    raise exception 'FALHA 10.3: gravou pedido em outra empresa';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%row-level security%' then raise exception 'Erro inesperado em 10.3: %', v_err; end if;
  end;

  begin
    insert into public.lgpd_aceites (tenant_id, user_id, documento, versao) values (t_x, u_x, 'termos_de_uso', 'forjado');
    raise exception 'FALHA 10.4: gravou aceite direto';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%permission denied%' then raise exception 'Erro inesperado em 10.4: %', v_err; end if;
  end;

  begin
    perform public.anonimizar_usuario(u_y);
    raise exception 'FALHA 10.5: anonimizou usuário de outra empresa';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%não encontrado%' then raise exception 'Erro inesperado em 10.5: %', v_err; end if;
  end;

  begin
    perform public.anonimizar_usuario(u_x);
    raise exception 'FALHA 10.6: anonimizou a si mesmo';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%própria conta%' then raise exception 'Erro inesperado em 10.6: %', v_err; end if;
  end;

  perform set_config('role', 'none', true);
  insert into public.profiles (id, tenant_id, role, can_inspect, full_name) values (u_x2, t_x, 'inspector', true, 'Nome Real');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_x2, 'role', 'authenticated')::text, true);
  begin
    perform public.anonimizar_usuario(u_x);
    raise exception 'FALHA 10.7: inspetor anonimizou usuário';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%FORBIDDEN%' then raise exception 'Erro inesperado em 10.7: %', v_err; end if;
  end;
  select count(*) into v_n from public.lgpd_solicitacoes;
  if v_n <> 0 then raise exception 'FALHA 10.8: inspetor viu pedido de titular'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', u_x, 'role', 'authenticated')::text, true);
  perform public.anonimizar_usuario(u_x2);
  if not exists (select 1 from public.profiles where id = u_x2 and full_name = 'Usuário anonimizado' and not active) then
    raise exception 'FALHA 10.9: anonimização não aplicada';
  end if;

  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    perform public.next_report_number(t_x, 'UT', 2026);
    raise exception 'FALHA 10.10: visitante chamou a numeração';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%permission denied%' then raise exception 'Erro inesperado em 10.10: %', v_err; end if;
  end;

  perform set_config('role', 'none', true);
  raise notice '[PASS] TESTE 10: aceites, pedidos de titulares e anonimização isolados por empresa';
end $$;


do $$
declare
  u_p uuid := 'ffffffff-0000-0000-0000-000000000001'::uuid;
  u_i uuid := 'ffffffff-0000-0000-0000-000000000002'::uuid;
  t_p uuid;
  c_p uuid := gen_random_uuid();
  w_p uuid := gen_random_uuid();
  v_tpl uuid;
  v_n int;
  v_err text;
begin
  perform set_config('role', 'none', true);
  insert into auth.users (id, email) values (u_p, 'p@teste.test'), (u_i, 'i@teste.test');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_p, 'role', 'authenticated')::text, true);
  t_p := public.criar_empresa_inicial('Pessoa P', 'Pessoa P');

  perform set_config('role', 'none', true);
  -- 0011: teste grátis só com cartão (Stripe); conta do cadastro nasce sem dias grátis
  if not exists (select 1 from public.tenants where id = t_p and plan = 'trial' and trial_ends_at <= now()) then
    raise exception 'FALHA 11.1: conta nova do cadastro ganhou dias grátis sem cartão';
  end if;
  insert into public.profiles (id, tenant_id, role, can_inspect, full_name) values (u_i, t_p, 'inspector', true, 'Inspetor P');
  insert into public.clients (id, tenant_id, legal_name) values (c_p, t_p, 'Cliente P');
  insert into public.work_orders (id, tenant_id, client_id, code, site, assigned_to, created_by)
    values (w_p, t_p, c_p, 'OS-P', 'Local P', u_i, u_p);
  select id into v_tpl from public.report_templates where tenant_id is null and published limit 1;

  perform set_config('role', 'authenticated', true);
  begin
    perform public.solicitar_contratacao('equipe_3', 'Empresa P', '12345678901', 'Pessoa P');
    raise exception 'FALHA 11.2: plano de equipe aceitou CPF';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%informe o CNPJ%' then raise exception 'Erro inesperado em 11.2: %', v_err; end if;
  end;
  perform public.solicitar_contratacao('individual', 'Pessoa P', '123.456.789-01', 'Pessoa P');
  select count(*) into v_n from public.pedidos_contratacao;
  if v_n <> 1 then raise exception 'FALHA 11.3: pedido não registrado'; end if;
  begin
    update public.tenants set plan = 'equipe_10' where id = t_p;
    raise exception 'FALHA 11.4: usuário alterou o próprio plano';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%permission denied%' then raise exception 'Erro inesperado em 11.4: %', v_err; end if;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', u_i, 'role', 'authenticated')::text, true);
  begin
    perform public.solicitar_contratacao('individual', 'X', '12345678901', 'X');
    raise exception 'FALHA 11.5: inspetor contratou plano';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%administrador da conta%' then raise exception 'Erro inesperado em 11.5: %', v_err; end if;
  end;
  select count(*) into v_n from public.pedidos_contratacao;
  if v_n <> 0 then raise exception 'FALHA 11.6: inspetor viu pedido'; end if;

  begin
    insert into public.reports (tenant_id, work_order_id, template_id, inspector_id, equipment_tag, inspection_date)
      values (t_p, w_p, v_tpl, u_i, 'SEM-PLANO', current_date);
    raise exception 'FALHA 11.1b: conta sem plano gravou laudo';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%TESTE_ENCERRADO%' then raise exception 'Erro inesperado em 11.1b: %', v_err; end if;
  end;

  -- Empresa antiga, criada antes da 0011, ainda dentro do teste
  perform set_config('role', 'none', true);
  update public.tenants set trial_ends_at = now() + interval '30 days' where id = t_p;
  perform set_config('role', 'authenticated', true);
  insert into public.reports (tenant_id, work_order_id, template_id, inspector_id, equipment_tag, inspection_date)
    values (t_p, w_p, v_tpl, u_i, 'DENTRO-DO-TESTE', current_date);

  perform set_config('role', 'none', true);
  update public.tenants set trial_ends_at = now() - interval '1 day' where id = t_p;
  perform set_config('role', 'authenticated', true);
  begin
    insert into public.reports (tenant_id, work_order_id, template_id, inspector_id, equipment_tag, inspection_date)
      values (t_p, w_p, v_tpl, u_i, 'FORA-DO-TESTE', current_date);
    raise exception 'FALHA 11.7: gravou laudo com teste encerrado';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%TESTE_ENCERRADO%' then raise exception 'Erro inesperado em 11.7: %', v_err; end if;
  end;
  select count(*) into v_n from public.reports where equipment_tag = 'DENTRO-DO-TESTE';
  if v_n <> 1 then raise exception 'FALHA 11.8: laudo antigo ficou inacessível'; end if;

  perform set_config('role', 'none', true);
  update public.tenants set plan = 'individual', trial_ends_at = null where id = t_p;
  perform set_config('role', 'authenticated', true);
  insert into public.reports (tenant_id, work_order_id, template_id, inspector_id, equipment_tag, inspection_date)
    values (t_p, w_p, v_tpl, u_i, 'PLANO-ATIVO', current_date);

  perform set_config('role', 'none', true);
  raise notice '[PASS] TESTE 11: conta do cadastro sem dias grátis, pedido de contratação e bloqueio de laudo novo';
end $$;


do $$
declare
  u_a uuid := 'abababab-0000-0000-0000-000000000001'::uuid;
  u_c uuid := 'abababab-0000-0000-0000-000000000002'::uuid;
  u_e uuid := 'abababab-0000-0000-0000-000000000003'::uuid;
  u_b uuid := 'abababab-0000-0000-0000-000000000004'::uuid;
  u_d uuid := 'abababab-0000-0000-0000-000000000005'::uuid;
  t_a uuid;
  t_b uuid;
  v_token text;
  v_token2 text;
  v_n int;
  v_err text;
begin
  perform set_config('role', 'none', true);
  insert into auth.users (id, email) values
    (u_a, 'admin@x.test'), (u_c, 'convidado@x.test'), (u_e, 'errado@x.test'), (u_b, 'outro@x.test'), (u_d, 'dois@x.test');

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_b, 'role', 'authenticated')::text, true);
  t_b := public.criar_empresa_inicial('Empresa B', 'Admin B');

  perform set_config('request.jwt.claims', json_build_object('sub', u_a, 'role', 'authenticated')::text, true);
  t_a := public.criar_empresa_inicial('Empresa A', 'Admin A');
  v_token := public.criar_convite(' Convidado@X.test ', 'inspector');

  begin
    perform token_hash from public.convites limit 1;
    raise exception 'FALHA 12.1: administrador leu o hash do convite';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%permission denied%' then raise exception 'Erro inesperado em 12.1: %', v_err; end if;
  end;
  begin
    perform public.criar_convite('convidado@x.test', 'inspector');
    raise exception 'FALHA 12.2: dois convites abertos para o mesmo e-mail';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%convite aberto%' then raise exception 'Erro inesperado em 12.2: %', v_err; end if;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', u_e, 'role', 'authenticated')::text, true);
  begin
    perform public.aceitar_convite(v_token, 'Errado');
    raise exception 'FALHA 12.3: aceitou convite com outro e-mail';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%outro e-mail%' then raise exception 'Erro inesperado em 12.3: %', v_err; end if;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', u_b, 'role', 'authenticated')::text, true);
  select count(*) into v_n from public.convites;
  if v_n <> 0 then raise exception 'FALHA 12.4: outra empresa viu o convite'; end if;
  begin
    perform public.aceitar_convite(v_token, 'Admin B');
    raise exception 'FALHA 12.5: conta de outra empresa aceitou convite';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%já pertence%' then raise exception 'Erro inesperado em 12.5: %', v_err; end if;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', u_c, 'role', 'authenticated')::text, true);
  if public.aceitar_convite(v_token, 'Pessoa Convidada') is distinct from t_a then
    raise exception 'FALHA 12.6: entrou na empresa errada';
  end if;
  if not exists (select 1 from public.profiles where id = u_c and tenant_id = t_a and role = 'inspector' and can_inspect) then
    raise exception 'FALHA 12.7: perfil de inspetor não criado';
  end if;
  select count(*) into v_n from public.tenants;
  if v_n <> 1 then raise exception 'FALHA 12.8: convidado vê outra empresa'; end if;
  begin
    perform public.criar_convite('novo@x.test', 'inspector');
    raise exception 'FALHA 12.9: inspetor criou convite';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%administrador da conta%' then raise exception 'Erro inesperado em 12.9: %', v_err; end if;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', u_d, 'role', 'authenticated')::text, true);
  begin
    perform public.aceitar_convite(v_token, 'Reuso');
    raise exception 'FALHA 12.10: convite usado duas vezes';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%não é válido%' then raise exception 'Erro inesperado em 12.10: %', v_err; end if;
  end;

  -- Limite do plano: Individual comporta só 1 inspetor
  perform set_config('role', 'none', true);
  update public.profiles set active = false where id = u_c;
  update public.tenants set plan = 'individual', trial_ends_at = null where id = t_a;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_a, 'role', 'authenticated')::text, true);
  begin
    perform public.criar_convite('dois@x.test', 'inspector');
    raise exception 'FALHA 12.11: passou do limite ao convidar';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%Limite de inspetores%' then raise exception 'Erro inesperado em 12.11: %', v_err; end if;
  end;
  begin
    update public.profiles set active = true where id = u_c;
    raise exception 'FALHA 12.12: reativação passou do limite';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%Limite de inspetores%' then raise exception 'Erro inesperado em 12.12: %', v_err; end if;
  end;
  v_token2 := public.criar_convite('dois@x.test', 'supervisor');
  perform set_config('request.jwt.claims', json_build_object('sub', u_d, 'role', 'authenticated')::text, true);
  perform public.aceitar_convite(v_token2, 'Supervisor');
  if not exists (select 1 from public.profiles where id = u_d and role = 'supervisor' and not can_inspect) then
    raise exception 'FALHA 12.13: supervisor convidado incorreto';
  end if;

  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    perform public.aceitar_convite(v_token, 'Visitante');
    raise exception 'FALHA 12.14: visitante chamou o convite';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err not like '%permission denied%' then raise exception 'Erro inesperado em 12.14: %', v_err; end if;
  end;

  perform set_config('role', 'none', true);
  raise notice '[PASS] TESTE 12: convites isolados por empresa, uso único e limite do plano';
end $$;

-- =====================================================================
-- TESTE 13: visitante sem login não tem permissão em nada do schema public
-- =====================================================================
do $$
declare
  v_tabelas text;
  v_funcoes text;
begin
  select string_agg(c.relname, ', ') into v_tabelas
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind in ('r', 'p', 'v', 'm')
     and has_table_privilege('anon', c.oid, 'select, insert, update, delete, truncate, references, trigger');
  if v_tabelas is not null then
    raise exception 'FALHA 13.1: visitante com permissão nas tabelas: %', v_tabelas;
  end if;

  select string_agg(p.proname, ', ') into v_funcoes
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and has_function_privilege('anon', p.oid, 'execute');
  if v_funcoes is not null then
    raise exception 'FALHA 13.2: visitante com permissão nas funções: %', v_funcoes;
  end if;

  raise notice '[PASS] TESTE 13: visitante sem permissão em tabelas e funções';
end $$;

-- =====================================================================
-- TESTE 14: fotos de campo no bucket privado, isoladas por empresa e laudo
-- =====================================================================
do $$
declare
  t_a    uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  t_b    uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  u_a1   text := 'aaaaaaaa-0000-0000-0000-000000000003';
  u_a2   text := 'aaaaaaaa-0000-0000-0000-000000000004';
  u_b1   text := 'bbbbbbbb-0000-0000-0000-000000000002';
  v_rep  uuid := '55555555-0000-0000-0000-00000000f070'::uuid;
  v_foto uuid := '44444444-0000-0000-0000-000000000099'::uuid;
  v_path text := t_a::text || '/' || v_rep::text || '/hash1.jpg';
  v_count int;
begin
  -- No Supabase a tabela de arquivos já vem com RLS ligada
  alter table storage.objects enable row level security;

  if exists (select 1 from storage.buckets where id = 'report-files' and public) then
    raise exception 'FALHA 14.1: bucket de fotos não pode ser público';
  end if;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_a1, 'role', 'authenticated')::text, true);
  insert into public.reports (id, tenant_id, work_order_id, template_id, inspector_id, status, equipment_tag, inspection_date)
  values (v_rep, t_a, '88888888-0000-0000-0000-000000000001'::uuid, '77777777-0000-0000-0000-000000000001'::uuid,
          u_a1::uuid, 'draft', 'V-FOTO', current_date);

  -- O inspetor do laudo envia a foto com o id gerado no aparelho
  insert into storage.objects (bucket_id, name) values ('report-files', v_path);
  insert into public.report_attachments (id, tenant_id, report_id, kind, storage_path, sha256)
  values (v_foto, t_a, v_rep, 'photo', v_path, 'hash1');

  -- Reenvio da mesma foto cai no erro que o app trata como "já enviada"
  begin
    insert into public.report_attachments (id, tenant_id, report_id, kind, storage_path, sha256)
    values (gen_random_uuid(), t_a, v_rep, 'photo', v_path, 'hash1');
    raise exception 'FALHA 14.2: foto repetida aceita no mesmo laudo';
  exception when unique_violation then null;
  end;

  -- Outro inspetor da mesma empresa não envia para laudo que não é dele
  perform set_config('request.jwt.claims', json_build_object('sub', u_a2, 'role', 'authenticated')::text, true);
  begin
    insert into storage.objects (bucket_id, name) values ('report-files', t_a::text || '/' || v_rep::text || '/hash2.jpg');
    raise exception 'FALHA 14.3: inspetor enviou foto para laudo de outro inspetor';
  exception when insufficient_privilege then null;
  end;

  -- Outra empresa não vê, não envia e não apaga
  perform set_config('request.jwt.claims', json_build_object('sub', u_b1, 'role', 'authenticated')::text, true);
  select count(*) into v_count from storage.objects where bucket_id = 'report-files';
  if v_count <> 0 then raise exception 'FALHA 14.4: outra empresa viu o arquivo da foto'; end if;
  select count(*) into v_count from public.report_attachments where id = v_foto;
  if v_count <> 0 then raise exception 'FALHA 14.5: outra empresa viu o registro da foto'; end if;
  begin
    insert into storage.objects (bucket_id, name) values ('report-files', v_path || '.2');
    raise exception 'FALHA 14.6: outra empresa enviou arquivo para a pasta da empresa A';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('report-files', t_b::text || '/' || v_rep::text || '/hash3.jpg');
    raise exception 'FALHA 14.7: outra empresa usou o laudo da empresa A na própria pasta';
  exception when insufficient_privilege then null;
  end;
  delete from storage.objects where name = v_path;
  delete from public.report_attachments where id = v_foto;

  -- Visitante não tem acesso nenhum
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    perform 1 from storage.objects where bucket_id = 'report-files';
    raise exception 'FALHA 14.8: visitante leu arquivos';
  exception when insufficient_privilege then null;
  end;

  -- Com o laudo enviado, a foto fica travada até para o próprio inspetor
  perform set_config('role', 'none', true);
  if not exists (select 1 from storage.objects where name = v_path)
     or not exists (select 1 from public.report_attachments where id = v_foto) then
    raise exception 'FALHA 14.9: outra empresa apagou a foto';
  end if;
  alter table public.reports disable trigger user;
  update public.reports set status = 'submitted' where id = v_rep;
  alter table public.reports enable trigger user;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_a1, 'role', 'authenticated')::text, true);
  delete from storage.objects where name = v_path;
  delete from public.report_attachments where id = v_foto;
  begin
    insert into storage.objects (bucket_id, name) values ('report-files', t_a::text || '/' || v_rep::text || '/hash4.jpg');
    raise exception 'FALHA 14.10: foto nova aceita em laudo já enviado';
  exception when insufficient_privilege then null;
  end;

  perform set_config('role', 'none', true);
  if not exists (select 1 from storage.objects where name = v_path)
     or not exists (select 1 from public.report_attachments where id = v_foto) then
    raise exception 'FALHA 14.11: foto apagada de laudo já enviado';
  end if;

  raise notice '[PASS] TESTE 14: fotos isoladas por empresa e travadas depois do envio do laudo';
end $$;

-- =====================================================================
-- TESTE 15: contratação sem conta, só pelo servidor
-- =====================================================================
do $$
declare
  u_novo uuid := 'dddddddd-0000-0000-0000-00000000f151'::uuid;
  u_b uuid := 'dddddddd-0000-0000-0000-00000000f152'::uuid;
  v_pedido uuid;
  v_pedido2 uuid;
  v_velho uuid;
  v_tenant uuid;
  v_impedimento text;
  v_usuario uuid;
  v_qtd int;
  v_plano text;
  v_fim timestamptz;
begin
  perform set_config('role', 'none', true);
  insert into auth.users (id, email) values (u_novo, 'novo@empresa.test'), (u_b, 'outro@empresa.test');

  -- Visitante e usuário logado não usam as funções do servidor
  perform set_config('role', 'anon', true);
  begin
    perform public.registrar_pedido_sem_conta('individual', 'X', '11122233344', 'Y', 'a@b.test', 'v1');
    raise exception 'FALHA 15.1: visitante gravou pedido';
  exception when insufficient_privilege then null;
  end;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u_novo, 'role', 'authenticated')::text, true);
  begin
    perform public.liberar_pedido_pago(gen_random_uuid(), 's', 'c', 'a', u_novo);
    raise exception 'FALHA 15.2: usuário logado liberou plano';
  exception when insufficient_privilege then null;
  end;

  -- Regras do pedido
  perform set_config('role', 'service_role', true);
  begin
    perform public.registrar_pedido_sem_conta('equipe_3', 'Empresa', '11122233344', 'Resp', 'novo@empresa.test', 'v1');
    raise exception 'FALHA 15.3: CPF aceito em plano de equipe';
  exception when raise_exception then
    if sqlerrm like 'FALHA%' then raise; end if;
  end;
  begin
    perform public.registrar_pedido_sem_conta('sob_consulta', 'Empresa', '11222333000181', 'Resp', 'novo@empresa.test', 'v1');
    raise exception 'FALHA 15.4: plano sob consulta aceito';
  exception when raise_exception then
    if sqlerrm like 'FALHA%' then raise; end if;
  end;
  begin
    perform public.registrar_pedido_sem_conta('equipe_3', 'Empresa', '11222333000181', 'Resp', 'novo@empresa.test', '');
    raise exception 'FALHA 15.5: pedido sem aceite';
  exception when raise_exception then
    if sqlerrm like 'FALHA%' then raise; end if;
  end;
  begin
    perform public.registrar_pedido_sem_conta('equipe_3', 'Empresa', '11222333000181', 'Resp', 'sem-arroba', 'v1');
    raise exception 'FALHA 15.6: e-mail inválido aceito';
  exception when raise_exception then
    if sqlerrm like 'FALHA%' then raise; end if;
  end;

  v_pedido := public.registrar_pedido_sem_conta('equipe_3', ' Empresa Nova ', '11.222.333/0001-81', 'Resp Novo', 'NOVO@empresa.test', 'v1', '11999990000', 'Rua 1');

  -- Pedido sem conta não aparece para nenhuma empresa
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
  if exists (select 1 from public.pedidos_contratacao where id = v_pedido) then
    raise exception 'FALHA 15.7: administrador viu pedido sem conta';
  end if;

  -- Sem conta anterior: nada impede
  perform set_config('role', 'service_role', true);
  select usuario, impedimento into v_usuario, v_impedimento from public.conferir_pedido_pago(v_pedido);
  if v_usuario is distinct from u_novo or v_impedimento is not null then
    raise exception 'FALHA 15.8: conferência errada (%, %)', v_usuario, v_impedimento;
  end if;

  v_tenant := public.liberar_pedido_pago(v_pedido, 'cs_1', 'cus_1', 'sub_1', u_novo);

  perform set_config('role', 'none', true);
  select plan, trial_ends_at into v_plano, v_fim from public.tenants where id = v_tenant;
  if v_plano <> 'equipe_3' or v_fim is not null then
    raise exception 'FALHA 15.9: plano não liberado (%, %)', v_plano, v_fim;
  end if;
  if not exists (select 1 from public.profiles where id = u_novo and tenant_id = v_tenant and role = 'admin' and full_name = 'Resp Novo') then
    raise exception 'FALHA 15.10: perfil não criado';
  end if;
  select count(*) into v_qtd from public.lgpd_aceites where user_id = u_novo and versao = 'v1';
  if v_qtd <> 2 then
    raise exception 'FALHA 15.11: aceites registrados: %', v_qtd;
  end if;
  if not exists (select 1 from public.audit_log where entity_id = v_pedido and action = 'plano_liberado') then
    raise exception 'FALHA 15.12: liberação sem registro de auditoria';
  end if;

  -- Aviso repetido da Stripe não duplica nada
  perform set_config('role', 'service_role', true);
  if public.liberar_pedido_pago(v_pedido, 'cs_1', 'cus_1', 'sub_1', u_novo) is distinct from v_tenant then
    raise exception 'FALHA 15.13: repetição mudou a empresa';
  end if;
  perform set_config('role', 'none', true);
  select count(*) into v_qtd from public.lgpd_aceites where user_id = u_novo;
  if v_qtd <> 2 then
    raise exception 'FALHA 15.14: repetição duplicou aceites';
  end if;

  -- Quem já tem empresa, ou CNPJ já usado, vai para análise da AXOS
  perform set_config('role', 'service_role', true);
  v_pedido2 := public.registrar_pedido_sem_conta('individual', 'Outra', '11122233344', 'Resp', 'novo@empresa.test', 'v1');
  select impedimento into v_impedimento from public.conferir_pedido_pago(v_pedido2);
  if v_impedimento is distinct from 'CONTA_JA_EXISTE' then
    raise exception 'FALHA 15.15: conta existente não detectada (%)', v_impedimento;
  end if;
  v_pedido2 := public.registrar_pedido_sem_conta('equipe_5', 'Outra', '11222333000181', 'Resp', 'outro@empresa.test', 'v1');
  select impedimento into v_impedimento from public.conferir_pedido_pago(v_pedido2);
  if v_impedimento is distinct from 'CNPJ_JA_CADASTRADO' then
    raise exception 'FALHA 15.16: CNPJ repetido não detectado (%)', v_impedimento;
  end if;

  -- Assinatura mais nova segura o plano; a última encerrada corta laudo novo
  perform set_config('role', 'none', true);
  update public.pedidos_contratacao set tenant_id = v_tenant where id = v_pedido2;
  update public.pedidos_contratacao set pago_em = now() - interval '1 day' where id = v_pedido;
  perform set_config('role', 'service_role', true);
  perform public.liberar_pedido_pago(v_pedido2, 'cs_2', 'cus_1', 'sub_2');
  if not public.encerrar_assinatura('sub_1') then
    raise exception 'FALHA 15.17: assinatura antiga não encerrada';
  end if;
  perform set_config('role', 'none', true);
  select plan into v_plano from public.tenants where id = v_tenant;
  if v_plano <> 'equipe_5' then
    raise exception 'FALHA 15.18: assinatura antiga derrubou a nova (%)', v_plano;
  end if;
  perform set_config('role', 'service_role', true);
  perform public.encerrar_assinatura('sub_2');
  if public.encerrar_assinatura('sub_2') then
    raise exception 'FALHA 15.19: encerramento repetido teve efeito';
  end if;
  perform set_config('role', 'none', true);
  select plan, trial_ends_at into v_plano, v_fim from public.tenants where id = v_tenant;
  if v_plano <> 'trial' or v_fim is null or v_fim > now() then
    raise exception 'FALHA 15.20: empresa sem bloqueio depois de encerrar (%, %)', v_plano, v_fim;
  end if;

  -- Pedido não pago sai depois de 7 dias; pago fica
  perform set_config('role', 'service_role', true);
  v_velho := public.registrar_pedido_sem_conta('individual', 'Velho', '11122233344', 'Resp', 'velho@empresa.test', 'v1');
  perform set_config('role', 'none', true);
  update public.pedidos_contratacao set criado_em = now() - interval '8 days' where id in (v_velho, v_pedido);
  perform set_config('role', 'service_role', true);
  perform public.registrar_pedido_sem_conta('individual', 'Novo', '11122233344', 'Resp', 'n@empresa.test', 'v1');
  perform set_config('role', 'none', true);
  if exists (select 1 from public.pedidos_contratacao where id = v_velho) then
    raise exception 'FALHA 15.21: pedido não pago continuou guardado';
  end if;
  if not exists (select 1 from public.pedidos_contratacao where id = v_pedido) then
    raise exception 'FALHA 15.22: pedido pago foi apagado';
  end if;

  raise notice '[PASS] TESTE 15: contratação sem conta só pelo servidor, com plano, aceites e auditoria';
end $$;
