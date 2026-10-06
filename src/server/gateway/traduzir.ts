// Tradução entre o formato da OpenAI (o que o Hermes fala) e o da Claude (Anthropic), mais o stream sintético.
// Funções puras, sem rede. O gateway sempre pede resposta COMPLETA ao provedor; se o Hermes pediu stream, a resposta
// é entregue em pedaços depois (simples e igual para qualquer provedor).

type Obj = Record<string, any>;

export const textoDe = (c: unknown): string => {
  if (typeof c === 'string') return c;
  if (!Array.isArray(c)) return '';
  return c.filter((p: Obj) => p?.type === 'text' && typeof p.text === 'string').map((p: Obj) => p.text).join('');
};

const json = (s: unknown): Obj => {
  try { const v = JSON.parse(String(s)); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; }
};

export function paraAnthropic(p: Obj, modelo: string): Obj {
  const system: string[] = [];
  const mensagens: Array<{ role: 'user' | 'assistant'; content: string | Obj[] }> = [];
  const juntar = (role: 'user' | 'assistant', blocos: Obj[]) => {
    const ultimo = mensagens[mensagens.length - 1];
    if (ultimo && ultimo.role === role) {
      const atual = typeof ultimo.content === 'string' ? [{ type: 'text', text: ultimo.content }] : ultimo.content;
      ultimo.content = [...atual, ...blocos];
    } else mensagens.push({ role, content: blocos });
  };
  for (const m of (p.messages ?? []) as Obj[]) {
    if (m.role === 'system') { const t = textoDe(m.content); if (t) system.push(t); continue; }
    if (m.role === 'tool') { juntar('user', [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: textoDe(m.content) }]); continue; }
    if (m.role === 'assistant') {
      const chamadas = (m.tool_calls ?? []) as Obj[];
      if (!chamadas.length) { const t = textoDe(m.content); mensagens.push({ role: 'assistant', content: t }); continue; }
      const t = textoDe(m.content);
      juntar('assistant', [...(t ? [{ type: 'text', text: t }] : []), ...chamadas.map(c => ({ type: 'tool_use', id: c.id, name: c.function?.name, input: json(c.function?.arguments) }))]);
      continue;
    }
    // user: texto puro quando possível; se a mensagem anterior já é do usuário (ex.: resultados de ferramenta), junta.
    const ultimo = mensagens[mensagens.length - 1];
    if (ultimo && ultimo.role === 'user') juntar('user', [{ type: 'text', text: textoDe(m.content) }]);
    else mensagens.push({ role: 'user', content: textoDe(m.content) });
  }
  const r: Obj = { model: modelo, max_tokens: p.max_tokens ?? p.max_completion_tokens ?? 4096 };
  if (typeof p.temperature === 'number') r.temperature = Math.min(1, Math.max(0, p.temperature));
  if (system.length) r.system = system.join('\n\n');
  r.messages = mensagens;
  const tc = p.tool_choice;
  if (Array.isArray(p.tools) && p.tools.length && tc !== 'none') {
    r.tools = (p.tools as Obj[]).map(t => ({ name: t.function?.name, ...(t.function?.description ? { description: t.function.description } : {}), input_schema: t.function?.parameters ?? { type: 'object', properties: {} } }));
    if (tc === 'auto') r.tool_choice = { type: 'auto' };
    else if (tc === 'required') r.tool_choice = { type: 'any' };
    else if (tc && typeof tc === 'object' && tc.function?.name) r.tool_choice = { type: 'tool', name: tc.function.name };
  }
  return r;
}

const PARADA: Record<string, string> = { end_turn: 'stop', stop_sequence: 'stop', tool_use: 'tool_calls', max_tokens: 'length' };

export function deAnthropic(a: Obj, nomeLogico: string): Obj {
  const blocos = (a.content ?? []) as Obj[];
  const texto = blocos.filter(b => b.type === 'text').map(b => b.text).join('');
  const chamadas = blocos.filter(b => b.type === 'tool_use').map(b => ({ id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) } }));
  const entrada = Number(a.usage?.input_tokens) || 0;
  const saida = Number(a.usage?.output_tokens) || 0;
  const message: Obj = { role: 'assistant', content: texto || (chamadas.length ? null : '') };
  if (chamadas.length) message.tool_calls = chamadas;
  return {
    id: a.id ?? 'chatcmpl-althius', object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: nomeLogico,
    choices: [{ index: 0, message, finish_reason: PARADA[a.stop_reason] ?? 'stop' }],
    usage: { prompt_tokens: entrada, completion_tokens: saida, total_tokens: entrada + saida }
  };
}

/** Resposta completa → texto de stream (SSE) no formato da OpenAI. */
export function comoStream(r: Obj): string {
  const base = { id: r.id, object: 'chat.completion.chunk', created: r.created, model: r.model };
  const bloco = (delta: Obj, fim: string | null, extra: Obj = {}) => 'data: ' + JSON.stringify({ ...base, choices: [{ index: 0, delta, finish_reason: fim }], ...extra }) + '\n\n';
  const msg = r.choices[0].message as Obj;
  const fim = r.choices[0].finish_reason as string;
  let s = '';
  if (msg.tool_calls?.length) {
    if (msg.content) s += bloco({ role: 'assistant', content: msg.content }, null);
    s += bloco({ ...(msg.content ? {} : { role: 'assistant' }), tool_calls: (msg.tool_calls as Obj[]).map((t, i) => ({ index: i, id: t.id, type: 'function', function: { name: t.function.name, arguments: t.function.arguments } })) }, null);
  } else s += bloco({ role: 'assistant', content: msg.content ?? '' }, null);
  s += bloco({}, fim, r.usage ? { usage: r.usage } : {});
  return s + 'data: [DONE]\n\n';
}
