-- Seam: RPC pública task_create; tarefa criada para o responsável informado.
BEGIN;
SELECT no_plan();
SET LOCAL "request.jwt.claims" = '{"sub":"e0000000-0000-0000-0000-000000000004"}';
SET LOCAL ROLE authenticated;
SELECT lives_ok($teste$
  DO $corpo$
  DECLARE tarefa jsonb;
  BEGIN
    tarefa := public.task_create(
      'a0000000-0000-0000-0000-000000000001',
      'd0000000-0000-0000-0000-000000000004',
      'fb610000-0000-0000-0000-000000000001',
      '{"title":"Revisar roteiro T1","assignee_member_id":"d0000000-0000-0000-0000-000000000004","due_at":"2026-10-03T14:00:00Z","channel":"call"}'::jsonb);
    IF tarefa->>'title' IS DISTINCT FROM 'Revisar roteiro T1' OR tarefa->>'id' IS NULL THEN
      RAISE EXCEPTION 'A criação não devolveu a tarefa registrada.';
    END IF;
  END;
  $corpo$;
$teste$,'BDR registra uma nova tarefa para si com título e identificador');
SELECT lives_ok($teste$
  DO $corpo$
  DECLARE primeira jsonb; repetida jsonb;
  BEGIN
    primeira := public.task_create('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000004',
      'fb610000-0000-0000-0000-000000000002','{"title":"Pedido repetido","due_at":"2026-10-03T14:00:00Z","channel":"call"}');
    repetida := public.task_create('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000004',
      'fb610000-0000-0000-0000-000000000002','{"title":"Pedido repetido","due_at":"2026-10-03T14:00:00Z","channel":"call"}');
    IF primeira->>'id' IS DISTINCT FROM repetida->>'id' THEN RAISE EXCEPTION 'A repetição duplicou a tarefa.'; END IF;
  END;
  $corpo$;
$teste$,'repetir a solicitação devolve a mesma tarefa');
SELECT throws_ok($teste$ SELECT public.task_create('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000004',
'fb610000-0000-0000-0000-000000000003','{"title":"Outro BDR","due_at":"2026-10-03T14:00:00Z","assignee_member_id":"d0000000-0000-0000-0000-000000000006"}') $teste$,
'42501',NULL,'BDR não atribui tarefa a outra pessoa');
SELECT throws_ok($teste$ SELECT public.task_create('b0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000004',
'fb610000-0000-0000-0000-000000000004','{"title":"Outro workspace","due_at":"2026-10-03T14:00:00Z"}') $teste$,
'42501',NULL,'Evolut não cria tarefa no Grão Norte');
SELECT throws_ok($teste$ SELECT public.task_create('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000003',
'fb610000-0000-0000-0000-000000000005','{"title":"Autor falso","due_at":"2026-10-03T14:00:00Z"}') $teste$,
'42501',NULL,'BDR não se passa pelo C-level');
SELECT ok(NOT has_function_privilege('anon','public.task_create(uuid,uuid,uuid,jsonb)','EXECUTE'),'anon não executa task_create');
SELECT ok(has_function_privilege('authenticated','public.task_create(uuid,uuid,uuid,jsonb)','EXECUTE'),'ação de tela tem GRANT explícito');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
