// @vitest-environment node
// Etapa "pessoas": Google acha os perfis, o leitor de perfis traz foto e cargo, telefone só com fonte configurada.
// Apify falsa (nenhuma chamada real). O gasto somado nunca passa do teto do pedido.
import { describe, expect, it } from 'vitest';
import { acharPessoas, candidatosDoGoogle, lerPerfil, marcasDaEmpresa, personaDoCargo, telefonesDoItem, type PedidoPessoas } from './pessoas.ts';
import type { OpcoesColeta, ResultadoColeta } from '../providers/apify-pool.ts';

const PERSONAS = [{ cargo: 'CEO', papel: 'decisor' }, { cargo: 'Diretor', papel: 'decisor' }, { cargo: 'Head', papel: 'campeao' }, { cargo: 'Gerente', papel: 'influenciador' }];
const pedido = (extra: Partial<PedidoPessoas> = {}): PedidoPessoas => ({
  conta: { nome: 'Canário Indústria Ltda', dominio: 'canario.test' }, personas: PERSONAS, max: 5, jaTem: [], tetoUsd: 0.0962, ...extra
});
const serp = (linhas: Array<[string, string, string?]>) => [{ organicResults: linhas.map(([title, url, description]) => ({ title, url, description: description ?? '' })) }];
const GOOGLE = serp([
  ['Ana Souza - Gerente de Compras - Canário Indústria | LinkedIn', 'https://br.linkedin.com/in/ana-souza?trk=x'],
  ['Bruno Lima - CEO - Canário Indústria | LinkedIn', 'https://www.linkedin.com/in/bruno-lima'],
  ['Carla Dias - Analista - Canário Indústria | LinkedIn', 'https://www.linkedin.com/in/carla-dias'],
  ['Diego Reis - Diretor Comercial - Outra Empresa | LinkedIn', 'https://www.linkedin.com/in/diego-reis'],
  ['Eva Melo – Head de Vendas – Canário | LinkedIn', 'https://www.linkedin.com/in/eva-melo'],
  ['Canário Indústria | LinkedIn', 'https://www.linkedin.com/company/canario'],
  ['Bruno Lima - CEO - Canário Indústria | LinkedIn', 'https://www.linkedin.com/in/bruno-lima/']
]);

function apifaFalsa(respostas: Record<string, (entrada: Record<string, unknown>, op: OpcoesColeta) => ResultadoColeta | Promise<ResultadoColeta>>) {
  const chamadas: Array<{ ator: string; entrada: Record<string, unknown>; op: OpcoesColeta }> = [];
  const gastos: Array<{ teto: number; custo: number }> = [];
  /** cada execução começa com teto ≤ o que sobrou do pedido (gasto real anterior + teto desta ≤ total) */
  const dentroDoTeto = (total: number) => gastos.every((g, i) => gastos.slice(0, i).reduce((t, x) => t + x.custo, 0) + g.teto <= total + 1e-9);
  return {
    chamadas, dentroDoTeto,
    pool: {
      coletar: async (ator: string, entrada: Record<string, unknown>, op: OpcoesColeta) => {
        chamadas.push({ ator, entrada, op });
        const f = respostas[ator];
        if (!f) throw new Error('ator inesperado');
        const r = await f(entrada, op);
        gastos.push({ teto: op.tetoUsd, custo: r.custoUsd ?? op.tetoUsd });
        return r;
      }
    }
  };
}
const ok = (itens: unknown[], custoUsd: number | null): ResultadoColeta => ({ itens, runId: 'r', conta: 'Conta 1', custoUsd });

describe('achar personas', () => {
  it('Google + leitor de perfis: só personas alvo da empresa, cargos mais importantes primeiro, com foto', async () => {
    const { pool, chamadas, dentroDoTeto } = apifaFalsa({
      'apify/google-search-scraper': () => ok(GOOGLE, 0.0055),
      'harvestapi/linkedin-profile-scraper': e => ok((e.queries as string[]).map(u => ({
        linkedinUrl: u, firstName: u.includes('bruno') ? 'Bruno' : 'X', lastName: 'Y', photo: u.includes('bruno') ? 'https://media.licdn.test/b.jpg' : 'http://inseguro/x.jpg',
        currentPosition: [{ position: u.includes('bruno') ? 'CEO e Fundador' : 'Cargo' }]
      })), 0.012)
    });
    const r = await acharPessoas(pedido(), { pool });
    expect(r.pessoas.map(p => p.linkedin_url)).toEqual([
      'https://www.linkedin.com/in/bruno-lima', 'https://www.linkedin.com/in/eva-melo', 'https://www.linkedin.com/in/ana-souza'
    ]);
    expect(r.pessoas[0]).toMatchObject({ nome: 'Bruno Y', cargo: 'CEO e Fundador', papel: 'decisor', foto_url: 'https://media.licdn.test/b.jpg', telefones: [] });
    expect(r.pessoas[1]).toMatchObject({ papel: 'campeao', foto_url: null });
    expect(r.pessoas[2]).toMatchObject({ papel: 'influenciador' });
    expect(r.custoUsd).toBeCloseTo(0.0175, 6);
    expect(chamadas[0].entrada.queries).toBe('site:linkedin.com/in ("CEO" OR "Diretor" OR "Head" OR "Gerente") "Canário Indústria Ltda"');
    expect(chamadas[0].entrada).toMatchObject({ maxPagesPerQuery: 1, maximumLeadsEnrichmentRecords: 0, aiModeSearch: { enableAiMode: false } });
    expect(dentroDoTeto(0.0962)).toBe(true);
  });

  it('não repete quem a conta já tem e respeita o máximo', async () => {
    const { pool } = apifaFalsa({ 'apify/google-search-scraper': () => ok(GOOGLE, 0.005), 'harvestapi/linkedin-profile-scraper': () => ok([], 0.004) });
    const r = await acharPessoas(pedido({ jaTem: ['bruno-lima'], max: 1 }), { pool });
    expect(r.pessoas.map(p => p.linkedin_url)).toEqual(['https://www.linkedin.com/in/eva-melo']);
  });

  it('leitor de perfis falhou: entra com o que o Google mostrou (sem foto)', async () => {
    const { pool } = apifaFalsa({ 'apify/google-search-scraper': () => ok(GOOGLE, 0.005), 'harvestapi/linkedin-profile-scraper': () => { throw new Error('fora'); } });
    const r = await acharPessoas(pedido(), { pool });
    expect(r.pessoas[0]).toMatchObject({ nome: 'Bruno Lima', cargo: 'CEO', foto_url: null });
  });

  it('ninguém achado: não gasta com o leitor de perfis', async () => {
    const { pool, chamadas } = apifaFalsa({ 'apify/google-search-scraper': () => ok([{ organicResults: [] }], 0.005) });
    const r = await acharPessoas(pedido(), { pool });
    expect(r).toEqual({ pessoas: [], custoUsd: 0.005 });
    expect(chamadas).toHaveLength(1);
  });

  it('busca no Google falhou: a etapa falha (o crédito volta e tenta depois)', async () => {
    const { pool } = apifaFalsa({ 'apify/google-search-scraper': () => { throw new Error('Nenhuma chave da Apify cadastrada.'); } });
    await expect(acharPessoas(pedido(), { pool })).rejects.toThrow(/chave/);
  });

  it('custo desconhecido segue nulo (nunca inventa)', async () => {
    const { pool } = apifaFalsa({ 'apify/google-search-scraper': () => ok(GOOGLE, null), 'harvestapi/linkedin-profile-scraper': () => ok([], 0.004) });
    const r = await acharPessoas(pedido(), { pool });
    expect(r.custoUsd).toBeNull();
  });

  it('telefone só com fonte configurada, cada número com a fonte; o teto total continua valendo', async () => {
    const { pool, chamadas, dentroDoTeto } = apifaFalsa({
      'apify/google-search-scraper': () => ok(GOOGLE, 0.005),
      'harvestapi/linkedin-profile-scraper': () => ok([], 0.012),
      'dono/telefones': e => ok([{ linkedinUrl: (e.urls as string[])[0], mobile_phone: '+55 11 98765-4321', outro: '11987654321' }], 0.01)
    });
    const r = await acharPessoas(pedido(), { pool, telefone: { ator: 'dono/telefones', entrada: { urls: '{{linkedin_urls}}' } } });
    expect(r.pessoas[0].telefones).toEqual([{ numero: '+55 11 98765-4321', fonte: 'Apify (dono/telefones)' }]);
    expect(r.pessoas[1].telefones).toEqual([]);
    expect(dentroDoTeto(0.0962)).toBe(true);
    expect(chamadas.map(c => c.ator)).toContain('dono/telefones');
    const semFonte = apifaFalsa({ 'apify/google-search-scraper': () => ok(GOOGLE, 0.005), 'harvestapi/linkedin-profile-scraper': () => ok([], 0.012) });
    await acharPessoas(pedido(), { pool: semFonte.pool });
    expect(semFonte.chamadas.map(c => c.ator)).not.toContain('dono/telefones');
  });

  it('ajudas', () => {
    expect(marcasDaEmpresa({ nome: 'Canário Indústria Ltda', dominio: 'canario.test' })).toEqual(['canario']);
    expect(marcasDaEmpresa({ nome: 'Grão Norte S/A', dominio: null })).toEqual(['grao norte']);
    expect(personaDoCargo('Diretora de Supply', PERSONAS)).toBeNull();
    expect(personaDoCargo('Diretor de Supply', PERSONAS)?.cargo).toBe('Diretor');
    expect(personaDoCargo('Headhunter', PERSONAS)).toBeNull();
    expect(candidatosDoGoogle(GOOGLE, pedido()).some(c => c.url.includes('diego'))).toBe(false);
    expect(lerPerfil({ publicIdentifier: 'Ana', fullName: 'Ana S', profilePicture: { url: 'https://x/a.jpg' } })).toEqual({ slug: 'ana', nome: 'Ana S', cargo: null, foto: 'https://x/a.jpg' });
    expect(telefonesDoItem({ contato: { phones: ['(11) 3333-4444', '12'] }, nome: '11999998888' })).toEqual(['(11) 3333-4444']);
  });
});
