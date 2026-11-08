-- =====================================================================
-- Axos Relatórios | migração 0009: fecha as tabelas de escopo para visitante
--
-- Estas 3 tabelas nasceram depois da retirada geral de permissões da 0001 e
-- ficaram com a permissão padrão do Supabase para visitante. As regras de
-- linha já bloqueavam o acesso; aqui elas ficam iguais às demais tabelas.
-- =====================================================================

revoke all on public.obra_escopo_linha, public.obra_escopo_revisao, public.laudo_escopo_vinculo from anon;
