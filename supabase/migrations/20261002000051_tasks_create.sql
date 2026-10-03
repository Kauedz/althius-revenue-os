-- Criação de tarefas por ação de tela, com responsável validado no workspace.
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS idempotency_key uuid;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS creation_request jsonb;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS created_by_member_id uuid REFERENCES public.workspace_members(id);
CREATE UNIQUE INDEX IF NOT EXISTS tasks_workspace_request ON public.tasks(workspace_id,idempotency_key);

CREATE OR REPLACE FUNCTION public.task_create(
  p_workspace_id uuid,p_member_id uuid,p_idempotency_key uuid,p_task jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_membro public.workspace_members%ROWTYPE;
  v_tarefa public.tasks%ROWTYPE;
  v_conta public.accounts%ROWTYPE;
  v_responsavel uuid;
  v_conta_id uuid;
  v_contato_id uuid;
  v_prazo timestamptz;
  v_titulo text;
  v_escopo text;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  PERFORM 1 FROM public.workspaces w JOIN public.workspace_members m ON m.workspace_id=w.id
  WHERE w.id=p_workspace_id AND w.status='active' AND m.id=p_member_id AND m.status='active' FOR UPDATE OF w;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Você não participa deste workspace como membro ativo.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_membro FROM public.workspace_members WHERE id=p_member_id;
  SELECT scope INTO v_escopo FROM public.role_permissions
  WHERE role_id=v_membro.role AND capability_key='tasks.assign';
  IF COALESCE(v_escopo,'none') NOT IN ('all','assigned','own') THEN
    RAISE EXCEPTION 'Você não pode criar tarefas neste workspace.' USING ERRCODE='42501';
  END IF;
  IF p_idempotency_key IS NULL OR jsonb_typeof(p_task) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'O pedido de criação da tarefa é inválido.' USING ERRCODE='22023';
  END IF;
  v_titulo := btrim(p_task->>'title');
  v_prazo := (p_task->>'due_at')::timestamptz;
  IF COALESCE(v_titulo,'')='' OR v_prazo IS NULL THEN
    RAISE EXCEPTION 'Defina o título e a data da tarefa.' USING ERRCODE='22023';
  END IF;
  v_responsavel := COALESCE((p_task->>'assignee_member_id')::uuid,p_member_id);
  IF (v_escopo='own' AND v_responsavel<>p_member_id) OR NOT EXISTS (
    SELECT 1 FROM public.workspace_members WHERE id=v_responsavel AND workspace_id=p_workspace_id AND status='active'
  ) THEN
    RAISE EXCEPTION 'O responsável deve estar ativo neste workspace; BDR cria tarefa somente para si.' USING ERRCODE='42501';
  END IF;
  v_conta_id := (p_task->>'account_id')::uuid;
  v_contato_id := (p_task->>'contact_id')::uuid;
  IF v_contato_id IS NOT NULL THEN
    SELECT account_id INTO v_conta.id FROM public.contacts WHERE id=v_contato_id AND workspace_id=p_workspace_id;
    IF NOT FOUND OR (v_conta_id IS NOT NULL AND v_conta_id<>v_conta.id) THEN
      RAISE EXCEPTION 'O contato não pertence à conta deste workspace.' USING ERRCODE='42501';
    END IF;
    v_conta_id := v_conta.id;
  END IF;
  IF v_conta_id IS NOT NULL THEN
    SELECT * INTO v_conta FROM public.accounts WHERE id=v_conta_id AND workspace_id=p_workspace_id;
    IF NOT FOUND OR (v_escopo='own' AND v_conta.owner_member_id IS DISTINCT FROM p_member_id) THEN
      RAISE EXCEPTION 'A conta não está sob sua responsabilidade neste workspace.' USING ERRCODE='42501';
    END IF;
  END IF;
  SELECT * INTO v_tarefa FROM public.tasks WHERE workspace_id=p_workspace_id AND idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF v_tarefa.created_by_member_id IS DISTINCT FROM p_member_id OR v_tarefa.creation_request IS DISTINCT FROM p_task THEN
      RAISE EXCEPTION 'Esta solicitação já foi usada para outra tarefa. Abra uma nova tarefa.' USING ERRCODE='22023';
    END IF;
    RETURN to_jsonb(v_tarefa);
  END IF;
  INSERT INTO public.tasks(workspace_id,title,channel,account_id,contact_id,assignee_member_id,
    agent_id,due_at,status,note,source,idempotency_key,created_by_member_id,creation_request,completed_at)
  VALUES(p_workspace_id,v_titulo,p_task->>'channel',v_conta_id,v_contato_id,v_responsavel,
    p_task->>'agent_id',v_prazo,COALESCE(p_task->>'status','pendente'),p_task->>'note','manual',p_idempotency_key,p_member_id,p_task,CASE WHEN p_task->>'status'='concluida' THEN now() END)
  RETURNING * INTO v_tarefa;
  INSERT INTO public.notifications(workspace_id,recipient_member_id,type,title,body,entity_type,entity_id)
  VALUES(p_workspace_id,v_responsavel,'task_created','Nova tarefa: '||v_titulo,'Uma tarefa foi atribuída a você.','task',v_tarefa.id);
  PERFORM public.audit_write(p_workspace_id,v_membro.user_id,'tarefa.criada','task',v_tarefa.id::text,
    jsonb_build_object('assignee_member_id',v_responsavel,'due_at',v_prazo,'idempotency_key',p_idempotency_key));
  RETURN to_jsonb(v_tarefa);
END;
$function$;
REVOKE ALL ON FUNCTION public.task_create(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.task_create(uuid,uuid,uuid,jsonb) TO authenticated;
