# 04: Toda conta no mapa do Início

**What to build:** transformar endereço ou CEP em latitude e longitude (geocodificação; avaliar BrasilAPI CEP v2, que às vezes traz coordenadas, e o Nominatim do OpenStreetMap com uso justo) e gravar em `accounts.lat`/`lng`. No Início:
- pinos por conta por cima da cor por UF;
- marcador **"Sem localização"** fora do contorno do Brasil, com a lista ao clicar;
- conta sem endereço nunca entra na contagem de nenhum estado;
- sem lat/lng mas com UF, o pino fica no centro do estado (marcado como aproximado).

`get_home_summary` devolve os pinos; o protótipo muda por `scripts/v18/patches.mjs`.

**Blocked by:** 03.

**Status:** ready-for-agent (depois da 03)

## Critérios
- [ ] 100% das contas ativas aparecem (no estado, aproximadas ou em "Sem localização").
- [ ] BDR vê só as próprias contas no mapa (a regra atual).
- [ ] Teste de tela com banco local.
