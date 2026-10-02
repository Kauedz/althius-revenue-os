# 24: Builder Frontend de Cadências, Aprovação de Copy e Geração de Tasks

**What to build:**
Interface visual para desenhar sequências de múltiplos canais (e-mail, social, tarefa manual) e gerador de tarefas: transforma inscrições ativas em linhas acionáveis na tabela `public.tasks`, aplicando trava de aprovação humana (`requires_human_approval`) para templates e cadências novos.

**Blocked by:** 23: Modelo e Engine de Cadência e Inscrição de Leads

**Status:** ready-for-agent

- [ ] Criação da tabela `public.tasks` e interface visual do Sequence Builder para adicionar/reordenar etapas.
- [ ] O primeiro lote de mensagens de uma cadência recém-ativada exige obrigatoriamente revisão humana antes de ser liberado para envio.
- [ ] Geração determinística de tarefas: o motor cria tarefas com campos de mensagem sugerida preenchidos pela IA.
- [ ] Teste de interface verifica a criação de uma cadência de 3 passos e a validação do formulário de etapas.
