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

## Dia a dia
- Ver o que está rodando: `docker compose ps`. Logs: `docker compose logs -f auth` (ou `rest`, `web`, `migrar`...).
- Parar sem perder dado: `npm run docker:parar`. **Nunca** use `docker compose down -v` em produção: o `-v` apaga o banco.
- Migration nova: entra sozinha na próxima subida (o `migrar` aplica só o que falta).

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
Workers das filas, servidor MCP e Hermes Agent. Hoje só existe o Redis das filas.
