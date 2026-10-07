// Registra na Unipile (v1) os 4 webhooks que a Althius usa, já com o cabeçalho secreto. Serve para cada conta nova da Unipile
// (por exemplo, as contas gratuitas de 7 dias que se revezam, ADR 0071): troca-se a chave no cofre e roda-se isto uma vez.
//
// Por padrão só MOSTRA o que faria. Para criar de verdade, acrescente --aplicar.
//   $env:UNIPILE_API_KEY = '<chave da conta nova>'; $env:UNIPILE_API_URL = '<endereço da conta nova>'
//   npm run unipile:webhooks -- --url https://app.seudominio.com.br/webhooks/unipile --segredo '<o mesmo UNIPILE_WEBHOOK_SECRET do servidor>'
//   npm run unipile:webhooks -- --url ... --segredo ... --aplicar
// A chave e o segredo nunca são impressos. Webhooks antigos (com outro endereço) não são apagados aqui: a API não garante o
// DELETE; o script avisa quais são, e você os remove no painel da Unipile.
import { parseArgs } from 'node:util';
import { baseDaApi, lerConfig, versaoDaApi } from '../../src/server/unipile/config.ts';

const { values: a } = parseArgs({ options: { url: { type: 'string' }, segredo: { type: 'string' }, aplicar: { type: 'boolean' } } });
const cfg = lerConfig();
const segredo = (a.segredo ?? process.env.UNIPILE_WEBHOOK_SECRET ?? '').trim();
if (!cfg.apiKey) { console.error('Falta a chave: defina UNIPILE_API_KEY no ambiente.'); process.exit(1); }
if (versaoDaApi(cfg) !== 'v1') { console.error('Este script é para a Unipile v1. Na v2, cadastre o endpoint de webhook pelo painel (o segredo vem da própria Unipile).'); process.exit(1); }
if (!a.url || !/^https:\/\/[^\s]+\/webhooks\/unipile$/.test(a.url)) { console.error('Passe --url https://SEU-DOMINIO/webhooks/unipile (https, terminando em /webhooks/unipile).'); process.exit(1); }
if (segredo.length < 16) { console.error('Passe --segredo (ou UNIPILE_WEBHOOK_SECRET) com pelo menos 16 caracteres: o mesmo valor do servidor.'); process.exit(1); }

const base = baseDaApi(cfg) + '/api/v1';
const quero = [
  { name: 'althius-mensagens', source: 'messaging', events: ['message_received'] },
  { name: 'althius-email', source: 'email', events: ['mail_received'] },
  { name: 'althius-contas', source: 'account_status', events: ['creation_success', 'reconnected', 'sync_success', 'stopped', 'ok', 'error', 'credentials', 'permissions', 'deleted'] },
  { name: 'althius-relacoes', source: 'users', events: ['new_relation'] }
];

async function chamar(metodo, caminho, corpo) {
  const r = await fetch(base + caminho, { method: metodo, headers: { 'X-API-KEY': cfg.apiKey, Accept: 'application/json', ...(corpo ? { 'Content-Type': 'application/json' } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${metodo} ${caminho}: ${JSON.stringify(j).slice(0, 200)}`);
  return j;
}

const existentes = (await chamar('GET', '/webhooks')).items ?? [];
console.log(`Unipile v1 em ${baseDaApi(cfg)} · ${existentes.length} webhook(s) já cadastrado(s) · ${a.aplicar ? 'APLICANDO' : 'só mostrando (use --aplicar para criar)'}`);
for (const w of quero) {
  const igual = existentes.find(e => e.source === w.source && e.request_url === a.url && (e.headers ?? []).some(h => String(h.key).toLowerCase() === 'unipile-auth'));
  if (igual) { console.log(`= ${w.name}: já existe com o cabeçalho secreto (${igual.id ?? 'sem id'}).`); continue; }
  console.log(`+ ${w.name}: ${w.source} → ${w.events.join(', ')}`);
  if (!a.aplicar) continue;
  const r = await chamar('POST', '/webhooks', { request_url: a.url, name: w.name, source: w.source, events: w.events, format: 'json', enabled: true,
    headers: [{ key: 'Content-Type', value: 'application/json' }, { key: 'Unipile-Auth', value: segredo }] });
  console.log(`  criado (${r.webhook_id ?? 'sem id'}).`);
}
const sobrando = existentes.filter(e => e.request_url !== a.url);
if (sobrando.length) console.log(`! ${sobrando.length} webhook(s) apontam para outro endereço (${sobrando.map(e => e.name || e.id).join(', ')}). Se forem de teste, apague no painel da Unipile.`);
