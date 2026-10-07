# ADR 0065 — Leads no Pipeline e o agente orquestra

Status: aceita
Data: 2026-10-07
Relacionadas: 0024 (porta do agente), 0043 (app controlado por agentes), 0058 (propor, aprovar, executar), 0061 (camada de execução), 0062 (enriquecimento), 0064 (plataforma enxuta)

## Contexto
O Nan pediu (07/10/2026):
- abrir a conta pelo card do Pipeline, como em Contas e leads;
- adicionar uma conta à mão e importar uma lista;
- levar contas ao Pipeline, uma ou em massa, na motion certa (SLG, MLG ou PLG);
- que os agentes consigam fazer isso também: criar contas, pedir enriquecimento e montar um plano de várias etapas para uma aprovação só.

"Lead" aqui é a **conta** (a empresa): é o que aparece em Contas e leads e nos cards do Pipeline.

## Decisão
### Tela
1. **O card do Pipeline abre a ficha da conta** (a mesma de Contas e leads). O lápis do card edita o negócio (valor, etapa, data).
2. **Contas e leads:**
   - "Adicionar conta": nome, site, UF e cidade. Usa `create_account`, a mesma regra de antes (só gestores).
   - "Importar lista": cola um CSV com cabeçalho `nome;site;uf;cidade`. Linha com problema não deixa importar nada, e o formulário diz qual linha. Usa `import_accounts`, que marca duplicadas.
   - Toda conta nova entra sozinha no enriquecimento (ADR 0062).
3. **Levar contas ao Pipeline** (`opportunity_add_accounts`, migration 128):
   - da ficha da conta ("Adicionar ao Pipeline"), escolhendo o quadro;
   - do Pipeline ("Adicionar contas da base"), em massa, por critério: todas, só as quentes, fit 80 ou mais, ou só as que ainda não estão em nenhum quadro.
   - A motion é a do quadro. Cada conta vira um negócio na primeira etapa, com **valor 0** (ninguém inventa valor).
   - Quem já está no quadro não duplica. Conta de outro cliente é ignorada.
   - Mesmas regras de criar negócio: `pipeline.deals`; o BDR só cria para si; os outros usam o dono da conta, ou quem levou. No máximo 500 por vez.
4. **Botão secundário** no topo das páginas de módulo (`acao2`), usado por "Importar lista" e "Adicionar contas da base".

### Agentes (migration 129, servidor MCP)
5. Propostas novas pela porta do agente. Só com o token; nada roda sem aprovação de uma pessoa, e quem decide é a operação (C-level ou estrategista):
   - `propor_contas`: até 50 contas. O site é normalizado e a que já existe fica de fora. Aprovada, a conta nasce e entra no enriquecimento.
   - `propor_enriquecimento`: contas que já existem voltam para a fila (empresa e pessoas). A aprovação mostra os créditos estimados.
   - `propor_levar_ao_pipeline`: igual ao botão da tela.
6. **`propor_plano`: de 2 a 20 passos numa aprovação só.**
   - Cada passo é uma proposta que já existe: criar contas, enriquecer, levar ao Pipeline, criar negócio, mover negócio, criar tarefa ou inscrever em cadência.
   - Os passos ficam presos ao plano (`approvals.parent_approval_id`). Não aparecem soltos em Aprovações e **não se decidem sozinhos** (gatilho `approvals_passo_so_com_o_plano`).
   - Aprovado o plano, os passos são aprovados na ordem e cada um aplica o seu efeito, com os gatilhos de sempre. Recusado o plano, ou com ajustes pedidos, todos os passos são recusados.
   - Um passo inválido recusa o plano inteiro e a resposta diz qual ("Passo 2: ..."). Nada fica pela metade.
   - A prévia da aprovação lista os passos numerados.

## Limites conhecidos
- Um passo do plano só usa contas que **já existem**. Criar contas e levá-las ao Pipeline no mesmo plano não dá: os ids ainda não existem na hora da proposta. O agente faz em dois planos.
- O plano não leva passo que é gasto (verba de campanha): esse continua sendo uma proposta à parte, decidida pelo C-level.
- A importação pela tela é por texto colado. Enviar um arquivo fica para depois.
