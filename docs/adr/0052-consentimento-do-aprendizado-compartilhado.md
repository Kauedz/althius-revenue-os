# ADR 0052 — Consentimento para o aprendizado compartilhado entre contas

Status: aceita
Data: 2026-10-06
Relacionadas: 0024 (isolamento dos agentes; camada 3 e teste de vazamento), 0023 (segurança do banco), 0050 (gateway do modelo)

## Contexto
O dono quer que os agentes aprendam com o que funciona em outras contas e apliquem em contas parecidas (nicho, abordagem), de forma probabilística. Isso só pode acontecer com o consentimento de cada cliente. O pedido é um aviso que apareça **uma vez** e um interruptor em Configurações, com texto que convença sem dar muito detalhe.

## Decisão
1. **Começa desligado.** Sem decisão registrada = não compartilha. Ver o aviso não liga nada.
2. **Só o C-level do workspace decide** (são dados da empresa dele). Estrategista e BDR não decidem e não recebem o aviso; o estrategista vê o interruptor travado com a nota "Só o C-level do workspace decide."; o BDR nem tem a seção. O banco recusa (42501) qualquer outra tentativa.
3. **O aviso aparece uma vez só.** O banco decide a "primeira vez" (`learning_consent_popup_visto` devolve true uma única vez), então duas janelas ou dois dispositivos não repetem. Fechar sem escolher (ou "Agora não") deixa desligado e o aviso não volta. Depois, a decisão fica em **Configurações → Aprendizado**, reversível a qualquer hora.
4. **Texto do aviso:** convida pelo benefício ("todos os agentes aprendem mais rápido, e os seus também"), diz que é para ajudar a melhorar o aprendizado dos agentes, e promete só o que o motor é obrigado a cumprir: **"Nada que identifique sua empresa ou seus contatos é compartilhado."** Esta frase é uma **obrigação do motor de aprendizado** (item 6), não só marketing.
5. **Registro:** cada decisão vai para a auditoria encadeada do workspace (`learning.consent_set`, com sim/não).
6. **Regras para o motor de aprendizado (PR seguinte), inegociáveis:**
   - lê **apenas** `internal.learning_workspaces_aceitos()` (só o sistema pode); quem desligou sai na hora;
   - contas que não aceitaram **não contribuem e não recebem** o aprendizado compartilhado;
   - só entram **agregados anonimizados** (por nicho, abordagem, canal e resultado), nunca texto de mensagem, nome, e-mail, telefone, empresa ou id de workspace; um padrão só vale com um número mínimo de contas diferentes por trás;
   - teste de vazamento com dado marcado (canário), como exige a ADR 0024, e isolamento entre dois workspaces.
7. O front nunca lê a lista de quem aceitou; a função que a entrega é interna e só do sistema.

## Cuidado de produto (decisão do dono)
O dono pediu pouco detalhe no aviso. Isso é permitido enquanto o aviso for verdadeiro e o motor cumprir o item 6. Se um cliente ou a LGPD pedirem descrição mais específica do que é compartilhado, o caminho é um link "Saiba mais" no aviso e na seção de Configurações com o texto completo (não incluído aqui).

## Consequências
- Nada é compartilhado ainda: este PR só guarda o consentimento e mostra o aviso e o interruptor.
- Mudança no protótipo gerado por regras em `scripts/v18/patches.mjs` (seção "Aprendizado" e texto do botão de cancelar da janela de confirmação).
