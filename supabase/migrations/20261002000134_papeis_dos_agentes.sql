-- ==============================================================================
-- Migration: 20261002000134_papeis_dos_agentes.sql
-- Papéis dos agentes (spec .scratch/prospeccao-revenue, fatia 5; ADR 0067). Decisão do Nan (07/10/2026):
--   Zoe (comercial) é a ÚNICA que prospecta; Jax (marketing) cuida da estratégia, do ICP e da mídia paga;
--   Lia (copy) de copy e cadências; Neo (revops) de métricas e relatórios.
-- Duas habilidades novas (o passo a passo que o agente lê com listar_habilidades), em todo cliente e nos novos:
--   "Prospecção: estimar, pedir e trazer candidatas" só na Zoe; "ICP: ler, conversar e propor" só no Jax.
-- Só citam ferramentas que existem. O cliente pode editar (como as outras habilidades).
-- ==============================================================================

CREATE OR REPLACE FUNCTION internal.habilidade_prospeccao()
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT $txt$# Prospecção: estimar, pedir e trazer candidatas

Use quando pedirem empresas novas ("ache clínicas em Campinas", "empresas de 10 a 20 pessoas que faturam de 1 a 5 milhões", "quem anuncia X"). Você é a única que prospecta.

1. Leia o ICP do cliente (ler_icp). Se estiver vazio e o pedido não disser o perfil, pergunte antes; não invente setor, porte nem região.
2. Veja as fontes (prospeccao_fontes): o que cada uma traz, os parâmetros e quantos créditos custa por empresa. Google Maps traz site e telefone; a Receita Federal traz CNPJ, porte e capital, mas não traz site.
3. Estime (prospeccao_estimar) com os parâmetros do ICP e um máximo razoável (comece pequeno: 20 a 50). Estimar não gasta nada.
4. Diga à pessoa, em créditos: "isso vai custar até N créditos; só cobra empresa nova; o crédito é gasto mesmo que você exclua candidatas depois". Espere ela dizer "pode rodar". Sem esse pedido, não rode.
5. Rode (prospeccao_rodar) com o estimativa_id (vale 30 minutos; se vencer, estime de novo). Acima do teto, vai para aprovação do C-level: avise.
6. Acompanhe (prospeccao_buscas) e conte o que veio: novas, repetidas, fora do ICP e créditos cobrados. As empresas aparecem como candidatas na página Prospecção para a pessoa incluir ou excluir. Só a incluída vira conta e é enriquecida.

Nunca invente empresa, site ou número. Fonte de pessoas (seguidores, B2C) não roda: LGPD.$txt$;
$$;
REVOKE ALL ON FUNCTION internal.habilidade_prospeccao() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION internal.habilidade_icp()
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT $txt$# ICP: ler, conversar e propor

Use quando falarem de cliente ideal, de quem comprar, de mudar o foco ou quando as vendas mostrarem um padrão novo.

1. Leia o ICP atual (ler_icp) e o Playbook. Vazio é vazio: diga que o cliente ainda não definiu.
2. Compare com os dados: contas e negócios ganhos ou avançados (listar_contas, listar_negocios), sinais (listar_sinais). Diga o tamanho do que olhou ("de 12 negócios ganhos, 9 são de SP").
3. Converse: explique o que os dados sugerem e pergunte o que a pessoa sabe e o sistema não mostra.
4. Proponha o ICP inteiro com propor_icp (setores, CNAEs, porte MICRO/EPP/DEMAIS, funcionários, faturamento, capital social, estados, cidades, observações) e o motivo. Deixe de fora o que não sabe. Vira aprovação; só muda depois.
5. Depois de aprovado, a Zoe usa o novo ICP nas buscas e o fit das contas é recalculado.

Nunca invente faixa, setor ou número.$txt$;
$$;
REVOKE ALL ON FUNCTION internal.habilidade_icp() FROM PUBLIC, anon, authenticated;

INSERT INTO public.agent_skills (workspace_id, agent_id, name, slug, content_markdown, enabled, version)
SELECT w.id, 'comercial', 'Prospecção: estimar, pedir e trazer candidatas', 'prospeccao', internal.habilidade_prospeccao(), true, 'v1.0'
  FROM public.workspaces w
ON CONFLICT (workspace_id, agent_id, slug) DO NOTHING;
INSERT INTO public.agent_skills (workspace_id, agent_id, name, slug, content_markdown, enabled, version)
SELECT w.id, 'marketing', 'ICP: ler, conversar e propor', 'icp', internal.habilidade_icp(), true, 'v1.0'
  FROM public.workspaces w
ON CONFLICT (workspace_id, agent_id, slug) DO NOTHING;

CREATE OR REPLACE FUNCTION internal.semear_habilidades_dos_papeis()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.agent_skills (workspace_id, agent_id, name, slug, content_markdown, enabled, version)
  VALUES (NEW.id, 'comercial', 'Prospecção: estimar, pedir e trazer candidatas', 'prospeccao', internal.habilidade_prospeccao(), true, 'v1.0'),
         (NEW.id, 'marketing', 'ICP: ler, conversar e propor', 'icp', internal.habilidade_icp(), true, 'v1.0')
  ON CONFLICT (workspace_id, agent_id, slug) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION internal.semear_habilidades_dos_papeis() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS workspaces_habilidades_dos_papeis ON public.workspaces;
CREATE TRIGGER workspaces_habilidades_dos_papeis AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION internal.semear_habilidades_dos_papeis();
