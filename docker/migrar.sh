#!/bin/sh
# Aplica as migrations (supabase/migrations) e, se pedido, os dados de demonstração.
# Idempotente: só roda o que ainda não foi aplicado. Usa a mesma tabela de controle do Supabase CLI
# (supabase_migrations.schema_migrations), então o banco continua compatível com `supabase db`.
set -eu

export PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD ausente}"
PSQL="psql -h db -U postgres -d postgres -v ON_ERROR_STOP=1 --no-psqlrc -q"

$PSQL <<'SQL'
CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version TEXT NOT NULL PRIMARY KEY, statements TEXT[], name TEXT);
CREATE TABLE IF NOT EXISTS supabase_migrations.althius_seed (aplicado_em TIMESTAMPTZ NOT NULL DEFAULT now());
SQL

aplicadas=0
for arquivo in $(ls /migracoes/*.sql | sort); do
  base=$(basename "$arquivo" .sql)
  versao=${base%%_*}
  nome=${base#*_}
  ja=$($PSQL -At -c "SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '$versao'")
  if [ "$ja" = "1" ]; then continue; fi
  echo "Aplicando $base"
  $PSQL --single-transaction -f "$arquivo"
  $PSQL -c "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('$versao', '$nome')"
  aplicadas=$((aplicadas + 1))
done
echo "Migrations novas aplicadas: $aplicadas"

if [ "${SEMEAR_DEMO:-false}" = "true" ]; then
  ja=$($PSQL -At -c "SELECT count(*) FROM supabase_migrations.althius_seed")
  if [ "$ja" = "0" ]; then
    echo "AVISO: carregando dados de demonstração (usuários com senha pública). Nunca use em produção."
    $PSQL --single-transaction -f /seed.sql
    $PSQL -c "INSERT INTO supabase_migrations.althius_seed DEFAULT VALUES"
  else
    echo "Dados de demonstração já carregados."
  fi
fi

# Avisa o PostgREST que o esquema mudou.
$PSQL -c "NOTIFY pgrst, 'reload schema'"
echo "Banco pronto."
