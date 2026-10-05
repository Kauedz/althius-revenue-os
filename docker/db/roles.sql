-- Senhas dos papéis internos do Supabase = a senha do banco do .env (POSTGRES_PASSWORD).
-- A imagem do Postgres cria os papéis sem senha útil; este arquivo roda na primeira subida.
\set pgpass `echo "$POSTGRES_PASSWORD"`

ALTER USER authenticator WITH PASSWORD :'pgpass';
ALTER USER supabase_auth_admin WITH PASSWORD :'pgpass';
ALTER USER supabase_storage_admin WITH PASSWORD :'pgpass';
