# ADR 0061 — Camada de execução das ferramentas do agente

Status: aceita
Data: 2026-10-06
Relacionadas: 0024 (porta do agente), 0045 (harness), 0047 (Hermes), 0058 (apps conectados), 0060 (sinais pelo agente)
Estudo de origem: [docs/reverse-engineering/gemini-cli/](../reverse-engineering/gemini-cli/) (Gemini CLI, Apache-2.0, só leitura; nenhum código copiado)

## Contexto
O Nan pediu para estudar, com o REA, como um agente de mercado organiza as ferramentas e trazer isso ao Althius. O estudo do Gemini CLI mostrou um ciclo único para toda chamada de ferramenta. Lá, a chamada passa por validação, política, confirmação, execução, corte da saída e evento, e há detecção de laço, erros tipados e novas tentativas com espera crescente.

No Althius, cada ferramenta do servidor MCP tratava erro do seu jeito. Nenhuma tinha prazo nem nova tentativa, a saída não tinha limite e não havia registro por chamada.

## Decisão
Toda ferramenta do servidor MCP da Althius passa por `src/server/mcp/execucao.ts`. O ciclo de cada chamada é:

1. **Política.** Toda ferramenta tem um tipo em `POLITICA_DAS_FERRAMENTAS`:
   - `leitura`, `proposta` ou `acao_externa`;
   - ferramenta sem política **não roda** (fecha em vez de abrir);
   - o tipo tem que bater com a marca `readOnlyHint` (há teste que confere).
2. **Laço.** A mesma chamada (nome + argumentos) 5 vezes seguidas não roda. O agente recebe o aviso para mudar a abordagem.
3. **Prazo.** Leitura 30 s, proposta 20 s, ação externa 75 s, apps conectados 65 s. Estourou, vira erro claro. Proposta ou ação estourada avisa que **pode ter sido registrada**.
4. **Nova tentativa só em leitura e só em falha passageira** (`indisponivel`):
   - até 3 tentativas, esperando 500 ms, 1 s, 2 s (até 4 s), com ±30% de variação;
   - **proposta e ação externa nunca são repetidas sozinhas**, porque poderiam duplicar uma aprovação ou um gasto.
5. **Erro tipado** (`ErroDeFerramenta`), com o tipo em `_meta` e a mensagem no texto:
   - os definitivos (token inválido, agente pausado, não configurado) dizem ao agente: "Não tente de novo: isso precisa de uma pessoa";
   - erro do banco sem resposta é passageiro; com código do banco, é recusa.
6. **Corte da saída.** Acima de 20 mil caracteres, ficam 20% do início e 80% do fim, com o aviso para pedir um recorte menor.
7. **Evento.** Uma linha JSON `mcp_ferramenta` no stderr por chamada, com nome, tipo, resultado, tipo de erro, duração, tentativas, tamanho e corte. **Nunca** argumentos nem conteúdo. O registro nunca derruba a ferramenta.

## O que NÃO foi adotado do Gemini CLI (de propósito)
- "Sempre permitir", modo yolo e confirmação pela própria ferramenta. No Althius toda mudança é aprovação de uma pessoa, e gasto só o C-level aprova.
- Registrar argumentos e prompts na telemetria (no Gemini vem ligado por padrão). Aqui é dado de cliente.
- Guardar a saída completa em arquivo temporário: o agente da Althius não tem arquivos.

## Próximas fatias (tickets em `.scratch/camada-de-execucao/issues`)
- Modo plano do agente: ele só lê e escreve um plano que uma pessoa aprova.
- `consultar_agente`: um agente pergunta a outro, com profundidade 1 e prazo.
- Resumo estruturado de conversa longa ("estado da tarefa").

## Limites conhecidos
- O prazo não cancela a consulta ao banco por baixo; só deixa de esperar.
- A contagem de laço é por processo MCP (um por agente e cliente) e zera quando o processo reinicia.
- O evento vai para o log do contêiner do Hermes. Ainda não vai ao banco nem a uma tela.
