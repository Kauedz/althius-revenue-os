# 09: Lookalike no Meta Ads

**What to build:** quando o Meta Ads for conectado, a base de empresas e pessoas do cliente (200 mil a 500 mil) vira **público personalizado** no Meta e, a partir dele, um **público semelhante (lookalike)**, pelo Jax (estratégia e mídia paga), sempre com aprovação de quem paga.

**Blocked by:** conector do Meta Ads (ADR 0063: hoje "Em breve").

**Status:** ready-for-human. **Não construir agora** (decisão do Nan, 07/10/2026). Só registrado.

## O que precisa estar decidido antes
- **Base legal (LGPD)**: subir e-mails e telefones de pessoas para o Meta, mesmo com hash (SHA-256), é tratamento de dado pessoal. Precisa de parecer do advogado e do aviso certo ao cliente. Só contatos com origem registrada (`contact_channels.fonte`) e fora da lista de supressão (`internal.enrichment_suppressions`).
- **Qual base**: contas incluídas (não candidatas), com filtro por fit (ADR 0067) e por ICP; quem saiu do CRM não entra.
- **Quem aprova**: criar público não gasta verba, mas a campanha que usa gasta. Proposta do Jax → aprovação de operação para criar o público; verba continua só com o C-level (ADR 0021).
- **Tamanho mínimo**: o Meta exige um mínimo de pessoas casadas para o lookalike; a tela precisa dizer quantas casaram (o Meta devolve).

## Fatia sugerida (quando desbloquear)
1. Proposta `propor_publico_lookalike` (Jax): base escolhida + motivo → aprovação.
2. Serviço envia os identificadores com hash pela API do Meta (nunca em texto claro; nada em log).
3. Tela de Campanhas mostra o público, o tamanho casado e a data.
4. Testes: isolamento por cliente, supressão respeitada, nenhum teste chama o Meta real.
