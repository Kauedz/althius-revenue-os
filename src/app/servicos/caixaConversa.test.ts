// Caixa de entrada em conversa (ADR 0068): uma conversa por EMPRESA, com as mensagens de todas as pessoas dela em ordem
// de tempo; cada mensagem com o canal e quem enviou. A visibilidade é a do banco (BDR só a própria conexão).
import { describe, expect, it } from 'vitest';
import { agruparPorEmpresa, listarCaixaPorEmpresa, responderNaCaixa } from './caixa';
import { bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const GRAO = 'b0000000-0000-0000-0000-000000000001';
const AGORA = new Date('2026-10-07T15:00:00-03:00');

describe('agrupar por empresa (unitário)', () => {
  const conversas = [
    { id: 'c1', channel: 'linkedin', intent: 'adiar', unread: true, last_message_at: '2026-10-06T10:00:00Z', contact: { id: 'p1', name: 'Ana' }, account: { id: 'a1', name: 'Acme' }, messaging_account: { member_id: 'm1' } },
    { id: 'c2', channel: 'email', intent: 'positiva', unread: false, last_message_at: '2026-10-07T12:00:00Z', contact: { id: 'p2', name: 'Bruno' }, account: { id: 'a1', name: 'Acme' }, messaging_account: { member_id: 'm1' } },
    { id: 'c3', channel: 'whatsapp', intent: null, unread: true, last_message_at: '2026-10-05T12:00:00Z', contact: { id: 'p3', name: 'Caio' }, account: { id: 'a2', name: 'Beta' }, messaging_account: null }
  ];
  const mensagens = [
    { id: 'x1', conversation_id: 'c1', direction: 'in', text: 'Mês que vem.', sent_by: 'member', created_at: '2026-10-06T10:00:00Z' },
    { id: 'x2', conversation_id: 'c2', direction: 'in', text: 'Vamos marcar?', sent_by: 'member', created_at: '2026-10-07T11:00:00Z' },
    { id: 'x3', conversation_id: 'c2', direction: 'out', text: 'Quinta às 10h.', sent_by: 'member', created_at: '2026-10-07T12:00:00Z' },
    { id: 'x4', conversation_id: 'c3', direction: 'in', text: 'Me liga.', sent_by: 'member', created_at: '2026-10-05T12:00:00Z' }
  ];
  const empresas = agruparPorEmpresa(conversas, mensagens, 'm1', AGORA);

  it('uma conversa por empresa, a mais recente primeiro, com as pessoas e as não lidas', () => {
    expect(empresas.map(e => [e.nome, e.pessoas, e.naoLidas])).toEqual([['Acme', ['Ana', 'Bruno'], 1], ['Beta', ['Caio'], 1]]);
    expect(empresas[0].ultima).toBe('Você: Quinta às 10h.');
  });

  it('as mensagens de todas as pessoas, em ordem de tempo, com canal, autor e intenção na última recebida', () => {
    expect(empresas[0].mensagens.map(m => [m.autor, m.canal, m.direcao, m.texto, m.intencao])).toEqual([
      ['Ana', 'LinkedIn', 'in', 'Mês que vem.', 'Adiar'],
      ['Bruno', 'E-mail', 'in', 'Vamos marcar?', 'Positiva'],
      ['Você', 'E-mail', 'out', 'Quinta às 10h.', null]
    ]);
  });

  it('para responder: a pessoa e o canal de cada conversa; só e-mail e WhatsApp da própria conta enviam por aqui', () => {
    expect(empresas[0].destinos).toEqual([
      { conversaId: 'c1', rotulo: 'Ana · LinkedIn', podeEnviar: false, motivo: 'Responder pelo LinkedIn ainda não é possível por aqui: responda pelo app e a mensagem aparece nesta conversa.' },
      { conversaId: 'c2', rotulo: 'Bruno · E-mail', podeEnviar: true, motivo: null }
    ]);
    expect(empresas[1].destinos[0]).toMatchObject({ podeEnviar: false, motivo: 'Só quem conectou esta conta responde por ela.' });
  });
});

describe.skipIf(!bancoLocalNoAr)('Caixa em conversa (banco local)', () => {
  it('C-level: a Serra Azul vira uma conversa só, com as duas pessoas e os dois canais', async () => {
    const t = await listarCaixaPorEmpresa(await entrarComoLocal('aline@evolut.com.br'), EVOLUT);
    const serra = t.empresas.find(e => e.nome === 'Serra Azul Têxtil')!;
    expect(serra.pessoas.sort()).toEqual(['Aline Xavier', 'Jonas Ribeiro']);
    expect(new Set(serra.mensagens.map(m => m.canal))).toEqual(new Set(['LinkedIn', 'E-mail']));
    const tempos = serra.mensagens.map(m => m.quandoIso);
    expect([...tempos].sort()).toEqual(tempos);
    expect(serra.destinos.every(d => !d.podeEnviar)).toBe(true); // a C-level lê, mas não fala pela conta do BDR
  });

  it('BDR vê só as conversas das próprias conexões', async () => {
    const t = await listarCaixaPorEmpresa(await entrarComoLocal('lucas@evolut.com.br'), EVOLUT);
    expect(t.empresas.map(e => e.nome)).not.toContain('Delta Saúde'); // conversa da Bruna
    expect(t.empresas.find(e => e.nome === 'Serra Azul Têxtil')!.destinos.find(d => d.rotulo === 'Jonas Ribeiro · E-mail')!.podeEnviar).toBe(true);
  });

  it('ISOLAMENTO: a Grão Norte não vê nenhuma conversa da Evolut', async () => {
    const eduardo = await entrarComoLocal('eduardo@graonorte.com.br');
    expect((await listarCaixaPorEmpresa(eduardo, EVOLUT)).empresas).toEqual([]);
    expect(JSON.stringify(await listarCaixaPorEmpresa(eduardo, GRAO))).not.toMatch(/Serra Azul|Jonas/);
  });

  it('responder pelo LinkedIn é recusado com a explicação', async () => {
    const lucas = await entrarComoLocal('lucas@evolut.com.br');
    const r = await responderNaCaixa(lucas, EVOLUT, 'd0000000-0000-0000-0000-000000000004', 'c5000000-0000-0000-0000-000000000001', 'Oi', '', crypto.randomUUID());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.mensagem).toMatch(/LinkedIn/);
  });
});
