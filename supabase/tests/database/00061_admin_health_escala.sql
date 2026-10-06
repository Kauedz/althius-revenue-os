-- ==============================================================================
-- Test: 00061_admin_health_escala.sql
-- A saúde da plataforma não pode ficar mais lenta a cada linha de auditoria: a conferência da corrente roda uma vez
-- por cliente. Antes da correção (migration 0109), 400 linhas levavam dezenas de segundos.
-- ==============================================================================

BEGIN;
SELECT no_plan();

SELECT lives_ok($$
  SELECT public.audit_write('a0000000-0000-0000-0000-000000000001', NULL, 'teste.escala', 'teste', 'n' || g, '{}'::jsonb)
  FROM generate_series(1, 400) g
$$, '400 linhas de auditoria gravadas');

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000001", "role": "authenticated"}';
CREATE TEMP TABLE t0 ON COMMIT DROP AS SELECT clock_timestamp() AS ini;
GRANT SELECT ON t0 TO authenticated;
SELECT lives_ok($$ SELECT public.admin_health() $$, 'A saúde da plataforma responde');
SELECT ok((SELECT clock_timestamp() - ini < interval '3 seconds' FROM t0), 'Com centenas de linhas, a saúde responde em menos de 3 s');
SELECT ok((public.admin_health() @> '[{"nome": "Auditoria íntegra", "status": "OK"}]'::jsonb), 'Auditoria íntegra continua sendo conferida');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
