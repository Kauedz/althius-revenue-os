# ADR 0038: "Ferro velho" — reaproveitar peças do Buzz e do Twenty

## Contexto
Dois projetos abertos têm peças prontas que valem mais do que escrever do zero: o Buzz (`block/buzz`) e o Twenty (`twentyhq/twenty`). Antes de copiar qualquer coisa, é preciso fixar três pontos: o que continua sendo o núcleo, como as peças entram e o que a licença de cada projeto permite.

## Decisão
1. **O Supabase continua sendo o núcleo.** Nada do que já existe é reescrito para acomodar uma peça. A peça é adaptada ao nosso banco (Postgres, RLS por `workspace_id`), não o contrário.
2. **Uma peça por PR.** Cada peça entra sozinha, com teste, aviso de licença em `THIRD_PARTY_NOTICES.md` e aprovação do dono. A primeira é a auditoria encadeada por hash, portada do crate `buzz-audit` do Buzz.
3. **Regra de licença:**
   - **Buzz (Apache-2.0):** pode portar código, mantendo o aviso de origem.
   - **Twenty — `twenty-shared`, `twenty-sdk`, `twenty-client-sdk`, `twenty-ui` e `twenty-apps/**` (MIT):** pode copiar, mantendo o aviso.
   - **Twenty — `twenty-server`, `twenty-front` e todo o resto (AGPLv3):** não copiar código. Só estudar o desenho e escrever código próprio.
   - **Qualquer arquivo com `/* @license Enterprise */`:** não usar.
4. **O Twenty completo fica para depois**, como CRM conectável pela API, igual ao HubSpot (ADRs 0004 e 0010). Sem fork e sem hospedar o código dele dentro do Althius.
5. **Não usar o `buzz-workflow`.** A aprovação dele não funciona (`approval_not_supported`) e ele não envia DM. O nosso fluxo de aprovação (ADR de aprovações, "quem paga decide o gasto") continua sendo o único.

## Consequências
- Todo código vindo de fora aparece em `THIRD_PARTY_NOTICES.md`, com projeto, caminho de origem, licença, commit, arquivo de destino e o que foi adaptado.
- Peça com licença AGPL ou Enterprise é recusada na revisão do PR, mesmo que "só um trechinho".
- Peça nova que mexa em regra de negócio já decidida exige ADR própria que substitua a anterior (ver `AGENTS.md`).
- Primeira peça (esta): `audit_logs` passa a ser uma corrente de hashes por workspace. Adulterar ou apagar linha antiga quebra a corrente, e `public.audit_verify_chain` aponta onde. Limite conhecido: apagar as **últimas** linhas não é detectado até existir uma âncora periódica do topo da corrente (próxima fatia).
