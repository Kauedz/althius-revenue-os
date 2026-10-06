# 06: Enviar ao CRM

**What to build:** levar a conta, os contatos e uma nota (sinais e abordagem) ao CRM em que a própria pessoa tem acesso conectado: HubSpot, Pipedrive e RD Station (base: `AppAlthius/supabase/functions/_shared/envio-ao-crm.ts` e `crm-handoff`). Cada objeto criado é gravado na hora; falha no meio não duplica na nova tentativa. A ação da pessoa não passa por aprovação (ela já decide); a de agente respeita a regra "quem paga decide".

**Blocked by:** 04.

**Status:** ready-for-agent

## Critérios
- [ ] Um segundo envio da mesma conta é recusado (depois do envio o CRM manda).
- [ ] Teste de escrita com servidor falso; nenhum teste chama API real.
- [ ] Registro de auditoria de cada envio.

## Passos do Nan
Conferir com uma conta de CRM de teste.
