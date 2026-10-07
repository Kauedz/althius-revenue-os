# Enriquecimento automático de contas e personas

Status: ready-for-agent (decisões do Nan tomadas em 06/10/2026, no fim). Origem: pedido do Nan em 06/10/2026.

## Problem Statement
Hoje uma conta nasce só com nome, domínio, cidade e UF digitados (`create_account`, `import_accounts`) e **nada a completa depois**. Os campos `logo_url`, `lat` e `lng` existem no banco, mas ninguém os grava. O logo só aparece se alguém digitar o site no painel, e não fica salvo. O mapa do Início conta contas por UF, e conta sem UF vira só um número "sem localização". Não existe CNPJ, endereço nem telefone da empresa. Contatos (personas) só entram à mão ou por CSV. A fila `enrichment` (`src/server/queues/definitions.ts`) existe, mas não tem consumidor.

## Solution
Toda conta criada (à mão, por CSV, pelo agente ou pelo CRM) entra numa **fila de enriquecimento** que roda sozinha e cobra créditos:

1. **Site e logo.** Sem domínio, acha o site da empresa (busca pela Apify). Com o domínio, grava o logo da conta, que passa a aparecer sempre, sem ninguém digitar.
2. **CNPJ.** Lê o site atrás do CNPJ (rodapé, "quem somos", política de privacidade). Sem CNPJ no site, faz uma busca "CNPJ + nome" e confere pela razão social. CNPJ achado por busca só vale se o nome bater.
3. **Receita Federal (BrasilAPI, grátis).** Com o CNPJ, preenche razão social, nome fantasia, endereço completo, CEP, cidade, UF, telefone e e-mail da empresa, CNAE, porte e situação.
4. **Localização.** Com o endereço ou CEP, transforma em latitude e longitude, e a conta vira um ponto no mapa do Início. **Obrigatório:**
   - toda conta aparece no mapa;
   - conta sem endereço fica num marcador próprio "Sem localização", fora do desenho do Brasil, que mostra a lista ao clicar;
   - conta sem endereço nunca entra na conta de nenhum estado.
5. **Personas.**
   - Com os cargos das personas do ICP do cliente (Playbook), busca no LinkedIn as pessoas da empresa com esses cargos (Apify).
   - Cria os contatos com nome, cargo, papel na compra, LinkedIn e **foto**, que aparece sozinha.
   - Não duplica contato que já existe (LinkedIn ou e-mail).
6. **Telefones.** O da empresa vem da Receita. O das pessoas fica para decisão do Nan (LGPD, ver abaixo).

Fontes atrás de uma interface `FonteDeEnriquecimento`, para trocar ou somar Apollo e outras bases depois sem mexer no resto.

## User Stories
1. Como estrategista, quero importar 200 empresas por nome e, minutos depois, ver cada uma com site, logo, CNPJ, endereço e telefone.
2. Como C-level, quero abrir o Início e ver todas as minhas contas no mapa do Brasil, e as sem endereço num cantinho próprio, sem bagunçar os estados.
3. Como BDR, quero abrir uma conta e já ver os decisores com foto e LinkedIn.
4. Como estrategista, quero saber de onde veio cada dado (Receita, site, LinkedIn) e quando.
5. Como C-level, quero ver quantos créditos o enriquecimento gastou e nunca pagar por um que falhou.
6. Como usuário, quero que o que eu digitei à mão nunca seja sobrescrito pelo enriquecimento.
7. Como dono, quero trocar ou somar fontes (Apollo, outras bases) sem refazer o resto.

## Implementation Decisions
- **Fila no banco.** Nova tabela `internal.account_enrichments`, com uma linha por conta e etapa (site, cnpj, receita, geo, personas) e estado. Usa o mesmo padrão da coleta de sinais (ADR 0055): o banco escolhe, reserva o crédito, o serviço busca e entrega; falha devolve o crédito e nunca inventa dado.
- **Serviço.** O mesmo contêiner `sinais` ganha um ciclo de enriquecimento (ou um contêiner irmão `enriquecimento`). A fila `enrichment` do BullMQ, que não tem consumidor, é removida ou ignorada.
- **Colunas novas em `accounts`:** `cnpj`, `razao_social`, `endereco`, `cep`, `telefone`, `cnae`, `porte`, `situacao_cadastral`, `enriquecido_em` e `fontes JSONB` (de onde veio cada campo). `lat`, `lng` e `logo_url` passam a ser preenchidos.
- **Nunca sobrescreve campo digitado.** Cada campo guarda a origem: `manual` vence `enriquecimento`.
- **Contatos criados pelo enriquecimento:**
  - marcados com a origem (coluna nova em `contacts`, que hoje não tem);
  - LinkedIn em `contact_channels` e foto em `photo_url`;
  - no máximo N por conta (decisão do Nan).
- **Mapa.**
  - Pinos por conta (lat/lng) por cima da cor por UF que já existe.
  - Marcador "Sem localização" fora do contorno do Brasil.
  - Muda o `get_home_summary` e o protótipo (via `scripts/v18/patches.mjs`, nunca à mão no gerado).
- **Créditos.** Por etapa: Receita é grátis na fonte, mas cobra pouco pelo trabalho; site e CNPJ por busca; personas por pessoa encontrada. Os valores são decisão do Nan; o teto em dólar segue a regra da ADR 0060 (nunca custa mais do que cobra).
- **Agente.** Ferramenta `enriquecer_conta` como **proposta** quando gasta créditos fora do automático (ADR 0061: tipo `acao_externa`).

## Testing Decisions
- pgTAP: fila, reserva/cobrança/devolução, isolamento entre clientes, "manual vence", deduplicação de contatos, `get_home_summary` com pinos e "sem localização".
- Vitest com BrasilAPI, Apify e geocodificação **falsas**: extração de CNPJ do HTML, conferência de razão social, mapeamento da Receita, criação de personas e tela do mapa.
- Nenhum teste chama fonte real.

## Out of Scope (por enquanto)
- Apollo e outras bases pagas (só a interface fica pronta).
- Telefone pessoal de pessoas, até a decisão de LGPD.
- Reenriquecer periodicamente (a coleta de sinais `receita_federal` e `nova_filial` cuida da mudança no tempo).

## Decisões do Nan (06/10/2026)
1. **Créditos:** medir antes e cobrar depois. Começa com **5 créditos por conta enriquecida + 2 por persona encontrada**, com o teto em dólar da ADR 0060 (nunca custa mais do que cobra). Ajustar com o custo real do beta.
2. **Personas:** até **5 por conta**.
3. **Telefone das pessoas:** **buscar também**. Proteções obrigatórias (LGPD, base de legítimo interesse em prospecção B2B; a Althius não é escritório de advocacia, então confirmar com um advogado antes de vender):
   - guardar a origem e a data de cada número;
   - só usar em canais profissionais;
   - lista de supressão: pessoa que pedir para sair é apagada e nunca volta;
   - nunca mostrar o número fora do workspace do cliente.
4. **Gatilho:** **sempre automático** ao criar ou importar conta.
