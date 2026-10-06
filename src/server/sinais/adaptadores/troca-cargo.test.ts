import { describe, expect, it } from 'vitest';
import { adaptadorDeTrocaDeCargo } from './troca-cargo.ts';
import type { ContaDoPedido } from './tipos.ts';

const ATOR = 'harvestapi/linkedin-profile-scraper';
const ctx = { agora: Date.parse('2026-10-06T12:00:00Z'), frequencia: 'semanal' as const };

const contato = (n: number, snapshot: Record<string, unknown> | null = null, papel = 'decisor') => ({
  id: `ct-${n}`, nome: `Fulano ${n}`, papel, linkedinUrl: `https://www.linkedin.com/in/canario-${n}`, snapshot
});
const conta = (contatos: ReturnType<typeof contato>[]): ContaDoPedido => ({ nome: 'Empresa X', dominio: 'x.test', contatos });

// Forma real do ator (06/10/2026): `currentPosition` lista os cargos atuais; o primeiro é o principal.
const perfil = (n: number, cargo: string, empresa: string, extra: Record<string, unknown> = {}) => ({
  id: `p${n}`, publicIdentifier: `canario-${n}`, linkedinUrl: `https://www.linkedin.com/in/canario-${n}`,
  currentPosition: [{ position: cargo, companyName: empresa, companyId: empresa === 'Empresa X' ? '111' : '222', startDate: { text: 'Aug 2026' } }], ...extra
});
const antes = (cargo: string, empresa: string, empresaId = empresa === 'Empresa X' ? '111' : '222') => ({ empresa, empresaId, cargo, desde: 'Jan 2025' });

describe('troca de cargo do decisor (troca_cargo)', () => {
  it('pede o perfil de cada contato com LinkedIn (no máximo 5), sem e-mail (mais barato)', () => {
    const c = conta([1, 2, 3, 4, 5, 6].map(n => contato(n)));
    const e = adaptadorDeTrocaDeCargo.entrada(ATOR, c, ctx);
    expect(e.queries).toEqual([1, 2, 3, 4, 5].map(n => `https://www.linkedin.com/in/canario-${n}`));
    expect(String(e.profileScraperMode)).toMatch(/no email/i);
  });

  it('sem nenhum contato com LinkedIn: erro claro (nunca roda à toa)', () => {
    expect(() => adaptadorDeTrocaDeCargo.entrada(ATOR, conta([]), ctx)).toThrow(/sem contato/i);
  });

  it('ator desconhecido para este sinal: erro claro', () => {
    expect(() => adaptadorDeTrocaDeCargo.entrada('alguem/qualquer', conta([contato(1)]), ctx)).toThrow(/não faz parte/i);
  });

  it('primeira leitura: só guarda o retrato, NÃO inventa mudança', () => {
    const c = conta([contato(1)]);
    const itens = [perfil(1, 'Gerente de Compras', 'Empresa X')];
    expect(adaptadorDeTrocaDeCargo.eventos(ATOR, itens, c, ctx)).toEqual([]);
    expect(adaptadorDeTrocaDeCargo.retratos!(ATOR, itens, c)).toEqual([
      { chave: 'ct-1', dados: { empresa: 'Empresa X', empresaId: '111', cargo: 'Gerente de Compras', desde: 'Aug 2026' } }
    ]);
  });

  it('mudou de empresa: acontecimento com de/para e quem é', () => {
    const c = conta([contato(1, antes('Gerente de Compras', 'Empresa X'))]);
    const [e] = adaptadorDeTrocaDeCargo.eventos(ATOR, [perfil(1, 'Diretor', 'Outra Empresa')], c, ctx);
    expect(e.texto).toBe('Fulano 1 mudou de empresa: de Empresa X para Outra Empresa (Diretor)');
    expect(e.fonte).toBe('LinkedIn');
    expect(e.evidencia).toContain('https://www.linkedin.com/in/canario-1');
    expect(e.evidencia).toContain('Gerente de Compras');
    expect(e.chave).toBe('troca|ct-1|empresa|outra empresa');
    expect(e.quando).toBe(new Date(ctx.agora).toISOString());
  });

  it('mesma empresa, outro cargo: mudou de cargo (promoção ou troca de área)', () => {
    const c = conta([contato(1, antes('Gerente de Compras', 'Empresa X'))]);
    const [e] = adaptadorDeTrocaDeCargo.eventos(ATOR, [perfil(1, 'Diretor de Suprimentos', 'Empresa X')], c, ctx);
    expect(e.texto).toBe('Fulano 1 mudou de cargo em Empresa X: de Gerente de Compras para Diretor de Suprimentos');
    expect(e.chave).toBe('troca|ct-1|cargo|diretor de suprimentos');
  });

  it('nada mudou (mesmo cargo, mesmo com acento ou caixa diferente): nenhum acontecimento', () => {
    const c = conta([contato(1, antes('Gerente de Compras', 'Empresa X'))]);
    expect(adaptadorDeTrocaDeCargo.eventos(ATOR, [perfil(1, 'GERENTE DE COMPRAS', 'Empresa X')], c, ctx)).toEqual([]);
  });

  it('perfil sem cargo atual declarado: não conclui que saiu e não apaga o retrato anterior', () => {
    const c = conta([contato(1, antes('Gerente', 'Empresa X'))]);
    const itens = [perfil(1, '', 'x', { currentPosition: [] })];
    expect(adaptadorDeTrocaDeCargo.eventos(ATOR, itens, c, ctx)).toEqual([]);
    expect(adaptadorDeTrocaDeCargo.retratos!(ATOR, itens, c)).toEqual([]);
  });

  it('perfil que não é de nenhum contato da conta, ou item de erro, é ignorado', () => {
    const c = conta([contato(1, antes('Gerente', 'Empresa X'))]);
    const itens = [perfil(9, 'Diretor', 'Outra'), { error: 'falhou' }, null, 'x'];
    expect(adaptadorDeTrocaDeCargo.eventos(ATOR, itens, c, ctx)).toEqual([]);
    expect(adaptadorDeTrocaDeCargo.retratos!(ATOR, itens, c)).toEqual([]);
  });

  it('reconhece o contato pelo endereço mesmo sem o campo publicIdentifier', () => {
    const c = conta([contato(1, antes('Gerente', 'Empresa X'))]);
    const p = perfil(1, 'Diretor', 'Empresa X', { publicIdentifier: undefined, linkedinUrl: 'https://br.linkedin.com/in/Canario-1/' });
    expect(adaptadorDeTrocaDeCargo.eventos(ATOR, [p], c, ctx)).toHaveLength(1);
  });

  it('o mesmo acontecimento tem sempre a mesma chave (o banco não conta duas vezes)', () => {
    const c = conta([contato(1, antes('Gerente', 'Empresa X'))]);
    const a = adaptadorDeTrocaDeCargo.eventos(ATOR, [perfil(1, 'Diretor', 'Outra Empresa')], c, ctx)[0].chave;
    const b = adaptadorDeTrocaDeCargo.eventos(ATOR, [perfil(1, 'Diretor', 'Outra Empresa')], c, { ...ctx, agora: ctx.agora + 86_400_000 })[0].chave;
    expect(a).toBe(b);
  });

  it('retrato de contato sem mudança é atualizado (guarda a data de início mais nova)', () => {
    const c = conta([contato(1, antes('Gerente', 'Empresa X'))]);
    const r = adaptadorDeTrocaDeCargo.retratos!(ATOR, [perfil(1, 'Gerente', 'Empresa X')], c);
    expect(r).toHaveLength(1);
    expect(r[0].dados.desde).toBe('Aug 2026');
  });

  it('conta com UM contato só: o único perfil devolvido é dele, mesmo que o endereço cadastrado seja de outro tipo (com código)', () => {
    const c = conta([{ ...contato(1, antes('Gerente', 'Empresa X')), linkedinUrl: 'https://www.linkedin.com/in/ACwAABcodigo' }]);
    const itens = [perfil(7, 'Diretor', 'Empresa X')];
    expect(adaptadorDeTrocaDeCargo.eventos(ATOR, itens, c, ctx)).toHaveLength(1);
    expect(adaptadorDeTrocaDeCargo.retratos!(ATOR, itens, c)).toHaveLength(1);
  });

  it('com VÁRIOS contatos, perfil que não casa com nenhum não é atribuído a ninguém', () => {
    const c = conta([{ ...contato(1), linkedinUrl: 'https://www.linkedin.com/in/ACwAAcodigo1' }, { ...contato(2), linkedinUrl: 'https://www.linkedin.com/in/ACwAAcodigo2' }]);
    expect(adaptadorDeTrocaDeCargo.retratos!(ATOR, [perfil(7, 'Diretor', 'Empresa X')], c)).toEqual([]);
  });
});
