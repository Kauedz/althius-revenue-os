import { describe, expect, it } from 'vitest';
import { adaptadorDePosts } from './posts.ts';
import type { ContaDoPedido } from './tipos.ts';

const ATOR = 'harvestapi/linkedin-profile-posts';
const ctx = { agora: Date.parse('2026-10-06T12:00:00Z'), frequencia: 'semanal' as const };
const contato = (n: number) => ({ id: `ct-${n}`, nome: `Fulano ${n}`, papel: 'decisor', linkedinUrl: `https://www.linkedin.com/in/canario-${n}`, snapshot: null });
const conta = (n: number[]): ContaDoPedido => ({ nome: 'Empresa X', dominio: 'x.test', contatos: n.map(contato) });

// Forma real do ator (06/10/2026): id do post, texto em `content`, data em `postedAt.date`, autor em `author`.
const post = (id: string, n: number, extra: Record<string, unknown> = {}) => ({
  type: 'post', id, linkedinUrl: `https://www.linkedin.com/posts/canario-${n}_${id}`, content: 'Estamos ampliando nossa operação de importação para o Sul.',
  author: { publicIdentifier: `canario-${n}`, linkedinUrl: `https://www.linkedin.com/in/canario-${n}`, name: 'Nome Público' },
  postedAt: { timestamp: Date.parse('2026-10-04T10:00:00Z'), date: '2026-10-04T10:00:00.000Z' }, engagement: { likes: 13, comments: 2, shares: 1 }, ...extra
});

describe('posts do decisor (posts_decisor)', () => {
  it('pede os posts recentes de até 3 contatos, sem republicações, na janela da frequência', () => {
    const e = adaptadorDePosts.entrada(ATOR, conta([1, 2, 3, 4]), ctx);
    expect(e).toEqual({ targetUrls: [1, 2, 3].map(n => `https://www.linkedin.com/in/canario-${n}`), maxPosts: 3, postedLimit: 'week', includeReposts: false });
    expect(adaptadorDePosts.entrada(ATOR, conta([1]), { ...ctx, frequencia: 'mensal' })).toMatchObject({ postedLimit: 'month' });
    expect(adaptadorDePosts.entrada(ATOR, conta([1]), { ...ctx, frequencia: 'diario' })).toMatchObject({ postedLimit: '24h' });
  });

  it('sem contato com LinkedIn: erro claro; ator desconhecido: erro claro', () => {
    expect(() => adaptadorDePosts.entrada(ATOR, conta([]), ctx)).toThrow(/sem contato/i);
    expect(() => adaptadorDePosts.entrada('x/y', conta([1]), ctx)).toThrow(/não faz parte/i);
  });

  it('cada post vira um acontecimento com o contato, o trecho, o link e a data do post', () => {
    const [e] = adaptadorDePosts.eventos(ATOR, [post('7001', 1)], conta([1]), ctx);
    expect(e.texto).toBe('Fulano 1 publicou no LinkedIn: Estamos ampliando nossa operação de importação para o Sul.');
    expect(e.fonte).toBe('LinkedIn');
    expect(e.quando).toBe('2026-10-04T10:00:00.000Z');
    expect(e.evidencia).toContain('https://www.linkedin.com/posts/canario-1_7001');
    expect(e.evidencia).toContain('13 curtidas');
    expect(e.chave).toBe('post|ct-1|7001');
  });

  it('post antigo demais para a janela é ignorado', () => {
    const velho = post('7002', 1, { postedAt: { date: '2026-08-01T00:00:00.000Z' } });
    expect(adaptadorDePosts.eventos(ATOR, [velho], conta([1]), ctx)).toEqual([]);
  });

  it('post de quem não é contato da conta é ignorado (nunca atribui post a outra pessoa)', () => {
    expect(adaptadorDePosts.eventos(ATOR, [post('7003', 9)], conta([1]), ctx)).toEqual([]);
  });

  it('post sem texto ou sem id, e itens que não são posts, são ignorados', () => {
    const itens = [post('7004', 1, { content: '' }), post('', 1), { error: 'x' }, null];
    expect(adaptadorDePosts.eventos(ATOR, itens, conta([1]), ctx)).toEqual([]);
  });

  it('o mesmo post repetido conta uma vez; texto longo é cortado', () => {
    const longo = post('7005', 1, { content: 'A'.repeat(1000) });
    const r = adaptadorDePosts.eventos(ATOR, [longo, longo], conta([1]), ctx);
    expect(r).toHaveLength(1);
    expect(r[0].texto.length).toBeLessThanOrEqual(300);
    expect(r[0].evidencia.length).toBeLessThanOrEqual(2000);
  });

  it('conta com UM contato só: o post devolvido é dele, mesmo que o endereço cadastrado seja de outro tipo (com código)', () => {
    const c = { nome: 'Empresa X', dominio: 'x.test', contatos: [{ ...contato(1), linkedinUrl: 'https://www.linkedin.com/in/ACwAABcodigo' }] };
    expect(adaptadorDePosts.eventos(ATOR, [post('7010', 7)], c, ctx)).toHaveLength(1);
  });
});
