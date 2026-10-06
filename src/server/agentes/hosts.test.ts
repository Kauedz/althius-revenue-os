import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lerExecutores, registroDeExecutores } from './hosts';

const WS = 'a0000000-0000-0000-0000-000000000001';
const bom = (extra: Record<string, unknown> = {}) => JSON.stringify({ executores: { [`${WS}/comercial`]: { url: 'http://hermes-evolut:8642/p/comercial/', chave: ' k1 ', modelo: 'comercial' }, ...extra } });

describe('lerExecutores', () => {
  it('lê o executor, tira a barra do fim e o /v1, e apara a chave', () => {
    const m = lerExecutores(JSON.stringify({ executores: { [`${WS}/marketing`]: { url: 'https://h.example/v1', chave: ' k ' } } }));
    expect(m.get(`${WS}/marketing`)).toEqual({ url: 'https://h.example', chave: 'k', modelo: 'hermes-agent' });
    expect(lerExecutores(bom()).get(`${WS}/comercial`)).toEqual({ url: 'http://hermes-evolut:8642/p/comercial', chave: 'k1', modelo: 'comercial' });
  });
  it('ignora entrada fora do formato e avisa, sem derrubar as boas', () => {
    const avisos: string[] = [];
    const m = lerExecutores(bom({
      'sem-uuid/comercial': { url: 'http://x', chave: 'k' },
      [`${WS}/vendas`]: { url: 'http://x', chave: 'k' },
      [`${WS}/copy`]: { url: 'ftp://x', chave: 'k' },
      [`${WS}/revops`]: { url: 'http://x', chave: '  ' },
      [`${WS}/comercial/extra`]: { url: 'http://x', chave: 'k' }
    }), a => avisos.push(a));
    expect([...m.keys()]).toEqual([`${WS}/comercial`]);
    expect(avisos).toHaveLength(5);
    expect(JSON.stringify(avisos)).not.toContain('"k"');
  });
  it('JSON ruim ou sem o campo: nenhum executor, com aviso', () => {
    const avisos: string[] = [];
    expect(lerExecutores('{nao e json', a => avisos.push(a)).size).toBe(0);
    expect(lerExecutores('{}', a => avisos.push(a)).size).toBe(0);
    expect(lerExecutores('[]', a => avisos.push(a)).size).toBe(0);
    expect(avisos).toHaveLength(3);
  });
});

describe('registroDeExecutores', () => {
  let pasta = '';
  afterEach(() => { if (pasta) rmSync(pasta, { recursive: true, force: true }); pasta = ''; });

  it('arquivo ausente: nenhum executor (e avisa uma vez só)', () => {
    const avisos: string[] = [];
    const r = registroDeExecutores('/nao/existe.json', a => avisos.push(a));
    expect(r.registrados()).toEqual([]);
    expect(r.resolver(WS, 'comercial')).toBeNull();
    expect(avisos).toHaveLength(1);
  });
  it('relê quando o arquivo muda, sem reiniciar', () => {
    pasta = mkdtempSync(join(tmpdir(), 'agentes-'));
    const arq = join(pasta, 'hosts.json');
    writeFileSync(arq, bom());
    const r = registroDeExecutores(arq);
    expect(r.registrados()).toEqual([`${WS}/comercial`]);
    expect(r.resolver(WS.toUpperCase(), 'comercial')?.chave).toBe('k1');
    expect(r.resolver(WS, 'marketing')).toBeNull();
    writeFileSync(arq, bom({ [`${WS}/marketing`]: { url: 'http://h2', chave: 'k2' } }));
    utimesSync(arq, new Date(), new Date(Date.now() + 5000));
    expect(r.registrados().sort()).toEqual([`${WS}/comercial`, `${WS}/marketing`]);
  });
});
