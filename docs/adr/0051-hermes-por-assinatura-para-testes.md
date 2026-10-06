# ADR 0051 — Hermes por assinatura (login do Codex) só para testes

Status: aceita (uso restrito a testes)
Data: 2026-10-06
Relacionadas: 0048 (Hermes por cliente), 0050 (gateway do modelo)

## Contexto
O dono quer testar os agentes sem custo de API. O Hermes Agent tem o provedor `openai-codex`, que entra por login (código no navegador) com a conta ChatGPT/Codex, sem chave de API. Os identificadores de modelo `gpt-5.6-luna` e `gpt-6-luna` aparecem nas tabelas do próprio Hermes; qual deles a conta enxerga depende do login (`hermes model` lista).

## Decisão
1. `npm run agentes:provisionar -- ... --modelo-oauth <nome-do-modelo>` gera os perfis com `provider: openai-codex`: **sem gateway, sem endereço e sem chave** no perfil. Rodar de novo **sem** a opção volta ao gateway (ADR 0050); o modo não fica preso.
2. O login é feito **uma vez, dentro do contêiner**: `docker exec -it hermes-<slug> hermes auth add openai-codex` (ou `--browser` se a organização bloquear o código; por SSH, túnel da porta 1455). A documentação do Hermes diz que os perfis leem o login do perfil padrão e que a renovação do token volta para lá; se algum agente ainda disser "sem credenciais", repita com `hermes -p <agente> auth add openai-codex`. **Não verificado com conta real aqui.**
3. **Só para teste.** Produção continua com chave de API pelo gateway (ADR 0050), porque a assinatura é de uma pessoa, tem limites do plano, exige login manual por contêiner (e pode expirar), e perde a medição de custo por cliente e a reserva automática. Não sabemos se os termos da OpenAI permitem atender clientes com assinatura pessoal: **o dono confere antes de qualquer uso além de teste**.
4. Sem login feito, o Hermes responde com a mensagem "Provider authentication failed… No Codex credentials stored" **como se fosse a resposta do agente**; no teste ela aparece no canal. Verificado em execução real com o contêiner oficial.

## Consequências
- Nenhuma mudança no banco nem nas telas.
- Mensagens e ferramentas dos agentes continuam passando só pelo MCP da Althius; o modo assinatura só troca de onde vem o modelo.
