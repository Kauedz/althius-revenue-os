# ADR 0041: Infraestrutura em Docker, em servidor nosso

## Contexto
Decisão do dono (2026-10-05): **nada de Supabase Cloud**. A Althius roda em Docker, em servidor nosso, em desenvolvimento, homologação e produção. O núcleo continua sendo o Supabase (Postgres, Auth, API do banco, Storage), só que hospedado por nós. As migrations, a RLS com `auth.uid()`, as funções e os testes pgTAP não mudam. "Trocar por Postgres puro" não é o plano: obrigaria a reescrever login, RLS e a camada de dados do front.

(Numeração: o prompt pedia 0039, mas 0039 e 0040 já estão nos PRs abertos da âncora e da política de auditoria. Por isso esta é a 0041.)

## Decisão
Um `docker-compose.yml` na raiz sobe tudo. Imagens oficiais, com versão fixa (as mesmas do `npx supabase start`, para o ambiente de teste e o de servidor se comportarem igual).

| Contêiner | O que é | Porta |
| --- | --- | --- |
| `db` | Postgres 17 do Supabase | nenhuma (rede interna) |
| `auth` | GoTrue: login, senha, sessão. Cadastro aberto desligado | nenhuma |
| `rest` | PostgREST: a API do banco, sempre com a RLS do usuário | nenhuma |
| `storage` | Arquivos (fotos de perfil), em disco | nenhuma |
| `migrar` | Aplica as migrations e sai. Idempotente. Com `SEMEAR_DEMO=true`, carrega o seed (só desenvolvimento) | nenhuma |
| `redis` | Fila dos workers (BullMQ), com senha | nenhuma |
| `backup` | `pg_dump` + cópia dos arquivos, agendado | nenhuma |
| `web` | Caddy: serve o front e faz proxy de `/auth/v1`, `/rest/v1`, `/storage/v1`. HTTPS automático quando `SITE_URL` é um domínio | **80 e 443** |

1. **Só o `web` publica porta.** O banco, o Redis e os demais nunca ficam abertos para a internet.
2. **Gateway: Caddy, não Kong.** O Kong do compose oficial do Supabase serve para checar a chave e rotear. Aqui cada serviço já valida o JWT por conta própria e o Caddy já roteia, então o Kong seria um contêiner a mais sem função. Se um dia for preciso (limite de uso por chave, por exemplo), entra sem mudar mais nada.
3. **Realtime e Edge Runtime não rodam ainda.** O front não usa nenhum dos dois hoje (conferido: só há `auth`, `rest` e `storage`). Entram no compose no dia em que alguma tela ou função precisar.
4. **Padrão para código de servidor (receptor de webhook, workers, MCP): serviço Node próprio no compose**, não Edge Function. Motivo: o backend já é TypeScript com BullMQ (Node), e assim webhook, worker e testes (Vitest) compartilham código e tipos. Um Edge Runtime a mais traria Deno e uma segunda forma de testar.
5. **Workers, MCP e Hermes Agent ainda não estão no compose, de propósito.** Hoje não existe ponto de entrada executável para nenhum deles (o MCP é só uma função que monta o servidor; os workers são só a classe base). Colocar um contêiner "rodando" seria fingir. Cada um entra no PR que criar o seu ponto de entrada, como um serviço novo do compose. O Hermes Agent e o Laya seguem a ADR 0024 (um contêiner por cliente).
6. **Segredos:** o `.env` é gerado por `npm run docker:env` (senhas aleatórias, permissão 600) e **nunca** vai para o git (a trava `guardas` bloqueia). O compose só tem referências `${...}`, nunca valores. As chaves `anon` (pública) e `service_role` são assinadas com o `JWT_SECRET` gerado. Docker secrets ficam como evolução.
7. **Backup:** o contêiner `backup` roda `pg_dump` (formato custom) e empacota os arquivos a cada 24 h (`BACKUP_INTERVALO_HORAS`), em `./backups`, e apaga o que passar de 14 dias (`BACKUP_RETENCAO_DIAS`). **Copiar essa pasta para fora do servidor** é obrigação de quem opera (ainda sem rotina automática).
8. **Atualizar imagens:** versão fixa no compose. Para atualizar: trocar a versão num PR, subir em homologação com uma cópia de backup, `docker compose pull && docker compose up -d --build`. As migrations novas são aplicadas sozinhas pelo `migrar`. Voltar atrás = restaurar o backup.
9. **Homologação e produção** usam o mesmo compose com `.env` diferentes (`SITE_URL`, senhas). `SEMEAR_DEMO` é `false` fora do desenvolvimento.

## O que foi provado (ambiente de teste, não servidor real)
- Subida do zero com um comando; 47 migrations aplicadas; subir de novo não refaz nada; os dados sobrevivem a parar e subir.
- Login do seed, API respeitando a RLS (C-level só vê o próprio workspace; anônimo vê nada; C-level não lê a auditoria), cadastro aberto bloqueado (422), avatar enviado só na própria pasta (a de outra pessoa dá 403).
- Banco e Redis fechados para fora; Redis exige senha.
- **Desastre simulado:** volumes apagados, banco restaurado do backup, arquivos restaurados, sistema volta com login, dados, corrente de auditoria íntegra e avatar. Detalhe que o teste revelou: o restore **não** pode usar `--no-owner` (o `auth` quebra por mudar o dono dos esquemas). O procedimento correto está em `docker/LEIA-ME.md`.

## Pendências e limites
- **HTTPS com domínio real não foi testado** (precisa de domínio e DNS). Só o HTTP em `localhost`.
- **O estágio de build do `docker/Dockerfile.web` (`npm ci` + `vite build` dentro do Docker) não foi exercitado** no ambiente de teste, que só tem internet por um proxy que o contêiner de build não alcança. O mesmo build foi feito fora do Docker e o resultado servido pelo Caddy. Valide num servidor com internet normal.
- Como criar o **primeiro superadmin em produção** (sem o seed): decisão pendente do dono.
- Cópia automática do `./backups` para fora do servidor; Docker secrets; Realtime, Edge Runtime e Studio (painel do Supabase) quando houver uso.
