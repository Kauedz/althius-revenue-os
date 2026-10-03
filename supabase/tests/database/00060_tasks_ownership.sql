-- Seam: RPC pública task_send_now; autorização do responsável e isolamento por workspace.
BEGIN;
SELECT no_plan();
INSERT INTO public.tasks (id,workspace_id,title,assignee_member_id,status)
VALUES ('fa600000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',
        'Teste de isolamento de tarefa','d0000000-0000-0000-0000-000000000009','pendente');
INSERT INTO public.tasks (id,workspace_id,title,assignee_member_id,status)
VALUES ('fa600000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001',
        'Tarefa de outro BDR','d0000000-0000-0000-0000-000000000006','pendente');
INSERT INTO public.tasks (id,workspace_id,title,assignee_member_id,status)
VALUES ('fa600000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001',
        'Tarefa do próprio BDR','d0000000-0000-0000-0000-000000000004','pendente');
SET LOCAL "request.jwt.claims" = '{"sub":"e0000000-0000-0000-0000-000000000004"}';
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$ SELECT public.task_send_now('fa600000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000004') $$,
  '42501',NULL,'BDR da Evolut não conclui tarefa da Grão Norte');
SELECT throws_ok(
  $$ SELECT public.task_send_now('fa600000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000004') $$,
  '42501',NULL,'BDR não conclui tarefa de outro responsável na Evolut');
SELECT throws_ok(
  $$ UPDATE public.tasks SET status='concluida' WHERE id='fa600000-0000-0000-0000-000000000003' $$,
  '42501',NULL,'Escrita direta não contorna o registro de conclusão');
SELECT is(public.task_send_now('fa600000-0000-0000-0000-000000000003','d0000000-0000-0000-0000-000000000004')->>'status',
  'concluida','O BDR conclui a própria tarefa pela RPC');
SELECT is((SELECT count(*)::integer FROM public.tasks WHERE id IN ('fa600000-0000-0000-0000-000000000001','fa600000-0000-0000-0000-000000000002','fa600000-0000-0000-0000-000000000003')),1,'BDR lê somente a própria tarefa');
RESET ROLE;
UPDATE public.workspace_members SET status='suspended' WHERE id='d0000000-0000-0000-0000-000000000007';
SET LOCAL "request.jwt.claims" = '{"sub":"e0000000-0000-0000-0000-000000000001"}';
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*)::integer FROM public.tasks WHERE id='fa600000-0000-0000-0000-000000000001'),0,'papel superadmin na Evolut não libera leitura no Grão Norte suspenso');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
