# Guia do dono: o que você precisa criar em cada app

Escrito em 06/10/2026 para o Nan. Cada passo vem das páginas oficiais dos fornecedores; o que **não** consegui confirmar está marcado. **Nunca cole Client ID, Secret ou token no chat.** Guarde num gerenciador de senhas; quando o ticket do conector estiver pronto, você cola na tela Fornecedores (cofre).

## Resumo (o que cada app pede de você)

| App | O cliente vê | O que você faz uma vez | Esforço |
| --- | --- | --- | --- |
| Notion, Apollo, Pipedrive, Granola, Confluence | só login | **nada** (a Althius se registra sozinha) | nenhum |
| Gmail, Google Agenda, Outlook, WhatsApp, Instagram, LinkedIn | só login | **nada**: pela Unipile, com o app dela | nenhum |
| **HubSpot** | só login | criar o "MCP Auth App" | 10 minutos |
| **Zoom** | só login | criar um app "General" no Zoom Marketplace | 30 minutos (publicar: não confirmado) |
| **Zoho CRM** | só login | criar um app no console de API do Zoho; a Althius escreve as ferramentas | 20 minutos + desenvolvimento |
| **RD Station CRM** | cola URL e token (hoje) | pedir um app OAuth à RD Station, ou aceitar colar | contato com a RD Station |
| **Slack** | só login | **publicar um app no Slack Marketplace** (revisão do Slack) | semanas |
| Salesforce, Dynamics, Teams | | **deixados "Em breve"** (decisão sua) | |

**Endereço de retorno** (o mesmo em todos): `https://SEU-SITE/integracoes/retorno`, onde `SEU-SITE` é o endereço público do sistema (`SITE_URL`). Exatamente assim, com `https` e sem barra no fim. Se testar localmente, crie um app de teste separado com o endereço local.

---

## 1. HubSpot (o primeiro a liberar)

O HubSpot não aceita registro automático: você cria um "app de autorização do MCP" e ele gera o Client ID e o Secret. Fonte: [documentação do HubSpot](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/integrate-with-the-remote-hubspot-mcp-server).

1. Entre em **app.hubspot.com** com a conta HubSpot da Althius (a da empresa, não a de um cliente).
2. No menu de cima, clique em **Development** (Desenvolvimento).
3. No menu da esquerda, clique em **MCP Auth Apps**.
4. No canto superior direito, clique em **Create MCP auth app**.
5. Preencha: **nome** (ex.: "Althius"), **descrição** (ex.: "Conecta o HubSpot do cliente à Althius") e, se pedir, um **ícone**.
6. Em **Redirect URL**, cole o endereço de retorno acima.
7. Salve. O HubSpot mostra o **Client ID** e o **Client Secret**. Copie os dois (o Secret é como uma senha).
8. O HubSpot exige PKCE; a Althius já usa.

Limite: enquanto o app não estiver no marketplace do HubSpot, ele aceita até **25 instalações**. Dá para a fase de testes e os primeiros clientes. Se o HubSpot pedir permissões (escopos), marque só as de **leitura de CRM** (contatos, empresas, negócios); a escrita entra quando o "Enviar ao CRM" estiver pronto. *(Não confirmei os nomes exatos dos escopos na tela.)*

**Depois (já está liberado no código):** abra **Fornecedores > Nova chave**, escolha **App de integração**, no nome da chave escreva `hubspot`, cole o **ID do cliente** no campo próprio e o **Segredo do cliente** no campo da chave (ele nunca aparece de novo). Depois conecte a sua própria conta pelo cartão do HubSpot. O ID do app (56000583) e o ID do cliente não são segredos; o Segredo é, e só vai nesse campo.

## 2. Google: pela Unipile, sem registrar app

Você perguntou se a Unipile cobre o Google além do Gmail. Resposta, [pela documentação deles](https://developer.unipile.com/docs/google-oauth):

- **A Unipile usa credenciais próprias do Google** por padrão. Você **não** precisa criar projeto no Google Cloud, nem passar pela verificação de segurança do Google (que custa cerca de US$ 500 por ano e exige revisão anual, quando se usa app próprio).
- **Gmail:** confirmado.
- **Google Agenda:** confirmado. A mesma conta Google pode ser ligada também como agenda, [sem conectar duas vezes](https://developer.unipile.com/v2.0/docs/link-calendar-accounts); o pedido do link usa o provedor de agenda. O Outlook tem o mesmo (agenda da conta Microsoft). **Falta eu construir o uso da agenda e testar** (hoje o cartão do Google Agenda segue "Em breve" com esse motivo).
- **Drive e Contatos:** páginas de marketing da Unipile citam, mas a documentação oficial que li **não confirma**. Não vou prometer.
- **Google Sheets e Google Meet:** não são da Unipile. Continuam "Em breve" (precisariam de app próprio no Google, com verificação).

**Nada para você fazer aqui.** Quando você disser, eu construo o uso da agenda pela Unipile.

## 3. Slack: o mais pesado

O Slack **não** aceita registro automático e, pelo que li na [documentação oficial](https://docs.slack.dev/ai/mcp-server), só deixa usar o MCP **apps publicados no Marketplace do Slack ou apps internos**: *"Only directory-published apps or internal apps may use MCP"*. App interno serve para um workspace só (o de vocês); para os **clientes** conectarem o Slack deles, a Althius precisa **publicar o app no Slack Marketplace**, o que passa por uma revisão do Slack (leva semanas e exige política de privacidade, página de suporte etc.).

Passos (para quando decidir seguir):
1. Entre em **api.slack.com/apps** e clique em **Create New App** > **From scratch**. Dê o nome "Althius" e escolha o workspace de desenvolvimento.
2. Em **OAuth & Permissions**, adicione o **Redirect URL** (endereço de retorno acima) e os **User Token Scopes** que o MCP usa (por exemplo `search:read.public`, `chat:write`; a lista varia por ferramenta).
3. Anote **Client ID** e **Client Secret** (em **Basic Information**).
4. Prepare e envie o app para **revisão do Marketplace** do Slack.

**Minha recomendação:** deixar o Slack "Em breve" por enquanto. O custo de publicar é alto para um conector que vocês ainda não vendem.

## 4. Zoom

O Zoom também **não** aceita registro automático ([documentação](https://developers.zoom.us/docs/mcp/servers/connect-to-zoom-mcp-servers/)). Passos:

1. Entre no **Zoom App Marketplace** (marketplace.zoom.us) com uma conta de desenvolvedor.
2. Clique em **Develop** > **Build App** e escolha **General app** > **Create**.
3. Dê um nome (ex.: "Althius").
4. Em **Basic Information > OAuth Information**, cole o **OAuth redirect URL** (endereço de retorno acima).
5. Em **Scopes** > **Add scopes**, adicione os que a lista de ferramentas do servidor MCP do Zoom pedir (reuniões, gravações e resumos, no caso da Althius).
6. Em **Basic Information > App Credentials**, copie o **Client ID** e o **Client Secret**.

**Não confirmei:** se, para clientes de **outras contas Zoom** autorizarem o app, ele precisa ser **publicado/aprovado** no Marketplace do Zoom. Em geral é assim em apps de terceiros, mas a página que li não diz. Antes de investir, eu confirmo isso na documentação de publicação do Zoom.

## 5. RD Station CRM

A RD Station **tem um MCP oficial** (cobre CRM e Marketing). O jeito de conectar que a página deles descreve ([rdstation.com/mcp-rd-station](https://www.rdstation.com/mcp-rd-station/)) é: **cada cliente entra no Catálogo MCP da RD Station com a própria conta, gera a URL segura e o token** (login por OAuth 2.0) e cola no aplicativo que vai usar. Planos que incluem o CRM: Basic, Pro e Advanced.

Isso **não é "só login" dentro da Althius**: o cliente teria que ir ao catálogo da RD e colar a URL e o token na Althius. A página **não diz** se um aplicativo de terceiros (como a Althius) pode se registrar para que o cliente só clique em Conectar.

O que você pode fazer:
1. **Perguntar à RD Station** (parcerias/App Store, ou o suporte para desenvolvedores) se a Althius pode se registrar como aplicativo no MCP deles, com um OAuth próprio. Pergunta pronta: *"A Althius é uma plataforma de GTM. Queremos oferecer a nossos clientes a conexão ao RD Station CRM por login (OAuth), sem eles precisarem gerar URL e token. Existe registro de aplicativo de parceiro para o MCP de vocês?"*
2. Se a resposta for não, posso oferecer o método "colar URL e token" (pior experiência, mas funciona).

Também há uma API antiga do CRM (v1) com token por usuário; a documentação que li não explica como o usuário obtém esse token e não mostra OAuth para CRM.

## 6. Zoho CRM

O Zoho tem MCP próprio, mas é um **servidor por cliente** (URL com chave, criada na conta dele), então não serve para "só login". O caminho viável é a **API do Zoho com login OAuth**, usando **um app registrado pela Althius**; aí o cliente só faz login. A Althius escreve as próprias ferramentas de CRM (buscar e criar contas e contatos), sem MCP. Passos do app, pelo [console de API do Zoho](https://www.zoho.com/accounts/protocol/oauth/multi-dc.html):

1. Entre em **api-console.zoho.com** (conta Zoho da Althius).
2. Clique em **Add Client** > **Server-based Applications**.
3. Informe **nome** (ex.: "Althius"), **homepage URL** (o site) e **Authorized Redirect URI** (endereço de retorno acima).
4. Crie. Copie **Client ID** e **Client Secret**.
5. Na aba **Settings**, ligue **"Use the same OAuth credentials for all data centers"**: assim clientes em regiões diferentes do Zoho (EUA, Europa, Índia, Austrália, Canadá e outras) usam o mesmo app.

**Custo:** exige desenvolvimento (as ferramentas do Zoho são nossas). Fica "Em breve" com esse motivo até você decidir.

## 7. Salesforce, Dynamics 365 e Teams

Ficam **"Em breve"**, como você pediu. (O motivo registrado: cada cliente precisa criar um app ou URL na própria conta.)

---

## Ordem que eu sugiro
1. **HubSpot** (crie o app; eu libero em seguida).
2. **Notion, Apollo, Pipedrive, Granola, Confluence** (sem você fazer nada; eu confirmo cada um com uma conexão real).
3. **Google Agenda pela Unipile** (eu construo).
4. **Zoom** (crie o app, depois eu confirmo a publicação).
5. **RD Station** (pergunta à RD Station).
6. **Zoho** e **Slack**, só se algum cliente pedir.
