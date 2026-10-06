// TESTE DE PONTA A PONTA dos agentes, para rodar em um servidor com o banco, o Hermes Agent e o MCP no ar:
// cria um canal, pede algo a um agente, roda UM ciclo do harness contra o Hermes e mostra a resposta que apareceu no canal.
// Prova a cadeia inteira: canal → política Hermes → fila → harness → Hermes Agent → MCP da Althius → banco → resposta no canal.
// Variáveis: BANCO_API_URL (ex.: http://localhost:54321), BANCO_ANON_KEY, BANCO_SERVICE_KEY, WORKSPACE_ID, MEMBRO_ID,
//   LOGIN_EMAIL, LOGIN_SENHA (pessoa que pede; precisa poder chamar o agente), HERMES_URL (sem /v1), HERMES_CHAVE,
//   AGENTE (padrão comercial), HERMES_MODELO (padrão hermes-agent), MEMBRO_EXTRA (outro membro para o canal).
// Apaga o canal de teste no fim (o gasto de 2 créditos fica no extrato).
import { createClient } from '@supabase/supabase-js';
import { bancoHarnessViaApi, rodarCicloHarness } from '../../src/server/agentes/harness.ts';
import { executorHermes } from '../../src/server/agentes/hermes.ts';
import { nomeDoAgente } from '../../src/server/agentes/prompts.ts';

const e = nome => { const v = process.env[nome]; if (!v) { console.error(`Falta ${nome}.`); process.exit(1); } return v; };
const URL = e('BANCO_API_URL'), ANON = e('BANCO_ANON_KEY'), SERVICO = e('BANCO_SERVICE_KEY');
const WS = e('WORKSPACE_ID'), MEMBRO = e('MEMBRO_ID'), HERMES = e('HERMES_URL'), CHAVE = e('HERMES_CHAVE');
const AGENTE = process.env.AGENTE || 'comercial', MODELO = process.env.HERMES_MODELO || 'hermes-agent';
const slug = 'teste-ponta-a-ponta';

const pessoa = createClient(URL, ANON, { auth: { persistSession: false } });
const { error: eLogin } = await pessoa.auth.signInWithPassword({ email: e('LOGIN_EMAIL'), password: e('LOGIN_SENHA') });
if (eLogin) { console.error('Login falhou:', eLogin.message); process.exit(1); }
const admin = createClient(URL, SERVICO, { auth: { persistSession: false } });

const outros = process.env.MEMBRO_EXTRA ? [process.env.MEMBRO_EXTRA] : [];
const c = await pessoa.rpc('chat_create_channel', { p_workspace_id: WS, p_member_id: MEMBRO, p_nome: 'Teste ponta a ponta', p_descricao: 'teste', p_pessoas: outros, p_agentes: [AGENTE] });
if (c.error || !c.data?.ok) { console.error('Canal não criado:', c.error?.message || c.data?.erro); process.exit(1); }
try {
  const s = await pessoa.rpc('chat_send', { p_workspace_id: WS, p_member_id: MEMBRO, p_slug: slug, p_texto: `@${nomeDoAgente(AGENTE)}, quantos contatos temos?`, p_resposta: null, p_agente: AGENTE });
  console.log('Pedido:', JSON.stringify(s.data));
  const { data: canal } = await admin.from('chat_channels').select('id').eq('workspace_id', WS).eq('slug', slug).single();
  const buscarMensagens = async () => (await admin.from('chat_messages').select('sender_type, sender_agent_id, content').eq('channel_id', canal.id).order('created_at')).data;
  // Pode haver pedidos de OUTROS canais esperando na frente (o harness atende um lote por agente por vez): roda ciclos
  // até a resposta do nosso canal aparecer (no máximo 10).
  const banco = bancoHarnessViaApi(URL + '/rest/v1', SERVICO);
  const executor = executorHermes({ resolver: () => ({ url: HERMES.replace(/\/+$/, '').replace(/\/v1$/, ''), chave: CHAVE, modelo: MODELO }) });
  let msgs = await buscarMensagens();
  for (let i = 1; i <= 10 && !msgs.some(m => m.sender_type === 'agent'); i++) {
    const r = await rodarCicloHarness({
      banco, executor, pegar: { silencioS: 0, esperaMaximaS: 0 }, executoresRegistrados: () => [`${WS}/${AGENTE}`],
      log: l => console.log('log:', JSON.stringify(l))
    });
    console.log(`Ciclo ${i}:`, JSON.stringify(r));
    msgs = await buscarMensagens();
  }
  for (const m of msgs) console.log(`  [${m.sender_type}${m.sender_agent_id ? ':' + m.sender_agent_id : ''}] ${m.content}`);
  const resposta = msgs.find(m => m.sender_type === 'agent');
  console.log(resposta ? '\nOK: o agente respondeu no canal.' : '\nFALHOU: o agente não respondeu. Veja os logs do Hermes e do harness.');
  process.exitCode = resposta ? 0 : 1;
} finally {
  await admin.from('chat_channels').delete().eq('workspace_id', WS).eq('slug', slug);
}
