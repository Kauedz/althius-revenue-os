# ADR 0043 — App controlado por agentes de IA (plano em fatias)

Status: proposta (aguarda ok do dono)
Data: 2026-10-05
Relacionadas: 0024 (Hermes Agent / MCP), 0021 (créditos), 0023 (segurança do banco), 0041 (Docker), 0042 (motor de cadência)

## Contexto
O objetivo do produto é que os 4 agentes fixos (comercial, marketing, copy, revops; nomes de tela Zoe/Jax/Lia/Neo) possam **operar o app inteiro** como um membro da equipe, sempre dentro das regras de papel, aprovação e créditos.

Hoje existe só a primeira fatia da porta do agente (ADR 0024): duas ferramentas MCP
(`buscar_contatos` e `propor_atualizacao`), token do agente (`alt_agente_…`, só o hash no banco), pausa do agente
e proposta que vira aprovação. Todo o resto do app (tarefas, cadências, pipeline, campanhas, conexão de contas) só é acionável por pessoa, pela tela.

## Decisão
1. **Cada ação do app vira uma ferramenta MCP** em `src/server/mcp/`, chamando uma função `agent_*` no banco. O agente nunca escreve direto em tabela.
2. **Sempre propor → aprovar.** A ferramenta cria uma proposta (aprovação). Quem aprova: pessoa com permissão, ou a política do Hermes (`hermes_evaluate_action`) quando a ação for de baixo risco e o dono tiver habilitado.
3. **Quem paga decide o gasto** (AGENTS.md, regra 4). Ação que gasta crédito (envio, campanha, verba) só é aprovada por C-level ou superadmin. Agente nunca aprova gasto, nem o próprio.
4. **Isolamento por workspace.** O token do agente pertence a um workspace; toda função `agent_*` filtra por ele. Cada ferramenta nova ganha teste de isolamento entre dois workspaces.
5. **Segurança do banco (ADR 0023).** Funções `agent_*` aceitam `anon` apenas pela exceção da ADR 0024 (exigem o token). Pausar o agente (erro 55000) bloqueia todas.
6. **Idempotência e registro.** Toda ferramenta recebe chave de idempotência e grava em `audit_logs` (quem: agente; o quê; resultado).
7. **Sem dado inventado e sem API real em teste.** Ferramentas devolvem erro claro; testes usam o provedor falso.
8. **Créditos, nunca dólar** nas respostas ao agente também.
9. **Mensagens enviadas pelo agente** passam pelo motor de cadência (ADR 0042) e pela mesma regra de envio única (no máximo uma vez); o agente não chama a Unipile diretamente.

## Plano em fatias (uma por PR, TDD, `npm run verificar` verde)
| Fatia | Ferramentas | Observação |
|---|---|---|
| A. Tarefas e cadências (**entregue**, migration 0105) | `listar_membros`, `listar_tarefas`, `listar_cadencias`, `propor_tarefa`, `propor_inscricao_cadencia` | Inscrever em cadência com envio automático é gasto → só o C-level aprova. Ficaram para depois: `concluir_tarefa` e `propor_cadencia` (criar/editar cadência) |
| B. Pipeline (**entregue**, migration 0106) | `listar_contas`, `listar_quadros`, `listar_negocios`, `propor_negocio`, `propor_mover_negocio` | Operação (C-level ou estrategista aprova); o histórico de etapa guarda quem aprovou. `propor_nota` não existe: o banco não tem nota de negócio, e nada foi inventado |
| C. Campanhas (**entregue**, migration 0107) | `listar_campanhas`, `propor_campanha`, `propor_verba_campanha`, `propor_status_campanha` | Verba = gasto → só C-level/superadmin aprova |
| D. Contas e conexões | `listar_contas`, `propor_importacao_csv`, `status_das_conexoes` | Conectar conta continua sendo ato da pessoa (login no provedor) |
| E. Política automática | regras do dono para aprovar sozinho o que for de baixo risco | Só depois de A–C estarem estáveis |

Cada fatia entrega: migration (função `agent_*` + GRANT explícito) + teste pgTAP (inclui isolamento) + ferramenta MCP + teste Vitest + registro em `docs/adr` se algo mudar.

## Ponto de controle: Unipile real
Nenhum envio automático por agente deve ir a cliente real antes da **homologação da Unipile** com conta de teste
(DSN + chave de API fornecidos pelo dono, e alguém com acesso à documentação oficial para conferir os formatos).
Hoje todos os formatos da Unipile são **não verificados** (só testados com versão falsa). A fatia A pode ser construída antes, mas o envio real só liga depois da homologação.

## Consequências
- Mais superfície de ataque: mitigada por token por workspace, pausa, aprovação e auditoria encadeada.
- O app continua usável só por pessoas; o agente é um "usuário a mais" sem poder de gasto.

## Pendente (não decidido aqui)
- Limite de propostas por hora por agente.
- Quais ações o dono aceita aprovar automaticamente (fatia E).
