# 06: Fontes trocáveis (Apollo e outras bases)

**What to build:** a interface `FonteDeEnriquecimento` (por etapa: site, cnpj, empresa, pessoas, telefones), com prioridade e reserva, como o modelo de IA no cofre (ADR 0050). Primeira fonte extra: Apollo, pelo conector já conectado (ADR 0056/0058), só se a pessoa tiver conectado.

**Blocked by:** 01.

**Status:** adiado (decisão de 06/10/2026). Só construir a interface quando houver uma segunda fonte real.

## Perguntas
Apollo entra como fonte automática do cliente que conectou, ou só sob pedido? Quem paga os créditos do Apollo é o próprio cliente (a conta dele), então não cobra créditos da Althius?

## Respostas (06/10/2026, por delegação do Nan)
- O Apollo entra como fonte automática do cliente que o conectou (ADR 0056/0058); quem não conectou não tem Apollo.
- Quem paga o Apollo é o próprio cliente, na conta dele. A Althius não cobra créditos por isso.
- A interface `FonteDeEnriquecimento` fica para quando o Apollo (ou outra fonte) for ligado de verdade: hoje seria código sem uso.
