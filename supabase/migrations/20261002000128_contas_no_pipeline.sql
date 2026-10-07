-- ==============================================================================
-- Migration: 20261002000128_contas_no_pipeline.sql
-- Levar contas da base para um quadro do Pipeline, uma ou várias de uma vez (ADR 0065). A motion é a do quadro
-- (SLG, MLG ou PLG). Mesmas regras de criar negócio pela tela (opportunity_create, migration 0101):
-- capacidade `pipeline.deals`; o BDR (escopo "own") só cria negócio para si.
-- Cada conta entra na primeira etapa do quadro, com valor 0 (ninguém inventa valor) e a chance padrão da etapa.
-- Conta que já tem negócio ativo naquele quadro não duplica; conta de outro cliente é ignorada.
-- A regra fica numa função interna, usada pela tela e pela proposta do agente (migration 0129).
-- ==============================================================================

CREATE OR REPLACE FUNCTION internal.levar_contas_ao_quadro(
  p_workspace_id UUID, p_pipeline_id UUID, p_account_ids UUID[], p_dono_padrao UUID, p_dono_fixo BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_quadro public.pipelines;
  v_etapa TEXT;
  v_prob INTEGER;
  v_topo INTEGER;
  v_pedidas UUID[] := ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(p_account_ids, '{}')) AS x WHERE x IS NOT NULL);
  v_conta public.accounts;
  v_dono UUID;
  v_id UUID;
  v_ids UUID[] := '{}';
  v_ja INTEGER := 0;
  v_validas INTEGER := 0;
BEGIN
  IF cardinality(v_pedidas) > 500 THEN
    RAISE EXCEPTION 'Leve no máximo 500 contas por vez.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_quadro FROM public.pipelines WHERE id = p_pipeline_id AND workspace_id = p_workspace_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quadro não encontrado neste workspace.' USING ERRCODE = '42501'; END IF;
  v_etapa := COALESCE(v_quadro.stage_order->>0, 'entrada');
  SELECT default_probability INTO v_prob FROM public.stage_definitions WHERE stage_key = v_etapa;
  SELECT COALESCE(min(position), 1) - 1 INTO v_topo FROM public.opportunities WHERE pipeline_id = v_quadro.id AND stage_key = v_etapa;

  FOR v_conta IN SELECT * FROM public.accounts a
                  WHERE a.workspace_id = p_workspace_id AND a.id = ANY (v_pedidas) ORDER BY a.name LOOP
    v_validas := v_validas + 1;
    IF EXISTS (SELECT 1 FROM public.opportunities o WHERE o.pipeline_id = v_quadro.id AND o.account_id = v_conta.id AND o.status = 'ativa') THEN
      v_ja := v_ja + 1;
      CONTINUE;
    END IF;
    -- Dono: fixo (BDR) é sempre quem levou; senão, o dono da conta (se ativo) ou quem levou.
    v_dono := CASE WHEN p_dono_fixo THEN p_dono_padrao
                   WHEN EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.id = v_conta.owner_member_id AND m.workspace_id = p_workspace_id AND m.status = 'active')
                     THEN v_conta.owner_member_id
                   ELSE p_dono_padrao END;
    INSERT INTO public.opportunities (workspace_id, pipeline_id, account_id, stage_key, title, amount, win_probability, health, position, owner_member_id, status)
    VALUES (p_workspace_id, v_quadro.id, v_conta.id, v_etapa, v_conta.name, 0, COALESCE(v_prob, 10), 'no_prazo', v_topo, v_dono, 'ativa')
    RETURNING id INTO v_id;
    v_topo := v_topo - 1;
    v_ids := v_ids || v_id;
  END LOOP;
  RETURN jsonb_build_object('criados', cardinality(v_ids), 'ja_estavam', v_ja, 'ignoradas', cardinality(v_pedidas) - v_validas, 'ids', to_jsonb(v_ids),
                            'quadro', v_quadro.name, 'etapa', v_etapa);
END;
$$;
REVOKE ALL ON FUNCTION internal.levar_contas_ao_quadro(UUID, UUID, UUID[], UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.opportunity_add_accounts(
  p_workspace_id UUID, p_member_id UUID, p_pipeline_id UUID, p_account_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_escopo TEXT;
  v_r JSONB;
BEGIN
  v_escopo := internal.exigir_escopo(p_workspace_id, p_member_id, 'pipeline.deals');
  v_r := internal.levar_contas_ao_quadro(p_workspace_id, p_pipeline_id, p_account_ids, p_member_id, v_escopo = 'own');
  IF (v_r->>'criados')::int > 0 THEN
    PERFORM public.audit_write(p_workspace_id, auth.uid(), 'opportunity.bulk_created', 'pipeline', p_pipeline_id::text,
      jsonb_build_object('criados', v_r->'criados', 'etapa', v_r->'etapa'));
  END IF;
  RETURN v_r - 'quadro' - 'etapa';
END;
$$;
REVOKE ALL ON FUNCTION public.opportunity_add_accounts(UUID, UUID, UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.opportunity_add_accounts(UUID, UUID, UUID, UUID[]) TO authenticated, service_role;
