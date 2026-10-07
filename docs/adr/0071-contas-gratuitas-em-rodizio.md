# ADR 0071 — Contas gratuitas em rodízio (Apify e Unipile) antes do primeiro cliente

Status: aceita
Data: 2026-10-07
Relacionadas: 0049 (rodízio de chaves da Apify), 0051 (Hermes por assinatura, só para testes), 0069, 0070.

## Contexto
Até entrar o primeiro cliente, a Althius roda numa VPS básica só para o Nan e o sócio, com contas gratuitas: cinco da Apify (cada uma com limite no mês) e cinco da Unipile (cada uma com 7 dias de teste). Quando entrar o primeiro cliente, as contas passam a ser pagas e a VPS sobe de plano. O Hermes Agent roda dentro do mesmo projeto, entrando no modelo pelo login do Codex/ChatGPT (ADR 0051).

## Decisão
1. **Apify: uma conta que esgotou o mês some por horas e a próxima assume.** O pool já fazia rodízio; agora distingue "limite do mês esgotado" (402, ou 403 com cara de limite) de "chave recusada" (401, ou 403 comum). A conta esgotada fica de molho por 6 horas (a Apify renova no ciclo de cada conta, que não é o mês do calendário), a tela do cofre mostra "Limite do mês esgotado nesta conta" em vez de "chave recusada", e as outras seguem trabalhando. Todas esgotadas: erro claro, nunca resultado inventado. Vale para sinais, enriquecimento e prospecção (todos usam o mesmo pool).
2. **Unipile: trocar de conta (ou de ponte) não perde o histórico.** Troca-se a chave e o endereço no cofre (tela do superadmin); a sincronia (ADR 0070) vê que as contas conectadas não existem na conta nova e as marca "desconectada"; cada pessoa recebe o pop-up (item 3) e conecta de novo. Como a ponte nova nunca viu o id antigo, o botão Conectar passa a pedir uma conexão **nova** (não "reconectar") quando a conta está desconectada; o registro, as conversas e as mensagens são os mesmos.
3. **Pop-up quando uma conta cai.** A tela confere as conexões da própria pessoa ao entrar e a cada minuto; conta em "desconectada" ou "pede nova autorização" abre um pop-up com o canal, o motivo, "o histórico continua guardado" e o botão "Reconectar agora" (leva à Caixa de entrada). Aparece uma vez por conta e estado, e só para a dona da conta. Além do pop-up, a notificação no sino já existia.
4. **Webhooks de cada conta nova da Unipile** (v1): \`npm run unipile:webhooks\` registra os 4 que a Althius usa (mensagens, e-mail, estado das contas, novas relações) com o cabeçalho secreto. Só mostra o que faria; \`--aplicar\` cria.
5. **Hermes na mesma VPS**, pelo login do Codex: o que a ADR 0051 já definiu. Os modelos \`gpt-5.6-luna\` e \`gpt-6-luna\` aparecem nas tabelas do Hermes; qual a conta enxerga se descobre depois do login (\`hermes model\`). Continua **só para testes**: antes de atender cliente pagante o dono confere os termos da OpenAI e a produção volta para chave de API pelo gateway (ADR 0050).

## Consequências
- Migration 146 (conexão nova quando desconectada) e teste 00096; teste de tela do pop-up; testes do rodízio quando a conta esgota.
- A troca de conta da Unipile continua exigindo um "Conectar" por pessoa e canal; o que muda é que nada do CRM se perde e a tela avisa.

## Limites conhecidos
- A mensagem exata da Apify para limite do mês foi reconhecida por palavras (limite, uso, crédito, excedido) em respostas 402 e 403; se a Apify mudar o texto, a conta cairá no caminho de "chave recusada" (mesmo efeito prático: a próxima assume, por 1 minuto em vez de 6 horas).
- O pop-up depende de o serviço de envio (que roda a sincronia) estar no ar com a chave da Unipile: sem ele, a tela só sabe o que o banco sabe.
