# 26: Conector e Sync Unidirecional com HubSpot por Estágios de Qualificação

**What to build:**
Conector oficial com HubSpot via OAuth e worker da fila `crm-sync-queue` que empurra (push unidirecional) Empresas, Contatos e Negócios (Deals) nos momentos de conversão comercial (quando o lead responde positivamente ou agenda reunião), salvando o `external_hubspot_id` retornado nas tabelas locais.

**Blocked by:** 19: Motor de Execuções e Aprovações com State Machine e pending_credits, 25: Sales Workbench do BDR (Minhas Tarefas de Hoje e Painel Lead 360)

**Status:** ready-for-agent

- [ ] Fluxo OAuth para conectar portal do HubSpot no Hub de Integrações, salvando tokens no schema `internal`.
- [ ] Worker escuta eventos de conversão e cria ou atualiza `Company`, `Contact` e `Deal` associados na API v3 do HubSpot.
- [ ] O ID retornado pelo HubSpot é persistido em `accounts.external_hubspot_id` e `contacts.external_hubspot_id`.
- [ ] Falhas na API do HubSpot passam por retentativas automáticas (até 3 tentativas com backoff exponencial).
- [ ] Teste automatizado com mock da API HubSpot valida a criação sincronizada de Deal e Contact a partir de um avanço de estágio.
