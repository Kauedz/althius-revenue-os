-- ==============================================================================
-- Migration: 20261002000141_preco_das_fontes.sql
-- ADR 0069. Preço da prospecção pensado no retorno sobre o custo real:
--   - o Google Maps (custo na Apify perto de US$ 0,005 por empresa, extras pagos desligados) passa de 1 para 2 créditos por
--     empresa nova. Com 1 crédito, gastar os 10 mil créditos só em busca custaria perto de US$ 50, o orçamento inteiro de
--     coleta, e não sobraria nada para sinais e enriquecimento. Com 2, a margem sobre o teto do crédito é de ~74%;
--   - a tela de Margens do superadmin passa a mostrar, por fonte, o preço em créditos e a MARGEM REAL medida (custo real médio
--     por empresa das buscas já feitas), para o preço ser ajustado com número e não com palpite;
--   - o superadmin muda o preço de uma fonte (admin_prospect_source_price_set). O preço vale para as próximas estimativas.
-- Receita Federal por CNAE continua em 1 crédito (a fonte é barata); a medição diz se precisa mudar.
-- ==============================================================================

UPDATE internal.prospect_sources SET creditos_por_empresa = 2, updated_at = now() WHERE code = 'google_maps' AND creditos_por_empresa = 1;
COMMENT ON COLUMN internal.prospect_sources.creditos_por_empresa IS 'Preço por empresa NOVA encontrada, em créditos (ADR 0069). A tela de Margens mostra a margem real medida.';

CREATE OR REPLACE FUNCTION public.admin_prospect_source_price_set(p_code TEXT, p_creditos INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM internal.exigir_superadmin();
  IF p_creditos IS NULL OR p_creditos < 1 OR p_creditos > 50 THEN RAISE EXCEPTION 'O preço vai de 1 a 50 créditos por empresa.' USING ERRCODE = '22023'; END IF;
  UPDATE internal.prospect_sources SET creditos_por_empresa = p_creditos, updated_at = now() WHERE code = p_code;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fonte não encontrada.' USING ERRCODE = '22023'; END IF;
  RETURN jsonb_build_object('ok', true, 'codigo', p_code, 'creditos_por_empresa', p_creditos);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_prospect_source_price_set(TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_prospect_source_price_set(TEXT, INTEGER) TO authenticated, service_role;

-- Margens: as capacidades de sempre + uma linha por fonte de prospecção com a margem real medida.
CREATE OR REPLACE FUNCTION public.admin_margins()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM internal.exigir_superadmin();
  RETURN COALESCE((
    SELECT jsonb_agg(x ORDER BY x->>'capacidade') FROM (
      SELECT jsonb_build_object('capacidade', m.capability_code, 'creditos_base', m.base_credit_unit,
        'margem', m.margin_percent, 'risco', m.risk_multiplier, 'ativo', m.is_active) AS x
        FROM internal.pricing_multipliers m
      UNION ALL
      SELECT jsonb_build_object('capacidade', 'Prospecção · ' || f.nome, 'codigo', f.code, 'creditos_base', f.creditos_por_empresa,
        'margem', CASE WHEN COALESCE(c.novas, 0) > 0
                       THEN round((1 - (c.custo / c.novas) / NULLIF(internal.credito_em_usd(f.creditos_por_empresa), 0)) * 100) END,
        'risco', NULL, 'empresas_medidas', COALESCE(c.novas, 0), 'ativo', f.ativo)
        FROM internal.prospect_sources f
        LEFT JOIN (SELECT s.source_code, sum(co.custo_usd) AS custo, sum(s.encontradas) AS novas
                     FROM public.prospect_searches s JOIN internal.prospect_search_costs co ON co.search_id = s.id
                    WHERE s.estado = 'concluida' GROUP BY s.source_code) c ON c.source_code = f.code
    ) t
  ), '[]'::jsonb);
END;
$$;
