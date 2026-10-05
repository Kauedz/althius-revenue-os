# ADR 0039: Âncora do topo da corrente de auditoria

## Contexto
A ADR 0038 trouxe a auditoria encadeada por hash. Ela acusa linha alterada, linha apagada no meio e corrente rompida, mas **não** acusa apagar as últimas linhas: não existe linha seguinte para mostrar o buraco.

## Decisão
1. Tabela `public.audit_anchors`: uma "foto" (posição + hash) do topo da corrente de cada workspace. Imutável (UPDATE e DELETE barrados, exceto a remoção do workspace inteiro, que leva as âncoras em cascata). RLS ligada e nenhuma política: tela e agentes não enxergam a tabela.
2. `public.audit_anchor_snapshot()` tira a foto. Função de sistema: só `service_role` executa. É idempotente e **nunca fotografa corrente já quebrada**, para não legitimar adulteração.
3. `public.audit_verify_chain` passa a acusar `topo_apagado` (a corrente ficou menor que a última foto) e `ancora_divergente` (a posição existe, mas o hash é outro: corrente reescrita com hashes recalculados).
4. A tela Saúde considera também workspaces que só têm âncora (corrente inteira apagada).

## Consequências
- Quem apaga as últimas linhas ou reescreve a corrente passa a ser detectado, **desde que a âncora seja anterior à adulteração**. O que foi apagado antes da primeira foto continua invisível.
- A âncora mora no mesmo banco. Quem tem acesso de dono do banco e desliga também a trava da tabela de âncoras ainda consegue apagar as duas. Mitigação futura: copiar a foto para fora do banco.
- **Pendente:** nada agenda a foto ainda. Falta um job periódico no backend (`src/server/`) chamando `audit_anchor_snapshot()`, e a cópia externa.
