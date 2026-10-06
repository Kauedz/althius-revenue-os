# Mapa da plataforma: o que é de verdade, o que é protótipo, o que sobra

Feito em 06/10/2026, percorrendo o app no **modo real**, com o banco local, em dois workspaces:
- **Evolut** (tem dados de demonstração no banco);
- **Grão Norte** (vazio). Tudo que aparece num workspace vazio e não vem do banco é **protótipo fixo**, que é dado inventado (regra 2 do AGENTS.md).

## 1. Página por página (menu do cliente)

| Página | Ligada ao banco? | O que vi |
| --- | --- | --- |
| Início | Sim | Mapa, números e operação vêm do banco. Vazio mostra "Sem dados ainda". |
| **Estratégia** | **Não** | **Protótipo fixo**: no workspace vazio mostra "ICP v4", "3.420 contas no ICP", "Camila Duarte" e uma tabela de ICP/personas inventada. |
| Aprovações | Sim | Vazio: "Nada para aprovar". |
| Contas e leads | Sim | KPIs e lista do banco; importação e criação funcionam. |
| Prospecção | Sim | Vazio: tudo "Sem dados ainda". Cada número tem a legenda "Sem dados ainda" embaixo (repetitivo). |
| Cadências | Sim | Vazio e limpo. |
| Tarefas | Sim | Vazio e limpo. |
| Campanhas | Sim (lista e verba) | Seis cartões de canal com texto longo ("O que o agente faz"), cada um com chips de conectores. Investido, leads e CPL aparecem "—" porque não há fonte de investimento. |
| Pipeline | Sim | Quadros SLG/MLG/PLG e 6 etapas do banco. |
| Caixa de entrada | Sim | Conta pessoal pela Unipile; só entra contato do CRM. |
| Agentes | Sim | Os 4 agentes do banco. |
| Execuções | Sim | Três visões (Lista, Kanban, Timeline). |
| **Conteúdos** | **Não** | **Protótipo fixo**: no workspace vazio mostra 5 conteúdos inventados e o botão "Gerar conteúdo". Não existe tabela nem serviço. |
| Sinais | Sim | Catálogo e eventos do banco. **O texto "Coleta automática em breve" está desatualizado**: a coleta já existe (ADR 0055). |
| Relatórios | Sim | Números do banco; boa parte da página fica "Sem dados ainda". |
| Integrações | Sim | Agora com 16 conectores (ADR 0063). |
| Créditos e uso | Sim, com ressalva | Saldo e extrato do banco. **"Comprar em 1 clique" soma o saldo na hora, sem nenhum meio de pagamento** (`credit_purchase` não cobra de ninguém). |
| **Equipe e acessos** | **Não** | **Protótipo fixo**: no Grão Norte mostra Aline, Lucas, Bruna... (no banco só há Camila, Eduardo e Rafael). Não é vazamento de cliente, é dado do protótipo. A equipe real, ligada ao banco, está em Configurações → Workspace e membros. |
| Configurações | Em parte | Minha conta, Aprendizado e Workspace e membros: reais. |
| Superadmin (6 páginas) | Sim | Workspaces, Uso global, Fornecedores, Margens, Auditoria, Saúde (cobertas por teste). |

## 2. O que já foi feito nesta rodada (ADR 0063)
- Catálogo de Integrações: de 37 para 16 conectores. Meta Ads, RD Station e Google Agenda ficam "Em breve".
- Cartões de canal de Campanhas e permissões dos agentes não citam mais conector que saiu.

## 3. Proposta de remoção e conserto (precisa do "pode" do Nan)

**A. Tirar do menu o que é dado inventado e não tem backend** (a plataforma precisa ser 100% verdade):
1. **Conteúdos**: tirar do menu e da navegação. Volta quando houver tabela, serviço e agente (Lia) gerando de verdade.
2. **Equipe e acessos**: tirar do menu (duplica Configurações → Workspace e membros, que é o real).
3. **Estratégia**: duas saídas.
   - (a) esconder até existir;
   - (b) ligar ao playbook real do workspace (ICP e personas já existem em `workspace_settings.personas_alvo` e no playbook dos agentes).
   - Recomendo **(b) mostrando só o que existe**, mas é uma fatia de trabalho, não uma remoção.

**B. Enxugar o que polui (mantendo a função):**
4. **Campanhas**: trocar os seis cartões longos por **uma lista de campanhas** com o canal como coluna, e um aviso único "Meta Ads: em breve".
5. Tirar a legenda **"Sem dados ainda"** de baixo de cada número, e deixar só o "—" ou o 0.
6. **Sinais**: trocar "Coleta automática em breve" pelo estado real da coleta.
7. **Execuções**: ficar só com a **Lista** e deixar Kanban e Timeline para depois.
8. **Relatórios**: esconder os blocos que estão vazios por falta de fonte (campanhas por canal, relatórios automáticos) até haver dado.
9. **Créditos**: deixar a tabela "Quanto custa cada ação" recolhida (ela é longa e já está nas regras).

**C. Consertar antes de vender (não é remoção):**
10. **Compra de créditos sem pagamento**: precisa de um meio de pagamento (Pix, cartão ou boleto) ou, até lá, o botão deve virar "Pedir créditos à Althius" (vira aprovação/aviso). Hoje qualquer C-level se dá créditos de graça.

## 4. Agentes orquestrando tudo (a visão do Nan)
O que existe hoje: 4 agentes (Zoe, Jax, Lia, Neo) com 26 ferramentas pelo servidor MCP. 15 são de **leitura** (contas, contatos, membros, tarefas, cadências, quadros, negócios, sinais, campanhas, habilidades, integrações, catálogo de sinais). 10 são de **proposta** com aprovação:
- atualizar conta, criar tarefa, inscrever em cadência, criar negócio, mover negócio;
- criar campanha, mudar verba, mudar status;
- agir num app conectado;
- propor receita de sinal.

Há também 1 de ação externa (testar fonte de sinal). Há conversa direta com cada agente, canais de chat e copiloto.

O que **falta** para o agente "orquestrar tudo", como um Slack com o Claude Code por trás:
- **Criar e importar contas** e **pedir enriquecimento** (hoje só pela tela).
- **Escrever e salvar conteúdo** (não há Conteúdos).
- **Ler e propor mudança no playbook/ICP** (Estratégia).
- **Publicar campanha na Meta** (Em breve).
- **Ver o resultado de campanha** (sem fonte de investimento).
- Uma única conversa em que o agente **encadeia** várias dessas coisas e mostra o plano para aprovação (a ADR 0061 já cita "modo plano" como próxima fatia).
