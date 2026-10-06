# Althius em Docker: como subir tudo com um comando

Decisão e motivos: `docs/adr/0041-infra-docker-self-hosted.md`. Precisa de Docker com o plugin `docker compose` e Node 22 só para gerar o `.env`.

## Subir (desenvolvimento, no seu computador)
```
npm run docker:env:demo     # cria o .env com senhas novas e liga os dados de demonstração
npm run docker:subir        # sobe tudo (a primeira vez demora: baixa imagens e compila o front)
```
Abra http://localhost. Login de demonstração: `rafael@althius.com.br` (superadmin) ou `aline@evolut.com.br` (C-level), senha `althius-demo`.
**Esses usuários e essa senha são públicos. Nunca use `docker:env:demo` em servidor de verdade.**

## Subir (servidor)
```
npm run docker:env -- --site=https://app.seudominio.com.br
npm run docker:subir
```
Aponte o DNS do domínio para o servidor e libere só as portas 80 e 443. O certificado HTTPS é emitido sozinho. O `.env` guarda as senhas do banco: **faça cópia segura e não perca**. Para gerar de novo, apague o `.env` (isso só vale para uma instalação nova; trocar a senha do banco com dados existentes exige trocar também dentro do banco).
Trocar `SITE_URL` depois exige `npm run docker:subir` de novo (o endereço é gravado dentro do front na compilação).

## Criar o primeiro superadmin (servidor novo)
Servidor sem dados de demonstração não tem ninguém para entrar. Crie o primeiro superadmin, **uma única vez, no servidor**:
```
npm run criar-superadmin -- --email pessoa@empresa.com.br
```
O que acontece: o usuário é criado no login **sem senha**, o banco registra o superadmin (e cria o workspace interno "Althius (interno)", onde ele "mora"; sem workspace não existe superadmin) com registro na auditoria, e o comando mostra um **link de definir senha** (vale uma vez, expira em 24 horas). A pessoa abre o link, escolhe a senha e entra.
- **Nada é enviado por e-mail** (o conector de e-mail ainda não existe): quem roda entrega o link por um canal seguro e não o guarda.
- O comando **se recusa a rodar** se já existir superadmin ativo, ou se faltar o `--email`. Não existe senha fixa.
- Os próximos superadmins e os clientes são criados dentro do sistema (tela Superadmin), não por este comando.
- Se o link expirar antes de ser usado, não dá para rodar de novo (já existe superadmin). Nesse caso, peça ajuda técnica: é preciso gerar um link novo pelo login do servidor.

## Dia a dia
- Ver o que está rodando: `docker compose ps`. Logs: `docker compose logs -f auth` (ou `rest`, `web`, `migrar`...).
- Parar sem perder dado: `npm run docker:parar`. **Nunca** use `docker compose down -v` em produção: o `-v` apaga o banco.
- Migration nova: entra sozinha na próxima subida (o `migrar` aplica só o que falta).

## Canal de mensagens (Unipile v2): chave, webhook e conexão
A Unipile é só um canal: toda a ligação com ela (chave, endereço, assinatura) está em `src/server/unipile/`, `src/server/webhooks/` e `src/server/cadencia/envio.ts`. Usamos a API **v2** (`https://api.unipile.com`), como no protótipo que já enviou e-mail em conta real.
- **Trocar a chave de API:** `npm run docker:chave-unipile` (pergunta a chave, grava no `.env` e recria só `webhooks` e `cadencia`; nada de banco ou login é tocado). A chave nunca aparece na tela, no log nem no banco.
- **Webhook:** cadastre na Unipile um *Webhook Endpoint* apontando para `https://SEU-DOMINIO/webhooks/unipile` (o Caddy repassa; a porta 3100 não fica aberta) com os eventos `account.add`, `account.reconnect`, `account.status.*`, `account.initial_sync.completed`, `account.remove`, `email.new`, `message.new` e `relation.new`. A resposta traz o campo `secret`: cole em `UNIPILE_WEBHOOK_SECRET` no `.env` e rode `npm run docker:subir`. Cada aviso vem assinado (`unipile-signature`, HMAC-SHA256) e vale 5 minutos; sem segredo ou com assinatura errada, o aviso é recusado (401).
- **Conectar conta de mensagem (Caixa de entrada):** com `UNIPILE_API_KEY` preenchida, o botão Conectar abre o link da Unipile; sem ela mostra "ainda não está disponível neste ambiente" (nunca finge conectar). A conta é sempre da pessoa que clicou: o pedido tem um código nosso (`state`) que volta no aviso `account.add`, e o dono vem do pedido, nunca do aviso. O link vale 30 minutos.
- Responde 200 na hora e grava em seguida (3 tentativas). Se o banco ficar fora do ar nas 3, o aviso é perdido e fica só no log (`docker compose logs webhooks`, linha `webhook_unipile_perdido`). Não existe fila ainda.
- Só entra mensagem de contato do CRM, em conversa individual e recebida (não a que a própria pessoa enviou). O resto é descartado sem gravar nada, e o log nunca mostra remetente nem texto.
- **O que já foi visto funcionando** (protótipo do dono): conectar e-mail, assinatura do webhook, avisos de conta, e-mail recebido e envio de e-mail. **Ainda sem teste real:** WhatsApp, LinkedIn e Instagram (envio e recebimento). Os campos incertos estão marcados "NÃO CONFIRMADO" no código e cada um é uma linha para corrigir.

## Chaves dos fornecedores (tela do superadmin)
- Entre como superadmin → **Fornecedores** → **Nova chave**. Dá para cadastrar a Apify (quantas chaves quiser: o sistema divide o trabalho entre elas), a Unipile (chave e segredo do webhook) e a chave do modelo de IA.
- As chaves ficam **cifradas** no banco. A chave que cifra (`COFRE_CHAVE_MESTRA`) mora no `.env`; `npm run docker:subir` cria sozinha se faltar e **nunca troca** uma que já existe. **Faça cópia do `.env`**: sem essa chave, as chaves guardadas não abrem (daria para cadastrar de novo).
- O que está no cofre vale mais que o `.env`. Sem chave no cofre, continua valendo `UNIPILE_API_KEY` etc. do `.env`.
- Em cada linha: **Testar chave** (Apify e modelo de IA), **Ativar ou desativar** e **Remover chave**.

## Motor de cadência
O contêiner `cadencia` roda a cada 60 segundos (`CADENCIA_INTERVALO_SEGUNDOS`). Para cada inscrição ativa cujo passo venceu:
- **Passo manual** (LinkedIn, Instagram, ligação), ou **automático com o envio automático desligado**: vira uma tarefa do responsável, no dia, com o texto/roteiro pronto.
- **Passo automático (e-mail ou WhatsApp) com o envio automático ligado** (o dono liga; BDR só nas próprias inscrições): passa pela política Hermes, reserva créditos, envia pela conta de mensagem do dono, e consome os créditos (4 por envio). Se o envio falhar, a reserva é liberada e nada é cobrado; depois de 3 falhas a inscrição pausa e o dono é avisado.
- **Não envia** (e avisa o dono, uma vez) se: a Lia (agente de copy) estiver pausada (volta sozinho quando ela voltar), faltar crédito ou aprovação (a inscrição pausa), o dono não tiver conta conectada, ou o contato não tiver o canal. Resposta do contato pausa a cadência automaticamente.
- **Variáveis nos textos** (`{{primeiro_nome}}`, `{{empresa}}`, `{{cargo}}`, `{{cidade}}`, `{{uf}}`, `{{dominio}}`, `{{nome}}`, `{{meu_nome}}`): o motor troca pelos dados do contato, da conta e do responsável. **Nunca sai mensagem com `{{...}}`**: se faltar o dado (ex.: contato sem cargo), o envio automático espera, o dono é avisado uma vez e ele segue sozinho quando o dado for preenchido. Em tarefa (passo manual), o que falta aparece como `[FALTA: cargo]`.
- Sem `UNIPILE_API_KEY`, só os passos que viram tarefa rodam (veja `docker compose logs cadencia`).
- **Garantia:** no máximo um envio por inscrição+passo. Se o resultado do envio for incerto (rede caiu, erro 5xx), o motor NÃO reenvia sozinho: a execução fica "em andamento" e a linha `cadencia_envio_incerto` aparece no log para alguém conferir na caixa de saída da conta.

## O que fica aberto
Só o `web` (portas 80 e 443). Banco, Redis, login, API e arquivos ficam na rede interna do Docker.

## Backup
O contêiner `backup` grava, a cada 24 h, em `./backups`: `banco-AAAAMMDDTHHMMSSZ.dump` e `arquivos-AAAAMMDDTHHMMSSZ.tar.gz`, e apaga o que tiver mais de 14 dias. **Copie `./backups` para fora do servidor** (outro servidor ou nuvem de arquivos). Backup que mora só no mesmo disco não protege de perder o disco.

## Restaurar um backup (servidor novo ou desastre)
Usa o `.env` **da instalação original** (mesmas senhas). Escolha o par de arquivos da mesma data.
```
docker compose up -d db                      # só o banco
docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db \
  pg_restore -h localhost -U supabase_admin -d postgres --clean --if-exists \
  < backups/banco-AAAAMMDDTHHMMSSZ.dump
docker volume create althius_storage-data
docker run --rm --entrypoint tar -v althius_storage-data:/dest -v "$PWD/backups:/b" \
  supabase/postgres:17.11.0.002 xzf /b/arquivos-AAAAMMDDTHHMMSSZ.tar.gz -C /dest
npm run docker:subir                         # sobe o resto
```
**Não use `--no-owner` no `pg_restore`**: o login (`auth`) deixa de funcionar porque o dono dos esquemas muda. Se `POSTGRES_PASSWORD` não estiver no seu terminal, rode `set -a; . ./.env; set +a` antes. Depois de restaurar, confira o login e a tela Saúde ("Auditoria íntegra" tem que estar OK).

## Atualizar as imagens
As versões estão fixas no `docker-compose.yml`. Troque a versão num PR, teste em homologação com uma cópia de backup e depois: `docker compose pull && npm run docker:subir`.

## Ainda não está aqui (entra quando existir ponto de entrada)
Outros workers das filas (enriquecimento, raspagem), servidor MCP e Hermes Agent. Hoje só existe o Redis das filas.

## Agentes respondendo (Hermes Agent)
O contêiner `agentes` (ADR 0047) pega os pedidos dos canais e os entrega ao Hermes Agent de cada cliente. Ele **só responde por quem está em `docker/agentes-executores.json`** (copie de `docker/agentes-executores.exemplo.json`; o arquivo não vai para o git porque tem chaves). Sem entrada para o agente, o pedido espera na fila e nada é respondido: não existe resposta de mentira.
- Ver o que está acontecendo: `docker compose logs -f agentes` (linhas `agentes_ciclo`, `harness_lote_respondido`, `harness_lote_falhou`; o log nunca mostra o texto das mensagens).
- Adicionar um cliente ou agente: acrescente a entrada no arquivo; o serviço relê sozinho, sem reiniciar.
- **Teste de ponta a ponta** (prova canal → fila → Hermes → banco → resposta): `scripts/agentes/teste-ponta-a-ponta.mjs` (variáveis no cabeçalho do arquivo). Sem chave de modelo, use `scripts/agentes/modelo-de-mentira.mjs` como modelo de IA do perfil de teste.
- **Preparar o Hermes de um cliente** (ADR 0048 e 0050): `npm run agentes:provisionar -- --workspace <uuid do cliente> --responsavel <uuid do membro estrategista/C-level> --slug <nome-curto>`. Depois `npm run docker:subir`. Ele cria os 4 tokens, os 4 perfis (só as ferramentas da Althius), o contêiner do cliente e as linhas do `agentes-executores.json`. O Hermes usa o **gateway** (`gateway`, rede interna) como modelo: a chave do provedor fica no cofre, nunca no Hermes. Rodar de novo não troca tokens nem chaves. Mudou perfis com o contêiner no ar? `docker compose restart hermes-<slug>`.
- **Modelo de IA:** cadastre em Fornecedores → Nova chave → "Modelo de IA dos agentes" (tipo OpenAI ou Claude, endereço, nome do modelo, prioridade; preço opcional para medir o custo real). Pode cadastrar mais de um: o de menor número é o principal e os outros são reserva automática. Sem nenhum cadastrado, o agente não responde (nada de resposta de mentira). Uso e custo real por cliente: Uso global do superadmin.

