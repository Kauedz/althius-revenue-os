# ADR 0025: Equipe persistida e envio de convites pendente atrás de interface
## Contexto
A tela de Workspace e membros apenas lia o banco: convites e alterações ficavam na memória. A tarefa autorizada pelo dono exige gravar convites, mudar papel e suspender, com hierarquia por workspace e Auditoria. As permissões antigas de escrita direta permitiam contornar essas regras.

## Decisão
- Migration 0031: convites separados de membros, sem criar usuários fictícios no Auth. A chave de idempotência identifica cada pedido, único por workspace. Convites pendentes por e-mail também são únicos, normalizados e valem por sete dias.
- Hierarquia definida explicitamente pelo dono nesta tarefa: superadmin > estrategista > clevel > bdr. Pode atribuir o próprio nível ou inferior; BDR não administra equipe. O papel do autor vem do workspace da ação. Mudança no próprio papel é proibida.
- Remover na tela revoga acesso por suspensão; mantém vínculos e histórico. Não é exclusão física, nem desatribui tarefas nesta fatia. Último C-level ativo não pode ser suspenso nem deixar esse papel. Bloqueio de linha do workspace serializa essas verificações.
- Escrita direta de membros e convites fica fechada. RPCs de tela validam identidade e capacidade, sem EXECUTE para PUBLIC/anon; gravações chamam public.audit_write.
- TODO autorizado: implementar envio e aceite reais de e-mail no backend, atrás da interface nossa EnvioConviteEquipe. A implementação disponível apenas mantém envio pendente; testes usam versão falsa, com registro e chave de idempotência, sem API externa. Nenhuma tela afirma que um e-mail foi enviado enquanto isso estiver pendente.
- O futuro backend deve conferir convite pendente, validade, e-mail verificado e papel autorizado no aceite; nunca permitir que a pessoa aceite convite de e-mail alheio. Registrar resultado do provedor e repetir pelo mesmo identificador, sem duplicar envio. Não levar segredos ao navegador.

## Consequências e congruência
Convite registrado ainda não dá acesso e não envia e-mail; a tela explica a pendência. O evento membro.papel_mudado registra autor, workspace e papéis anterior/novo; autorização passa a consultar o papel persistido.
A coluna “Quem nomeia” do documento descreve nomeação inicial (estrategista por superadmin), enquanto a matriz team.invite permite atribuir até o próprio nível. A instrução explícita do dono nesta tarefa confirma a hierarquia acima também para estrategista e superadmin, resolvendo essa ambiguidade para esta fatia. Nenhuma ADR anterior é desfeita.
