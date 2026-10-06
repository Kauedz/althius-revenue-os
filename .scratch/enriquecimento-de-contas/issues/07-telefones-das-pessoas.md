# 07: Telefones das personas

**What to build:** buscar o telefone de cada persona encontrada (fonte pela Apify ou base conectada, atrás da `FonteDeEnriquecimento`) e gravar em `contact_channels` (`phone`/`whatsapp`) com origem e data. Decisão do Nan: buscar (06/10/2026).

**Blocked by:** 05.

**Status:** ready-for-agent

## Proteções obrigatórias (LGPD)
- [ ] Origem e data em cada número; a tela mostra "de onde veio".
- [ ] Lista de supressão por workspace: pedido de saída apaga a pessoa e impede que volte num enriquecimento futuro.
- [ ] Número nunca sai do workspace do cliente (isolamento com teste).
- [ ] Antes de vender: validar a base legal com um advogado (o texto da política de privacidade do cliente precisa citar prospecção B2B).
