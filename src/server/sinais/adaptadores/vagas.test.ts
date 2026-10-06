import { describe, expect, it } from 'vitest';
import { adaptadorDeVagas } from './vagas.ts';

const AGORA = Date.parse('2026-10-06T12:00:00Z');
const conta = { nome: 'Magalu', dominio: 'magalu.com.br' };
const ctx = { agora: AGORA, frequencia: 'semanal' as const };

// Formas reais devolvidas em 06/10/2026 (campos conferidos nos testes de descoberta; só empresas, nunca pessoas).
const doValig = (o: Record<string, unknown> = {}) => ({
  id: '1', url: 'https://www.linkedin.com/jobs/view/1', title: 'Analista de Comércio Exterior', location: 'São Paulo, São Paulo, Brazil',
  postedDate: '2026-10-05T00:00:00.000Z', companyName: 'Magalu', description: 'Cuidar das importações.', ...o
});
const doCurious = (o: Record<string, unknown> = {}) => ({
  id: '2', link: 'https://www.linkedin.com/jobs/view/2', title: 'Gerente de Logística', location: 'Campinas, São Paulo, Brazil',
  postedAt: '2026-10-04', companyName: 'Magalu', descriptionText: 'Liderar a logística.', ...o
});

describe('vagas abertas (vagas_cargo)', () => {
  it('monta a entrada do ator principal com o nome da empresa e a janela da frequência', () => {
    expect(adaptadorDeVagas.entrada('valig/linkedin-jobs-scraper', conta, ctx)).toEqual({ companyName: ['Magalu'], location: 'Brazil', datePosted: 'r604800', limit: 25 });
    expect(adaptadorDeVagas.entrada('valig/linkedin-jobs-scraper', conta, { ...ctx, frequencia: 'mensal' })).toMatchObject({ datePosted: 'r2592000' });
    expect(adaptadorDeVagas.entrada('valig/linkedin-jobs-scraper', conta, { ...ctx, frequencia: 'diario' })).toMatchObject({ datePosted: 'r86400' });
  });

  it('monta a entrada do ator de reserva', () => {
    expect(adaptadorDeVagas.entrada('curious_coder/linkedin-jobs-scraper', conta, ctx)).toEqual({
      keywords: 'Magalu', location: 'Brazil', datePosted: 'pastWeek', limitPerSource: 25, scrapeCompany: false
    });
  });

  it('ator desconhecido para este sinal: erro claro (nunca roda um ator qualquer)', () => {
    expect(() => adaptadorDeVagas.entrada('alguem/qualquer-coisa', conta, ctx)).toThrow(/não faz parte/i);
  });

  it('cada vaga da empresa vira um acontecimento com texto, evidência, fonte e data', () => {
    const [e] = adaptadorDeVagas.eventos('valig/linkedin-jobs-scraper', [doValig()], conta, ctx);
    expect(e.texto).toBe('Abriu vaga de Analista de Comércio Exterior em São Paulo, São Paulo, Brazil');
    expect(e.fonte).toBe('LinkedIn Jobs');
    expect(e.quando).toBe('2026-10-05T00:00:00.000Z');
    expect(e.evidencia).toContain('https://www.linkedin.com/jobs/view/1');
    expect(e.evidencia).toContain('05/10/2026');
    expect(e.chave).toBe('vaga|magalu|analista de comercio exterior|2026');
  });

  it('o ator de reserva (outros nomes de campo) gera o mesmo tipo de acontecimento', () => {
    const [e] = adaptadorDeVagas.eventos('curious_coder/linkedin-jobs-scraper', [doCurious()], conta, ctx);
    expect(e.texto).toBe('Abriu vaga de Gerente de Logística em Campinas, São Paulo, Brazil');
    expect(e.evidencia).toContain('https://www.linkedin.com/jobs/view/2');
    expect(e.quando).toBe('2026-10-04T00:00:00.000Z');
  });

  it('vaga de OUTRA empresa é descartada (na dúvida, não é)', () => {
    const r = adaptadorDeVagas.eventos('valig/linkedin-jobs-scraper', [doValig(), doValig({ id: '9', companyName: 'Mercado Livre Brasil' })], conta, ctx);
    expect(r).toHaveLength(1);
  });

  it('forma jurídica e acento não atrapalham o reconhecimento da empresa', () => {
    const c = { nome: 'Indústria Kobra Ltda.', dominio: 'kobra.com.br' };
    expect(adaptadorDeVagas.eventos('valig/linkedin-jobs-scraper', [doValig({ companyName: 'Industria Kobra' })], c, ctx)).toHaveLength(1);
  });

  it('a mesma vaga repetida (LinkedIn e Indeed, ou duas vezes) conta um acontecimento só', () => {
    const r = adaptadorDeVagas.eventos('valig/linkedin-jobs-scraper', [doValig(), doValig({ id: '3', title: 'ANALISTA DE COMÉRCIO EXTERIOR' })], conta, ctx);
    expect(r).toHaveLength(1);
  });

  it('vaga antiga demais para a janela é ignorada', () => {
    const r = adaptadorDeVagas.eventos('valig/linkedin-jobs-scraper', [doValig({ postedDate: '2026-08-01T00:00:00.000Z' })], conta, ctx);
    expect(r).toEqual([]);
  });

  it('sem título ou sem data válida de publicação, usa só o que existe; sem título, descarta', () => {
    const r = adaptadorDeVagas.eventos('valig/linkedin-jobs-scraper', [doValig({ title: '' }), doValig({ id: '4', title: 'Analista de Dados', postedDate: undefined })], conta, ctx);
    expect(r).toHaveLength(1);
    expect(r[0].quando).toBe(new Date(AGORA).toISOString());
  });

  it('itens que não são objetos (erro devolvido como item) são ignorados', () => {
    expect(adaptadorDeVagas.eventos('valig/linkedin-jobs-scraper', [null, 'x', 3, { error: 'falhou' }], conta, ctx)).toEqual([]);
  });

  it('textos grandes são cortados nos limites do banco', () => {
    const [e] = adaptadorDeVagas.eventos('valig/linkedin-jobs-scraper', [doValig({ title: 'A'.repeat(500), description: 'B'.repeat(5000) })], conta, ctx);
    expect(e.texto.length).toBeLessThanOrEqual(300);
    expect(e.evidencia.length).toBeLessThanOrEqual(2000);
    expect(e.chave.length).toBeLessThanOrEqual(300);
  });

  it('usa o nome da empresa no LinkedIn quando a conta o guarda (Magazine Luiza no CRM, Magalu no LinkedIn)', () => {
    const c = { nome: 'Magazine Luiza', dominio: 'magazineluiza.com.br', linkedinNome: 'Magalu' };
    expect(adaptadorDeVagas.entrada('valig/linkedin-jobs-scraper', c, ctx)).toMatchObject({ companyName: ['Magalu'] });
    expect(adaptadorDeVagas.entrada('curious_coder/linkedin-jobs-scraper', c, ctx)).toMatchObject({ keywords: 'Magalu' });
    const [e] = adaptadorDeVagas.eventos('valig/linkedin-jobs-scraper', [doValig()], c, ctx);
    expect(e.evidencia).toContain('Magazine Luiza');
    expect(e.chave).toBe('vaga|magazine luiza|analista de comercio exterior|2026');
  });

  it('o nome do LinkedIn vazio ou só com espaços volta para o nome da conta', () => {
    expect(adaptadorDeVagas.entrada('valig/linkedin-jobs-scraper', { ...conta, linkedinNome: '   ' }, ctx)).toMatchObject({ companyName: ['Magalu'] });
  });
});
