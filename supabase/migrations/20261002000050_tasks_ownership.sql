-- Conclusão de tarefa: identidade e workspace são conferidos antes da gravação.
CREATE OR REPLACE FUNCTION public.task_send_now(p_task_id uuid, p_member_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  v_membro public.workspace_members%ROWTYPE;
  v_tarefa public.tasks%ROWTYPE;
  v_escopo text;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  SELECT m.* INTO v_membro
  FROM public.workspace_members m JOIN public.workspaces w ON w.id=m.workspace_id
  WHERE m.id=p_member_id AND m.status='active' AND w.status='active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Você não participa deste workspace como membro ativo.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_tarefa FROM public.tasks
  WHERE id=p_task_id AND workspace_id=v_membro.workspace_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Você não tem acesso a esta tarefa neste workspace.' USING ERRCODE='42501';
  END IF;
  SELECT scope INTO v_escopo FROM public.role_permissions
  WHERE role_id=v_membro.role AND capability_key='tasks.assign';
  IF COALESCE(v_escopo,'none') NOT IN ('all','assigned','own')
     OR (v_escopo='own' AND v_tarefa.assignee_member_id<>v_membro.id) THEN
    RAISE EXCEPTION 'Você só pode concluir tarefas sob sua responsabilidade.' USING ERRCODE='42501';
  END IF;
  IF v_tarefa.status='concluida' THEN
    RETURN jsonb_build_object('success',true,'status','concluida','task_id',v_tarefa.id);
  END IF;
  UPDATE public.tasks SET status='concluida',completed_at=now() WHERE id=v_tarefa.id;
  PERFORM public.audit_write(v_tarefa.workspace_id,v_membro.user_id,'tarefa.concluida','task',v_tarefa.id::text,
    jsonb_build_object('title',v_tarefa.title,'channel',v_tarefa.channel,'envio_real',false));
  RETURN jsonb_build_object('success',true,'status','concluida','task_id',v_tarefa.id);
END;
$function$;
REVOKE ALL ON FUNCTION public.task_send_now(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.task_send_now(uuid,uuid) TO authenticated;

-- Toda conclusão passa pela RPC: sem alteração direta que pule a Auditoria.
REVOKE INSERT,UPDATE,DELETE ON public.tasks FROM PUBLIC,anon,authenticated;

-- O papel de outro workspace não dá acesso a tarefas daqui.
DROP POLICY IF EXISTS "Members see tasks in workspace" ON public.tasks;
CREATE POLICY "Members see tasks in workspace" ON public.tasks FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.workspace_members m JOIN public.workspaces w ON w.id=m.workspace_id
  WHERE m.workspace_id=tasks.workspace_id AND m.user_id=auth.uid() AND m.status='active' AND w.status='active'
    AND (m.role IN ('superadmin','estrategista','clevel') OR tasks.assignee_member_id=m.id)
));