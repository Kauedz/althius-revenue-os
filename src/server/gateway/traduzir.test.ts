import { describe, expect, it } from 'vitest';
import { paraAnthropic, deAnthropic, comoStream, textoDe } from './traduzir.ts';

describe('OpenAI → Claude (pedido)', () => {
  it('system vira campo próprio; user e assistant passam; max_tokens vem de max_completion_tokens', () => {
    const r = paraAnthropic({
      model: 'althius', max_completion_tokens: 500, temperature: 0.3,
      messages: [{ role: 'system', content: 'Você é a Zoe.' }, { role: 'user', content: 'Oi' }, { role: 'assistant', content: 'Olá!' }, { role: 'user', content: 'Liste' }]
    }, 'claude-x');
    expect(r).toEqual({
      model: 'claude-x', max_tokens: 500, temperature: 0.3, system: 'Você é a Zoe.',
      messages: [{ role: 'user', content: 'Oi' }, { role: 'assistant', content: 'Olá!' }, { role: 'user', content: 'Liste' }]
    });
  });
  it('sem limite informado, usa 4096 (a Claude exige max_tokens)', () => {
    expect(paraAnthropic({ messages: [{ role: 'user', content: 'x' }] }, 'm').max_tokens).toBe(4096);
  });
  it('várias mensagens system viram um só texto', () => {
    const r = paraAnthropic({ messages: [{ role: 'system', content: 'A' }, { role: 'system', content: 'B' }, { role: 'user', content: 'x' }] }, 'm');
    expect(r.system).toBe('A\n\nB');
  });
  it('ferramentas, chamada e resultado de ferramenta viram blocos tool_use/tool_result', () => {
    const r = paraAnthropic({
      messages: [
        { role: 'user', content: 'Busque' },
        { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'tool_call', arguments: '{"a":1}' } }] },
        { role: 'tool', tool_call_id: 'c1', content: 'achei 3' }
      ],
      tools: [{ type: 'function', function: { name: 'tool_call', description: 'chama', parameters: { type: 'object', properties: { a: { type: 'number' } } } } }],
      tool_choice: 'auto'
    }, 'm');
    expect(r.tools).toEqual([{ name: 'tool_call', description: 'chama', input_schema: { type: 'object', properties: { a: { type: 'number' } } } }]);
    expect(r.tool_choice).toEqual({ type: 'auto' });
    expect(r.messages).toEqual([
      { role: 'user', content: 'Busque' },
      { role: 'assistant', content: [{ type: 'tool_use', id: 'c1', name: 'tool_call', input: { a: 1 } }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'c1', content: 'achei 3' }] }
    ]);
  });
  it('resultados de ferramenta seguidos e texto do usuário juntam numa mensagem só (a Claude exige papéis alternados)', () => {
    const r = paraAnthropic({
      messages: [
        { role: 'assistant', content: 'vou chamar', tool_calls: [{ id: 'a', type: 'function', function: { name: 'f', arguments: '{}' } }, { id: 'b', type: 'function', function: { name: 'g', arguments: '{}' } }] },
        { role: 'tool', tool_call_id: 'a', content: 'ra' }, { role: 'tool', tool_call_id: 'b', content: 'rb' }, { role: 'user', content: 'e agora?' }
      ]
    }, 'm');
    expect(r.messages).toHaveLength(2);
    expect(r.messages[0].content).toEqual([{ type: 'text', text: 'vou chamar' }, { type: 'tool_use', id: 'a', name: 'f', input: {} }, { type: 'tool_use', id: 'b', name: 'g', input: {} }]);
    expect(r.messages[1].content).toEqual([
      { type: 'tool_result', tool_use_id: 'a', content: 'ra' }, { type: 'tool_result', tool_use_id: 'b', content: 'rb' }, { type: 'text', text: 'e agora?' }
    ]);
  });
  it('tool_choice: required → any; função específica → tool; none → sem ferramentas', () => {
    const base = { messages: [{ role: 'user', content: 'x' }], tools: [{ type: 'function', function: { name: 'f', parameters: {} } }] };
    expect(paraAnthropic({ ...base, tool_choice: 'required' }, 'm').tool_choice).toEqual({ type: 'any' });
    expect(paraAnthropic({ ...base, tool_choice: { type: 'function', function: { name: 'f' } } }, 'm').tool_choice).toEqual({ type: 'tool', name: 'f' });
    const nenhuma = paraAnthropic({ ...base, tool_choice: 'none' }, 'm');
    expect(nenhuma.tools).toBeUndefined();
    expect(nenhuma.tool_choice).toBeUndefined();
  });
  it('argumentos de ferramenta que não são JSON viram objeto vazio (nunca derruba o pedido)', () => {
    const r = paraAnthropic({ messages: [{ role: 'assistant', content: null, tool_calls: [{ id: 'a', type: 'function', function: { name: 'f', arguments: 'isso não é json' } }] }] }, 'm');
    expect((r.messages[0].content as any[])[0].input).toEqual({});
  });
  it('conteúdo em partes de texto é juntado; temperatura é limitada a 0–1', () => {
    const r = paraAnthropic({ temperature: 1.8, messages: [{ role: 'user', content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }] }, 'm');
    expect(r.messages[0].content).toBe('ab');
    expect(r.temperature).toBe(1);
  });
});

describe('Claude → OpenAI (resposta)', () => {
  it('texto simples', () => {
    const r = deAnthropic({ id: 'msg_1', model: 'claude-x', content: [{ type: 'text', text: 'Olá' }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 } }, 'althius');
    expect(r.choices[0]).toEqual({ index: 0, message: { role: 'assistant', content: 'Olá' }, finish_reason: 'stop' });
    expect(r.usage).toEqual({ prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 });
    expect(r.model).toBe('althius');
  });
  it('tool_use vira tool_calls com argumentos em texto JSON', () => {
    const r = deAnthropic({ id: 'm', content: [{ type: 'text', text: 'vou buscar' }, { type: 'tool_use', id: 't1', name: 'tool_call', input: { x: 1 } }], stop_reason: 'tool_use', usage: { input_tokens: 1, output_tokens: 1 } }, 'althius');
    expect(r.choices[0].finish_reason).toBe('tool_calls');
    expect(r.choices[0].message).toEqual({ role: 'assistant', content: 'vou buscar', tool_calls: [{ id: 't1', type: 'function', function: { name: 'tool_call', arguments: '{"x":1}' } }] });
  });
  it('max_tokens → length; sem texto → content nulo quando há ferramenta', () => {
    expect(deAnthropic({ content: [{ type: 'text', text: 'corta' }], stop_reason: 'max_tokens', usage: {} }, 'a').choices[0].finish_reason).toBe('length');
    expect(deAnthropic({ content: [{ type: 'tool_use', id: 't', name: 'f', input: {} }], stop_reason: 'tool_use', usage: {} }, 'a').choices[0].message.content).toBeNull();
  });
  it('uso ausente vira zero (não inventa)', () => {
    expect(deAnthropic({ content: [], stop_reason: 'end_turn' }, 'a').usage).toEqual({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
  });
});

describe('stream sintético', () => {
  it('resposta de texto vira chunks + [DONE]', () => {
    const sse = comoStream({ id: 'x', model: 'althius', created: 1, choices: [{ index: 0, message: { role: 'assistant', content: 'Oi' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
    expect(sse.endsWith('data: [DONE]\n\n')).toBe(true);
    const blocos = sse.split('\n\n').filter(b => b.startsWith('data: {')).map(b => JSON.parse(b.slice(6)));
    expect(blocos[0].choices[0].delta).toEqual({ role: 'assistant', content: 'Oi' });
    expect(blocos[blocos.length - 1].choices[0].finish_reason).toBe('stop');
  });
  it('chamada de ferramenta sai no formato de stream (índice, id, nome e argumentos)', () => {
    const sse = comoStream({ id: 'x', model: 'm', created: 1, choices: [{ index: 0, message: { role: 'assistant', content: null, tool_calls: [{ id: 't', type: 'function', function: { name: 'f', arguments: '{}' } }] }, finish_reason: 'tool_calls' }] });
    const blocos = sse.split('\n\n').filter(b => b.startsWith('data: {')).map(b => JSON.parse(b.slice(6)));
    expect(blocos[0].choices[0].delta.tool_calls[0]).toEqual({ index: 0, id: 't', type: 'function', function: { name: 'f', arguments: '{}' } });
    expect(blocos[blocos.length - 1].choices[0].finish_reason).toBe('tool_calls');
  });
});

describe('textoDe', () => {
  it('junta partes de texto e ignora o que não é texto', () => {
    expect(textoDe([{ type: 'text', text: 'a' }, { type: 'image_url', image_url: {} }, { type: 'text', text: 'b' }])).toBe('ab');
    expect(textoDe(null)).toBe('');
    expect(textoDe('x')).toBe('x');
  });
});
