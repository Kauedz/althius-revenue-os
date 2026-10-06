# Conversar com os agentes no seu computador

Para testar a Zoe, o Jax, a Lia e o Neo com um modelo de IA de verdade, sem servidor. O modelo é o do **Codex, pelo seu login** (só para teste, ADR 0051). Em produção troca-se por chave de API, pelo gateway (ADR 0050).

## O que precisa estar ligado
1. **Docker Desktop** aberto.
2. O banco local: `npx supabase start`.
3. O app: `npm run dev` (http://localhost:3000).
4. (Se usar integrações) o serviço `webhooks`, como já fizemos.

## Passo a passo (uma vez)
1. **Preparar o Hermes** (cria os tokens, os perfis e sobe o contêiner `hermes-evolut`):
   `npm run agentes:local -- preparar`
   Padrão: cliente Evolut, responsável Aline (C-level) e modelo `gpt-6-luna`. Para outro modelo: `-- preparar --modelo gpt-5.6-luna`. *(Qual nome de modelo a sua conta enxerga depende do login; se um não existir, tente o outro.)*
2. **Entrar no Codex** (só na primeira vez):
   `docker exec -it hermes-evolut hermes auth add openai-codex`
   O comando mostra um link e um código. Abra o link no navegador, entre com a sua conta e digite o código.
3. **Ligar o ciclo dos agentes** (deixe esta janela aberta enquanto testa):
   `npm run agentes:local -- rodar`

## Testar
Entre no app como a Aline (`aline@evolut.com.br`, senha `althius-demo`), abra um canal com o agente e chame a Zoe. A política padrão é "só quando chamado" (ADR 0045): o agente não responde a toda mensagem. A resposta chega no canal em alguns segundos.

## Se algo não responder
- **Nada responde:** confira se o passo 3 está rodando e se o contêiner está de pé (`docker ps`). Sem o registro dos agentes (`docker/agentes-executores.local.json`), as mensagens esperam na fila: o sistema nunca inventa resposta.
- **Aparece "sem login do modelo" no log do ciclo:** falta o passo 2 (ou o login expirou). A mensagem de erro do Hermes não vai para o canal: o pedido volta para a fila e tenta de novo.
- **Pouca memória no computador:** o Hermes usa ~250 MB. Se o Windows reclamar, pare o painel e a análise de logs do Supabase (`docker stop supabase_studio_althius-revenue-os supabase_analytics_althius-revenue-os supabase_vector_althius-revenue-os`); não são necessários para o teste.

## O que este modo NÃO é
- Não é produção: a assinatura é de uma pessoa, tem limites do plano e exige o login manual no contêiner.
- Os dados do Hermes (conversas) ficam em `docker/hermes/evolut/data`, fora do git.
