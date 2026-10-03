-- Alterar prazo passa pela mesma identidade e responsabilidade da conclusão.
CREATE OR REPLACE FUNCTION public.task_reschedule(p_task_id uuid,p_member_id uuid,p_due_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_membro public.workspace_members%ROWTYPE; v_tarefa public.tasks%ROWTYPE; v_escopo text;
BEGIN
  PERFORM public.assert_caller_is_member(p_member_id);
  SELECT m.* INTO v_membro FROM public.workspace_members m JOIN public.workspaces w ON w.id=m.workspace_id
  WHERE m.id=p_member_id AND m.status='active' AND w.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Você não participa deste workspace como membro ativo.' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_tarefa FROM public.tasks WHERE id=p_task_id AND workspace_id=v_membro.workspace_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Você não tem acesso a esta tarefa neste workspace.' USING ERRCODE='42501'; END IF;
  SELECT scope INTO v_escopo FROM public.role_permissions WHERE role_id=v_membro.role AND capability_key='tasks.assign';
  IF COALESCE(v_escopo,'none') NOT IN ('all','assigned','own') OR (v_escopo='own' AND v_tarefa.assignee_member_id<>p_member_id) THEN
    RAISE EXCEPTION 'Você só pode adiar tarefas sob sua responsabilidade.' USING ERRCODE='42501';
  END IF;
  IF p_due_at IS NULL OR NOT isfinite(p_due_at) THEN RAISE EXCEPTION 'Escolha uma data e hora válidas.' USING ERRCODE='22023'; END IF;
  IF v_tarefa.status='concluida' THEN RAISE EXCEPTION 'Uma tarefa concluída não pode ser adiada.' USING ERRCODE='23514'; END IF;
  IF v_tarefa.due_at=p_due_at THEN RETURN to_jsonb(v_tarefa); END IF;
  UPDATE public.tasks SET due_at=p_due_at WHERE id=p_task_id RETURNING * INTO v_tarefa;
  PERFORM public.audit_write(v_tarefa.workspace_id,v_membro.user_id,'tarefa.adiada','task',p_task_id::text,jsonb_build_object('due_at',p_due_at));
  RETURN to_jsonb(v_tarefa);
END;
$function$;
REVOKE ALL ON FUNCTION public.task_reschedule(uuid,uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.task_reschedule(uuid,uuid,timestamptz) TO authenticated;