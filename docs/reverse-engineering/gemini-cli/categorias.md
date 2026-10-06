# Gemini CLI: as 14 categorias

Alvo: fonte `fb972b2f` (Apache-2.0). Caminhos relativos a `packages/core/src/`, exceto os que começam com `cli/` (`packages/cli/src/`).

Cada categoria tem três listas:
- **Fatos:** conferidos no código, com arquivo e linha.
- **Hipóteses:** inferidas, não conferidas.
- **Desconhecidos:** o que não foi possível ver.

No fim de cada uma, **No Althius** diz o que já existe, o que entrou agora (ADR 0061) e o que falta.

---

## 1. Organização de módulos

**Fatos**
- O monorepo tem 7 pacotes: `a2a-server`, `cli`, `core`, `devtools`, `sdk`, `test-utils`, `vscode-ide-companion`. `cli`, `sdk` e `a2a-server` dependem de `@google/gemini-cli-core` (ex.: `packages/sdk/package.json:25`).
- `core` não importa `cli`: a dependência só vai em direção ao núcleo.
- Divisão dentro do `core`:
  - `core/`: cliente, chat, turno, prompts, limites de tokens;
  - `context/`: compressão, mascaramento e destilação de saídas;
  - `tools/`, `scheduler/`, `policy/`, `agents/`, `mcp/`, `telemetry/`, `services/`, `config/`, `prompts/`, `hooks/`, `routing/`, `skills/`, `utils/`.

**Hipóteses**
- `sdk/` é um invólucro programático do `core`; `devtools` é um inspetor independente.

**Desconhecidos**
- O conteúdo interno de `vscode-ide-companion` e `devtools`.

**No Althius**
- **Já existe:** separação parecida. O agente roda no Hermes (externo), a porta de ferramentas fica em `src/server/mcp`, e há serviços separados (`integracoes`, `sinais`, `agentes`) e o banco como fonte da verdade.
- **Entrou agora:** `src/server/mcp/execucao.ts`, uma camada própria de execução entre o protocolo e as ferramentas, como o `scheduler/` deles.

---

## 2. Ferramentas disponíveis

**Fatos**
- `config/config.ts:3974` (`createToolRegistry`) registra as ferramentas embutidas: ls, read_file, grep/ripgrep, glob, edit, write_file, web_fetch, shell, web_search, ask_user, ativação de skill e recursos MCP (`:4008-4083`).
- Algumas só entram com chave ligada: write_todos (`:4084`), entrar e sair do modo plano (`:4089`), tracker (`:4098`). O subagente entra como ferramenta em `:4122`.
- Os nomes no protocolo estão em `tools/definitions/base-declarations.ts:30-138`.
- Ferramenta excluída continua registrada e é filtrada na hora de listar (`tools/tool-registry.ts:564-654`). A lista de exclusão junta configuração, extensões e o motor de políticas (`config/config.ts:2445`).
- Nome repetido sobrescreve com um aviso só (`tool-registry.ts:287`).
- Não existe ferramenta de memória: o próprio prompt diz isso (`prompts/snippets.ts:872`).

**Hipóteses**
- `allowedTools` chega ao motor de políticas pelo pacote `cli`.

**Desconhecidos**
- Onde `read_many_files` é registrada.

**No Althius**
- **Já existe:** 26 ferramentas no servidor MCP, todas por token do agente.
- **Entrou agora:** `POLITICA_DAS_FERRAMENTAS`, a lista única com o tipo de cada ferramenta (leitura, proposta, ação externa). Ferramenta sem linha nela é bloqueada, e um teste confere que todas têm política e que o tipo bate com a marca de leitura.

---

## 3. Fluxo de planejamento

**Fatos**
- **Limite de turnos:** `core/client.ts:79` fixa `MAX_TURNS = 100` por envio. O limite de sessão é `-1` (sem limite) por padrão (`config/config.ts:1250`).
- **Passos de cada turno** (`processTurn`, `core/client.ts:628-922`):
  1. conta o turno;
  2. comprime o contexto;
  3. mascara saídas antigas;
  4. avisa estouro de janela;
  5. detecta laço;
  6. escolhe o modelo (roteador);
  7. roda o turno.
- **Quem executa as ferramentas:** o turno só junta os pedidos de ferramenta (`core/turn.ts:270`, `:383`); quem chama devolve os resultados. Na tela isso é `cli/ui/hooks/useGeminiStream.ts:1972`; sem tela, `cli/nonInteractiveCli.ts:316`.
- **"Quem fala agora":** existe (`utils/nextSpeakerChecker.ts`), mas vem **desligado** por padrão (`config/config.ts:1286`).
- **Modo plano** é imposto por regras, não só pelo prompt:
  - `policy/policies/plan.toml:76-81` nega tudo;
  - libera leitura, alguns subagentes e escrita só de `.md` na pasta de planos (`:86-131`);
  - `tools/exit-plan-mode.ts:221-232` pede aprovação e manda seguir o plano à risca.
- **write_todos:** estados `pending | in_progress | completed | cancelled | blocked`, com um só em andamento (`tools/write-todos.ts:22-26`, `:121-125`).
- **Detecção de laço:**
  - 5 chamadas idênticas de ferramenta (`services/loopDetectionService.ts:29`);
  - 10 repetições de texto (`:30`);
  - verificação por modelo depois de 30 turnos (`:42`).
  - Na primeira detecção ele avisa o modelo; na segunda, para (`core/client.ts:1284-1311`).

**Hipóteses**
- write_todos só molda a conversa, não grava nada.

**Desconhecidos**
- As estratégias do roteador de modelos.

**No Althius**
- **Já existe:** o laço do agente é do Hermes. A conduta "propor antes de agir" é imposta pelo banco (toda mudança vira aprovação).
- **Entrou agora:** a detecção de laço na porta de ferramentas. Na 5ª chamada idêntica seguida, a ferramenta não roda e o agente recebe o aviso para mudar de abordagem.
- **Falta (ticket):** um "modo plano" do agente que só lê e escreve um plano para uma pessoa aprovar.

---

## 4. Ciclo de execução de ferramentas

**Fatos**
- **Estados de uma chamada** (`scheduler/types.ts:26-34`): Validating, Scheduled, Executing, AwaitingApproval, Success, Error, Cancelled.
- **Do pedido do modelo à execução:**
  - Ferramenta inexistente vira erro `TOOL_NOT_REGISTERED`, com sugestão de nome (`scheduler/scheduler.ts:343-376`).
  - Parâmetro inválido vira `INVALID_TOOL_PARAMS` (`:404-437`).
  - Cada chamada passa por gancho → política → confirmação → agendada (`:628-756`).
- **Paralelismo:** é o padrão. Edições e `update_topic` são sempre sequenciais, e o modelo pode pedir `wait_for_previous` (`:577-594`, `tools/tools.ts:546-573`).
- **Resultado ao modelo:** volta como `functionResponse.response.output`; erro volta como `response.error` (`utils/generateContentResponseUtilities.ts:49`, `scheduler/tool-executor.ts:577`).
- **Corte de saída grande:**
  - acima de 40.000 caracteres (`config/config.ts:482`), salva o completo em arquivo temporário e entrega 20% do início e 80% do fim (`utils/fileUtils.ts:781-793`);
  - teto de 64 KB por parte (`utils/constants.ts:18`).

**Hipóteses**
- Não há limite de concorrência além do agrupamento.

**Desconhecidos**
- O que o `ToolOutputDistillationService` faz por dentro.

**No Althius**
- **Entrou agora:** `criarExecutor().envolver()` dá a toda ferramenta o mesmo ciclo: política, laço, execução com prazo, nova tentativa (só leitura), corte da saída e evento.
- **Corte:** 20 mil caracteres, 20% do início e 80% do fim, com aviso para pedir um recorte menor. Não guardamos o completo em arquivo, porque o agente não tem acesso a arquivos.
- **Paralelismo:** quem decide é o Hermes.

---

## 5. Tratamento de erros

**Fatos**
- `tools/tool-error.ts:14-83` tem cerca de 40 tipos de erro de ferramenta.
- Só `NO_SPACE_LEFT` é fatal (`:101-109`); o resto volta ao modelo para ele se corrigir.
- O modelo recebe a mensagem e a pessoa recebe `returnDisplay`, que pode ser diferente (`scheduler/tool-executor.ts:156-167`, `:560-585`).
- Cancelamento devolve `[Operation Cancelled]` e mantém a saída parcial (`:408-478`).
- Erro de MCP: a marca `isError` vira `MCP_TOOL_ERROR` (`tools/mcp-tool.ts:394-410`).
- O motor de política **nega** se um verificador quebrar (fecha em vez de abrir, `policy/policy-engine.ts:871-919`).

**Hipóteses**
- O desenho aposta no modelo se corrigindo, por isso quase nada é fatal.

**Desconhecidos**
- Como cada ferramenta escolhe o tipo específico.

**No Althius**
- **Entrou agora:** `ErroDeFerramenta` com 10 tipos (entrada_invalida, nao_autorizado, agente_pausado, nao_configurado, indisponivel, tempo_esgotado, laco_detectado, sem_politica, recusado, inesperado).
  - O tipo vai no resultado (`_meta`) para a execução decidir se tenta de novo.
  - Os definitivos (token inválido, agente pausado, não configurado) dizem ao agente "Não tente de novo: isso precisa de uma pessoa", que é o nosso "fatal".
  - Erro do banco sem resposta é `indisponivel`; com código do banco é `recusado` (`src/server/mcp/ferramentas.ts`).

---

## 6. Confirmação de ações

**Fatos**
- **Respostas possíveis da pessoa** (`tools/tools.ts:1106-1114`): uma vez, sempre, sempre-e-salvar, sempre para o servidor, sempre para a ferramenta, editar ou cancelar.
- **Modos** (`policy/types.ts:48-65`), do mais restrito ao mais solto: plano < padrão < autoEdit < yolo.
- **Motor de políticas:**
  - a regra de maior prioridade vence (`policy/policy-engine.ts:255-257`, `check()` em `:610-929`);
  - sem regra, pergunta à pessoa, ou nega quando não há tela (`:299-301`);
  - comandos de terminal são quebrados em partes e qualquer negação vence (`:447-604`).
- **Prioridades por origem** (`policy/config.ts:67-71`): padrão 1, extensão 2, projeto 3, usuário 4, admin 5. Extensão não pode liberar (`:240-254`).
- "Sempre permitir" vira regra nova, com escopo e persistência (`scheduler/policy.ts:114-231`).
- Pasta não confiável bloqueia os modos soltos (`config/config.ts:2803-2862`).

**Desconhecidos**
- O conteúdo das listas de comandos perigosos e seguros.

**No Althius**
- **Já existe, e mais rígido:** o agente nunca executa mudança. Toda mudança vira **aprovação** de uma pessoa (ADRs 0043, 0045, 0058), e gasto só o C-level aprova.
- **Entrou agora:** o tipo de cada ferramenta na política. "Proposta" e "ação externa" nunca são repetidas sozinhas.
- **Não adotado:** "sempre permitir" e modo yolo (decisão de produto: no Althius, quem paga decide).

---

## 7. Gerenciamento de contexto

**Fatos**
- **Quando comprime:** a 50% da janela do modelo (`context/chatCompressionService.ts:45`). Os 30% mais recentes ficam intactos (`:269`).
- **Como comprime:** o resumo é um `<state_snapshot>` com objetivo, restrições, conhecimento, rastro de artefatos, estado e tarefa (`prompts/snippets.ts:898-977`). Depois vem uma segunda passada de autocrítica (`chatCompressionService.ts:616-645`).
- **Compressão que piora é rejeitada:** se o resumo ficar maior, ele é descartado e as próximas vezes só cortam (`:530-545`, `:696-705`).
- **Saídas antigas:** acima de 30 mil tokens podáveis, as saídas antigas de ferramenta são trocadas por um marcador e salvas em arquivo, protegendo os 50 mil tokens mais novos (`context/toolOutputMaskingService.ts:25-41`).
- **Estimativa de tokens:** 0,33 token por caractere ASCII e 1,5 por não-ASCII (`utils/tokenCalculation.ts:14-17`).

**Hipóteses**
- O "ContextManager" em grafo vai substituir a compressão (hoje está desligado por padrão).

**No Althius**
- **Já existe:** o histórico e a compressão são do Hermes. O harness manda só o lote do canal, e o Playbook é cortado em 6.000 caracteres (`src/server/agentes/prompts.ts`).
- **Entrou agora:** o corte das saídas de ferramenta na origem (20 mil caracteres, com aviso).
- **Falta (ticket):** resumo estruturado da conversa direta longa, no formato de "estado da tarefa".

---

## 8. Subagentes

**Fatos**
- **Definição:** um subagente é local ou remoto (A2A) (`agents/types.ts:214`, `:301`, `:308`). Tem limites de 30 turnos e 10 minutos (`:51`, `:56`).
- **Como o agente chama:** por **uma** ferramenta, `invoke_agent {agent_name, prompt}` (`agents/agent-tool.ts:43-72`).
- **Isolamento:** cada subagente tem registro próprio de ferramentas, copiado do pai com curingas (`agents/local-executor.ts:170-276`).
- **Sem recursão:** subagente **não** chama subagente (`:206`).
- **Como termina:** com `complete_task`, com saída validada por esquema (`agents/complete-task.ts:86-104`). Sem `complete_task`, termina em erro. Ao estourar o limite, ganha mais um turno de 60 s de folga (`local-executor.ts:107`, `:449-529`).
- **Agentes de usuário:** vêm de `.gemini/agents/*.md` com cabeçalho YAML (`agents/agentLoader.ts:54-114`). Os de projeto precisam de reconhecimento antes de rodar (`agents/registry.ts:188-213`).

**No Althius**
- **Não existe ainda:** os 4 agentes não se chamam entre si.
- **Falta (ticket):** `consultar_agente`, com profundidade 1, prazo, sem acesso a propostas e resposta por resumo. É o equivalente do `invoke_agent` + `complete_task`.

---

## 9. Carregamento de instruções

**Fatos**
- **Três camadas** (`config/config.ts:2591-2635`, `utils/environmentContext.ts:62-66`):
  1. global e memória de projeto no prompt de sistema;
  2. extensões e projeto na primeira mensagem;
  3. subpastas só quando uma ferramenta toca nelas ("JIT", `utils/memoryDiscovery.ts:512-648`).
- **Descoberta dos arquivos:** sobe do diretório até a raiz do git (`memoryDiscovery.ts:405-510`).
- **Imports:** `@arquivo`, até 5 níveis, sem ciclos e ignorando blocos de código (`utils/memoryImportProcessor.ts:190-332`).
- **Pasta não confiável:** a memória de projeto só vale em pasta confiável (`context/memoryContextManager.ts:132`).
- **Prompt de sistema:** montado em seções (`prompts/promptProvider.ts:142-256`). Em conflito vale projeto > extensão > global (`prompts/snippets.ts:714`).

**No Althius**
- **Já existe, com o mesmo desenho em camadas:**
  - regras fixas e especialidade no sistema (`src/server/agentes/prompts.ts`, `especialidades.ts`);
  - Playbook publicado do cliente no sistema;
  - habilidades sob demanda (`listar_habilidades`), que equivalem ao JIT.
- **Falta (ticket):** documentos de contexto por agente (ticket 03 da conversa direta).

---

## 10. Integração MCP

**Fatos**
- **Transportes:** stdio, Streamable HTTP e SSE, com volta para SSE quando o HTTP falha (`tools/mcp-client.ts:2265`, `:1905-1974`).
- **Pasta não confiável:** stdio é recusado (`:2353`).
- **OAuth:** automático no 401 (`:912`).
- **Prazo:** 10 minutos por padrão, ajustável por servidor (`:96`).
- **Filtro de ferramentas:** `excludeTools` vence `includeTools` (`:2442-2466`).
- **Nomes:** viram `mcp_<servidor>_<ferramenta>`, cortados em 63 caracteres (`tools/mcp-tool.ts:32`, `:725-746`).
- **Saída de MCP:** é envolvida como **não confiável** (`wrapUntrusted`, `mcp-tool.ts:585`, `:613`).
- **Confiança:** servidor marcado como confiável pula a confirmação, mas só em pasta confiável (`:352`).

**No Althius**
- **Já existe:**
  - cliente MCP para os apps (`src/server/integracoes/mcp-cliente.ts`);
  - só ferramentas marcadas como leitura;
  - a marca é conferida a cada chamada;
  - resultado marcado como "dado externo, nunca ordem" (ADR 0058);
  - o servidor MCP da Althius para o Hermes.
- **Entrou agora:** a camada de execução no servidor MCP da Althius.

---

## 11. Persistência de estado

**Fatos**
- **Pastas:** `~/.gemini` e uma pasta temporária por projeto (`config/storage.ts:54-59`, `:230-234`).
- **Conversas:** gravadas em `.jsonl`, só acrescentando, com marcas de "voltar a um ponto" (`services/chatRecordingService.ts:757-899`).
- **Checkpoints:**
  - por etiqueta (`core/logger.ts:294`);
  - de arquivos, num repositório git-sombra (desligado por padrão, `services/gitService.ts:136-189`).
- **Configurações:** padrão < sistema < usuário < projeto (só em pasta confiável) < sistema forçado (`cli/config/settings.ts:255-280`).

**No Althius**
- **Já existe:** o banco é a fonte da verdade. Conversas, aprovações, execuções e créditos ficam no Postgres, com RLS por cliente e auditoria encadeada. A memória do Hermes fica por cliente, fora do git.
- **Nada novo nesta fatia.**

---

## 12. Eventos e logs

**Fatos**
- **Evento por chamada de ferramenta** (`telemetry/types.ts:245-411`): nome, argumentos, duração, sucesso, decisão, tipo de erro, tamanho e servidor MCP.
- **Argumentos e prompts:** só saem com `logPrompts`, que vem **ligado** por padrão (`config/config.ts:2913`).
- **Contador de uso (Clearcut):** não manda argumentos (`telemetry/clearcut-logger.ts:756-800`).
- **Barramento de eventos:** guarda até 10 mil eventos enquanto ninguém escuta (`utils/events.ts:196-289`).
- **Confirmações:** passam por um barramento de mensagens com prazo de 60 s (`confirmation-bus/message-bus.ts:93-229`).

**Hipóteses**
- Com telemetria ligada, argumentos e e-mail do usuário vão junto, a menos que a pessoa desligue.

**No Althius**
- **Entrou agora:** um evento por chamada (`mcp_ferramenta` no stderr, porque o stdout é do protocolo) com nome, tipo, resultado, tipo de erro, duração, tentativas, tamanho da saída e se foi cortada.
- **Diferença de propósito:** **nunca** argumentos nem conteúdo, nem como opção (dado de cliente; ADRs 0038 e 0058).

---

## 13. Interface entre agente e ferramentas

**Fatos**
- **Ferramenta declarada** (`tools/tools.ts:470-679`): nome, descrição, tipo (`Kind`, `:1116-1130`) e esquema.
- **`build()`** valida os parâmetros (Ajv) e cria a invocação (`:687-727`). Se o esquema não compila, **pula** a validação (`utils/schemaValidator.ts:88-102`).
- **Resultado** (`tools.ts:750-791`): `llmContent` para o modelo, `returnDisplay` para a pessoa, `error {message, type}`, além de chamada em cadeia (`tailToolCallRequest`).
- **Leitura vem do tipo:** "é só leitura" sai do `Kind` (`tools.ts:518`).

**No Althius**
- **Já existe:** esquemas JSON validados pelo SDK MCP, e `readOnlyHint` e `destructiveHint` em cada ferramenta.
- **Entrou agora:**
  - o tipo da política tem que bater com `readOnlyHint` (teste);
  - o erro tipado vai em `_meta`, separado do texto que o agente lê.

---

## 14. Retry e timeout

**Fatos**
- **Limites** (`utils/retry.ts:20`, `:42-47`): até 10 tentativas, de 5 s a 30 s.
- **Espera:** dobra a cada vez com ±30% de variação (`:517-524`).
- **O que repete:** rede, 429, 499 e 5xx. **400 nunca** (`:170-209`).
- **Sem `Retry-After`:** o atraso vem do `RetryInfo` do Google ou do texto da mensagem. Mais de 300 s é tratado como cota esgotada (`utils/googleQuotaErrors.ts:120`, `:277-341`).
- **Cota persistente:** troca de modelo (`fallback/handler.ts:26`).
- **A execução de ferramenta em si não é repetida.** Só as chamadas ao modelo e o `web_fetch` (`tools/web-fetch.ts:301`, `:640`).
- **Prazos:**
  - terminal: prazo de **inatividade** de 300 s (`tools/shell.ts:554-661`);
  - MCP: 10 min (`tools/mcp-client.ts:96`);
  - confirmação: 30 s (`tools/tools.ts:356-359`).

**No Althius**
- **Entrou agora:**
  - **Leitura:** até 3 tentativas, 500 ms → 1 s → 2 s (até 4 s), ±30%, só para falha passageira.
  - **Proposta e ação externa:** nunca repetem. É a mesma ideia do Gemini, de não repetir a execução da ferramenta, aplicada a quem muda algo.
  - **Prazos por tipo:** leitura 30 s, proposta 20 s, ação externa 75 s; apps conectados 65 s.
  - **Ao estourar o prazo:** o erro diz que a proposta pode ter sido registrada mesmo assim.
- **Antes já existia:** o rodízio de chaves da Apify (ADR 0049) e o gateway do modelo com reserva (ADR 0050).

---

## Limites desta análise

- **REA:** a análise estática de JavaScript não terminou, nem no pacote completo (mais de 40 minutos e 3,2 GB de memória) nem no núcleo publicado (mais de 10 minutos). Os fatos acima vêm da leitura direta do código-fonte da mesma versão do produto, não do grafo do REA.
- **Sem Hopper e sem Ghidra:** não houve análise binária. Também não era necessária, porque o alvo é JavaScript.
- **Nada do alvo foi executado:** comportamento em tempo de execução (tempos reais, ordem de eventos) não foi observado.
