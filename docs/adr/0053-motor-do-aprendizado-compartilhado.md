# ADR 0053 — Motor do aprendizado compartilhado entre contas

Status: aceita
Data: 2026-10-06
Relacionadas: 0052 (consentimento e regras), 0024 (isolamento e vazamento), 0042 (cadência), 0023 (segurança do banco)

## Contexto
A ADR 0052 guardou o consentimento e fixou as obrigações do motor. Este é o motor: aprende o que funciona nas contas que aceitaram e sugere para contas parecidas, de forma probabilística.

## O que ele mede (e só isso)
Para cada **envio de cadência** (últimos 180 dias) de um cliente que aceitou: o **segmento da conta** (texto normalizado em minúsculas), o **canal**, o **passo** da cadência e se o contato **respondeu** em até 14 dias (qualquer mensagem de entrada na mesma conversa depois do envio). Também conta quantas respostas foram classificadas como positivas (`intent = positiva` da conversa). Isso é **correlação medida**, não prova de causa: um passo pode responder mais por outro motivo (lista melhor, época do ano).

## Regras (cumprem o item 6 da ADR 0052)
1. **Só quem aceitou** entra (`internal.learning_workspaces_aceitos()`), tanto para contribuir quanto para receber.
2. **Base agregada sem cliente** (`internal.learning_agregados`: segmento, canal, passo, totais). Não tem coluna de cliente, texto, nome nem e-mail. É **refeita do zero** a cada rodada: quem desliga some dos números na rodada seguinte.
3. **Mínimos duros no banco** (não dá para baixar por parâmetro): pelo menos **3 clientes** diferentes por padrão, pelo menos **20 envios** (o padrão do serviço é 30) e **nenhum cliente com mais de metade dos envios** do padrão (senão o número seria quase só dele). Como o segmento é texto livre, ele só aparece se **3 ou mais clientes** usam exatamente o mesmo texto (k-anonimato do próprio rótulo).
4. **Probabilístico:** um padrão só vira sugestão se o **limite inferior (95%, Wilson)** da taxa de resposta for **maior que a média geral** de todos os clientes que compartilham. Amostra pequena fica com limite baixo e não passa.
5. **Para quem sugerir:** cliente que aceitou, tem **conta ativa naquele segmento** e **ainda não faz tão bem** (taxa própria menor, com pelo menos 10 envios) **ou nunca enviou** aquele passo naquele canal. O texto diz a taxa do padrão, a média geral e, se houver, a taxa do próprio cliente; para quem nunca enviou, diz isso e não inventa número.
6. **Só sugere.** A sugestão entra em `learning_entries` (origem `compartilhado`, status `sugerida`, agente comercial); quem aplica ou descarta é o estrategista, pelo fluxo que já existe. Descartada não volta (`chave_padrao` única por cliente) e rodar de novo não duplica. Cada sugestão vai para a auditoria do cliente (`learning.shared_suggestion`, só com a chave do padrão).
7. **Desligou:** perde as sugestões pendentes na rodada seguinte. As já aplicadas ou descartadas ficam (são números agregados, sem dado de ninguém).
8. **Teste de vazamento** (pgTAP 00068) com dados marcados (canário) em nome de empresa, contato, texto enviado, texto recebido e cliente: nada aparece na base agregada nem nas sugestões, nenhuma sugestão cita o id de outro cliente.

## Execução
Serviço `aprendizado` no Docker, a cada `APRENDIZADO_INTERVALO_HORAS` (padrão 6). Só o sistema roda o motor (`aprendizado_executar` só para `service_role`). O log só mostra números.

## Limites conhecidos (honestos)
- Só enxerga **cadências** (envios com resposta). Resultados de campanha paga, reunião marcada e negócio ganho **ainda não** entram.
- A intenção positiva é da **conversa**; se houver vários envios na mesma conversa, todos contam a mesma intenção.
- Muitos padrões testados ao mesmo tempo aumentam a chance de um parecer bom por acaso; por isso o limite é conservador e o motor só **sugere**.
- Sugestão não muda nada sozinha e não mede o efeito depois de aplicada (o campo de impacto mostra a taxa do padrão, não um ganho comprovado).
