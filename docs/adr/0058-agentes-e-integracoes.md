# ADR 0058 — Ponte dos agentes com os apps conectados (leitura e ação com aprovação)

Status: aceita (leitura e ação com aprovação)
Data: 2026-10-06
Relacionadas: 0043 (app controlado por agentes), 0045 (harness), 0048 (Hermes por cliente), 0056 (integrações do catálogo), 0057 (agentes conhecem a empresa)

## Contexto
Os apps (HubSpot, Notion, Apollo…) conectam por login da PESSOA (ADR 0056) e o token de cada pessoa fica cifrado no servidor. Os agentes só enxergavam o banco da Althius. O dono quer que eles consultem os apps conectados.

## Decisão
1. **O acesso é o de quem pediu** (decisão do dono, 06/10/2026): a pessoa da mensagem mais recente da rodada em andamento do agente no canal. O banco responde isso (`integration_agent_context`, só `service_role`). Sem rodada em andamento, não há solicitante e nenhum acesso é usado. Quem pediu sem ter conectado o app recebe o aviso "precisa conectar"; o acesso de outra pessoa nunca é usado no lugar.
2. **O workspace e a pessoa vêm do banco, nunca do pedido.** O agente só manda o token dele (`alt_agente_…`); campos de workspace ou membro no pedido são ignorados. O token do agente já confere pausa e isolamento por workspace.
3. **Duas rotas no serviço de integrações** (`/integracoes/agente/ferramentas` e `/chamar`), provadas pelo token do agente, **não** pelo login de uma pessoa. **Só pela rede interna do Docker:** o Caddy público responde 404 nesse caminho.
4. **Só leitura.** Só entram ferramentas que o servidor do app marca como somente leitura (`readOnlyHint`). Sem a marca, a ferramenta não é oferecida nem executada. A marca é conferida **a cada chamada**, no próprio servidor do app, nunca confiando no modelo. Escrita vira proposta e aprovação (ticket 05).
5. **O token do app nunca sai do serviço de integrações.** O agente e o modelo só recebem o resultado. O resultado vem marcado como dado externo, nunca ordem; cortado em 20.000 caracteres com aviso.
6. **Lista compacta.** As descrições de apps reais passam de 60 KB (o HubSpot) e confundiam o modelo. A lista traz nome e resumo (160 caracteres); o detalhe de uma ferramenta vem sob pedido.
7. **Auditoria** (`integration_agent_log`, tabela encadeada ADR 0038): agente, em nome de quem, app, ferramenta e resultado (`ok`, `erro`, `negado`). Nunca argumentos, tokens nem o conteúdo devolvido. A falha em auditar não derruba a leitura.
8. Duas ferramentas no servidor MCP do agente: `integracao_ferramentas` e `integracao_ler`. O endereço da ponte entra por `ALTHIUS_INTEGRACOES_URL` no perfil do Hermes.

## Ação nos apps (ticket 05): propor, aprovar, executar uma vez
9. **O agente nunca escreve num app.** Ele PROPÕE (`integracao_propor`: app, ferramenta, argumentos e motivo). A proposta vira uma aprovação de **operação** (C-level ou estrategista decide; `approval_type = execucao`) com o app, a conta, a ferramenta e os argumentos à vista. Para achar a ferramenta, `integracao_ferramentas` aceita `escrita=true`: lista as que mudam algo e **não são marcadas como destrutivas** (só para propor; nada roda).
10. **Só ferramentas marcadas como de escrita (`readOnlyHint: false`) e não destrutivas (`destructiveHint` diferente de verdadeiro).** Sem marca, de leitura (use `integracao_ler`) ou destrutiva: 403/400, sem proposta. A regra é a mesma na proposta, na listagem e na execução.
11. **Executa depois de aprovada, no máximo uma vez, com o acesso de quem pediu.** O banco guarda a ação (`internal.integration_actions`) e a entrega ao executor uma por vez (`SKIP LOCKED`), marcando "executando" ANTES de tocar no app. Falhou ou travou (10 minutos): vira "falhou" e **nunca é repetida sozinha**, porque a ação pode já ter acontecido no app. Recusada vira "cancelada". O executor roda no serviço de integrações (a cada 5 s), reconfere a ferramenta no servidor do app e avisa quem pediu do resultado (notificação e auditoria).
12. A proposta repetida (mesmo pedido, mesmas pessoas e argumentos, em qualquer ordem) tem a mesma chave de idempotência e não duplica a aprovação.

## Decisão pendente do dono: ferramentas que "podem apagar"
O HubSpot marca como destrutivas justamente as ferramentas de CRM (`manage_crm_objects`, que cria notas, tarefas e negócios, e outras). Pela regra do item 10, só sobram 4 ferramentas de escrita no HubSpot (propriedades, segmentos, pipelines, feedback). Opção B (recomendada): liberar as destrutivas **com aviso explícito na aprovação** ("pode apagar dados no app") e só com aprovação humana. Enquanto o dono não decidir, vale a regra estrita.

## Verificado de verdade (06/10/2026)
Hermes oficial, modelo do Codex, HubSpot real da conta do dono: a Zoe respondeu "O nome do portal conectado é Althius. Fonte: dados da organização no HubSpot.", a chamada de escrita (`manage_crm_objects`) foi recusada com 403 e as duas aparecem na auditoria. O HubSpot marca 18 das 29 ferramentas como somente leitura. Ação: a Zoe achou a ferramenta de escrita de segmentos, pediu a confirmação do resumo e registrou a proposta "Ação no HubSpot: manage_segment" (criar a lista estática TESTE ALTHIUS), pendente de aprovação. O executor (aprovar e rodar de fato) está coberto por testes de banco e de serviço com app falso; a execução real depende de o dono aprovar.

## Limites conhecidos
- Depende de o servidor do app marcar a leitura. Se um app não marcar, nada é oferecido (melhor do que arriscar).
- Se duas pessoas pedirem à mesma agente no mesmo instante, a rodada é uma só e vale a pessoa da mensagem mais recente.
- O Caddy só foi conferido por leitura (não subi o Caddy aqui).
