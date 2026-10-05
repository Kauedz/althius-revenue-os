// Cadências ligadas ao banco local. Seed: Camila estrategista (d..02), Aline C-level (d..03, só lê), Lucas BDR (d..04, dono da conta c..01),
// Eduardo C-level do Grão Norte (d..09). O seed não tem cadências.
import { afterEach, describe, expect, it } from 'vitest';
import { adminLocal, bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';
import { adicionarPasso, cadenciasVazias, inscreverContato, listarCadencias, removerUltimoPasso, salvarCadencia } from './cadencias';

const WS = 'a0000000-0000-0000-0000-000000000001';
const GRAO = 'b0000000-0000-0000-0000-000000000001';
const CAMILA = 'd0000000-0000-0000-0000-000000000002';
const ALINE = 'd0000000-0000-0000-0000-000000000003';
const LUCAS = 'd0000000-0000-0000-0000-000000000004';
const EDUARDO = 'd0000000-0000-0000-0000-000000000009';
const ALINE_XAVIER = 'cb000000-0000-0000-0000-000000000001';

describe('cadenciasVazias', () => {
  it('não inventa linha nem número', () => {
    expect(cadenciasVazias()).toEqual({ kpis: [], linhas: [] });
  });
});

describe.skipIf(!bancoLocalNoAr)('Cadências (banco local)', () => {
  const adm = adminLocal();
  afterEach(async () => { await adm.from('cadences').delete().in('workspace_id', [WS, GRAO]); });

  it('sem cadências: lista vazia, indicadores zerados e taxa de resposta sem dado', async () => {
    const camila = await entrarComoLocal('camila@althius.com.br');
    const t = await listarCadencias(camila, WS);
    expect(t.linhas).toEqual([]);
    expect(t.kpis).toEqual([['Cadências ativas', '0', ''], ['Contatos em cadência', '0', ''], ['Taxa de resposta', '—', ''], ['Contatos que responderam', '0', 'a cadência pausa sozinha']]);
  });

  it('estrategista monta a cadência passo a passo; a lista traz passos, contatos e descrição dos passos', async () => {
    const camila = await entrarComoLocal('camila@althius.com.br');
    const c = await salvarCadencia(camila, WS, CAMILA, null, 'Importadores', 'Para o Sudeste', 'Ativa');
    if (!c.ok || !c.id) throw new Error('cadência não criada');
    expect((await adicionarPasso(camila, WS, CAMILA, c.id, { canal: 'E-mail', modo: 'auto', espera: 0, assunto: 'Oi', texto: 'Primeira mensagem' })).ok).toBe(true);
    expect((await adicionarPasso(camila, WS, CAMILA, c.id, { canal: 'LinkedIn', modo: 'manual', espera: 2, assunto: '', texto: 'Conectar com nota' })).ok).toBe(true);
    const linkedinAuto = await adicionarPasso(camila, WS, CAMILA, c.id, { canal: 'LinkedIn', modo: 'auto', espera: 1, assunto: '', texto: 'x' });
    expect(linkedinAuto.ok === false && linkedinAuto.mensagem).toMatch(/Só e-mail e WhatsApp/);
    const semTexto = await adicionarPasso(camila, WS, CAMILA, c.id, { canal: 'E-mail', modo: 'auto', espera: 1, assunto: 'x', texto: ' ' });
    expect(semTexto.ok === false && semTexto.mensagem).toMatch(/texto da mensagem/);

    let t = await listarCadencias(camila, WS);
    expect(t.linhas).toHaveLength(1);
    expect(t.linhas[0]).toMatchObject({ nome: 'Importadores', passos: 2, contatos: 0, resposta: '—', status: 'Ativa' });
    expect(t.linhas[0].desc).toBe('Para o Sudeste · Passo 1: E-mail, automático. Passo 2: LinkedIn, manual, espera 2 dias.');
    expect(t.kpis[0]).toEqual(['Cadências ativas', '1', '']);

    expect((await removerUltimoPasso(camila, WS, CAMILA, c.id)).ok).toBe(true);
    t = await listarCadencias(camila, WS);
    expect(t.linhas[0].passos).toBe(1);
    expect((await salvarCadencia(camila, WS, CAMILA, c.id, 'Importadores', 'Para o Sudeste', 'Pausada')).ok).toBe(true);
    t = await listarCadencias(camila, WS);
    expect(t.linhas[0].status).toBe('Pausada');
    expect(t.kpis[0]).toEqual(['Cadências ativas', '0', '1 pausada']);
  });

  it('BDR cria e edita só a própria; C-level só consulta; com contato em andamento os passos não mudam', async () => {
    const camila = await entrarComoLocal('camila@althius.com.br');
    const lucas = await entrarComoLocal('lucas@evolut.com.br');
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const dela = await salvarCadencia(camila, WS, CAMILA, null, 'Da Camila', '', 'Ativa');
    const minha = await salvarCadencia(lucas, WS, LUCAS, null, 'Do Lucas', '', 'Ativa');
    if (!dela.ok || !dela.id || !minha.ok || !minha.id) throw new Error('cadências não criadas');

    const invadir = await salvarCadencia(lucas, WS, LUCAS, dela.id, 'Invadida', '', 'Ativa');
    expect(invadir.ok === false && invadir.mensagem).toMatch(/Só quem criou a cadência ou um estrategista/);
    expect((await adicionarPasso(lucas, WS, LUCAS, dela.id, { canal: 'Ligação', modo: 'manual', espera: 0, assunto: '', texto: 'x' })).ok).toBe(false);
    const doClevel = await salvarCadencia(aline, WS, ALINE, null, 'Do C-level', '', 'Ativa');
    expect(doClevel.ok === false && doClevel.mensagem).toMatch(/só consulta/);
    expect((await listarCadencias(aline, WS)).linhas).toHaveLength(2); // o C-level enxerga

    expect((await adicionarPasso(lucas, WS, LUCAS, minha.id, { canal: 'Ligação', modo: 'manual', espera: 0, assunto: '', texto: 'Roteiro' })).ok).toBe(true);
    expect((await inscreverContato(lucas, WS, LUCAS, minha.id, ALINE_XAVIER)).ok).toBe(true);
    const bloqueado = await adicionarPasso(lucas, WS, LUCAS, minha.id, { canal: 'E-mail', modo: 'manual', espera: 1, assunto: '', texto: 'x' });
    expect(bloqueado.ok === false && bloqueado.mensagem).toMatch(/contatos em andamento/);
    const t = await listarCadencias(lucas, WS);
    expect(t.linhas.find(l => l.id === minha.id)).toMatchObject({ contatos: 1, resposta: '0%' });
    expect(t.kpis[1]).toEqual(['Contatos em cadência', '1', '']);
  });

  it('isolamento: o Grão Norte não vê nem mexe nas cadências da Evolut (nem pela view de desempenho)', async () => {
    const camila = await entrarComoLocal('camila@althius.com.br');
    const eduardo = await entrarComoLocal('eduardo@graonorte.com.br');
    const c = await salvarCadencia(camila, WS, CAMILA, null, 'Da Evolut', '', 'Ativa');
    if (!c.ok || !c.id) throw new Error('cadência não criada');
    expect((await listarCadencias(eduardo, GRAO)).linhas).toEqual([]);
    expect((await listarCadencias(eduardo, WS)).linhas).toEqual([]);
    const { data: view } = await eduardo.from('view_cadence_performance').select('cadence_name');
    expect(view).toEqual([]);
    expect((await adicionarPasso(eduardo, GRAO, EDUARDO, c.id, { canal: 'E-mail', modo: 'manual', espera: 0, assunto: '', texto: 'x' })).ok).toBe(false);
    expect((await salvarCadencia(eduardo, GRAO, EDUARDO, c.id, 'Invadida', '', 'Ativa')).ok).toBe(false);
  });
});
