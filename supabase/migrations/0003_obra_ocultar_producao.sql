-- =====================================================================
-- Axos Relatórios | migração 0003: ocultar produção de colegas
-- Alvo: Supabase (PostgreSQL 15+)
-- STATUS: escrita, mas NÃO executada.
--
-- Adiciona coluna ocultar_producao_colegas na tabela tenants.
-- Quando true, o inspetor não vê a produção de colegas, apenas a própria.
-- Quando false (padrão), todos veem a produção de todos.
-- =====================================================================

-- Coluna de ocultação de produção por colega
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS ocultar_producao_colegas boolean NOT NULL DEFAULT false;

-- Comentário na coluna
COMMENT ON COLUMN public.tenants.ocultar_producao_colegas IS
  'Quando true, o inspetor não vê a produção de colegas, apenas a própria. Default: false (visível para todos).'

-- Índice para consultas por tenant + ocultar_producao_colegas
CREATE INDEX IF NOT EXISTS idx_tenants_ocultar_producao_colegas
  ON public.tenants (tenant_id, ocultar_producao_colegas);
