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
