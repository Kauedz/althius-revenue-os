// MODELO DE IA DE MENTIRA (servidor compatível com OpenAI), só para testar o Hermes Agent de ponta a ponta SEM chave de
// modelo e sem custo: quando o Hermes oferece a ferramenta `tool_call`, ele chama mcp__althius__buscar_contatos (o nosso
// MCP, que lê o banco com o token do agente) e depois responde com um texto fixo. NUNCA use em produção: serve para provar
// a ligação Hermes ↔ MCP ↔ banco ↔ canal. Uso:  FAKE_LLM_LOG=/tmp/llm.log node scripts/agentes/modelo-de-mentira.mjs
// e aponte o perfil do Hermes (model.provider: custom, base_url: http://127.0.0.1:8999/v1) para ele.
import { createServer } from 'node:http';
import { appendFileSync } from 'node:fs';
const LOG = process.env.FAKE_LLM_LOG || '/dev/null';
createServer((req, res) => {
  let b = ''; req.on('data', c => b += c); req.on('end', () => {
    let j = {}; try { j = JSON.parse(b); } catch {}
    appendFileSync(LOG, JSON.stringify({ url: req.url, tools: (j.tools || []).map(t => t.function?.name), nmsgs: (j.messages || []).length, roles: (j.messages || []).map(m => m.role) }) + '\n');
    if (req.url.endsWith('/models')) { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ object: 'list', data: [{ id: 'fake-model', object: 'model' }] })); }
    const msgs = j.messages || [];
    const ultimo = msgs[msgs.length - 1] || {};
    const alvo = (j.tools || []).some(t => t.function?.name === 'tool_call');
    let msg;
    if (ultimo.role === 'tool') {
      const txt = typeof ultimo.content === 'string' ? ultimo.content : JSON.stringify(ultimo.content); msg = { role: 'assistant', content: 'Resposta de teste: a ferramenta devolveu ' + txt.length + ' caracteres.' };
    } else if (alvo) {
      msg = { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'tool_call', arguments: JSON.stringify({ calls: [{ name: 'mcp__althius__buscar_contatos', arguments: {} }] }) } }] };
    } else {
      msg = { role: 'assistant', content: 'Sem ferramenta disponível.' };
    }
    const base = { id: 'chatcmpl-x', object: 'chat.completion', created: 1, model: 'fake-model' };
    if (j.stream) {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const ch = (delta, fin) => res.write('data: ' + JSON.stringify({ ...base, object: 'chat.completion.chunk', choices: [{ index: 0, delta, finish_reason: fin }] }) + '\n\n');
      if (msg.tool_calls) { ch({ role: 'assistant', tool_calls: msg.tool_calls.map((t, i) => ({ index: i, ...t })) }, null); ch({}, 'tool_calls'); }
      else { ch({ role: 'assistant', content: msg.content }, null); ch({}, 'stop'); }
      res.write('data: [DONE]\n\n'); return res.end();
    }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ...base, choices: [{ index: 0, message: msg, finish_reason: msg.tool_calls ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }));
  });
}).listen(8999, '127.0.0.1', () => console.log('fake llm on 8999'));
