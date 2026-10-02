-- ==============================================================================
-- Test: 00015_cadences_and_tasks.sql
-- Verifies Ticket 08 - Cadences (Auto vs Manual), Tasks & Auto-Pause on Response
-- ==============================================================================

BEGIN;
SELECT * FROM no_plan();
-- 1. Setup mock workspace, members, account, contact and channel
INSERT INTO public.workspaces (id, name, slug) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Evolut Trading', 't-evolut')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workspace_members (id, workspace_id, user_id, role, status) VALUES 
  ('87eb998f-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bdr', 'active')
ON CONFLICT (workspace_id, user_id) DO NOTHING;

INSERT INTO public.accounts (id, workspace_id, name, domain, owner_member_id) VALUES 
  ('acc00000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Hospital São Lucas', 'saolucas.com.br', '87eb998f-0000-0000-0000-000000000001');

INSERT INTO public.contacts (id, workspace_id, account_id, name, job_title) VALUES 
  ('76485a2b-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'acc00000-0000-0000-0000-000000000001', 'Dr. Roberto Silveira', 'Diretor de TI');

INSERT INTO public.contact_channels (workspace_id, contact_id, type, value, position) VALUES 
  ('11111111-1111-1111-1111-111111111111', '76485a2b-0000-0000-0000-000000000001', 'whatsapp', '+5511987654321', 1);

INSERT INTO public.messaging_accounts (id, workspace_id, member_id, provider, unipile_account_id, status) VALUES 
  ('30a03713-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '87eb998f-0000-0000-0000-000000000001', 'whatsapp', 'unipile_wa_bdr_01', 'connected');

-- 2. Create Cadence with Step 1 (Auto Email) and Step 2 (Manual LinkedIn)
INSERT INTO public.cadences (id, workspace_id, name, status) VALUES 
  ('cad00000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Cadência Enterprise D0-D7', 'ativa');

INSERT INTO public.cadence_steps (id, workspace_id, cadence_id, step_number, channel, execution_mode, target_position, body) VALUES 
  ('f175139f-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'cad00000-0000-0000-0000-000000000001', 1, 'email', 'auto', 0, 'Primeiro e-mail de abordagem'),
  ('f175139f-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'cad00000-0000-0000-0000-000000000001', 2, 'linkedin', 'manual', 2, 'Convite com nota personalizada');

-- 3. Integrity Test: Auto execution mode MUST fail on LinkedIn or Call
SELECT throws_ok(
  $$
    INSERT INTO public.cadence_steps (workspace_id, cadence_id, step_number, channel, execution_mode, target_position) VALUES 
      ('11111111-1111-1111-1111-111111111111', 'cad00000-0000-0000-0000-000000000001', 3, 'linkedin', 'auto', 4);
  $$,
  '23514', -- check_violation
  NULL,
  'Integridade: Modo "auto" DEVE ser rejeitado para LinkedIn (permitido apenas em e-mail e whatsapp)'
);

-- 4. Enroll contact into Cadence
INSERT INTO public.cadence_enrollments (id, workspace_id, cadence_id, contact_id, status, current_step_number) VALUES 
  ('c8bdab05-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'cad00000-0000-0000-0000-000000000001', '76485a2b-0000-0000-0000-000000000001', 'ativa', 1);

-- 5. Test Auto-Pause upon response: Ingest a message from Dr. Roberto
SELECT ok(
  (public.unipile_ingest_message(
    'unipile_wa_bdr_01',
    'whatsapp',
    '+5511987654321',
    'chat_roberto',
    'msg_test_cad_pause',
    'Recebi sua mensagem e gostaria de conversar',
    false,
    'positiva'
  )->>'action') = 'persisted',
  'Ingestao da resposta do contato efetuada'
);

-- Verify cadence enrollment automatically paused
SELECT is(
  (SELECT status FROM public.cadence_enrollments WHERE id = 'c8bdab05-0000-0000-0000-000000000001'),
  'pausada_resposta',
  'Pausa de Cadência: Inscrição deve mudar automaticamente para pausada_resposta'
);

-- 6. Test Task Creation and "Enviar agora"
INSERT INTO public.tasks (id, workspace_id, title, channel, account_id, contact_id, assignee_member_id, status, due_at, note) VALUES 
  ('e19bd44a-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Conectar no LinkedIn', 'linkedin', 'acc00000-0000-0000-0000-000000000001', '76485a2b-0000-0000-0000-000000000001', '87eb998f-0000-0000-0000-000000000001', 'pendente', now(), 'Enviar convite com nota sobre novas vagas');

SELECT is(
  (public.task_send_now('e19bd44a-0000-0000-0000-000000000001'::uuid, '87eb998f-0000-0000-0000-000000000001'::uuid)->>'status'),
  'concluida',
  'Enviar agora: Tarefa manual executada com sucesso e marcada como concluida'
);

SELECT is(
  (SELECT status FROM public.tasks WHERE id = 'e19bd44a-0000-0000-0000-000000000001'),
  'concluida',
  'Tarefa: Status da tarefa no banco deve estar como concluida'
);

SELECT * FROM finish();
ROLLBACK;