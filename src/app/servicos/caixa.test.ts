// @vitest-environment node
// Seam: serviço da Caixa de entrada (listarCaixa, marcarLida, pedirSugestaoDeResposta, excluirContatoDoCrm)
// contra o banco local. Verificado só pelo próprio serviço.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { excluirContatoDoCrm, listarCaixa, marcarLida, minhasConexoes, pedirSugestaoDeResposta } from './caixa';
import { adminLocal, bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const LUCAS = 'd0000000-0000-0000-0000-000000000004';
const ALINE = 'd0000000-0000-0000-0000-000000000003';
const CONVERSA_ALINE = 'c5000000-0000-0000-0000-000000000001';
const CONVERSA_BRUNA = 'c5000000-0000-0000-0000-000000000002';

describe.skipIf(!bancoLocalNoAr)('Caixa de entrada (banco local)', () => {
  const pedidos: string[] = [];
  beforeAll(async () => {
    // Estado de partida do seed, sem depender do que outro teste deixou (abrir conversa marca como lida).
    const admin = adminLocal();
    await admin.from('conversations').update({ unread: true }).in('id', [CONVERSA_ALINE, 'c5000000-0000-0000-0000-000000000005']);
    await admin.from('conversations').update({ unread: false }).in('id', ['c5000000-0000-0000-0000-000000000003', 'c5000000-0000-0000-0000-000000000004']);
  });
  afterAll(async () => {
    const admin = adminLocal();
    await admin.from('conversations').update({ unread: true }).eq('id', CONVERSA_ALINE);
    if (pedidos.length) await admin.from('executions').delete().in('id', pedidos);
  });

  it('BDR vê só as próprias conversas, no formato da tela, com números reais', async () => {
    const caixa = await listarCaixa(await entrarComoLocal('lucas@evolut.com.br'), EVOLUT);
    expect(caixa.linhas.map(l => l.de).sort()).toEqual(['Aline Xavier', 'Jonas Ribeiro', 'Marcelo Antunes', 'Tiago Nunes']);
    expect(caixa.linhas.find(l => l.id === CONVERSA_ALINE)).toMatchObject({
      de: 'Aline Xavier', assunto: 'Tenho interesse, mas só no mês que vem.', canal: 'LinkedIn', intencao: 'Adiar', quando: 'Ontem', conta: 'Serra Azul Têxtil'
    });
    expect(caixa.kpis).toEqual([
      ['Não lidas', '2', ''], ['Positivas', '2', 'na semana'], ['Objeções', '0', ''], ['Tempo de resposta', '38 min', 'média']
    ]);
  });

  it('C-level lê todas; abrir não apaga o "não lida" do BDR, mas abrir pelo dono sim', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    expect((await listarCaixa(aline, EVOLUT)).linhas).toHaveLength(5);
    expect(await marcarLida(aline, EVOLUT, ALINE, CONVERSA_ALINE)).toEqual({ ok: true });
    const lucas = await entrarComoLocal('lucas@evolut.com.br');
    expect((await listarCaixa(lucas, EVOLUT)).kpis[0][1]).toBe('2');
    expect(await marcarLida(lucas, EVOLUT, LUCAS, CONVERSA_ALINE)).toEqual({ ok: true });
    expect((await listarCaixa(lucas, EVOLUT)).kpis[0][1]).toBe('1');
  });

  it('sugerir resposta vira pedido ao Agente de Copy; conversa de outro BDR é recusada', async () => {
    const lucas = await entrarComoLocal('lucas@evolut.com.br');
    const r = await pedirSugestaoDeResposta(lucas, EVOLUT, LUCAS, CONVERSA_ALINE);
    expect(r.ok).toBe(true);
    if (r.ok) pedidos.push(r.execucaoId);
    expect(await pedirSugestaoDeResposta(lucas, EVOLUT, LUCAS, CONVERSA_BRUNA)).toEqual({ ok: false, mensagem: 'Conversa não encontrada.' });
  });

  it('BDR não exclui contato de conversa que não é dele', async () => {
    expect(await excluirContatoDoCrm(await entrarComoLocal('lucas@evolut.com.br'), EVOLUT, LUCAS, CONVERSA_BRUNA))
      .toEqual({ ok: false, mensagem: 'Conversa não encontrada.' });
  });

  it('conexões pessoais vêm do banco (não as da demonstração)', async () => {
    expect(await minhasConexoes(await entrarComoLocal('lucas@evolut.com.br'), EVOLUT)).toEqual({
      email: { conta: 'lucas@evolut.com.br', via: 'gmail' }, linkedin: { conta: 'Lucas Teixeira' }, whatsapp: { conta: '+55 11 90000-0004' }, instagram: null
    });
    expect(await minhasConexoes(await entrarComoLocal('aline@evolut.com.br'), EVOLUT)).toEqual({ email: null, linkedin: null, whatsapp: null, instagram: null });
  });

  it('Grão Norte não vê a caixa da Evolut', async () => {
    const caixa = await listarCaixa(await entrarComoLocal('eduardo@graonorte.com.br'), EVOLUT);
    expect(caixa.linhas).toEqual([]);
    expect(caixa.kpis[3]).toEqual(['Tempo de resposta', '—', 'média']);
  });
});
