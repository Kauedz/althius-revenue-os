# ADR 0024: Hermes Agent (Nous Research) como runtime dos agentes, Laya como classificador, treg fora do núcleo

## Contexto
O dono do produto decidiu usar o **Hermes Agent** da Nous Research (MIT, Python) para rodar os 4 agentes. Os perfis dele isolam configuração, memória, sessões, skills e credenciais (`~/.hermes/profiles/<nome>/`). O quadro **Kanban** (`hermes kanban`, um SQLite por quadro) coordena um orquestrador e trabalhadores em paralelo, com bloqueio para decisão humana. Cada perfil pode expor uma API compatível com OpenAI (API server).

A própria documentação do Kanban avisa: ele é "single-host by design" com modelo de ameaça de "usuário local confiável", e as rotas do painel não exigem autenticação (só localhost). Ou seja, o isolamento entre perfis **não é uma barreira de segurança entre clientes**: um agente com ferramentas de terminal ou arquivos na mesma máquina poderia ler o perfil de outro cliente.

Nomes: "Hermes" no documento de regras é o **orquestrador com as 4 checagens** (papel → dono do dado → decisão → créditos), já implementado no banco (`hermes_evaluate_action`). Daqui em diante:
- **Hermes Agent** = o programa da Nous Research que raciocina e coordena os agentes;
- **política Hermes** = as 4 checagens no banco, que continuam sendo a última palavra.

## Decisão
1. **Hermes Agent planeja; a plataforma executa.** O Hermes Agent não acessa o banco nem APIs externas diretamente. Ele só enxerga as ferramentas de um **servidor MCP da Althius** (nosso código), com allowlist por perfil. Cada ferramenta (ex.: `buscar_leads`, `propor_atualizacao`, `solicitar_enriquecimento`, `classificar`, `preparar_envio`) passa pela política Hermes, registra execução e auditoria e consome créditos pelo ledger.
2. **Isolamento por workspace:**
   - 1 perfil por agente de cada workspace (ex.: `evolut-comercial`, `evolut-copy`) + 1 perfil orquestrador (copiloto) por workspace;
   - 1 quadro Kanban por workspace;
   - **os perfis de um cliente rodam em contêiner separado dos de outro cliente**;
   - ferramentas de terminal, arquivos e código desligadas nos perfis de cliente;
   - o token que o perfil usa no MCP da Althius só vale para o workspace dele.
3. **Estado do negócio é nosso.** Leads, conversas, cadências, execuções, aprovações e créditos ficam no Postgres. O Kanban do Hermes é só a coordenação interna dos agentes; cada cartão aponta para uma execução nossa (`executions.id`). Se o Hermes Agent cair, nada do negócio se perde.
4. **Segredos nunca no Hermes Agent.** Chaves do Apify, Unipile, HubSpot e do modelo de IA ficam no backend (schema `internal`); o MCP da Althius injeta o que precisar.
5. **Laya** (Apache 2.0, roda no nosso servidor, checkpoint multilíngue) é o classificador padrão para decisões delimitadas: intenção de resposta (positiva, adiar, objeção, neutra, opt-out, automática), aderência ao ICP (score) e sinal de opt-out. Fica atrás da interface `classificador` (com versão falsa para teste) e é exposta ao Hermes Agent pelo MCP da Althius (não direto), para registrar e controlar. Antes de qualquer ação automática:
   - conjunto de avaliação com conversas reais em português;
   - limiar de confiança; abaixo dele, revisão humana;
   - **opt-out nunca depende só do modelo**: regra de palavras-chave + modelo, e na dúvida suprime (LGPD).
6. **treg fica fora do núcleo.** O software pode ser hospedado por nós de graça, mas:
   - o catálogo hospedado cobra por chamada (US$ 1 de crédito inicial, depois preço do provedor por chamada, ex.: US$ 0,004 por verificação Hunter);
   - os dados das chamadas passam pelos servidores deles;
   - a licença aparece de forma divergente (repositório: Apache 2.0 com termos extras; site: AGPL), o que pede leitura jurídica antes de embutir num produto vendido.
   Pode ser usado como laboratório para testar provedores novos antes de escrevermos o conector.
7. **O Hermes Agent aprende com cada workspace, sem misturar workspaces.** Três camadas, como no Blueprint ("Memória") e no documento de papéis ("Aprendizado não é tela própria"):

   | Camada | O que guarda | Onde fica | Quem vê e corrige |
   |---|---|---|---|
   | Memória do agente | Preferências operacionais que o próprio agente anota (ex.: "na Evolut, ligar antes das 10h funciona melhor") | Perfil do Hermes Agent daquele workspace (`MEMORY.md`, skills), **com cópia no nosso banco** a cada alteração | Estrategista e superadmin: ver, corrigir e excluir |
   | Memória do workspace | Fatos aprovados sobre o cliente, a oferta e o processo, compartilhados pelos 4 agentes daquele cliente | Nosso banco, lida pelo MCP da Althius (ferramenta de consulta) | Estrategista aprova; C-level lê |
   | Mudança de comportamento oficial | Playbook e skills publicados | `agent_playbooks` / `agent_skills`; o agente só **sugere** (`learning_entries` com status sugerida → aplicada/descartada, com a evidência, ex.: "aprendido com 140 ligações") | Estrategista aplica ou descarta |

   Garantias de não misturar:
   - Nenhuma memória global com dado de cliente. Perfis, quadros e contêineres são por workspace; o token do MCP só lê o workspace dele.
   - **Teste de vazamento obrigatório (canário):** grava-se um fato único e inventado na memória do workspace A e pergunta-se aos agentes do workspace B; o fato nunca pode aparecer. Roda a cada mudança no Hermes Agent ou no MCP.
   - Aprendizado entre clientes só por curadoria da Althius, com material anonimizado e autorizado, entrando nos **modelos globais** (templates sem dado privado). Nunca automático.
   - Excluir o workspace (ou pedido do titular, LGPD) apaga também o perfil, a memória e a cópia no banco.
   - Nem toda mensagem vira memória: o agente anota fatos operacionais, não conversas inteiras nem dados pessoais de leads.

## Consequências
- Primeira fatia (pequena):
  1. Hermes Agent local com 1 perfil (`evolut-comercial`);
  2. MCP da Althius com 2 ferramentas (`buscar_leads`, `propor_atualizacao`);
  3. Laya via `classificar`;
  4. resultado: uma alteração proposta que vira aprovação na tela. Tudo com versões falsas nos testes automáticos.
- Novo componente de infraestrutura (Python): Hermes Agent e Laya rodam em contêineres próprios. Laya roda em CPU para volume baixo; GPU recomendada em produção.
- A ideia anterior de um orquestrador próprio em TypeScript com BullMQ (sem ADR) fica substituída para o raciocínio dos agentes. Filas continuam úteis para trabalho determinístico (envio de mensagens, sincronização com CRM, coleta).
- Validar as versões atuais dos três projetos antes de implementar: a documentação muda rápido.

## Implementação da primeira fatia (2026-10-03)
- **Porta do agente** (migration `20261002000040_agent_runtime.sql`): cada agente de cada workspace recebe um token `alt_agente_…` (só o hash fica no banco, tabela `agent_runtime_tokens`, sem acesso para usuários). O token também diz **quem responde pelo agente** (estrategista, C-level ou superadmin do workspace); essa pessoa aparece como solicitante das propostas.
- **Exceção consciente à ADR 0023:** `agent_list_contacts` e `agent_propose_update` têm `GRANT EXECUTE` para `anon`, porque o servidor MCP usa a chave pública + o token, **nunca** a chave de sistema. Sem token válido, a função devolve erro `28000`. Assim um contêiner de cliente comprometido não alcança outro cliente. Não "corrija" esse GRANT.
- **Proposta → aprovação:** `agent_propose_update` cria aprovação `operacao`/`crm` (tela: "Alteração de CRM") com prévia "Cargo de X: antes → depois", idempotente por chave. Ao ser aprovada, o gatilho `approvals_aplicar_proposta_agente` aplica a mudança, **desde que o valor não tenha mudado depois do pedido** (senão registra "não aplicada" no histórico). Por enquanto só o campo `cargo` (`contacts.job_title`).
- **Servidor MCP** (`src/server/mcp/`): TypeScript com `@modelcontextprotocol/server` v2; ferramentas `buscar_contatos` e `propor_atualizacao`, nenhuma recebe workspace. Roda com `node src/server/mcp/principal.ts` e as variáveis `ALTHIUS_SUPABASE_URL`, `ALTHIUS_SUPABASE_CHAVE_PUBLICA`, `ALTHIUS_AGENTE_TOKEN`; recusa iniciar com a chave de sistema.
- **Canário automático:** `supabase/tests/database/00030_agent_runtime.sql` e `src/server/mcp/althius.test.ts` (cliente MCP real em memória, sem modelo de IA). Teste manual com Hermes Agent + Groq em 2026-10-03: a Grão Norte recebeu lista vazia; a Evolut criou a proposta no banco real.
- Pendências: Laya (`classificar`), memória do workspace (ADR, camada 2), espelho da memória do agente no banco, notificação ao aprovador, tela para criar/revogar tokens, Hermes em contêiner por cliente.
