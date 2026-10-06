# ADR 0054 — Conectores que ainda não existem aparecem como "Em breve"

Status: aceita
Data: 2026-10-06
Relacionadas: 0017 (conexão de contas de mensagem), 0044 (canal de mensagens trocável), regra 2 do AGENTS.md (nunca inventar dado)

## Contexto
O catálogo de Integrações do protótipo tem 37 conectores (HubSpot, Salesforce, Gmail, Slack, Gong, Apollo, Google Ads, Meta Ads, LinkedIn Ads, Notion...). Nenhum deles tinha código no projeto: a autorização era uma simulação de 1,6 segundo que marcava "conectado", e o protótipo já trazia HubSpot, Gmail, Google Ads, Apollo e Google Sheets como conectados na conta de exemplo. No modo real isso mostrava ao cliente integrações que não existem.

## Decisão
1. No **modo real**, todo conector do catálogo aparece como **"Em breve"**, com o botão desabilitado. Nenhum vem marcado como conectado, não há autorização simulada, e o botão "Conectar ferramenta" e as linhas de exemplo da página de Integrações somem. O resumo da página diz onde conectar de verdade: as contas pessoais de e-mail, WhatsApp, LinkedIn e Instagram, na **Caixa de entrada**.
2. A página de **Sinais** diz "Coleta automática em breve": o catálogo, as configurações e o registro de eventos existem, mas **nada coleta sinais sozinho** (a rodada de coleta pela Apify ainda não foi construída). Só aparecem sinais já registrados no sistema.
3. O **modo demonstração** (`VITE_ALTHIUS_MODO=demo`) não muda: continua mostrando o protótipo inteiro, simulado, para apresentação.
4. **Um conector sai de "Em breve" só quando existir de verdade**: aplicativo registrado no provedor, autorização (OAuth), token guardado cifrado, renovação, leitura/escrita testadas com versão falsa e uma ADR própria. Um PR por conector.

## O que conecta de verdade hoje
- Contas pessoais de e-mail, WhatsApp, LinkedIn e Instagram pelo assistente hospedado do canal de mensagens (só o e-mail foi testado com conta real, pelo dono).
- Chaves de modelo de IA, Apify e canal de mensagens no cofre (ADR 0049), ainda sem teste com chave real de produção.
