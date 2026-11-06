-- =====================================================================
-- Axos Relatórios | migração 0004: modelos globais dos 16 métodos END
-- Alvo: Supabase (PostgreSQL 15+)
-- STATUS: escrita, mas NÃO executada.
--
-- Todo laudo exige um modelo publicado do método (reports.template_id).
-- tenant_id nulo = modelo global. Os campos de cada método entram em
-- "definition" quando os formulários forem refinados.
-- =====================================================================
insert into public.report_templates (tenant_id, method, name, version, definition, published)
select null, m::public.end_method, 'Modelo padrão ' || m, 1, '{"campos": []}'::jsonb, true
  from unnest(enum_range(null::public.end_method)::text[]) as m
on conflict do nothing;
