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

## Decisões tomadas sem o Nan (pequenas, técnicas)
- **Preço provisório: 1 crédito por empresa nova**, máximo de 200 por busca (como pedido). A medir com o SQL do `docker/LEIA-ME.md`.
- **A entrada do ator é montada no serviço**, não no banco (o banco devolve modelo e parâmetros já validados). Mais simples de testar; o banco continua sendo quem valida.
- **Filtros de porte e capital** cobram só o que passa no filtro: o fornecedor cobra pelos itens que o ator devolve, mas o cliente paga só pelas empresas que entram. Se o custo real subir demais, a solução é preço maior por empresa, não cobrar pelo descarte.
- **Ferramenta extra `prospeccao_buscas`** (leitura): para a Zoe contar à pessoa o que a busca trouxe.
- Os nomes exatos dos campos do ator da Receita estão com alternativas tolerantes (`nome_fantasia|razao_social`...). **Confirmar no primeiro uso real** e ajustar o mapeamento (é dado, sem código).
- O sócio (QSA) da Receita **não é guardado** nas candidatas (dado de pessoa; LGPD). O mapeamento de pessoas continua no enriquecimento (ADR 0062).

## Consequências
- Testes: pgTAP `00083_prospeccao_buscas.sql` (113), Vitest do serviço (`src/server/prospeccao/`), das ferramentas (`src/server/mcp/prospeccao.test.ts`), do serviço da tela e da tela (`prospeccao.tela.test.tsx`).
- `docker-compose.yml` ganhou o contêiner `prospeccao` (`docker/Dockerfile.prospeccao`, variáveis `PROSP_*`).

## Limites conhecidos
- Só duas fontes cadastradas. Anúncios do Meta, Instagram, SEO, imóveis etc. entram como **registro novo** (pela equipe ou por proposta do agente, como na ADR 0060) — falta a proposta de fonte de prospecção pelo agente.
- Uma busca por vez no contêiner (cada uma pode trazer centenas de itens).
- A tela ainda não mostra a lista de buscas em tabela própria (só as 3 mais recentes no subtítulo).
