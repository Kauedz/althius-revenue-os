// @vitest-environment node
// Seam: serviço de Aprovações (lista no formato do v18 e decisão pelo banco).
import { describe, expect, it } from 'vitest';
import { decidirAprovacao, formatarPrazo, listarAprovacoes } from './aprovacoes';
import { adminLocal, bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';
import { isolarAprovacoes } from '../../test/isolarAprovacoes';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const ALINE_EVOLUT = 'd0000000-0000-0000-0000-000000000003';
const CAMILA_EVOLUT = 'd0000000-0000-0000-0000-000000000002';
const COPY_SERRA_AZUL = 'ac000000-0000-0000-0000-000000000001';
const VERBA_LINKEDIN = 'ac000000-0000-0000-0000-000000000003';

describe('formatarPrazo', () => {
  const agora = new Date('2026-10-02T10:00:00-03:00'); // sexta
  it('hoje mostra a hora', () => expect(formatarPrazo('2026-10-02T14:00:00-03:00', agora)).toBe('Hoje, 14:00'));
  it('amanhã', () => expect(formatarPrazo('2026-10-03T18:00:00-03:00', agora)).toBe('Amanhã'));
  it('dentro da semana mostra o dia e a hora', () => expect(formatarPrazo('2026-10-06T09:00:00-03:00', agora)).toBe('Ter, 09:00'));
  it('mais longe mostra a data', () => expect(formatarPrazo('2026-10-20T09:00:00-03:00', agora)).toBe('20 out'));
  it('vencido', () => expect(formatarPrazo('2026-10-01T09:00:00-03:00', agora)).toBe('Venceu 01 out'));
  it('sem prazo', () => expect(formatarPrazo(null, agora)).toBe('—'));
});

describe.skipIf(!bancoLocalNoAr)('Aprovações (banco local)', () => {
  isolarAprovacoes([COPY_SERRA_AZUL, VERBA_LINKEDIN]);

  it('C-level vê a fila no formato da tela do v18', async () => {
    const fila = await listarAprovacoes(await entrarComoLocal('aline@evolut.com.br'), EVOLUT);
    expect(fila).toHaveLength(5);
    expect(fila[0]).toMatchObject({
      id: COPY_SERRA_AZUL,
      tipo: 'Copy',
      titulo: 'E-mails T1 — Serra Azul Têxtil',
      solicitante: 'Mateus Maia',
      agente: 'copy',
      motivo: 'Primeiro contato com a decisora mapeada.',
      impacto: '3 e-mails enviados para 1 contato',
      creditos: 60,
      historico: ['08:05 Criada pelo agente', '08:06 Enviada para Aline Xavier']
    });
    expect(fila.map(a => a.tipo)).toEqual(['Copy', 'Lista', 'Orçamento', 'Alteração de CRM', 'Execução acima de limite']);
  });

  it('BDR não recebe a fila', async () => {
    expect(await listarAprovacoes(await entrarComoLocal('lucas@evolut.com.br'), EVOLUT)).toEqual([]);
  });

  it('estrategista não aprova gasto: recebe o motivo e nada muda', async () => {
    const camila = await entrarComoLocal('camila@althius.com.br');
    const [verba] = (await listarAprovacoes(camila, EVOLUT)).filter(a => a.id === VERBA_LINKEDIN);
    const r = await decidirAprovacao(camila, { aprovacao: verba, membroId: CAMILA_EVOLUT, decisao: 'Aprovada' });
    expect(r).toEqual({ ok: false, mensagem: 'Só o C-level ou o superadmin aprovam gastos. O pedido continua na fila.' });
    expect((await adminLocal().from('approvals').select('status').eq('id', VERBA_LINKEDIN).single()).data?.status).toBe('pendente');
  });

  it('C-level aprova e a decisão fica gravada no banco, fora da fila', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const [copy] = await listarAprovacoes(aline, EVOLUT);
    expect(await decidirAprovacao(aline, { aprovacao: copy, membroId: ALINE_EVOLUT, decisao: 'Aprovada' })).toEqual({ ok: true });
    const linha = (await adminLocal().from('approvals').select('status, decided_by_member_id').eq('id', COPY_SERRA_AZUL).single()).data;
    expect(linha).toEqual({ status: 'aprovado', decided_by_member_id: ALINE_EVOLUT });
    expect((await listarAprovacoes(aline, EVOLUT)).map(a => a.id)).not.toContain(COPY_SERRA_AZUL);
  });

  it('pedir ajuste sem texto é recusado com orientação', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const [copy] = await listarAprovacoes(aline, EVOLUT);
    expect(await decidirAprovacao(aline, { aprovacao: copy, membroId: ALINE_EVOLUT, decisao: 'Ajustes solicitados', notas: ' ' }))
      .toEqual({ ok: false, mensagem: 'Diga o que precisa ser ajustado.' });
  });
});
