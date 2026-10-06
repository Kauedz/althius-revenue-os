# Reaproveitamento do protótipo AppAlthius

Mapa do que o protótipo (`AppAlthius/`, repositório `Kauedz/Althius`, 557 commits) já tem pronto e do que este projeto ainda não tem. Escrito em 06/10/2026.

**Profundidade da leitura (sem exagero):** li por inteiro os guias (`docs/visao-geral-da-plataforma.md`, `.scratch/ORDEM-BUILD-FUNCIONAL.md`, `supabase/functions/README.md`), a pesquisa de atores, a spec de sinais reais, o estado de cada um dos ~230 tickets e o código do coletor de sinais (`signal-scan/apify.ts`, `signal-runner/adaptadores/comum.ts` e `vagas.ts`). **Não li ainda** os demais arquivos de código (são 183 nas funções e 333 nas telas). Cada área abaixo será lida a fundo no ticket que a portar.

## Como o protótipo difere deste projeto

| Ponto | AppAlthius | Este projeto (`A`) |
| --- | --- | --- |
| Backend | Supabase na nuvem + Edge Functions em Deno (`supabase/functions/*`) | Postgres local/Docker em servidor nosso (ADR 0041) + serviços Node em `src/server/*` |
| Banco | 63 migrations, esquema próprio ("Workspace operacional", "Fonte") | 116 migrations, RLS por `workspace_id`, 4 papéis, matriz de 33 capacidades |
| Agentes | Scopus, Ethos, Rhetor, Oraculum (motor Hermes na Edge Function) | Zoe, Jax, Lia, Neo (Hermes Agent por cliente + MCP, ADR 0047/0048) |
| Cobrança | Por usuário (R$ 500) com Stripe + créditos (ADR 0019 dele) | Franquia mensal + recarga em créditos (ADR 0014/0015), sem Stripe ainda |
| Telas | `projeto-althius-frontend` escrito à mão (React/Vite, 333 arquivos) | Protótipo v18/v22 convertido para React (`src/v18/*.generated.*`) |

**Regra de convivência (AGENTS.md):** a ordem de verdade é o documento de regras, depois o front v22, depois documentos antigos. Portanto, **portamos a lógica de negócio e os testes** do protótipo, adaptando para o banco e o vocabulário deste projeto. **Não copiamos telas nem esquema de banco.**

## O que existe lá e falta aqui

| # | Área | No AppAlthius | Aqui hoje | Plano |
| --- | --- | --- | --- | --- |
| 1 | **Sinais reais** | `signal-scan` (cliente Apify com rodízio de contas, custo real lido com releitura), `signal-runner` (adaptadores testados de vagas, movimentação, anúncios, avaliações; dedupe por acontecimento), registro de atores. Validado em execução real em 30/09 (Nubank) | Catálogo e tela; nada coleta | **Em andamento: `.scratch/coleta-de-sinais` (tickets 01 a 06)** |
| 2 | **Conexões funcionais** (HubSpot, Notion, Apollo, Pipedrive, RD Station, Clay, Lusha, Meta Ads) | OAuth no servidor MCP oficial com PKCE, chave de API, renovação de token, permissão por ferramenta (Ler/Propor/Executar), catálogo ampliado. 30 tickets, vários prontos para conferir | 37 conectores do catálogo aparecem "Em breve" (ADR 0054) | **Próxima grande fatia.** Portar `integration-connect`, `integration-callback`, `integration-tools`, `_shared/integration-access.ts`, `_shared/integracoes/perfis.ts` e a migration `20261002110000_permissao_por_ferramenta` |
| 3 | **Enviar ao CRM** | `crm-handoff` e `_shared/envio-ao-crm.ts` (HubSpot, Pipedrive, RD Station), idempotente por objeto criado | Não existe | Depois das conexões (2) |
| 4 | **Enriquecimento em cascata** | `account-enrichment`, `_shared/provedor-de-contatos.ts`, `contact-photo-lookup` | Não existe | Depois dos sinais |
| 5 | **Descoberta de contas** | `account-discovery` (critérios, pontuação, regiões) | Não existe | Avaliar com o Nan |
| 6 | **Cobrança Stripe** | `stripe-billing`, `stripe-webhook`, preço por assento | Não existe | **Conflito de modelo**: decisão do Nan antes de portar |
| 7 | **E-mail de convite** | `workspace-invitation-email` (Resend) | ADR 0025: convite com "envio pendente" | Portar quando houver conta de e-mail |
| 8 | **Entrada e segurança** | Login Google, senha, código, captcha (Turnstile), senhas vazadas, onboarding pós-login | Login simples (ADR 0022) | Comparar e portar o que faltar |
| 9 | **Envio por sequência** | `sequence-runner`, `sequence-step-sends` (envio incerto reconciliado), `reply-proposal-*`, `received-email-attachments`, `sender-accounts` | Cadência com motor, Caixa de entrada, Unipile (PRs 12 a 21) | Já existe em outro desenho. Comparar só as lacunas: resposta proposta, anexos, reconciliação de envio incerto |
| 10 | **Agentes e aprovações** | `agent-conversation`, `_shared/orquestracao.ts`, `ferramentas-dos-agentes.ts`, `executor-de-aprovacoes.ts` | Hermes por cliente + MCP; aprovações por link | Comparar o executor de aprovações; manter nomes Zoe/Jax/Lia/Neo |
| 11 | **Apagar dados** (LGPD) | `storage-purge`, arquivar e apagar dados comerciais | Não existe | Portar como ticket próprio |
| 12 | **Playbook, kanban de prospecção, contas e contatos, CSV, configurações, página de agentes** | Specs fechadas (`playbook-do-workspace`, `kanban-de-prospeccao`, `contas-e-contatos`, `configuracoes`, `pagina-de-agentes`) | Telas v22 ligadas ao banco; CSV (PR 20); playbook (3 migrations) | Usar as specs só como critério de conferência |
| 13 | **Sinais jurídicos** | Spec `sinais-juridicos` (4 tickets, nenhum fechado) | Não existe | Fora do escopo agora |
| 14 | **Fase 2 de receita** | 10 tickets em `needs-triage` | Não existe | Fora do escopo |

## Ordem sugerida

1. **Sinais reais** (em andamento).
2. **Conexões funcionais** (HubSpot primeiro): é o que mais pesa na venda, porque hoje 37 conectores são "Em breve".
3. **Enviar ao CRM** e **enriquecimento em cascata**.
4. **Apagar dados (LGPD)** e **e-mail de convite**.
5. **Cobrança Stripe**, só depois de decidir o modelo de preço.

## Conflitos que o Nan precisa decidir (não decido sozinho)

1. **Modelo de cobrança:** por usuário com Stripe (protótipo) ou franquia mensal + recarga (aqui).
2. **Nomes dos agentes:** Scopus/Ethos/Rhetor/Oraculum (protótipo) x Zoe/Jax/Lia/Neo (aqui). Este projeto segue Zoe/Jax/Lia/Neo.
3. **Papéis:** protótipo fala em Administrador e Vendedor; aqui são `superadmin`, `estrategista`, `clevel`, `bdr`.
4. **Onde roda:** Supabase na nuvem (protótipo, ADR 0013 dele) x Docker em servidor nosso (aqui, ADR 0041).

## Método de portar uma área (cada ticket)

1. Ler o código e os testes do protótipo daquela área.
2. Escrever o teste que falha no padrão daqui (pgTAP/Vitest), reaproveitando os casos de teste dele.
3. Portar a lógica de Deno para Node/TypeScript, trocando Edge Function por serviço em `src/server/*`.
4. Ajustar vocabulário, papéis, créditos (nunca dólar) e RLS por `workspace_id`.
5. `npm run verificar` verde, um PR por ticket.
