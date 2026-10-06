# 02: Tela de Conexões real

**What to build:** a página de Integrações mostra o estado real de cada cartão (Disponível, Conectado, Precisa reconectar, Precisa configurar, Em breve com o motivo), o botão Conectar leva ao consentimento do app, o retorno volta para a tela com o resultado, e Gerenciar permite desconectar e ver as ferramentas. A demonstração segue como está.

**Blocked by:** 01.

**Status:** ready-for-agent

## Pode mexer
- Regras novas em `scripts/v18/patches.mjs` + `npm run v18:sync` (nunca editar `src/v18/*.generated.*`).
- `src/app/servicos/` (serviço de integrações) e `src/app/AlthiusApp.ts`.
- `src/app/conectores.tela.test.tsx` (acrescentar; o teste de "Em breve" passa a valer só para quem não tem perfil).

## Não mexa
- No fluxo de contas de mensagem da Caixa de entrada.

## Critérios
- [ ] Nada aparece como conectado sem estar. Erro de consulta mostra mensagem clara com "Tentar de novo".
- [ ] Quem não tem `integrations.connect` vê o cartão, mas o botão explica quem pode conectar.
- [ ] Os cinco canais (WhatsApp, Gmail, Outlook, Instagram, LinkedIn) mostram o estado das contas de mensagem (o que a Caixa já sabe) e o botão Conectar chama `/integracoes/iniciar` com o `membroId` da pessoa; Gerenciar leva à Caixa de entrada. Quem é BDR conecta canais, mas vê "só C-level, estrategista e superadmin conectam apps".
- [ ] Conector sem servidor oficial continua "Em breve" **com o motivo** (texto do perfil).
- [ ] Retorno do consentimento (sucesso, recusa, expirado, portal diferente) mostra mensagem clara.
- [ ] Nenhum US$ na tela.
- [ ] `npm run verificar` verde.

## Passos do Nan
Autorizar a própria conta do Notion para conferir de ponta a ponta.
