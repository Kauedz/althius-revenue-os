-- Seam: RPC pública task_reschedule, alteração persistida do prazo da própria tarefa.
BEGIN;
SELECT no_plan();
SET LOCAL "request.jwt.claims" = '{"sub":"e0000000-0000-0000-0000-000000000004"}';
SET LOCAL ROLE authenticated;
SELECT lives_ok($teste$
DO $corpo$
DECLARE tarefa jsonb; adiada jsonb;
BEGIN
  tarefa:=public.task_create('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000004',
    'fc620000-0000-0000-0000-000000000001','{"title":"Adiar T1","channel":"call","due_at":"2026-10-03T14:00:00Z"}');
  adiada:=public.task_reschedule((tarefa->>'id')::uuid,'d0000000-0000-0000-0000-000000000004','2026-10-04T14:00:00Z');
  IF (adiada->>'due_at')::timestamptz IS DISTINCT FROM '2026-10-04T14:00:00Z'::timestamptz THEN
    RAISE EXCEPTION 'O novo prazo não foi registrado.';
  END IF;
END;
$corpo$;
$teste$,'BDR adia a própria tarefa e recebe o novo prazo');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;