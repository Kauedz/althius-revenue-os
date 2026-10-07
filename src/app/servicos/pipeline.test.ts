// Pipeline ligado ao banco local: quadros, negócios, histórico e isolamento. Logins do seed.
// Seed: Aline C-level Evolut (d..03); Lucas BDR (d..04, dono de c..01); Bruna BDR (d..06, dona de c..03); Eduardo C-level Grão Norte.
import { afterEach, describe, expect, it } from 'vitest';
import { adminLocal, bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';
import { arquivarNegocio, atualizarNegocio, criarNegocio, criarQuadro, excluirQuadro, falhaDoBanco, levarContasAoQuadro, listarPipeline, moverNegocio, pipelineVazio, reordenarEtapas, renomearQuadro } from './pipeline';

const WS = 'a0000000-0000-0000-0000-000000000001';
const GRAO = 'b0000000-0000-0000-0000-000000000001';
const ALINE = 'd0000000-0000-0000-0000-000000000003';
const LUCAS = 'd0000000-0000-0000-0000-000000000004';
const BRUNA = 'd0000000-0000-0000-0000-000000000006';
const CONTA_LUCAS = 'c0000000-0000-0000-0000-000000000001';
const CONTA_BRUNA = 'c0000000-0000-0000-0000-000000000003';

describe('falhaDoBanco', () => {
  it('mostra a mensagem do banco só para erros de regra; o resto vira texto genérico', () => {
    expect(falhaDoBanco({ code: '42501', message: 'Só gestores criam quadros.' }, 'x')).toEqual({ ok: false, mensagem: 'Só gestores criam quadros.' });
    expect(falhaDoBanco({ code: 'P0001', message: 'Limite de quadros atingido' }, 'x').mensagem).toBe('Limite de quadros atingido');
    expect(falhaDoBanco({ code: '57014', message: 'canceling statement due to statement timeout' }, 'Tente de novo.').mensagem).toBe('Tente de novo.');
    expect(falhaDoBanco({ message: 'algo' }, 'Tente de novo.').mensagem).toBe('Tente de novo.');
  });
});

describe('pipelineVazio', () => {
  it('não traz nenhum quadro nem negócio inventado', () => {
    expect(pipelineVazio()).toEqual({ quadros: { slg: [], mlg: [], plg: [] } });
  });
});

describe.skipIf(!bancoLocalNoAr)('Pipeline (banco local)', () => {
  const adm = adminLocal();
  // Os 3 quadros padrão ("SLG (Geral)"...) são do seed e ficam; o resto o teste cria e apaga. Negócios: o seed não tem nenhum.
  const limpar = async () => {
    await adm.from('opportunities').delete().in('workspace_id', [WS, GRAO]);
    await adm.from('pipelines').delete().in('workspace_id', [WS, GRAO]).not('name', 'like', '% (Geral)');
  };
  const padrao = { slg: [expect.objectContaining({ nome: 'SLG (Geral)', ordem: null, deals: [] })], mlg: [expect.objectContaining({ nome: 'MLG (Geral)', ordem: null, deals: [] })], plg: [expect.objectContaining({ nome: 'PLG (Geral)', ordem: null, deals: [] })] };
  afterEach(limpar);

  it('o workspace nasce só com os 3 quadros padrão, sem negócio nenhum: nada de dado inventado', async () => {
    await limpar();
    const aline = await entrarComoLocal('aline@evolut.com.br');
    expect((await listarPipeline(aline, WS)).quadros).toEqual(padrao);
  });

  it('gestor cria quadros por motion, renomeia e reordena as etapas; o sexto SLG é recusado', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const a = await criarQuadro(aline, WS, ALINE, 'slg', 'Principal');
    expect(a.ok).toBe(true);
    await criarQuadro(aline, WS, ALINE, 'mlg', 'Marketing');
    for (const n of ['B', 'C', 'D']) expect((await criarQuadro(aline, WS, ALINE, 'slg', 'Quadro ' + n)).ok).toBe(true);
    const sexto = await criarQuadro(aline, WS, ALINE, 'slg', 'Quadro E');
    expect(sexto).toMatchObject({ ok: false });
    expect(sexto.ok === false && sexto.mensagem).toMatch(/Limite de quadros/);

    if (!a.ok || !a.id) throw new Error('quadro não criado');
    expect((await renomearQuadro(aline, WS, ALINE, a.id, 'Funil enterprise')).ok).toBe(true);
    expect((await reordenarEtapas(aline, WS, ALINE, a.id, ['entrada', 'descoberta', 'qualificacao', 'proposta', 'negociacao', 'ganho'])).ok).toBe(true);
    const r = await reordenarEtapas(aline, WS, ALINE, a.id, ['ganho', 'entrada', 'qualificacao', 'descoberta', 'proposta', 'negociacao']);
    expect(r.ok === false && r.mensagem).toMatch(/última/);

    const p = await listarPipeline(aline, WS);
    expect(p.quadros.slg).toHaveLength(5); // o padrão + 4 criados
    expect(p.quadros.mlg).toHaveLength(2);
    expect(p.quadros.plg).toHaveLength(1);
    const principal = p.quadros.slg.find(q => q.id === a.id)!;
    expect(principal.nome).toBe('Funil enterprise');
    expect(principal.ordem).toEqual(['entrada', 'descoberta', 'qualificacao', 'proposta', 'negociacao', 'ganho']);
    expect(p.quadros.slg.find(q => q.nome === 'Quadro B')!.ordem).toBeNull(); // ordem padrão
  });

  it('BDR não cria quadro', async () => {
    const lucas = await entrarComoLocal('lucas@evolut.com.br');
    const r = await criarQuadro(lucas, WS, LUCAS, 'slg', 'Do BDR');
    expect(r.ok === false && r.mensagem).toMatch(/gestores/);
  });

  it('BDR cria e move só o negócio dele; mover grava o histórico com quem moveu; outro BDR é barrado', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const lucas = await entrarComoLocal('lucas@evolut.com.br');
    const bruna = await entrarComoLocal('bruna@evolut.com.br');
    const q = await criarQuadro(aline, WS, ALINE, 'slg', 'Principal');
    if (!q.ok || !q.id) throw new Error('quadro não criado');

    const dados = { valor: 50000, fecha: '2026-12-15', prob: 10, etapa: 'entrada', status: 'ok' as const };
    const meu = await criarNegocio(lucas, WS, LUCAS, q.id, { ...dados, contaId: CONTA_LUCAS, donoId: LUCAS });
    const dela = await criarNegocio(aline, WS, ALINE, q.id, { ...dados, contaId: CONTA_BRUNA, donoId: BRUNA, etapa: 'qualificacao', status: 'risco' });
    expect(meu.ok && dela.ok).toBe(true);
    if (!meu.ok || !meu.id || !dela.ok || !dela.id) throw new Error('negócios não criados');

    const paraOutro = await criarNegocio(lucas, WS, LUCAS, q.id, { ...dados, contaId: CONTA_BRUNA, donoId: BRUNA });
    expect(paraOutro.ok === false && paraOutro.mensagem).toMatch(/para você mesmo/);

    const doQuadro = (p: Awaited<ReturnType<typeof listarPipeline>>) => p.quadros.slg.find(x => x.id === q.id)!;
    let p = await listarPipeline(lucas, WS);
    const deals = doQuadro(p).deals;
    expect(deals).toHaveLength(2);
    const d = deals.find(x => x.id === meu.id)!;
    expect(d).toMatchObject({ conta: 'Serra Azul Têxtil', valor: 50000, fecha: '2026-12-15', etapa: 'entrada', status: 'ok', prob: 10, donoId: LUCAS, cid: CONTA_LUCAS });
    expect(d.dono).toBeTruthy();
    expect(deals.find(x => x.id === dela.id)).toMatchObject({ status: 'risco', etapa: 'qualificacao', donoId: BRUNA });

    expect((await moverNegocio(lucas, WS, LUCAS, meu.id, 'proposta', null)).ok).toBe(true);
    const barrado = await moverNegocio(lucas, WS, LUCAS, dela.id, 'proposta', null);
    expect(barrado.ok === false && barrado.mensagem).toMatch(/responsável ou um gestor/);
    const barrada2 = await moverNegocio(bruna, WS, BRUNA, meu.id, 'negociacao', null);
    expect(barrada2.ok === false && barrada2.mensagem).toMatch(/responsável ou um gestor/);

    const { data: hist } = await adm.from('opportunity_stage_history').select('from_stage_key, to_stage_key, moved_by_member_id').eq('opportunity_id', meu.id);
    expect(hist).toEqual([{ from_stage_key: 'entrada', to_stage_key: 'proposta', moved_by_member_id: LUCAS }]);

    p = await listarPipeline(lucas, WS);
    expect(doQuadro(p).deals.find(x => x.id === meu.id)).toMatchObject({ etapa: 'proposta', prob: 55 });

    // Gestor move o negócio da Bruna e o histórico guarda a Aline, não a dona do negócio
    expect((await moverNegocio(aline, WS, ALINE, dela.id, 'ganho', null)).ok).toBe(true);
    const { data: h2 } = await adm.from('opportunity_stage_history').select('moved_by_member_id').eq('opportunity_id', dela.id).eq('to_stage_key', 'ganho');
    expect(h2).toEqual([{ moved_by_member_id: ALINE }]);

    // Editar e arquivar (só o dele)
    expect((await atualizarNegocio(lucas, WS, LUCAS, meu.id, { valor: 65000, fecha: '', prob: 60, etapa: 'proposta', status: 'atraso', donoId: LUCAS })).ok).toBe(true);
    p = await listarPipeline(lucas, WS);
    expect(doQuadro(p).deals.find(x => x.id === meu.id)).toMatchObject({ valor: 65000, fecha: '', prob: 60, status: 'atraso' });
    const reatribuir = await atualizarNegocio(lucas, WS, LUCAS, meu.id, { valor: 1, fecha: '', prob: 60, etapa: 'proposta', status: 'ok', donoId: BRUNA });
    expect(reatribuir.ok).toBe(false);
    expect((await arquivarNegocio(lucas, WS, LUCAS, dela.id)).ok).toBe(false);
    expect((await arquivarNegocio(lucas, WS, LUCAS, meu.id)).ok).toBe(true);
    p = await listarPipeline(lucas, WS);
    expect(doQuadro(p).deals.map(x => x.id)).toEqual([dela.id]);
  });

  it('excluir quadro leva os negócios para outro; o único quadro da motion não sai', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const a = await criarQuadro(aline, WS, ALINE, 'plg', 'Um');
    const b = await criarQuadro(aline, WS, ALINE, 'plg', 'Dois');
    if (!a.ok || !a.id || !b.ok || !b.id) throw new Error('quadros não criados');
    const n = await criarNegocio(aline, WS, ALINE, b.id, { contaId: CONTA_LUCAS, donoId: LUCAS, valor: 10, fecha: '', prob: 10, etapa: 'entrada', status: 'ok' });
    expect(n.ok).toBe(true);
    expect((await excluirQuadro(aline, WS, ALINE, b.id)).ok).toBe(true);
    let p = await listarPipeline(aline, WS);
    expect(p.quadros.plg.map(x => x.nome)).toEqual(['PLG (Geral)', 'Um']);
    expect(p.quadros.plg[0].deals).toHaveLength(1); // o negócio foi para o quadro mais antigo, nada se perdeu
    expect((await excluirQuadro(aline, WS, ALINE, a.id)).ok).toBe(true);
    p = await listarPipeline(aline, WS);
    const unico = await excluirQuadro(aline, WS, ALINE, p.quadros.plg[0].id);
    expect(unico.ok === false && unico.mensagem).toMatch(/único quadro/);
  });

  it('isolamento: o Grão Norte não vê nem mexe em quadro ou negócio da Evolut', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const eduardo = await entrarComoLocal('eduardo@graonorte.com.br');
    const q = await criarQuadro(aline, WS, ALINE, 'slg', 'Evolut');
    if (!q.ok || !q.id) throw new Error('quadro não criado');
    const n = await criarNegocio(aline, WS, ALINE, q.id, { contaId: CONTA_LUCAS, donoId: LUCAS, valor: 10, fecha: '', prob: 10, etapa: 'entrada', status: 'ok' });
    if (!n.ok || !n.id) throw new Error('negócio não criado');
    expect((await listarPipeline(eduardo, GRAO)).quadros).toEqual(padrao);       // só os quadros padrão dele, sem negócio
    expect(await listarPipeline(eduardo, WS)).toEqual(pipelineVazio());           // nada da Evolut
    const GRAO_MEMBRO = 'd0000000-0000-0000-0000-000000000009';
    expect((await moverNegocio(eduardo, GRAO, GRAO_MEMBRO, n.id, 'ganho', null)).ok).toBe(false);
    expect((await renomearQuadro(eduardo, GRAO, GRAO_MEMBRO, q.id, 'Invadido')).ok).toBe(false);
  });

  it('ADR 0065: levar contas da base ao quadro, em massa, sem duplicar; o resultado diz quantas entraram', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const { data: q } = await adm.from('pipelines').select('id').eq('workspace_id', WS).eq('motion', 'mlg').single();
    const r = await levarContasAoQuadro(aline, WS, ALINE, q!.id, [CONTA_LUCAS, CONTA_BRUNA]);
    expect(r).toEqual({ ok: true, criados: 2, jaEstavam: 0, ignoradas: 0 });
    expect(await levarContasAoQuadro(aline, WS, ALINE, q!.id, [CONTA_LUCAS])).toEqual({ ok: true, criados: 0, jaEstavam: 1, ignoradas: 0 });
    const tela = await listarPipeline(aline, WS);
    expect(tela.quadros.mlg[0].deals.map(d => d.conta).sort()).toEqual(['Metalúrgica Ipê', 'Serra Azul Têxtil']);
    expect(tela.quadros.mlg[0].deals.every(d => d.valor === 0)).toBe(true);
  });

  it('ADR 0065: quadro de outro cliente vem como erro claro, sem criar nada', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const { data: q } = await adm.from('pipelines').select('id').eq('workspace_id', GRAO).eq('motion', 'slg').single();
    expect(await levarContasAoQuadro(aline, WS, ALINE, q!.id, [CONTA_LUCAS])).toEqual({ ok: false, mensagem: 'Quadro não encontrado neste workspace.' });
  });
});
