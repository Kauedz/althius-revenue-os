# ADR 0050 — Gateway do modelo de IA (vários provedores, chave no cofre)

Status: aceita
Data: 2026-10-06
Relacionadas: 0021 (créditos), 0024 (Hermes Agent), 0047 (executor), 0048 (Hermes por cliente), 0049 (cofre de chaves)

## Contexto
Quem paga o modelo de IA são os fundadores da Althius: o cliente compra o serviço (ICP, sinais, GTM) e vê só créditos. O dono quer usar um modelo da OpenAI hoje e poder trocar ou somar outros provedores (como a Claude) sem mexer em cada Hermes de cliente. Espalhar a chave do provedor por um contêiner Hermes por cliente seria inseguro e trocar de provedor exigiria reprovisionar tudo.

## Decisão
1. **Um gateway interno** (`src/server/gateway/`, contêiner `gateway`, porta 3300 só na rede interna) fala o formato OpenAI (`/v1/chat/completions`, `/v1/models`). Todo Hermes de cliente aponta para ele com o nome lógico de modelo `althius`. O Hermes **nunca** recebe a chave do provedor.
2. **A chave do Hermes no gateway é o token do próprio agente** (`alt_agente_…`, o mesmo do MCP). O gateway confere com `agent_runtime_resolve`: token inválido = 401, agente pausado pelo cliente = 403. Assim o consumo é atribuído ao cliente e ao agente certos e o botão de pausa também corta o modelo.
3. **Modelos e chaves vêm do cofre** (ADR 0049, tipo "Modelo de IA dos agentes"). Cada modelo tem: tipo de API (`openai` = OpenAI e compatíveis; `anthropic` = Claude), endereço (a Claude tem padrão), nome do modelo, prioridade (1 = principal) e, opcionalmente, preço por 1 milhão de tokens (entrada e saída).
4. **Reserva automática.** Os modelos são tentados por prioridade. Falha de chave (401/403), limite (429), erro ou lentidão (120 s) tira o modelo de cena por 60 s e o próximo responde. Todos falhando = erro 502 genérico (sem texto do provedor); nenhum modelo cadastrado = 503 claro. **Nunca existe resposta de mentira.**
5. **Tradução OpenAI ↔ Claude** (`traduzir.ts`): mensagens `system`, chamadas e resultados de ferramenta (`tool_use`/`tool_result`), `tool_choice`, `max_tokens`, razão de parada e uso de tokens. Verificada por testes unitários; **ainda não testada contra a API real da Claude** (sem chave neste ambiente).
6. **Sempre resposta completa do provedor.** Se o Hermes pediu stream, o gateway entrega em pedaços a partir da resposta inteira (igual para qualquer provedor; evita traduzir stream da Claude).
7. **Registro de uso** em `internal.llm_uso` (cliente, agente, modelo, tokens e, só se o preço foi informado, custo real em dólar; sem preço o custo fica vazio, nunca estimado). O cliente não vê nada disso; o **Uso global do superadmin** mostra tokens e custo real do modelo no mês por cliente.
8. **Créditos continuam como estão:** o harness já reserva e consome créditos por lote (ADR 0045). O gateway não cobra crédito; ele mede o custo real para a Althius precificar.
9. **Chave e segredos nunca saem do gateway**: nem em log, nem em erro devolvido ao Hermes. O gateway não aceita nada sem token de agente.

## Provisionamento
`npm run agentes:provisionar` agora aponta o perfil para `http://gateway:3300/v1` com modelo `althius` e usa o token do agente como chave. Não precisa mais de `HERMES_MODELO_CHAVE`. (`--modelo-url` e `--modelo-nome` continuam existindo para testes com um modelo falso.) Os contêineres Hermes dependem do `gateway` no compose.

## Verificado
Cadeia completa em execução real: canal → fila → harness → **Hermes Agent oficial** → **gateway** (chave do cofre) → modelo falso → ferramenta do MCP → banco → resposta no canal, com o uso registrado.

## Pendente
- Teste real com a chave da OpenAI (nome exato do modelo "Luna" e endereço `https://api.openai.com/v1`, informados pelo dono) e com a Claude. Se a OpenAI exigir parâmetro diferente para o modelo (por exemplo `max_completion_tokens`), o pedido do Hermes é repassado como veio.
- Limite de gasto mensal por provedor e alerta de custo (hoje só a medição).
- Corrigido junto: os Dockerfiles do `webhooks` e da `cadencia` copiavam só alguns arquivos e quebrariam ao subir (faltavam as pastas `unipile` e `cofre`). Agora copiam as pastas inteiras.
