# Prompt para a IA do backend

Cole o texto abaixo junto com a pasta `althius-frontend-v18`.

---

Você vai continuar o backend da **Althius**, um Revenue OS B2B com 4 agentes de IA orquestrados pelo **Hermes**. Você já começou esse trabalho com base em três documentos: o desenho de banco ("Revenue OS — banco de dados") e o Blueprint baseado no Buzz. Desde então, o frontend mudou bastante. Esta pasta traz o front atual e a regra de negócio atualizada.

## Arquivos e ordem de verdade

1. `docs/Althius_papeis_permissoes_conexoes_Hermes.md`: a regra de negócio. O `.pdf` é o mesmo conteúdo, com os diagramas.
2. `Althius_Desktop_v18.html`: o front que roda. Abra no navegador e troque de papel pelo avatar (Modo demonstração).
3. `fonte/`: o mesmo front em arquivos legíveis. Comece pelo `LEIA-ME.md`.
4. Os documentos antigos (banco de dados e Blueprint de 42 páginas). Ignore a versão de 38 páginas.

**Quando houver conflito, vale nesta ordem: documento novo → front v18 → documentos antigos.** A seção "Conferência dos documentos do backend" lista os 24 pontos que mudaram. Nunca resolva um conflito sozinho em silêncio.

## O que não muda

- **Banco:** Supabase (Postgres + Auth + RLS + Realtime + Edge Functions). Isolamento por `workspace_id` em tudo.
- **Hermes:** orquestra tudo. Toda ação, venha de um clique, de um agente ou de um evento, passa pelas 4 checagens na mesma ordem: papel tem a chave → é dono do dado → precisa de decisão → cabe nos créditos. Depois executa e registra (execução, extrato, notificação, auditoria). A mesma função serve para a tela e para os agentes.
- **Apify:** motor de coleta, numa conta central da Althius. O cliente nunca vê Apify, nome de Actor nem custo do fornecedor.
- **Unipile:** motor de conversa (LinkedIn, WhatsApp, Instagram e e-mail), com conexão por pessoa. A palavra Unipile nunca aparece na interface. Ela substitui os conectores separados de Gmail, Microsoft Graph e WhatsApp Cloud API que estavam nos documentos antigos.
- **Privacidade da Caixa de entrada:** só entra conversa com contato do CRM. Mensagem de quem não está no CRM é descartada sem gravar nada, nem metadado. Grupos nunca entram. Excluir o contato apaga as mensagens dele.
- **Segredos:** nunca chegam ao front nem ao prompt de um LLM.
- **Ledger de créditos:** imutável. Correção só por transação compensatória.

## Papéis

São 4 papéis por workspace: `superadmin`, `estrategista`, `clevel` (era "Admin do cliente") e `bdr`.

- A matriz com as 33 capacidades está no documento e em `window.ALTHIUS_CAPS` (`fonte/module.js`). Transforme essa matriz em seed de `roles`/`role_permissions`, com um `scope` por capacidade: `all`, `assigned`, `own`, `read`, `request` ou `none`.
- Não crie os outros papéis dos documentos antigos agora.
- Regra de dinheiro: verba de mídia, compra de créditos e execução acima do limite só o C-level ou o superadmin aprovam. O estrategista pede.

## Como trabalhar: skills do Matt Pocock

Use as skills do repositório `mattpocock/skills`, nesta ordem:

1. **`/setup-matt-pocock-skills`**, se ainda não rodou neste repositório.
2. **`/grill-with-docs`** com o documento novo. Atualize o `CONTEXT.md` com o glossário: workspace, papel, capacidade, scope, agente, playbook, skill, sinal, motion, quadro, etapa, cadência, passo automático ou manual, conta de mensagem, aprovação de operação e de gasto, crédito, reserva.
   - Antes de qualquer código, compare o que você já construiu com o documento novo. Entregue uma lista curta: o que já está certo, o que precisa mudar e o que falta.
3. **Decisões em aberto:** as 14 da última seção do documento não são suas para decidir. Implemente o padrão indicado em cada uma e registre como ADR curta. Se uma decisão travar o trabalho, use `/to-questionnaire` e me mande as perguntas.
4. **`/to-spec`** e depois **`/to-tickets`**, em tracer bullets: fatias verticais finas (banco + RLS + função + teste + contrato que o front usa), cada uma entregável sozinha, com as dependências marcadas.
5. **`/implement`** ticket por ticket. Use **`/tdd`** (teste falhando primeiro) e **`/code-review`** antes de fechar cada um.
6. **`/improve-codebase-architecture`** a cada 4 ou 5 tickets. Se algo quebrar sem explicação, use **`/diagnosing-bugs`**.

## Ordem sugerida dos tickets

1. Papéis e permissões a partir da matriz, mais RLS, com teste de leitura e escrita para os 4 papéis em pelo menos 2 workspaces. O estrategista só enxerga os workspaces em que é membro.
2. Função de política do Hermes: as 4 checagens, a auditoria e as notificações. Tudo o que vem depois usa essa função.
3. Créditos: carteiras (franquia mensal + recarga), reserva, consumo e liberação, modo automático ou com aprovação, teto, limite mensal e recarga automática.
4. Aprovações com `category` (`operacao` ou `gasto`) e `payload_hash`. São de uso único: mudar o conteúdo invalida a aprovação.
5. Contas, contatos e `contact_channels`, mais a função que busca o logo pelo site (conta e workspace).
6. Gateway do Apify com `signal_definitions`, `workspace_signal_settings` e `signal_events`, ligados ao catálogo de capacidades.
7. Unipile:
   - conexão pelo assistente de conexão e `notify_url`;
   - webhook com header secreto, resposta 200 imediata, fila e idempotência pelo id da mensagem;
   - filtro só-CRM;
   - status da conta e reconexão;
   - nova conexão no LinkedIn.
8. Cadências com passos automáticos (e-mail e WhatsApp) e manuais (LinkedIn, Instagram, ligação), tarefas com "Enviar agora", pausa quando a pessoa responde e personalização por contato.
9. Pipeline: motions, até 5 quadros por motion, 6 etapas fixas, chance padrão por etapa, posição do card, histórico de etapa e sincronização com o CRM.
10. Campanhas por canal e Relatórios lidos dos dados reais (views agregadas).
11. Canais de chat com #geral obrigatório e agentes por canal.

## Para não quebrar o front

- **Contrato de dados:** o front lê os formatos de `fonte/data.js` (os "services") e de `window.ALTHIUS_MOD`. Mantenha os mesmos nomes de campo, ou entregue um adaptador e documente a troca. Não renomeie campos que o front usa sem avisar.
- **Migrations:** pequenas, reversíveis e uma por ticket. Nada de migration gigante.
- **Permissões:** todo endpoint e toda Edge Function checa a permissão no servidor, mesmo que o front já esconda o botão. Para cada capacidade, teste o caso permitido e o negado.
- **Integrações externas:** Apify, Unipile, CRM e LLM ficam atrás de uma interface sua, com versão falsa para teste. Nenhum teste chama a API real.
- **Ações externas:** toda ação externa (envio, escrita no CRM, coleta) tem chave de idempotência e registro de execução.
- **Reporte ao fim de cada ticket:** o que mudou, os testes que passaram, o que ficou pendente e qualquer conflito encontrado com o documento.
