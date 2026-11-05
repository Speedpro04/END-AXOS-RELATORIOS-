-- =====================================================================
-- Axos Relatórios | migração 0003: ocultar produção de colegas
-- Alvo: Supabase (PostgreSQL 15+)
-- STATUS: escrita, mas NÃO executada.
--
-- Adiciona coluna ocultar_producao_colegas na tabela tenants.
-- Quando true, o inspetor não vê a produção de colegas, apenas a própria.
-- Quando false (padrão), todos veem a produção de todos.
--
-- Proteção da coluna: a política tenants_update (0001) já exige o papel
-- admin para atualizar a linha; aqui a coluna entra na lista de colunas
-- que o papel authenticated pode gravar — combinando as duas regras,
-- só o administrador altera a coluna.
-- =====================================================================

-- Coluna de ocultação de produção por colega
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS ocultar_producao_colegas boolean NOT NULL DEFAULT false;

-- Comentário na coluna
COMMENT ON COLUMN public.tenants.ocultar_producao_colegas IS
  'Quando true, o inspetor não vê a produção de colegas, apenas a própria. Default: false (visível para todos).';

-- Libera a gravação da coluna para authenticated (a política tenants_update
-- da migração 0001 já limita a atualização da linha ao papel admin).
GRANT UPDATE (ocultar_producao_colegas) ON public.tenants TO authenticated;
