# 02: Tela de Conexões real

**What to build:** a página de Integrações mostra o estado real de cada cartão (Disponível, Conectado, Precisa reconectar, Precisa configurar, Em breve com o motivo), o botão Conectar leva ao consentimento do app, o retorno volta para a tela com o resultado, e Gerenciar permite desconectar e ver as ferramentas. A demonstração segue como está.

**Blocked by:** 01.

**Status:** done

## Pode mexer
- Regras novas em `scripts/v18/patches.mjs` + `npm run v18:sync` (nunca editar `src/v18/*.generated.*`).
- `src/app/servicos/` (serviço de integrações) e `src/app/AlthiusApp.ts`.
- `src/app/conectores.tela.test.tsx` (acrescentar; o teste de "Em breve" passa a valer só para quem não tem perfil).

## Não mexa
- No fluxo de contas de mensagem da Caixa de entrada.

## Critérios
- [x] Nada aparece como conectado sem estar. Erro de consulta mostra mensagem clara com "Tentar de novo".
- [x] Quem não tem `integrations.connect` conecta um app e recebe a mensagem "Só C-level, estrategista e superadmin conectam esta integração" (a recusa vem do banco).
- [x] Os cinco canais (WhatsApp, Gmail, Outlook, Instagram, LinkedIn) mostram o estado das contas de mensagem (o que a Caixa já sabe) e o botão Conectar chama `/integracoes/iniciar` com o `membroId` da pessoa; Gerenciar leva à Caixa de entrada. Quem é BDR conecta canais, mas vê "só C-level, estrategista e superadmin conectam apps".
- [x] Conector sem servidor oficial continua "Em breve" **com o motivo** (texto do perfil).
- [x] Retorno do consentimento (sucesso, recusa, expirado, portal diferente) mostra mensagem clara.
- [x] Nenhum US$ na tela.
- [ ] `npm run verificar` verde. **Pendente:** ver a nota do ticket 01 (as mesmas falhas de ambiente).

## Comments

- Feito em 06/10/2026. O "Gerenciar" dos cinco canais de mensagem hoje oferece desconectar pelo mesmo caminho da Caixa; a gestão completa (várias contas) continua na Caixa de entrada.
- O motivo do "Em breve" aparece na descrição do cartão (o protótipo só mostrava o texto de uso quando conectado).

## Passos do Nan
Autorizar a própria conta do Notion para conferir de ponta a ponta.
