-- ==============================================================================
-- Test: 00055_normalizacao.sql
-- PR 09: normalização de domínio e e-mail (implementação própria) e deduplicação na importação de contas.
--   www. e sem www., maiúsculas, http e https, porta, caminho, e-mail com nome.
-- Seed: Aline C-level Evolut (user e..03, membro d..03); Lucas BDR (e..04, d..04); Eduardo C-level do Grão Norte (e..07, d..09).
--       Aline Xavier cb..01 (e-mail aline.xavier@serraazul.com.br), conta Serra Azul c..01 (domínio serraazul.com.br).
-- ==============================================================================

BEGIN;
SELECT no_plan();

-- 1. Domínio: tudo vira o mesmo texto
SELECT is(public.normalize_domain('serraazul.com.br'), 'serraazul.com.br', 'Já normalizado fica igual');
SELECT is(public.normalize_domain('www.serraazul.com.br'), 'serraazul.com.br', 'Tira o www.');
SELECT is(public.normalize_domain('WWW.SerraAzul.COM.br'), 'serraazul.com.br', 'Maiúsculas viram minúsculas');
SELECT is(public.normalize_domain('http://serraazul.com.br'), 'serraazul.com.br', 'Tira http://');
SELECT is(public.normalize_domain('https://serraazul.com.br'), 'serraazul.com.br', 'Tira https://');
SELECT is(public.normalize_domain('HTTPS://WWW.SerraAzul.com.br/'), 'serraazul.com.br', 'Tudo junto');
SELECT is(public.normalize_domain('https://www.serraazul.com.br/produtos/importacao?x=1#topo'), 'serraazul.com.br', 'Tira caminho, consulta e âncora');
SELECT is(public.normalize_domain('serraazul.com.br:8443'), 'serraazul.com.br', 'Tira a porta');
SELECT is(public.normalize_domain('https://usuario:senha@serraazul.com.br:443/x'), 'serraazul.com.br', 'Tira usuário e senha da URL');
SELECT is(public.normalize_domain('serraazul.com.br.'), 'serraazul.com.br', 'Tira o ponto final');
SELECT is(public.normalize_domain('  https://www.serraazul.com.br  '), 'serraazul.com.br', 'Tira espaços nas pontas');
SELECT is(public.normalize_domain('//www.serraazul.com.br/x'), 'serraazul.com.br', 'URL sem protocolo');
SELECT is(public.normalize_domain('contato@serraazul.com.br'), 'serraazul.com.br', 'Um e-mail vira o domínio dele');
SELECT is(public.normalize_domain('loja.serraazul.com.br'), 'loja.serraazul.com.br', 'Subdomínio que não é www é mantido');
SELECT is(public.normalize_domain('www.www.exemplo.com'), 'exemplo.com', 'Vários www. seguidos saem todos');
SELECT is(public.normalize_domain('https:' || chr(92) || chr(92) || 'www.serraazul.com.br' || chr(92) || 'x'), 'serraazul.com.br', 'Barra invertida também separa o caminho');
SELECT is(public.normalize_domain('café.com.br'), 'café.com.br', 'Domínio com acento é aceito');
SELECT is(public.normalize_domain(NULL), NULL, 'Nulo continua nulo');
SELECT is(public.normalize_domain(''), NULL, 'Vazio vira nulo');
SELECT is(public.normalize_domain('   '), NULL, 'Só espaços vira nulo');
SELECT is(public.normalize_domain('localhost'), NULL, 'Sem ponto não é domínio');
SELECT is(public.normalize_domain('serraazul'), NULL, 'Sem terminação não é domínio');
SELECT is(public.normalize_domain('http://'), NULL, 'Só o protocolo não é domínio');
SELECT is(public.normalize_domain('192.168.0.10'), NULL, 'Endereço IP não é domínio de empresa');
SELECT is(public.normalize_domain('serra azul.com.br'), NULL, 'Espaço no meio é inválido');
SELECT is(public.normalize_domain('serra_azul.com.br'), NULL, 'Sublinhado é inválido');
SELECT is(public.normalize_domain('-serraazul.com.br'), NULL, 'Rótulo começando com hífen é inválido');
SELECT is(public.normalize_domain('serraazul.c'), NULL, 'Terminação de 1 letra é inválida');
SELECT is(public.normalize_domain(repeat('a', 70) || '.com.br'), NULL, 'Rótulo com mais de 63 letras é inválido');
SELECT ok(public.is_valid_domain('serraazul.com.br'), 'is_valid_domain aceita domínio');
SELECT ok(NOT public.is_valid_domain('https://serraazul.com.br'), 'is_valid_domain não aceita URL (só domínio já normalizado)');
SELECT ok(NOT public.is_valid_domain(NULL), 'is_valid_domain recusa nulo');

-- 2. E-mail: com nome, entre aspas, mailto
SELECT is(public.normalize_email('aline.xavier@serraazul.com.br'), 'aline.xavier@serraazul.com.br', 'E-mail simples');
SELECT is(public.normalize_email('  Aline.Xavier@SerraAzul.COM.br '), 'aline.xavier@serraazul.com.br', 'Maiúsculas e espaços');
SELECT is(public.normalize_email('Aline Xavier <Aline.Xavier@SerraAzul.com.br>'), 'aline.xavier@serraazul.com.br', 'E-mail com nome');
SELECT is(public.normalize_email('"Xavier, Aline" <aline.xavier@serraazul.com.br>'), 'aline.xavier@serraazul.com.br', 'Nome entre aspas com vírgula');
SELECT is(public.normalize_email('<aline.xavier@serraazul.com.br>'), 'aline.xavier@serraazul.com.br', 'Só entre sinais de menor e maior');
SELECT is(public.normalize_email('mailto:aline.xavier@serraazul.com.br'), 'aline.xavier@serraazul.com.br', 'Com mailto:');
SELECT is(public.normalize_email('aline+vendas@serraazul.com.br'), 'aline+vendas@serraazul.com.br', 'O +etiqueta é mantido (é um endereço distinto)');
SELECT is(public.normalize_email('aline.xavier@www.serraazul.com.br'), 'aline.xavier@www.serraazul.com.br', 'O domínio do e-mail não perde o www (é endereço de correio, não site)');
SELECT is(public.normalize_email('sem-arroba.com.br'), NULL, 'Sem @ é inválido');
SELECT is(public.normalize_email('aline@'), NULL, 'Sem domínio é inválido');
SELECT is(public.normalize_email('aline@serraazul'), NULL, 'Domínio sem terminação é inválido');
SELECT is(public.normalize_email('dois@@serraazul.com.br'), NULL, 'Dois @ é inválido');
SELECT is(public.normalize_email('Aline Xavier'), NULL, 'Só nome não é e-mail');
SELECT is(public.normalize_email(NULL), NULL, 'Nulo continua nulo');
SELECT is(public.normalize_email(''), NULL, 'Vazio vira nulo');

SELECT is(public.parse_email_list('Aline <a@x.com.br>, b@y.com.br; "Silva, João" <joao@z.com.br>'), ARRAY['a@x.com.br', 'b@y.com.br', 'joao@z.com.br'], 'Lista com nomes, vírgula, ponto e vírgula e aspas');
SELECT is(public.parse_email_list('A@X.com.br, a@x.com.br'), ARRAY['a@x.com.br'], 'Repetidos saem uma vez, na ordem de chegada');
SELECT is(public.parse_email_list('sem email aqui'), ARRAY[]::text[], 'Sem e-mail: lista vazia');
SELECT is(public.parse_email_list(NULL), ARRAY[]::text[], 'Nulo: lista vazia');

-- 3. O canal de e-mail do contato usa a mesma normalização (e o filtro de mensagens recebidas reconhece e-mail com nome)
SELECT is(public.normalize_channel_value('email', 'Aline Xavier <Aline.Xavier@SerraAzul.com.br>'), 'aline.xavier@serraazul.com.br', 'normalize_channel_value entende e-mail com nome');
SELECT is(public.normalize_channel_value('email', 'texto sem e-mail'), 'texto sem e-mail', 'Valor que não é e-mail mantém o comportamento antigo (nunca vira nulo)');
SELECT is(public.normalize_channel_value('phone', '(11) 90000-0001'), '11900000001', 'Telefone não mudou');
SELECT is(public.normalize_channel_value('linkedin', 'https://www.linkedin.com/in/Fulano'), 'fulano', 'LinkedIn não mudou');
SELECT is(public.unipile_ingest_message('demo-lucas-google', 'email', 'Aline Xavier <ALINE.XAVIER@serraazul.com.br>', 'chat-norm', 'msg-norm-1', 'Oi', false, 'neutra')->>'action', 'persisted',
  'Mensagem de "Nome <e-mail>" é reconhecida como contato do CRM');

-- 4. Logo do site
SELECT is(public.fetch_domain_logo('HTTPS://www.SerraAzul.com.br/'), 'https://img.logo.dev/serraazul.com.br?token=pk_anonymous&size=128', 'Logo usa o domínio normalizado');
SELECT is(public.fetch_domain_logo('nao e dominio'), NULL, 'Site inválido não gera endereço de logo');
SELECT is(public.fetch_domain_logo(NULL), NULL, 'Nulo continua nulo');

-- 5. Criar e editar conta normalizam o domínio
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000003", "role": "authenticated"}';
SELECT is((public.create_account('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'Nova Conta', 'HTTPS://WWW.NovaConta.com.br/home')).domain, 'novaconta.com.br', 'create_account normaliza o domínio');
SELECT throws_ok($$ SELECT public.create_account('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'Conta Ruim', 'isto não é um site') $$, '22023', NULL, 'create_account recusa domínio inválido');
SELECT is((public.update_account((SELECT id FROM public.accounts WHERE domain = 'novaconta.com.br'), 'd0000000-0000-0000-0000-000000000003', NULL, 'http://www.OutroSite.com.br')).domain, 'outrosite.com.br', 'update_account normaliza o domínio');
SELECT throws_ok($$ SELECT public.update_account((SELECT id FROM public.accounts WHERE domain = 'outrosite.com.br'), 'd0000000-0000-0000-0000-000000000003', NULL, 'lixo') $$, '22023', NULL, 'update_account recusa domínio inválido');
SELECT is((public.update_account((SELECT id FROM public.accounts WHERE domain = 'outrosite.com.br'), 'd0000000-0000-0000-0000-000000000003', 'Só o nome', NULL)).domain, 'outrosite.com.br', 'Sem domínio novo, o domínio fica como estava');

-- 6. Importação marca duplicidade de verdade (www, maiúsculas, http/https), conta as inválidas e nunca apaga
SELECT is(public.import_accounts('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', jsonb_build_array(
  jsonb_build_object('name', 'Serra Azul de novo', 'domain', 'www.SerraAzul.com.br'),
  jsonb_build_object('name', 'Serra Azul https', 'domain', 'https://serraazul.com.br/'),
  jsonb_build_object('name', 'Serra Azul http com porta', 'domain', 'HTTP://serraazul.com.br:80'),
  jsonb_build_object('name', 'Empresa Nova', 'domain', 'WWW.EmpresaNova.com.br'),
  jsonb_build_object('name', 'Empresa Nova de novo', 'domain', 'https://empresanova.com.br/contato'),
  jsonb_build_object('name', 'Sem site', 'domain', ''),
  jsonb_build_object('name', 'Site quebrado', 'domain', 'isto não é um site')
)), '{"total": 7, "criadas": 1, "duplicadas": 4, "invalidas": 2}'::jsonb, 'Duplicadas por www, caixa, protocolo e porta; inválidas contadas');
RESET ROLE;
SELECT is((SELECT count(*) FROM public.accounts WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND domain = 'serraazul.com.br' AND is_duplicate = false), 1::bigint, 'Continua uma conta canônica da Serra Azul');
SELECT is((SELECT count(*) FROM public.accounts WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND domain = 'serraazul.com.br' AND is_duplicate = true AND duplicate_of_id = 'c0000000-0000-0000-0000-000000000001'), 3::bigint, 'As 3 repetições apontam para a original');
SELECT is((SELECT count(*) FROM public.accounts WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND domain = 'empresanova.com.br'), 2::bigint, 'Empresa Nova: 1 canônica e 1 duplicada (nada apagado)');
SELECT is((SELECT name FROM public.accounts WHERE id = 'c0000000-0000-0000-0000-000000000001'), 'Serra Azul Têxtil', 'A conta original não foi sobrescrita');

-- Isolamento: o mesmo domínio em OUTRO cliente não é duplicata
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000007", "role": "authenticated"}';
SELECT is(public.import_accounts('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000009', jsonb_build_array(
  jsonb_build_object('name', 'Serra Azul (cliente do Grão)', 'domain', 'WWW.SerraAzul.com.br')
)), '{"total": 1, "criadas": 1, "duplicadas": 0, "invalidas": 0}'::jsonb, 'No Grão Norte o mesmo domínio é uma conta nova (cada cliente tem a sua base)');
-- BDR continua sem importar
SET LOCAL "request.jwt.claims" = '{"sub": "e0000000-0000-0000-0000-000000000004", "role": "authenticated"}';
SELECT throws_ok($$ SELECT public.import_accounts('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', '[{"name":"x","domain":"x.com.br"}]'::jsonb) $$, '42501', NULL, 'BDR continua sem importar');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
