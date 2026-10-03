// @vitest-environment node
// Seam: serviço de Aprovações (lista no formato do v18 e decisão pelo banco).
import { afterEach, describe, expect, it } from 'vitest';
import { decidirAprovacao, formatarPrazo, listarAprovacoes } from './aprovacoes';
import { adminLocal, bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';
import { isolarAprovacoes } from '../../test/isolarAprovacoes';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const GRAO = 'b0000000-0000-0000-0000-000000000001';
const ALINE_EVOLUT = 'd0000000-0000-0000-0000-000000000003';
const CAMILA_EVOLUT = 'd0000000-0000-0000-0000-000000000002';
const RAFAEL_EVOLUT = 'd0000000-0000-0000-0000-000000000001';
const LUCAS_EVOLUT = 'd0000000-0000-0000-0000-000000000004';
const COPY_SERRA_AZUL = 'ac000000-0000-0000-0000-000000000001';
const LISTA_512 = 'ac000000-0000-0000-0000-000000000002';
const VERBA_LINKEDIN = 'ac000000-0000-0000-0000-000000000003';
const CRM_NEGOCIOS = 'ac000000-0000-0000-0000-000000000004';
const GENERICA = 'Não foi possível registrar a decisão agora. Tente de novo em instantes.';

/** Consulta falsa: cada tabela devolve a sua resposta, sem banco. */
function clienteTabelas(porTabela: Record<string, { data: unknown; error: { message?: string } | null }>) {
  return {
    from(nome: string) {
      const resultado = porTabela[nome] ?? { data: [], error: null };
      const cadeia: any = new Proxy(function () {}, {
        get: (_alvo: unknown, prop: string) => (prop === 'then'
          ? (ok: (v: unknown) => unknown, falha?: (e: unknown) => unknown) => Promise.resolve(resultado).then(ok, falha)
          : cadeia),
        apply: () => cadeia
      });
      return cadeia;
    }
  };
}

describe('formatarPrazo', () => {
  const agora = new Date('2026-10-02T10:00:00-03:00'); // sexta
  it('hoje mostra a hora', () => expect(formatarPrazo('2026-10-02T14:00:00-03:00', agora)).toBe('Hoje, 14:00'));
  it('amanhã', () => expect(formatarPrazo('2026-10-03T18:00:00-03:00', agora)).toBe('Amanhã'));
  it('dentro da semana mostra o dia e a hora', () => expect(formatarPrazo('2026-10-06T09:00:00-03:00', agora)).toBe('Ter, 09:00'));
  it('mais longe mostra a data', () => expect(formatarPrazo('2026-10-20T09:00:00-03:00', agora)).toBe('20 out'));
  it('vencido', () => expect(formatarPrazo('2026-10-01T09:00:00-03:00', agora)).toBe('Venceu 01 out'));
  it('sem prazo', () => expect(formatarPrazo(null, agora)).toBe('—'));
});

describe('listarAprovacoes quando a consulta falha ou vem incompleta', () => {
  const pedido = {
    id: 'a1',
    approval_type: 'desconhecido',
    title: 'Titulo',
    requested_by_member_id: 'm-ausente',
    agent_code: null,
    reason: null,
    impact: null,
    preview: null,
    estimated_credits: null,
    deadline_at: null,
    history: { nao: 'lista' },
    payload_json: { titulo: 'Titulo' }
  };

  it('erro na fila vira mensagem clara', async () => {
    const cliente = clienteTabelas({ approvals: { data: null, error: { message: 'rede' } } });
    await expect(listarAprovacoes(cliente as never, EVOLUT)).rejects.toThrow('Não foi possível carregar as aprovações.');
  });

  it('fila vazia', async () => {
    const cliente = clienteTabelas({ approvals: { data: [], error: null } });
    await expect(listarAprovacoes(cliente as never, EVOLUT)).resolves.toEqual([]);
  });

  it('tipo desconhecido, campos vazios e histórico inválido não quebram a tela', async () => {
    const cliente = clienteTabelas({
      approvals: { data: [pedido], error: null },
      workspace_members: { data: [], error: null }
    });
    const [item] = await listarAprovacoes(cliente as never, EVOLUT);
    expect(item).toMatchObject({
      tipo: 'desconhecido',
      solicitante: 'Alguém do time',
      motivo: '',
      impacto: '',
      previa: '',
      creditos: 0,
      prazo: '—',
      historico: [],
      conteudo: { titulo: 'Titulo' },
      agente: null
    });
  });

  it('erro ao buscar os nomes dos solicitantes não pode ser ignorado', async () => {
    const cliente = clienteTabelas({
      approvals: { data: [pedido], error: null },
      workspace_members: { data: null, error: { message: 'falhou' } }
    });
    await expect(listarAprovacoes(cliente as never, EVOLUT)).rejects.toThrow('Não foi possível carregar');
  });
});

describe.skipIf(!bancoLocalNoAr)('Aprovações (banco local)', () => {
  isolarAprovacoes([COPY_SERRA_AZUL, LISTA_512, VERBA_LINKEDIN, CRM_NEGOCIOS]);
  afterEach(async () => {
    await adminLocal().from('notifications').delete().in('entity_id', [COPY_SERRA_AZUL, LISTA_512, VERBA_LINKEDIN, CRM_NEGOCIOS]);
  });

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

  it('superadmin e estrategista também recebem a fila do workspace', async () => {
    expect(await listarAprovacoes(await entrarComoLocal('rafael@althius.com.br'), EVOLUT)).toHaveLength(5);
    expect(await listarAprovacoes(await entrarComoLocal('camila@althius.com.br'), EVOLUT)).toHaveLength(5);
  });

  it('C-level de outro workspace não vê a fila da Evolut', async () => {
    expect(await listarAprovacoes(await entrarComoLocal('eduardo@graonorte.com.br'), EVOLUT)).toEqual([]);
    expect(await listarAprovacoes(await entrarComoLocal('aline@evolut.com.br'), GRAO)).toEqual([]);
  });

  it('estrategista não aprova gasto: recebe o motivo e nada muda', async () => {
    const camila = await entrarComoLocal('camila@althius.com.br');
    const [verba] = (await listarAprovacoes(camila, EVOLUT)).filter(a => a.id === VERBA_LINKEDIN);
    const r = await decidirAprovacao(camila, { aprovacao: verba, membroId: CAMILA_EVOLUT, decisao: 'Aprovada' });
    expect(r).toEqual({ ok: false, mensagem: 'Só o C-level ou o superadmin aprovam gastos. O pedido continua na fila.' });
    expect((await adminLocal().from('approvals').select('status').eq('id', VERBA_LINKEDIN).single()).data?.status).toBe('pendente');
  });

  it('BDR não decide operação', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const lucas = await entrarComoLocal('lucas@evolut.com.br');
    const [copy] = (await listarAprovacoes(aline, EVOLUT)).filter(a => a.id === COPY_SERRA_AZUL);
    const r = await decidirAprovacao(lucas, { aprovacao: copy, membroId: LUCAS_EVOLUT, decisao: 'Aprovada' });
    expect(r).toEqual({ ok: false, mensagem: 'Seu papel não decide esta aprovação.' });
    expect((await adminLocal().from('approvals').select('status').eq('id', COPY_SERRA_AZUL).single()).data?.status).toBe('pendente');
  });

  it('estrategista aprova operação e a decisão fica gravada', async () => {
    const camila = await entrarComoLocal('camila@althius.com.br');
    const [lista] = (await listarAprovacoes(camila, EVOLUT)).filter(a => a.id === LISTA_512);
    expect(await decidirAprovacao(camila, { aprovacao: lista, membroId: CAMILA_EVOLUT, decisao: 'Aprovada' })).toEqual({ ok: true });
    expect((await adminLocal().from('approvals').select('status, decided_by_member_id').eq('id', LISTA_512).single()).data)
      .toEqual({ status: 'aprovado', decided_by_member_id: CAMILA_EVOLUT });
  });

  it('superadmin aprova gasto', async () => {
    const rafael = await entrarComoLocal('rafael@althius.com.br');
    const [verba] = (await listarAprovacoes(rafael, EVOLUT)).filter(a => a.id === VERBA_LINKEDIN);
    expect(await decidirAprovacao(rafael, { aprovacao: verba, membroId: RAFAEL_EVOLUT, decisao: 'Aprovada' })).toEqual({ ok: true });
    expect((await adminLocal().from('approvals').select('status, decided_by_member_id').eq('id', VERBA_LINKEDIN).single()).data)
      .toEqual({ status: 'aprovado', decided_by_member_id: RAFAEL_EVOLUT });
  });

  it('C-level rejeita operação', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const [crm] = (await listarAprovacoes(aline, EVOLUT)).filter(a => a.id === CRM_NEGOCIOS);
    expect(await decidirAprovacao(aline, { aprovacao: crm, membroId: ALINE_EVOLUT, decisao: 'Rejeitada', notas: 'Fora do ciclo.' }))
      .toEqual({ ok: true });
    expect((await adminLocal().from('approvals').select('status').eq('id', CRM_NEGOCIOS).single()).data?.status).toBe('rejeitado');
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

  it('pedir ajuste com texto grava a decisão', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const [lista] = (await listarAprovacoes(aline, EVOLUT)).filter(a => a.id === LISTA_512);
    expect(await decidirAprovacao(aline, { aprovacao: lista, membroId: ALINE_EVOLUT, decisao: 'Ajustes solicitados', notas: 'Encurtar o primeiro parágrafo.' }))
      .toEqual({ ok: true });
    expect((await adminLocal().from('approvals').select('status').eq('id', LISTA_512).single()).data?.status).toBe('ajustes_solicitados');
  });

  it('conteúdo alterado invalida a aprovação', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const [copy] = (await listarAprovacoes(aline, EVOLUT)).filter(a => a.id === COPY_SERRA_AZUL);
    const r = await decidirAprovacao(aline, {
      aprovacao: { id: copy.id, conteudo: { ...(copy.conteudo as object), previa: 'texto trocado' } },
      membroId: ALINE_EVOLUT,
      decisao: 'Aprovada'
    });
    expect(r).toEqual({ ok: false, mensagem: 'O conteúdo mudou depois do pedido. Esta aprovação foi invalidada e precisa ser pedida de novo.' });
    expect((await adminLocal().from('approvals').select('status').eq('id', COPY_SERRA_AZUL).single()).data?.status).toBe('rejeitado');
  });

  it('decidir de novo a mesma aprovação é recusado', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const [copy] = (await listarAprovacoes(aline, EVOLUT)).filter(a => a.id === COPY_SERRA_AZUL);
    expect(await decidirAprovacao(aline, { aprovacao: copy, membroId: ALINE_EVOLUT, decisao: 'Aprovada' })).toEqual({ ok: true });
    expect(await decidirAprovacao(aline, { aprovacao: copy, membroId: ALINE_EVOLUT, decisao: 'Rejeitada' }))
      .toEqual({ ok: false, mensagem: 'Esta aprovação já foi decidida por outra pessoa.' });
  });

  it('aprovação que não existe', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const r = await decidirAprovacao(aline, {
      aprovacao: { id: '00000000-0000-0000-0000-00000000abcd', conteudo: {} },
      membroId: ALINE_EVOLUT,
      decisao: 'Rejeitada'
    });
    expect(r).toEqual({ ok: false, mensagem: 'Esta aprovação não existe mais.' });
  });

  it('decidir no lugar de outro membro é recusado', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const [copy] = (await listarAprovacoes(aline, EVOLUT)).filter(a => a.id === COPY_SERRA_AZUL);
    const r = await decidirAprovacao(aline, { aprovacao: copy, membroId: CAMILA_EVOLUT, decisao: 'Aprovada' });
    expect(r).toEqual({ ok: false, mensagem: 'Você não tem permissão para esta decisão.' });
    expect((await adminLocal().from('approvals').select('status').eq('id', COPY_SERRA_AZUL).single()).data?.status).toBe('pendente');
  });

  it('decisão fora da lista vira erro genérico e não grava', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const [copy] = (await listarAprovacoes(aline, EVOLUT)).filter(a => a.id === COPY_SERRA_AZUL);
    const r = await decidirAprovacao(aline, { aprovacao: copy, membroId: ALINE_EVOLUT, decisao: 'qualquer' as 'Aprovada' });
    expect(r).toEqual({ ok: false, mensagem: GENERICA });
    expect((await adminLocal().from('approvals').select('status').eq('id', COPY_SERRA_AZUL).single()).data?.status).toBe('pendente');
  });
});