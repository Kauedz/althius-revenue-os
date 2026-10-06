# 02: Os agentes conhecem a empresa

**What to build:** toda resposta de um agente leva o Playbook publicado dele (limite de tamanho, versão mais nova sempre) e o agente ganha ferramentas de leitura para as habilidades, os sinais recentes de uma conta e o perfil de cliente ideal. Sem Playbook publicado, o agente diz isso em vez de fingir que sabe.

**Blocked by:** None (can start immediately).

**Status:** feito e conferido de verdade em 06/10/2026 (ADR 0057). A Zoe respondeu com a missão e as regras do Playbook v3.2; ICP: não há tabela, ele vive no texto do Playbook (ver ADR). Teste de banco 00073 (28 verificações). Falta `npm run verificar` completo (apaga o banco local).

## Pode mexer
Instruções dos agentes, servidor de ferramentas (MCP), uma migration nova com funções de leitura do agente (com GRANT explícito e isolamento por workspace), testes.

## Não mexa
Playbook, habilidades e sinais em si (só leitura); migrations antigas.

## Critérios
- [x] Publicar nova versão do Playbook muda a resposta seguinte, sem reiniciar nada.
- [x] Ferramentas de leitura de habilidades e sinais de uma conta, com teste de isolamento entre dois workspaces e agente pausado bloqueado.
- [x] Confirmar onde o ICP é guardado; se não houver lugar no banco, registrar isso no ticket e propor uma ADR em vez de inventar.
- [x] Texto longo do Playbook é cortado com aviso, nunca em silêncio.
