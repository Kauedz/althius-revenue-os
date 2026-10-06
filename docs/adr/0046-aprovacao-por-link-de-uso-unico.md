# ADR 0046 — Aprovação por link de uso único

Status: aceita
Data: 2026-10-06
Relacionadas: 0007 (estrategista pede gasto), 0023 (privilégios das funções), 0024 (porta do agente), 0038 (peças do Buzz), 0043 (agentes)

## Contexto
O C-level precisa aprovar gasto pelo celular, sem abrir o sistema e entrar. A regra "quem paga decide o gasto" não pode ser enfraquecida, e o conteúdo aprovado precisa ser exatamente o que foi pedido.

## Decisão
1. O sistema emite um link por aprovação e por decisor (`approval_link_issue`, só `service_role`). O banco guarda **só o hash** do token; o token aparece uma vez, no retorno da emissão.
2. O link vale de **5 minutos a 24 horas** e **uma vez** (aprovar ou rejeitar). No máximo 5 links ativos por aprovação.
3. **Conteúdo alterado** depois da emissão mata o link: ele compara o hash do conteúdo atual com o `payload_hash` da aprovação **e** com o hash guardado na emissão.
4. O link é de **uma aprovação** e **um decisor** do mesmo workspace. Só C-level e superadmin recebem link de **gasto**; operação também aceita estrategista. O decisor é conferido de novo na hora de decidir.
5. A decisão passa pela **mesma `approval_decide` da tela**: alçada, hash, notificação, auditoria e efeitos (verba, tarefa...). Decidida por qualquer caminho, a aprovação revoga os links que sobraram.
6. **Exceção de segurança (ADR 0023):** `approval_link_preview` e `approval_link_decide` aceitam chamada **sem login**, porque o token é a prova (mesmo raciocínio da porta do agente, ADR 0024). Sem token válido, nada acontece, e todo erro devolve só um status, sem detalhe interno. A visão mostra título, motivo, impacto, prévia e créditos, nunca ids nem o conteúdo bruto, nunca dólar.
7. O link vale pelo token, **não pelo login do navegador**: logado com outra conta, o link continua decidindo pelo decisor do token.

## Consequências
- Quem tiver o link, dentro do prazo, decide: o link deve ir só ao celular do decisor (canal de entrega ainda não existe; e-mail e WhatsApp dependem dos conectores).
- Falta a **página** do link no front (`#/aprovar/<token>`) e o **envio** do link ao decisor; o serviço (`aprovacaoPorLink.ts`) e a emissão (`links.ts`) já estão prontos para elas.
- Peça vinda do Buzz (desenho, sem cópia de código): ver `THIRD_PARTY_NOTICES.md`, seção 4.
