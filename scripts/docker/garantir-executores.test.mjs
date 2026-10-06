import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONTEUDO_VAZIO, garantirExecutores } from './garantir-executores.mjs';

let pasta = '';
afterEach(() => { if (pasta) rmSync(pasta, { recursive: true, force: true }); pasta = ''; });

describe('garantirExecutores', () => {
  it('cria o arquivo vazio quando falta, e não mexe se já existe', () => {
    pasta = mkdtempSync(join(tmpdir(), 'exec-'));
    const a = join(pasta, 'agentes-executores.json');
    expect(garantirExecutores(a)).toBe(true);
    expect(readFileSync(a, 'utf8')).toBe(CONTEUDO_VAZIO);
    expect(JSON.parse(readFileSync(a, 'utf8'))).toEqual({ executores: {} });
    writeFileSync(a, '{"executores":{"x":1}}');
    expect(garantirExecutores(a)).toBe(false);
    expect(readFileSync(a, 'utf8')).toBe('{"executores":{"x":1}}');
  });
  it('recusa com explicação quando já existe uma PASTA com o nome do arquivo', () => {
    pasta = mkdtempSync(join(tmpdir(), 'exec-'));
    const a = join(pasta, 'agentes-executores.json');
    mkdirSync(a);
    expect(() => garantirExecutores(a)).toThrow(/é uma pasta/);
  });
});
