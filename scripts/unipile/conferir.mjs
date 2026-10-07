// Confere a Unipile com a chave de verdade (ADR 0069), na v1 ou na v2. Só LÊ por padrão: lista as contas conectadas e, de
// cada uma, os primeiros chats. Com --link gera o link para CONECTAR uma conta (você abre e entra). Só ENVIA se você passar
// --enviar com a conta, o chat e o texto (uma mensagem de teste para uma conversa SUA). A chave vem do ambiente e nunca é impressa.
//
//   $env:UNIPILE_API_KEY = "<chave>"                              (PowerShell; a chave de teste será revogada depois)
//   $env:UNIPILE_API_URL = "https://api68.unipile.com:19840"      (o endereço do seu painel; a v1 é deduzida dele)
//   npm run unipile:conferir
//   npm run unipile:conferir -- --link linkedin
//   npm run unipile:conferir -- --enviar --canal linkedin --conta <id da conta> --chat <id do chat> --texto "teste"
import { parseArgs } from 'node:util';
import { baseDaApi, lerConfig, versaoDaApi } from '../../src/server/unipile/config.ts';
import { mensageiroViaApi } from '../../src/server/cadencia/envio.ts';

const { values: a } = parseArgs({ options: { enviar: { type: 'boolean' }, link: { type: 'string' }, conta: { type: 'string' }, chat: { type: 'string' }, texto: { type: 'string' }, canal: { type: 'string' } } });
const cfg = lerConfig();
if (!cfg.apiKey) { console.error('Falta a chave: defina UNIPILE_API_KEY no ambiente (ela não é impressa).'); process.exit(1); }
const v1 = versaoDaApi(cfg) === 'v1';
const base = baseDaApi(cfg);
console.log(`Unipile ${v1 ? 'v1' : 'v2'} em ${base}`);

async function chamar(metodo, caminho, corpo) {
  const r = await fetch(`${base}${caminho}`, { method: metodo, headers: { 'X-API-KEY': cfg.apiKey, Accept: 'application/json', ...(corpo ? { 'Content-Type': 'application/json' } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined });
  const resposta = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${caminho.split('?')[0]}: ${JSON.stringify(resposta).slice(0, 200)}`);
  return resposta;
}

if (a.link) {
  const provedor = String(a.link).toLowerCase();
  const expira = new Date(Date.now() + 30 * 60_000).toISOString();
  const r = v1
    ? await chamar('POST', '/api/v1/hosted/accounts/link', { type: 'create', providers: [provedor === 'microsoft' ? 'OUTLOOK' : provedor.toUpperCase()], api_url: base, expiresOn: expira, name: 'teste-althius' })
    : await chamar('POST', '/v2/auth/link', { expires_on: expira, providers: [provedor === 'microsoft' ? 'outlook' : provedor], state: 'teste-althius' });
  const link = r.url ?? r.link ?? r.data?.link;
  console.log(link ? `Abra este link (vale 30 minutos) e conecte a conta:\n${link}` : 'A Unipile não devolveu o link.');
  process.exit(link ? 0 : 2);
}

if (a.enviar) {
  if (!a.conta || !a.chat || !a.texto) { console.error('Para enviar: --conta, --chat e --texto.'); process.exit(1); }
  const canal = a.canal === 'instagram' ? 'instagram' : 'linkedin';
  const r = await mensageiroViaApi(() => cfg).enviar({ contaExterna: a.conta, canal, destinatario: a.chat, assunto: null, texto: a.texto, chaveIdempotencia: 'conferir-' + Date.now(), chatId: a.chat });
  console.log(r.ok ? `Enviado (mensagem ${r.mensagemId ?? 'sem id'}).` : `Não enviou: ${r.erro} (${r.definitivo ? 'recusado, nada saiu' : 'incerto, confira no app'}).`);
  process.exit(r.ok ? 0 : 2);
}

const contas = v1 ? await chamar('GET', '/api/v1/accounts') : await chamar('GET', '/v2/accounts/?limit=50');
const lista = (v1 ? contas.items : contas.data) || [];
console.log(`Contas conectadas: ${lista.length}`);
for (const c of lista) {
  const tipo = String(v1 ? c.type : c.provider);
  const status = v1 ? (c.sources || []).map(s => s.status).join(',') : c.status;
  console.log(`- ${tipo} · ${c.name} · ${status} · id ${c.id}`);
  if (!['linkedin', 'instagram', 'whatsapp'].includes(tipo.toLowerCase())) continue;
  try {
    const chats = v1 ? await chamar('GET', `/api/v1/chats?account_id=${encodeURIComponent(c.id)}&limit=3`) : await chamar('GET', `/v2/${encodeURIComponent(c.id)}/chats?limit=3`);
    for (const ch of (v1 ? chats.items : chats.data || chats.items) || []) console.log(`    chat ${ch.id} · ${ch.name ?? '(sem nome)'} · não lidas ${ch.unread_count ?? 0}`);
  } catch (e) { console.log('    não consegui listar os chats: ' + e.message); }
}
