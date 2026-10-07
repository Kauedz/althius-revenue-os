// Confere a Unipile com a chave de verdade (ADR 0069). Só LÊ por padrão: lista as contas conectadas e, de cada uma, os
// primeiros chats. Só ENVIA se você passar --enviar com a conta, o chat e o texto (uma mensagem de teste para uma conversa
// SUA). A chave vem do ambiente e nunca é impressa.
//
//   $env:UNIPILE_API_KEY = "<chave>"              (PowerShell; a chave de teste será revogada depois)
//   npm run unipile:conferir
//   npm run unipile:conferir -- --enviar --conta <id da conta> --chat <id do chat> --texto "teste"
import { parseArgs } from 'node:util';
import { lerConfig } from '../../src/server/unipile/config.ts';
import { mensageiroViaApi } from '../../src/server/cadencia/envio.ts';

const { values: a } = parseArgs({ options: { enviar: { type: 'boolean' }, conta: { type: 'string' }, chat: { type: 'string' }, texto: { type: 'string' }, canal: { type: 'string' } } });
const cfg = lerConfig();
if (!cfg.apiKey) { console.error('Falta a chave: defina UNIPILE_API_KEY no ambiente (ela não é impressa).'); process.exit(1); }

async function pegar(caminho) {
  const r = await fetch(`${cfg.url}${caminho}`, { headers: { 'X-API-KEY': cfg.apiKey, Accept: 'application/json' } });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${caminho.split('?')[0]}: ${JSON.stringify(corpo).slice(0, 200)}`);
  return corpo;
}

if (a.enviar) {
  if (!a.conta || !a.chat || !a.texto) { console.error('Para enviar: --conta, --chat e --texto.'); process.exit(1); }
  const canal = a.canal === 'instagram' ? 'instagram' : 'linkedin';
  const r = await mensageiroViaApi(() => cfg).enviar({ contaExterna: a.conta, canal, destinatario: a.chat, assunto: null, texto: a.texto, chaveIdempotencia: 'conferir-' + Date.now(), chatId: a.chat });
  console.log(r.ok ? `Enviado (mensagem ${r.mensagemId ?? 'sem id'}).` : `Não enviou: ${r.erro} (${r.definitivo ? 'recusado, nada saiu' : 'incerto, confira no app'}).`);
  process.exit(r.ok ? 0 : 2);
}

const contas = await pegar('/v2/accounts/?limit=50');
console.log(`Contas conectadas: ${(contas.data || []).length}`);
for (const c of contas.data || []) {
  console.log(`- ${c.provider} · ${c.name} · ${c.status} · id ${c.id}`);
  if (!['linkedin', 'instagram', 'whatsapp'].includes(String(c.provider).toLowerCase())) continue;
  try {
    const chats = await pegar(`/v2/${encodeURIComponent(c.id)}/chats?limit=3`);
    for (const ch of chats.data || chats.items || []) console.log(`    chat ${ch.id} · ${ch.type ?? ''} · ${ch.name ?? '(sem nome)'} · não lidas ${ch.unread_count ?? 0}`);
  } catch (e) { console.log('    não consegui listar os chats: ' + e.message); }
}
