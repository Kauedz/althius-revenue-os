# ADR 0067 — Prospecção: buscas e candidatas (e, a seguir, ICP, fit e papéis dos agentes)

Status: aceita
Data: 2026-10-07
Relacionadas: 0024 (porta do agente), 0058 (quem pediu), 0060 (fonte como dado), 0061 (política das ferramentas), 0062 (enriquecimento), 0064 (créditos pedidos à Althius), 0066 (sinais com teto). Spec: `.scratch/prospeccao-revenue/spec.md` (fatias 2 a 5)

## Contexto
O agente só trabalhava com as contas que já estavam na base: não havia como buscar empresas novas. O Nan decidiu (07/10/2026): a Zoe é a única que prospecta; ela diz quanto custa antes de rodar e só roda quando a pessoa pede; o que vem cai como **candidata** e a pessoa inclui ou exclui; o crédito da busca é gasto mesmo que ela exclua; só se enriquece o que entra. As duas lógicas (ICP primeiro e sinal primeiro) são a mesma máquina: muda a fonte.

## Decisão (fatia 2: buscas e candidatas — migration 131)
1. **Fonte é dado** (`internal.prospect_sources`): ator da Apify, entrada com `{{variáveis}}` (`{{busca}}`, `{{local}}`, `{{cnae}}`, `{{uf}}`, `{{municipio}}`, `{{max}}`), parâmetros aceitos (obrigatórios, opcionais e filtros) e mapeamento dos campos (caminhos `a.b.0.c`, com alternativas `a|b`). Começa com **Google Maps** (`compass/crawler-google-places`, extras pagos desligados) e **Receita Federal por CNAE** (`jungle_synthesizer/brazil-cnpj-receita-federal-crawler`). Fonte nova = um registro, sem código. O agente e o cliente nunca veem o ator nem dólar.
2. **Fonte de pessoas (B2C)** — ex.: seguidores de concorrente — tem `publico = 'pessoas'` e **não roda** (LGPD) até uma decisão explícita. Nenhuma foi cadastrada.
3. **Fluxo** (tudo conferido no banco; o servidor MCP não decide permissão):
   - `agent_prospect_estimate` (só a Zoe, `agent_code = 'comercial'`): valida fonte, parâmetros (CNAE com 7 dígitos, UF sigla, porte MICRO/EPP/DEMAIS, capital em reais) e o máximo da fonte; grava a busca como `estimada` e devolve o custo (máximo × preço). **Não gasta nada.** Vale 30 minutos.
   - `agent_prospect_run` (só a Zoe): exige estimativa fresca, do mesmo cliente e ainda `estimada` — o servidor garante que **sempre se estima antes**. Exige uma pessoa pedindo (a rodada em andamento, ADR 0058) com `prospecting.approve = all` (BDR não roda). Passa pelo portão de crédito de sempre (`hermes_credit_gate`): dentro do teto → `pendente`; acima do teto, do limite ou do saldo → aprovação de **gasto** (só C-level/superadmin); aprovada → `pendente`, recusada → `cancelada`.
   - Serviço `prospeccao` (contêiner novo, `src/server/prospeccao/`): `prospect_next` reserva o **máximo** (`credit_reserve`, chave de idempotência) e cria a execução "Lista" da Zoe; o serviço monta a entrada, roda o ator com o teto em dólar (= o que o cliente paga) e entrega os itens já no formato comum.
   - `prospect_finish`: insere candidatas, **ignora repetidas** (mesma chave, site que já é conta, CNPJ que já é conta ou candidata), aplica os **filtros do ICP** que a fonte não faz (porte, capital social: sem o dado, não passa), **cobra novas × preço** (nunca mais que o estimado) e devolve o resto. Nada novo = `sem_resultado`, devolve tudo. `prospect_fail` devolve tudo; nova tentativa depois de 30 min, até 3 vezes.
   - Custo real em dólar só em `internal.prospect_search_costs`.
4. **Decisão da pessoa** (`prospect_candidates_decide`, tela; `prospecting.approve = all`): **incluir** cria a conta pela regra de `create_account` (site normalizado; site que já é conta só **liga**), copiando os dados da fonte com a origem em `accounts.fontes` e a marca `althius.enriquecimento` ligada (não viram "manuais"); a conta nova entra sozinha no enriquecimento (gatilho da ADR 0062). **Candidata sem site não vira conta**: a tela pede o site; site digitado por uma pessoa é manual. **Nunca se inventa domínio**; perfil de rede social, WhatsApp e link do Google não contam como site. **Excluir não devolve crédito.**
5. **Ferramentas da Zoe** no MCP: `prospeccao_fontes` e `prospeccao_buscas` (leitura), `prospeccao_estimar` (proposta, não repete sozinha; a descrição manda dizer o custo e esperar o "pode rodar"), `prospeccao_rodar` (ação externa).
6. **Tela Prospecção** (modo real): as candidatas (empresa, site ou "Sem site", cidade, ramo, busca de origem, situação) com filtro por situação, **Incluir/Excluir** por linha (excluir pede confirmação e avisa que o crédito não volta), **"Incluir todas com site"**, os números (buscas, candidatas, incluídas, créditos em buscas) e o estado das buscas recentes no subtítulo. Novas buscas: botão **"Pedir à Zoe"** (abre a conversa com ela). As listas fictícias do protótipo saíram.

## Decisão (fatia 3: ICP estruturado — migration 132)
1. **`workspace_settings.icp`** (objeto): `setores`, `cnaes` (7 dígitos), `portes` (MICRO, EPP, DEMAIS, como a Receita), `funcionarios_min/max`, `faturamento_min/max` (R$/ano), `capital_min/max` (capital social; é o que a Receita traz), `ufs`, `cidades`, `observacoes`. Os cargos alvo continuam em `personas_alvo`. **Sem valor padrão**: sem ICP, o campo é `{}` e a tela diz "Não definido".
2. **Gestor do cliente** (C-level, estrategista, superadmin) edita na tela Estratégia ("Editar ICP"; `workspace_icp_set`). BDR não.
3. **O Jax propõe** (`agent_propose_icp`, só `marketing`): vira aprovação de operação; aprovada, o ICP muda e fica registrado como "agente:marketing".
4. **Os agentes leem** (`agent_icp`, ferramenta `ler_icp`) e o ICP entra no contexto de toda resposta, junto do Playbook (`harness_playbook` passa a anexar o texto do ICP). A Zoe monta os parâmetros das buscas a partir dele.
5. A tela mostra o ICP como primeira linha da Estratégia e o resumo no subtítulo.

## Decisão (fatia 4: fit calculado — migration 133)
1. `accounts.fit` passa a ser **calculado pelo banco**, sem IA, sem API e sem crédito, de 0 a 100:
   - **ICP (até 60)**: só os critérios que o ICP define, com o mesmo peso: **setor** (CNAE da conta na lista, ou o segmento/CNAE da conta citando um dos setores), **porte** (Receita) e **região** (estado e, se houver, cidade). Sem o dado na conta, o critério não pontua ("sem dado"). Sem ICP, 0 ("ICP não definido").
   - **Sinais recentes (até 25)**: sinais dos últimos 30 dias (1 = 10, 2 = 18, 3 ou mais = 25).
   - **Dados completos (até 15)**: site 2, CNPJ 5, endereço ou cidade 3, telefone 2, pelo menos uma pessoa mapeada 3.
2. `accounts.fit_partes` guarda as três partes com o motivo; a ficha da conta mostra "Por que fit N: ICP x/60 (...) · Sinais y/25 (...) · Dados z/15 (...)".
3. Recalcula sozinho quando a conta muda, quando chega ou sai sinal, quando entra ou sai pessoa e quando o ICP do cliente muda (só as contas daquele cliente). **O fit não se escreve à mão**: qualquer valor gravado é substituído pelo calculado.
4. Os números fixos do seed deixam de valer: o fit da demonstração agora é o calculado (sem ICP na Evolut, as notas ficam baixas, e isso é verdade).

## Decisão (fatia 5: papéis dos agentes — migration 134)
1. **Zoe** (comercial): "Prospecção · empresas, pessoas e comitê", a única que prospecta (conferido no banco: só ela estima e roda). **Jax** (marketing): "Estratégia · ICP e mídia paga" (só ele propõe ICP). **Lia** (copy): "Copy · mensagens e cadências". **Neo** (revops): "RevOps · métricas e relatórios".
2. A tela de Agentes (texto do protótipo, por regra nova no `patches.mjs`), o prompt de cada agente (`prompts.ts`, `especialidades.ts`) e os Playbooks de demonstração (seed) passam a dizer isso. Os outros três encaminham à Zoe pedidos de buscar empresas novas.
3. Duas habilidades novas, em todo cliente e nos novos: **"Prospecção: estimar, pedir e trazer candidatas"** (só a Zoe) e **"ICP: ler, conversar e propor"** (só o Jax).
4. **Sem prometer o que não existe**: saiu o "Apollo" da Zoe (não é fonte nossa; entrou "Google Maps"), o Meta Ads do Jax aparece "Em breve" (ADR 0063), e saíram dos Playbooks de demonstração "importação por NCM", "higiene de CRM toda noite", "recalcular previsão" e "publicar relatório no canal".

## Decisões tomadas sem o Nan (pequenas, técnicas)
- **Preço provisório: 1 crédito por empresa nova**, máximo de 200 por busca (como pedido). A medir com o SQL do `docker/LEIA-ME.md`.
- **A entrada do ator é montada no serviço**, não no banco (o banco devolve modelo e parâmetros já validados). Mais simples de testar; o banco continua sendo quem valida.
- **Filtros de porte e capital** cobram só o que passa no filtro: o fornecedor cobra pelos itens que o ator devolve, mas o cliente paga só pelas empresas que entram. Se o custo real subir demais, a solução é preço maior por empresa, não cobrar pelo descarte.
- **Pesos do fit (60/25/15) e pontos por sinal e por dado** foram escolhidos por mim, simples e explicáveis. Ajustar é uma migration pequena.
- **Faturamento e capital social são campos separados no ICP**: o Nan falou em faturamento, mas as fontes públicas (Receita) trazem capital social, não faturamento. O filtro automático das buscas usa porte e capital; o faturamento fica como orientação para os agentes.
- **As ferramentas do MCP não são filtradas por agente**: o servidor MCP só conhece o token, e quem decide é o banco (a Zoe estima e roda; o Jax propõe ICP). Os outros agentes veem as ferramentas e recebem a recusa clara se tentarem.
- A habilidade "Fontes de sinais" (ADR 0060) continua nos 4 agentes: monitorar contas não é prospectar.
- **Ferramenta extra `prospeccao_buscas`** (leitura): para a Zoe contar à pessoa o que a busca trouxe.
- Os nomes exatos dos campos do ator da Receita estão com alternativas tolerantes (`nome_fantasia|razao_social`...). **Confirmar no primeiro uso real** e ajustar o mapeamento (é dado, sem código).
- O sócio (QSA) da Receita **não é guardado** nas candidatas (dado de pessoa; LGPD). O mapeamento de pessoas continua no enriquecimento (ADR 0062).

## Consequências
- Testes: pgTAP `00083_prospeccao_buscas.sql` (113) `00084_icp_estruturado.sql` (31) `00085_fit_calculado.sql` (17) e `00086_papeis_dos_agentes.sql` (11); o `00024` passou a conferir que o fit escrito à mão é substituído, Vitest do serviço (`src/server/prospeccao/`), das ferramentas (`src/server/mcp/prospeccao.test.ts`), do serviço da tela e da tela (`prospeccao.tela.test.tsx`).
- `docker-compose.yml` ganhou o contêiner `prospeccao` (`docker/Dockerfile.prospeccao`, variáveis `PROSP_*`).

## Limites conhecidos
- Só duas fontes cadastradas. Anúncios do Meta, Instagram, SEO, imóveis etc. entram como **registro novo** (pela equipe ou por proposta do agente, como na ADR 0060) — falta a proposta de fonte de prospecção pelo agente.
- **Fit**: sinal que envelhece (passa de 30 dias) só sai da nota na próxima mudança da conta; falta um recálculo diário. Funcionários, faturamento e capital do ICP ainda não entram no fit (a conta não tem esses dados).
- Uma busca por vez no contêiner (cada uma pode trazer centenas de itens).
- A tela ainda não mostra a lista de buscas em tabela própria (só as 3 mais recentes no subtítulo).
