# 05: Sincronização do HubSpot

**What to build:** "Sincronizar agora": Companies atribuídas a participantes do workspace viram contas; contacts associados viram contatos com vínculo. Só lê, nunca apaga, respeita o responsável, vazio no HubSpot não apaga o que já existe, a primeira vez traz tudo e as seguintes só o que mudou. A regra de negócio fica numa função do banco testável sem o HubSpot (histórias 25 a 56 do protótipo).

**Blocked by:** 04.

**Status:** ready-for-agent

## Critérios
- [ ] Correspondência por identidade externa, depois URL canônica (contas) e e-mail, telefone ou LinkedIn (contatos), sem duplicar.
- [ ] Idempotente: sincronizar duas vezes sem mudança no HubSpot não altera nada.
- [ ] Uma sincronização por vez por workspace; continua de onde parou.
- [ ] Contagens e motivos dos itens ignorados e com falha.
- [ ] Isolamento entre workspaces.

## Passos do Nan
Conectar o próprio HubSpot e conferir o resultado numa conta de teste.
