# ADR 0062 — Enriquecimento automático de contas e personas

Status: aceita (preço em créditos provisório, a medir)
Data: 2026-10-06
Relacionadas: 0021 (créditos, nunca dólar), 0023 (segurança do banco), 0055 (coleta de sinais), 0060 (teto em dólar), 0061 (camada de execução do agente)
Spec e tickets: `.scratch/enriquecimento-de-contas/`

## Contexto
Uma conta nascia só com nome, site, cidade e UF digitados, e nada a completava depois. Logo, latitude e longitude existiam no banco, mas ninguém os gravava. O mapa do Início contava contas por estado, e conta sem estado virava só um número. Não havia CNPJ, endereço nem telefone da empresa. Os contatos (personas) só entravam à mão ou por CSV. O Nan pediu que isso passasse a ser feito sozinho (06/10/2026).

## Decisão
1. **Sempre automático.** Toda conta nova (à mão, por CSV, pelo agente ou pelo CRM) entra sozinha na fila `internal.account_enrichments`, por gatilho. Contas que já existiam podem ser pedidas por `account_enrichment_request` (só C-level, estrategista e superadmin).
2. **Duas etapas por conta.**
   - **Empresa** (só fontes públicas, sem chave; parte do domínio que a conta já tem): site → CNPJ lido do site (dígitos conferidos) → Receita Federal (BrasilAPI; minhareceita de reserva) → coordenadas pelo CEP (BrasilAPI v2), senão pelo endereço e, por último, pela cidade (Nominatim) → logo.
   - **Pessoas:** só depois da empresa. Busca no Google (`apify/google-search-scraper`) e lê só os perfis escolhidos (`harvestapi/linkedin-profile-scraper`) para trazer foto e cargo. **Até 5 por conta.** Os cargos procurados são do cliente (`workspace_settings.personas_alvo`, com um padrão: CEO, Diretor, Sócio, Head, Gerente).
3. **Mesmo desenho da coleta de sinais (ADR 0055).** O banco escolhe, reserva o crédito e aplica o resultado (`enrichment_next`, `enrichment_finish`, `enrichment_fail`, só `service_role`). O serviço `enriquecimento` (`src/server/enriquecimento/`, contêiner no `docker-compose.yml`) só busca fora. Falha devolve o crédito, tenta de novo (até 3 vezes) e nunca grava dado inventado. Etapa que não achou nada devolve a reserva.
4. **Manual vence.** O que uma pessoa digitou ou editou entra em `accounts.campos_manuais` e o enriquecimento nunca sobrescreve. O gatilho marca isso em toda escrita que não seja do próprio enriquecimento.
5. **Origem e data.** Cada dado da conta guarda de onde veio e quando (`accounts.fontes`). Cada canal de contato guarda `fonte` e `coletado_em`. Contato criado pelo enriquecimento tem `contacts.origem`.
6. **Telefone das pessoas (decisão do Nan: buscar).** Só roda se houver fonte configurada (`ENRIQ_TELEFONE_ATOR` e `ENRIQ_TELEFONE_ENTRADA`); sem ela, as pessoas entram sem telefone. Proteções da LGPD:
   - origem e data em cada número;
   - lista de supressão por cliente: `contact_suppress` apaga a pessoa e guarda os identificadores (e-mail, LinkedIn, telefone) para nunca recriar. Telefone com ou sem o 55 do Brasil é o mesmo número;
   - o número nunca sai do workspace do cliente (RLS, com teste de isolamento);
   - **antes de vender**, validar a base legal (legítimo interesse em prospecção B2B) com um advogado. A Althius não é escritório de advocacia.
7. **Créditos (ADR 0021): medir antes, cobrar depois.** Começa em **5 créditos por conta enriquecida e 2 por persona criada** (`internal.enrichment_prices`). O teto em dólar de cada trabalho é o que o cliente paga, como na ADR 0060 (`internal.signal_teto_usd`): o enriquecimento nunca custa mais do que cobra. O cliente nunca vê dólar. O custo real fica em `custo_usd` na fila, só para o superadmin.
8. **Mapa do Início: toda conta aparece.**
   - Com coordenada: pin no ponto exato (CEP ou endereço) ou aproximado (só a cidade).
   - Só com o estado: pin em volta do número do estado, com contorno tracejado ("local aproximado").
   - Sem nada: marcador **"Sem localização"** no oceano, fora do desenho do Brasil. Clicar nele lista essas contas. Conta sem endereço nunca entra na contagem de nenhum estado.
   - Mudança feita por regras em `scripts/v18/patches.mjs` (nunca no arquivo gerado) e dados vindos de `src/app/servicos/contas.ts`.
9. **Fotos.** A tela acha a foto pela chave em `ALTHIUS_FOTOS`. Foto do banco (endereço https) é publicada por `publicarFotosDosContatos` em `AlthiusApp.ts`, e sai da memória do navegador ao trocar de workspace ou sair. Endereço que não é https é ignorado.
10. **Site digitado vai para o banco.** "Salvar site" na conta chama `update_account`, e o enriquecimento usa esse site.

## Achado de custo (precisa do olhar do Nan)
- O ator `harvestapi/linkedin-profile-search` (busca de pessoas por empresa e cargo) custa cerca de **US$ 0,10 por página, ou seja, cerca de 10 créditos**. Sozinho, ele comeria o valor cobrado (5 por conta mais 2 por persona).
- Por isso a etapa de pessoas usa **Google para achar os perfis + leitor de perfis só nos 5 escolhidos**. A estimativa é de cerca de **3 créditos de custo para 10 cobrados** com 5 pessoas.
- **Isso ainda não foi rodado com chave real.** Falta medir `custo_usd` na fila com algumas contas de verdade antes de fixar o preço. O preço atual é provisório.

## Conflito com o documento de regras (aberto, decisão do Nan)
A tabela "Créditos" de `althius-frontend-v18/docs/Althius_papeis_permissoes_conexoes_Hermes.md` diz:
- "Enriquecer um contato (e-mail e telefone)": **10 créditos**;
- "Mapear o comitê de uma conta": **25 créditos**.

O enriquecimento automático cobra **2 por persona criada**, com telefone quando houver fonte, e **5 por conta**: no máximo 15 por conta com 5 pessoas. Vale a decisão mais nova do Nan (06/10/2026, "medir antes, cobrar depois"), mas **o documento não foi mudado**. O Nan decide se:
- (a) atualiza a tabela do documento com os valores do enriquecimento automático; ou
- (b) mantém as duas coisas separadas: o automático é mais barato e as ações pedidas à mão seguem a tabela.

## Não fizemos (por enquanto)
- **Achar o site de conta sem domínio** e **achar o CNPJ por busca ("CNPJ + nome", conferindo a razão social)**: estavam na spec, mas a etapa "empresa" de hoje só parte do domínio da conta e lê o CNPJ do próprio site. Conta sem domínio ou com site sem CNPJ fica sem CNPJ e sem endereço: no mapa, vira pin aproximado se tiver o estado digitado; senão, fica em "Sem localização". Fazer isso exige busca paga na Apify e uma regra de conferência de nome; fica para uma decisão do Nan.
- **Fontes trocáveis (ticket 06):** a interface `FonteDeEnriquecimento` da spec não existe. As fontes estão escritas direto em `empresa.ts` e `pessoas.ts`; só o telefone tem uma fonte configurável (`FonteDeTelefone`). Apollo e outras bases pagas ficam para depois dessa interface.
- **Mostrar "de onde veio" na tela (ticket 07):** o banco guarda a fonte e a data de cada dado, mas a tela ainda não mostra.
- **Botão "Remover a pedido do titular (LGPD)" no contato:** a função do banco existe (`contact_suppress`, só gestores), mas os tickets não pedem o botão. Fica para o Nan dizer onde ele entra.
- Reenriquecer periodicamente: a coleta de sinais (`receita_federal`, `nova_filial`) cuida da mudança no tempo.
- Botão "Enriquecer de novo" na tela: a função do banco existe (`account_enrichment_request`), mas a tela não está nos tickets.
- A ferramenta `enriquecer_conta` do agente como proposta (ADR 0061, tipo `acao_externa`) não foi construída.

## Limites conhecidos
- Coordenadas pela cidade (Nominatim) são aproximadas e o uso é "justo": poucas consultas por segundo.
- O CNPJ lido do site é o primeiro com os dígitos verificadores corretos; um site com o CNPJ de outra empresa (matriz, grupo) pode trazer o CNPJ errado. Hoje a tela não mostra CNPJ nem razão social; eles ficam só no banco.
- Quem pede para sair precisa, hoje, de alguém da equipe chamando `contact_suppress` direto no banco.
- Pessoa sem e-mail nem telefone aparece no comitê como "Sem e-mail nem telefone ainda" (antes a tela mostrava "undefined").
