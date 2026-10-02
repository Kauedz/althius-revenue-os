-- ==============================================================================
-- Test: 00001_dual_schema_isolation.sql
-- Verifies Ticket 02 (ADR 0002) - Schema separation and permission isolation
-- ==============================================================================

BEGIN;
SELECT * FROM no_plan();
-- 1. Verify schema existence
SELECT has_schema('internal', 'Schema internal deve existir');
SELECT has_schema('public', 'Schema public deve existir');

-- 2. Verify table existence in schema internal
SELECT has_table('internal', 'master_provider_keys', 'Tabela internal.master_provider_keys deve existir');
SELECT has_table('internal', 'connection_secrets', 'Tabela internal.connection_secrets deve existir');
SELECT has_table('internal', 'provider_cost_events', 'Tabela internal.provider_cost_events deve existir');
SELECT has_table('internal', 'pricing_multipliers', 'Tabela internal.pricing_multipliers deve existir');

-- 3. Verify that PUBLIC / anon / authenticated roles have NO permissions on internal schema tables
SELECT ok(NOT has_table_privilege('anon', 'internal.master_provider_keys', 'SELECT'), 'Role anon NÃO pode ter permissão de SELECT em internal.master_provider_keys');

SELECT ok(NOT has_table_privilege('authenticated', 'internal.master_provider_keys', 'SELECT'), 'Role authenticated NÃO pode ter permissão de SELECT em internal.master_provider_keys');

SELECT ok(NOT has_table_privilege('anon', 'internal.connection_secrets', 'SELECT'), 'Role anon NÃO pode ter permissão de SELECT em internal.connection_secrets');

SELECT ok(NOT has_table_privilege('authenticated', 'internal.connection_secrets', 'SELECT'), 'Role authenticated NÃO pode ter permissão de SELECT em internal.connection_secrets');

SELECT ok(NOT has_table_privilege('anon', 'internal.provider_cost_events', 'SELECT'), 'Role anon NÃO pode ter permissão de SELECT em internal.provider_cost_events');

SELECT ok(NOT has_table_privilege('authenticated', 'internal.provider_cost_events', 'SELECT'), 'Role authenticated NÃO pode ter permissão de SELECT em internal.provider_cost_events');

-- 4. Verify that service_role and postgres DO have permissions
SELECT ok(has_table_privilege('service_role', 'internal.connection_secrets', 'SELECT'), 'Role service_role DEVE ter permissão de SELECT em internal.connection_secrets');

SELECT ok(has_table_privilege('service_role', 'internal.master_provider_keys', 'SELECT'), 'Role service_role DEVE ter permissão de SELECT em internal.master_provider_keys');

SELECT * FROM finish();
ROLLBACK;