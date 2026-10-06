// @vitest-environment node
// Adaptador genérico (ADR 0060): a receita do agente é só dado. Monta a entrada com as variáveis da conta, lê os campos
// do item e nunca deixa um item de outra empresa virar evento.
import { describe, expect, it } from 'vitest';
import { criarAdaptadorGenerico, eventosDoMapeamento, lerCampo, montarEntrada, preencher, type FonteGenerica } from './generico.ts';

const conta = { nome: 'Acme Indústria S.A.', dominio: 'www.acme.com.br', linkedinNome: 'Acme', linkedinUrl: 'https://www.linkedin.com/company/acme' };
const ctx = { agora: Date.parse('2026-10-06T12:00:00Z'), frequencia: 'semanal' as const };

const fonte = (m: Partial<FonteGenerica['mapeamento']> = {}, entrada: Record<string, unknown> = { q: '{{empresa}}' }): FonteGenerica => ({
  ator: 'dono/noticias', entrada, descricao: 'Google News',
  mapeamento: { texto: 'Notícia: {{title}}', chave: '{{url}}', vinculo: 'entrada', link: 'url', quando: 'publishedAt', ...m }
});

describe('entrada do ator', () => {
  it('troca as variáveis pela conta, em qualquer profundidade', () => {
    expect(montarEntrada({ q: '"{{empresa}}" site:{{dominio}}', urls: [{ url: '{{site}}' }], li: '{{linkedin_url}}', nome: '{{linkedin_empresa}}' }, conta, ctx)).toEqual({
      q: '"Acme Indústria S.A." site:acme.com.br', urls: [{ url: 'https://acme.com.br' }], li: 'https://www.linkedin.com/company/acme', nome: 'Acme'
    });
  });
  it('"{{dias}}" sozinho vira número (a janela da frequência)', () => {
    expect(montarEntrada({ dias: '{{dias}}', texto: 'últimos {{dias}} dias' }, conta, ctx)).toEqual({ dias: 8, texto: 'últimos 8 dias' });
  });
  it('variável inexistente ou sem valor na conta é erro: nunca roda o ator pela metade', () => {
    expect(() => montarEntrada({ q: '{{cnpj}}' }, conta, ctx)).toThrow(/não existe/);
    expect(() => montarEntrada({ q: '{{linkedin_url}}' }, { nome: 'Sem LinkedIn', dominio: 'x.test' }, ctx)).toThrow(/não tem o dado/);
  });
  it('o adaptador só aceita o ator da própria fonte', () => {
    const a = criarAdaptadorGenerico(fonte());
    expect(() => a.entrada('outro/ator', conta, ctx)).toThrow();
    expect(a.entrada('dono/noticias', conta, ctx)).toEqual({ q: 'Acme Indústria S.A.' });
  });
});

describe('leitura dos itens', () => {
  it('lê caminhos com pontos e posições de lista', () => {
    expect(lerCampo({ a: { b: [{ c: 'ok' }] } }, 'a.b.0.c')).toBe('ok');
    expect(lerCampo({ a: 1 }, 'a.b.c')).toBeUndefined();
  });
  it('preenche o modelo e sabe quando todos os campos vieram vazios', () => {
    expect(preencher('Vaga: {{title}} em {{city}}', { title: 'Dev', city: '' })).toEqual({ texto: 'Vaga: Dev em', vazio: false });
    expect(preencher('{{url}}', {}).vazio).toBe(true);
  });

  it('gera um evento por acontecimento, com fonte, link e data', () => {
    const itens = [
      { title: 'Acme abre fábrica', url: 'https://news.test/1', publishedAt: '2026-10-04T10:00:00Z' },
      { title: 'Acme abre fábrica (repost)', url: 'https://news.test/1', publishedAt: '2026-10-05T10:00:00Z' },
      { title: 'Antiga', url: 'https://news.test/2', publishedAt: '2026-08-01T10:00:00Z' },
      { title: '', url: 'https://news.test/3' },
      { error: 'bloqueado' }
    ];
    const ev = eventosDoMapeamento(fonte(), itens, conta, ctx);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ texto: 'Notícia: Acme abre fábrica', fonte: 'Google News', quando: '2026-10-04T10:00:00.000Z' });
    expect(ev[0].evidencia).toContain('https://news.test/1');
    expect(ev[0].chave.startsWith('ag|')).toBe(true);
  });

  it('CANÁRIO: vinculo "empresa" descarta item de outra empresa', () => {
    const f = fonte({ vinculo: 'empresa', empresa: 'company.name', quando: undefined });
    const ev = eventosDoMapeamento(f, [
      { title: 'Vaga A', url: 'u1', company: { name: 'ACME' } },
      { title: 'Vaga B', url: 'u2', company: { name: 'Acme Indústria SA' } },
      { title: 'Vaga C', url: 'u3', company: { name: 'Outra Empresa' } },
      { title: 'Vaga D', url: 'u4' }
    ], conta, ctx);
    expect(ev.map(e => e.texto).sort()).toEqual(['Notícia: Vaga A', 'Notícia: Vaga B']);
  });

  it('CANÁRIO: vinculo "dominio" só aceita o site da conta (ou subdomínio)', () => {
    const f = fonte({ vinculo: 'dominio', dominio: 'website', quando: undefined });
    const ev = eventosDoMapeamento(f, [
      { title: 'A', url: 'u1', website: 'https://acme.com.br/sobre' },
      { title: 'B', url: 'u2', website: 'loja.acme.com.br' },
      { title: 'C', url: 'u3', website: 'https://acme.com.br.golpe.test' },
      { title: 'D', url: 'u4', website: 'naoacme.com.br' }
    ], conta, ctx);
    expect(ev.map(e => e.texto).sort()).toEqual(['Notícia: A', 'Notícia: B']);
  });

  it('sem data no item, vale a hora da coleta', () => {
    const ev = eventosDoMapeamento(fonte({ quando: undefined }), [{ title: 'Sem data', url: 'u' }], conta, ctx);
    expect(ev[0].quando).toBe(new Date(ctx.agora).toISOString());
  });
});
