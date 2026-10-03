// A matriz de capacidades do banco (role_permissions) precisa bater com a do documento/front v18
// (window.ALTHIUS_CAPS em module.js): 33 capacidades x 4 papéis, mesmo escopo em cada célula.
import { describe, expect, it } from 'vitest';
import '../v18/data.js';
import '../v18/module.js';
import { carregarContexto } from './contexto';
import { PAPEL_FRONT } from './dados';
import { bancoLocalNoAr, entrarComoLocal } from '../test/supabaseLocal';

const LETRA: Record<string, string> = { all: 's', assigned: 'a', own: 'p', read: 'l', request: 'q', none: 'n' };
const PAPEIS = ['superadmin', 'estrategista', 'cliente', 'bdr'];

describe.skipIf(!bancoLocalNoAr)('matriz do banco x matriz do front v18', () => {
  it('cada célula tem o mesmo escopo', async () => {
    const caps = window.ALTHIUS_CAPS as { grupos: Array<{ itens: Array<{ k: string; v: string[] }> }> };
    const esperado = Object.fromEntries(caps.grupos.flatMap(g => g.itens).map(i => [i.k, i.v.join('')]));

    const ctx = await carregarContexto(await entrarComoLocal('aline@evolut.com.br'));
    const doBanco: Record<string, string[]> = {};
    for (const m of ctx.matriz) {
      (doBanco[m.chave] ||= ['?', '?', '?', '?'])[PAPEIS.indexOf(PAPEL_FRONT[m.papel])] = LETRA[m.escopo];
    }
    const obtido = Object.fromEntries(Object.entries(doBanco).map(([k, v]) => [k, v.join('')]));

    expect(Object.keys(obtido).sort()).toEqual(Object.keys(esperado).sort());
    expect(obtido).toEqual(esperado);
  });
});
