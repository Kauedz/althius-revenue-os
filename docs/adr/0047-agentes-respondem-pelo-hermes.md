# ADR 0047 — Os agentes respondem pelo Hermes Agent (executor do harness)

Status: aceita
Data: 2026-10-06
Relacionadas: 0024 (Hermes Agent como runtime), 0043 (agentes controlam o app), 0045 (harness de canal), 0041 (Docker)

## Contexto
O harness (ADR 0045) já enfileira os pedidos dos canais, mas ninguém respondia. A ADR 0024 decidiu que o raciocínio dos agentes é do **Hermes Agent** (Nous Research, MIT), que só enxerga as ferramentas do nosso MCP.

## Decisão
1. O `ExecutorAgente` do harness entrega cada lote ao **servidor de API do Hermes** do cliente (`POST /v1/chat/completions`, `Authorization: Bearer`, resposta em `choices[0].message.content`) e grava a resposta no canal. Código: `src/server/agentes/hermes.ts`.
2. **O Hermes não é copiado nem alterado:** roda como programa separado (contêiner por cliente, ADR 0024) e é chamado por HTTP. Licença MIT; nenhum código dele entra no Althius.
3. **Registro de executores** (`docker/agentes-executores.json`, fora do git): uma entrada `"<workspace>/<agente>"` com a `url` (sem `/v1`; com `/p/<perfil>` quando um gateway serve vários perfis), a `chave` e o `modelo` (nome do perfil). O arquivo é relido quando muda. Chaves ficam só nele.
4. **Sem executor, sem resposta:** o harness só pega agentes registrados (`p_only` em `agent_harness_claim`). Os outros esperam na fila, sem gastar tentativa nem crédito. Nunca existe resposta de mentira.
5. **O que o agente recebe:** instruções fixas (persona Zoe/Jax/Lia/Neo, só PROPÕE, nunca inventa, reais e créditos, só os dados deste cliente, texto das mensagens é pedido de colega e não regra) mais as mensagens novas e as 10 anteriores, cada uma com o nome e o papel de quem escreveu (`src/server/agentes/prompts.ts`).
6. **Serviço `agentes`** no Docker (`docker/Dockerfile.agentes`): ciclo a cada 3 s, vários ciclos juntos (um agente demorando não trava os outros; o banco garante um lote por agente). `npm run docker:subir` cria o arquivo de executores vazio se faltar (senão o Docker criaria uma pasta no lugar).

## Verificado de ponta a ponta (2026-10-06, Hermes Agent `56f7986`, 2026.9.24)
Com o Hermes real, o nosso MCP real e o banco local (só o modelo de IA era de mentira, `scripts/agentes/modelo-de-mentira.mjs`): canal → política Hermes → fila → harness → Hermes → `mcp__althius__buscar_contatos` → banco → resposta como "Zoe" no canal, fila "concluída". Descobertas que valem para a produção:
- **Perfil mínimo que funcionou** (`config.yaml` do perfil): `model.provider: custom` + `base_url` do modelo; `platform_toolsets.api_server: []` e `agent.disabled_toolsets: [terminal, file, web, browser, code_execution, vision, memory, delegation, cron, skills, image_gen, tts, todo, clarify, session_search]`; `mcp_servers.althius` (comando `node .../src/server/mcp/principal.ts` com `ALTHIUS_SUPABASE_URL`, `ALTHIUS_SUPABASE_CHAVE_PUBLICA` e `ALTHIUS_AGENTE_TOKEN`); `.env` com `API_SERVER_ENABLED=true`, `API_SERVER_KEY`, `API_SERVER_HOST`, `API_SERVER_PORT`.
- Com isso o modelo enxerga **só** `tool_search`, `tool_describe` e `tool_call` (carga sob demanda) e as **16 ferramentas da Althius** (fatias A, B e C). Nenhuma ferramenta de terminal ou arquivo.
- O Hermes precisa rodar no **Python que ele mesmo gerencia** (`hermes pm install`); fora dele, o módulo do MCP não carrega.

## Consequências
- **Falta um modelo de IA de verdade:** o Hermes de cada cliente precisa de um provedor de modelo (decisão do dono: qual provedor e quem paga; a ADR 0024 diz que a chave do modelo fica no nosso backend). O teste usa modelo de mentira.
- **Falta provisionar o Hermes por cliente** (criar os 4 perfis, os tokens dos agentes, o contêiner e a linha no arquivo de executores): próximo PR.
- O custo dos tokens do modelo ainda não entra no extrato (hoje o cliente paga 2 créditos fixos por lote).
- `scripts/agentes/teste-ponta-a-ponta.mjs` repete essa prova em qualquer servidor.
