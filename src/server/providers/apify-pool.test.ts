import { describe, expect, it } from 'vitest';
import { criarPoolApify } from './apify-pool.ts';
import type { Cofre, SegredoLido } from '../cofre/cofre.ts';

const chave = (n: number): SegredoLido => ({ id: `k${n}`, rotulo: `Conta ${n}`, segredo: `tok-${n}`, config: {} });
function cofreCom(itens: SegredoLido[]) {
  const usos: Array<[string, string | null]> = [];
  const cofre: Cofre = { ler: async () => itens, marcarUso: async (id, erro) => { usos.push([id, erro ?? null]); }, invalidar: () => {} };
  return { cofre, usos };
}
const ok = (id = 'run1') => Response.json({ data: { id, status: 'READY' } }, { status: 201 });

describe('rodízio da Apify (quantas chaves o superadmin cadastrar)', () => {
  it('divide o trabalho: cada pedido vai para a chave menos ocupada', async () => {
    const { cofre } = cofreCom([1, 2, 3, 4, 5, 6].map(chave));
    const usadas: string[] = [];
    const liberar: Array<() => void> = [];
    const buscar = (async (_u: string, init: RequestInit) => {
      usadas.push(String((init.headers as Record<string, string>).Authorization));
      await new Promise<void>(r => liberar.push(r));
      return ok();
    }) as unknown as typeof fetch;
    const pool = criarPoolApify({ cofre, buscar, env: {} });
    const pedidos = [1, 2, 3, 4, 5, 6].map(() => pool.executar('ator/x', {}));
    await new Promise(r => setTimeout(r, 20));
    expect(new Set(usadas).size).toBe(6); // seis pedidos ao mesmo tempo, seis chaves diferentes
    liberar.forEach(f => f());
    await Promise.all(pedidos);
  });

  it('manda a chave no cabeçalho (nunca na URL) e devolve qual conta rodou', async () => {
    const { cofre, usos } = cofreCom([chave(1)]);
    let url = '';
    const buscar = (async (u: string) => { url = u; return ok('abc'); }) as unknown as typeof fetch;
    const r = await criarPoolApify({ cofre, buscar, env: {} }).executar('ator/x', { a: 1 });
    expect(r).toEqual({ runId: 'abc', conta: 'Conta 1', status: 'READY' });
    expect(url).toBe('https://api.apify.com/v2/acts/ator%2Fx/runs');
    expect(url).not.toContain('tok-1');
    expect(usos).toEqual([['k1', null]]);
  });

  it('chave recusada: anota o erro, tenta a próxima e pula a ruim por um tempo', async () => {
    const { cofre, usos } = cofreCom([chave(1), chave(2)]);
    let agora = 0;
    const tentadas: string[] = [];
    const buscar = (async (_u: string, init: RequestInit) => {
      const a = String((init.headers as Record<string, string>).Authorization);
      tentadas.push(a);
      return a.endsWith('tok-1') ? new Response('{}', { status: 401 }) : ok();
    }) as unknown as typeof fetch;
    const pool = criarPoolApify({ cofre, buscar, env: {}, agora: () => agora });
    expect((await pool.executar('a/b', {})).conta).toBe('Conta 2');
    expect(usos[0]).toEqual(['k1', expect.stringMatching(/recus/i)]);
    tentadas.length = 0;
    await pool.executar('a/b', {});
    expect(tentadas).toEqual(['Bearer tok-2']); // a ruim está de molho
    agora += 61_000;
    tentadas.length = 0;
    await pool.executar('a/b', {});
    expect(tentadas).toContain('Bearer tok-1'); // passado o tempo, volta a tentar
  });

  it('limite de requisição (429): troca de chave sem marcar como recusada', async () => {
    const { cofre } = cofreCom([chave(1), chave(2)]);
    const buscar = (async (_u: string, init: RequestInit) => String((init.headers as Record<string, string>).Authorization).endsWith('tok-1') ? new Response('{}', { status: 429 }) : ok()) as unknown as typeof fetch;
    expect((await criarPoolApify({ cofre, buscar, env: {} }).executar('a/b', {})).conta).toBe('Conta 2');
  });

  it('todas falham: erro claro (nunca resultado inventado)', async () => {
    const { cofre } = cofreCom([chave(1), chave(2)]);
    const buscar = (async () => new Response('{}', { status: 500 })) as unknown as typeof fetch;
    await expect(criarPoolApify({ cofre, buscar, env: {} }).executar('a/b', {})).rejects.toThrow(/Apify/);
  });

  it('sem nenhuma chave (cofre vazio e sem .env): erro claro que manda cadastrar na tela', async () => {
    const { cofre } = cofreCom([]);
    await expect(criarPoolApify({ cofre, buscar: (async () => ok()) as unknown as typeof fetch, env: {} }).executar('a/b', {})).rejects.toThrow(/chave da Apify/i);
  });

  it('cofre vazio ou desligado: usa as chaves APIFY_TOKEN_* do .env (quantas houver)', async () => {
    const usadas: string[] = [];
    const buscar = (async (_u: string, init: RequestInit) => { usadas.push(String((init.headers as Record<string, string>).Authorization)); return ok(); }) as unknown as typeof fetch;
    const pool = criarPoolApify({ cofre: null, buscar, env: { APIFY_TOKEN_1: 'env-1', APIFY_TOKEN_7: 'env-7' } });
    await pool.executar('a/b', {});
    expect(usadas).toHaveLength(1);
    expect(pool.chaves ? (await pool.chaves()).length : 0).toBe(2);
  });
});
