// Tarefas ligadas ao banco local. Seed: Lucas e Bruna são BDRs; Aline é C-level; Eduardo é do Grão Norte. O seed não tem tarefas.
import { afterEach, describe, expect, it } from 'vitest';
import { adminLocal, bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';
import { adiarTarefa, CANAL_BANCO, CANAL_TELA, criarTarefa, listarTarefas, mudarStatusTarefa, tarefasVazias } from './tarefas';

const WS = 'a0000000-0000-0000-0000-000000000001';
const GRAO = 'b0000000-0000-0000-0000-000000000001';
const ALINE = 'd0000000-0000-0000-0000-000000000003';
const LUCAS = 'd0000000-0000-0000-0000-000000000004';
const BRUNA = 'd0000000-0000-0000-0000-000000000006';
const AGORA = new Date('2026-10-05T15:00:00Z'); // 12:00 em Brasília
const iso = (dias: number, hora = 14) => new Date(Date.UTC(2026, 9, 5 + dias, hora)).toISOString();

describe('tabelas de canal e status', () => {
  it('os rótulos da tela e do banco são inversos entre si', () => {
    for (const [banco, tela] of Object.entries(CANAL_TELA)) expect(CANAL_BANCO[tela]).toBe(banco);
    expect(CANAL_BANCO['Ligação']).toBe('call');
    expect(CANAL_BANCO['Reunião']).toBe('reuniao');
    expect(CANAL_BANCO['CRM']).toBe('crm');
  });
  it('tarefasVazias não inventa linha nem número', () => {
    expect(tarefasVazias()).toEqual({ kpis: [], linhas: [] });
  });
});

describe.skipIf(!bancoLocalNoAr)('Tarefas (banco local)', () => {
  const adm = adminLocal();
  afterEach(async () => { await adm.from('tasks').delete().in('workspace_id', [WS, GRAO]).eq('source', 'manual'); });

  const nova = (titulo: string, extra: Partial<Parameters<typeof criarTarefa>[3]> = {}) => ({
    titulo, canal: 'Ligação', contaId: 'c0000000-0000-0000-0000-000000000001', contatoId: 'cb000000-0000-0000-0000-000000000001', responsavelId: LUCAS,
    agente: null, prazo: iso(0), status: 'Pendente', nota: 'Abrir pela vaga', ...extra
  });

  it('BDR cria tarefa para si; a lista traz conta, tipo, prazo em linguagem de tela e o roteiro', async () => {
    const lucas = await entrarComoLocal('lucas@evolut.com.br');
    const r = await criarTarefa(lucas, WS, LUCAS, nova('Ligar para Aline'));
    expect(r.ok).toBe(true);
    const t = await listarTarefas(lucas, WS, AGORA);
    expect(t.linhas).toHaveLength(1);
    expect(t.linhas[0]).toMatchObject({ titulo: 'Ligar para Aline', tipo: 'Ligação', conta: 'Serra Azul Têxtil', prazo: 'Hoje, 11:00', status: 'Pendente', roteiro: 'Abrir pela vaga', respId: LUCAS });
  });

  it('BDR não cria tarefa para outra pessoa, nem fingindo ser ela', async () => {
    const lucas = await entrarComoLocal('lucas@evolut.com.br');
    const paraBruna = await criarTarefa(lucas, WS, LUCAS, nova('Para a Bruna', { responsavelId: BRUNA }));
    expect(paraBruna.ok === false && paraBruna.mensagem).toMatch(/para você mesmo/);
    const fingindo = await criarTarefa(lucas, WS, BRUNA, nova('Fingindo', { responsavelId: BRUNA }));
    expect(fingindo.ok).toBe(false);
    const vazio = await criarTarefa(lucas, WS, LUCAS, nova('  '));
    expect(vazio.ok === false && vazio.mensagem).toMatch(/precisa ser feito/);
  });

  it('cada BDR vê só as próprias; o C-level vê todas', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const lucas = await entrarComoLocal('lucas@evolut.com.br');
    const bruna = await entrarComoLocal('bruna@evolut.com.br');
    await criarTarefa(lucas, WS, LUCAS, nova('Do Lucas'));
    await criarTarefa(bruna, WS, BRUNA, nova('Da Bruna', { responsavelId: BRUNA }));
    const doCLevel = await criarTarefa(aline, WS, ALINE, nova('Do C-level para o Lucas'));
    expect(doCLevel.ok).toBe(true);
    expect((await listarTarefas(lucas, WS, AGORA)).linhas.map(l => l.titulo).sort()).toEqual(['Do C-level para o Lucas', 'Do Lucas']);
    expect((await listarTarefas(bruna, WS, AGORA)).linhas.map(l => l.titulo)).toEqual(['Da Bruna']);
    expect((await listarTarefas(aline, WS, AGORA)).linhas).toHaveLength(3);
  });

  it('atrasada, concluir, adiar e indicadores (todos contados do banco)', async () => {
    const lucas = await entrarComoLocal('lucas@evolut.com.br');
    const a = await criarTarefa(lucas, WS, LUCAS, nova('Hoje 1'));
    const b = await criarTarefa(lucas, WS, LUCAS, nova('Ontem', { prazo: iso(-1) }));
    const c = await criarTarefa(lucas, WS, LUCAS, nova('Mandar e-mail', { canal: 'E-mail', prazo: iso(2) }));
    if (!a.ok || !a.id || !b.ok || !b.id || !c.ok || !c.id) throw new Error('tarefas não criadas');

    let t = await listarTarefas(lucas, WS, AGORA);
    expect(t.linhas.find(l => l.id === b.id)).toMatchObject({ status: 'Atrasada', prazo: expect.stringMatching(/^Atrasada · /) });
    expect(t.kpis).toEqual([['Para hoje', '1', ''], ['Atrasadas', '1', 'pedem ação'], ['Ligações pendentes', '2', ''], ['Concluídas na semana', '0', 'últimos 7 dias']]);

    expect((await mudarStatusTarefa(lucas, WS, LUCAS, b.id, 'Concluída')).ok).toBe(true);
    expect((await adiarTarefa(lucas, WS, LUCAS, a.id, 1)).ok).toBe(true);
    t = await listarTarefas(lucas, WS, new Date());
    expect(t.linhas.find(l => l.id === b.id)!.status).toBe('Concluída');
    expect(t.linhas.find(l => l.id === a.id)!.prazo).toMatch(/^Amanhã/);
    expect(t.kpis[3][1]).toBe('1');
    expect((await mudarStatusTarefa(lucas, WS, LUCAS, b.id, 'feito_talvez')).ok).toBe(false);
  });

  it('outro BDR não mexe na tarefa; o Grão Norte não enxerga nem mexe', async () => {
    const lucas = await entrarComoLocal('lucas@evolut.com.br');
    const bruna = await entrarComoLocal('bruna@evolut.com.br');
    const eduardo = await entrarComoLocal('eduardo@graonorte.com.br');
    const r = await criarTarefa(lucas, WS, LUCAS, nova('Do Lucas'));
    if (!r.ok || !r.id) throw new Error('tarefa não criada');
    const barrada = await mudarStatusTarefa(bruna, WS, BRUNA, r.id, 'Concluída');
    expect(barrada.ok === false && barrada.mensagem).toMatch(/responsável ou um gestor/);
    expect((await adiarTarefa(bruna, WS, BRUNA, r.id, 1)).ok).toBe(false);
    expect((await listarTarefas(eduardo, GRAO, AGORA)).linhas).toEqual([]);
    expect((await mudarStatusTarefa(eduardo, GRAO, 'd0000000-0000-0000-0000-000000000009', r.id, 'Concluída')).ok).toBe(false);
  });
});
