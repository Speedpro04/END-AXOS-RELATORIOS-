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
