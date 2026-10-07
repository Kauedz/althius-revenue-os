// Estratégia ligada ao banco (ADR 0064): mostra só o que existe. Não há tabela de ICP; o ICP mora no Playbook de cada agente
// (ADR 0057). Seed: a Evolut tem os 4 Playbooks publicados; o Grão Norte não tem nenhum. Ambos têm as personas alvo padrão.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminLocal, bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';
import { estrategiaVazia, listarEstrategia, resumoDoIcp, resumoDoPlaybook, salvarIcp } from './estrategia';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const GRAO = 'b0000000-0000-0000-0000-000000000001';

describe('formatação', () => {
  it('estrategiaVazia não inventa linha nem número', () => {
    expect(estrategiaVazia()).toEqual({ kpis: [], linhas: [] });
  });

  it('o resumo do Playbook tira os títulos e corta com reticências', () => {
    expect(resumoDoPlaybook('# Missão\nEncontrar contas.\n\n# Regras\n- Não inventar.')).toBe('Missão. Encontrar contas. Regras. Não inventar.');
    expect(resumoDoPlaybook('x'.repeat(400)).length).toBeLessThanOrEqual(241);
    expect(resumoDoPlaybook('x'.repeat(400)).endsWith('…')).toBe(true);
  });
});

describe('ICP estruturado (ADR 0067)', () => {
  it('o resumo do ICP diz só o que foi definido', () => {
    expect(resumoDoIcp({ setores: ['Clínicas'], cnaes: ['8630504'], portes: ['MICRO', 'EPP'], funcionarios_min: 10, funcionarios_max: 20, ufs: ['SP'] }))
      .toBe('Setores: Clínicas. CNAE: 8630504. Porte: MICRO, EPP. Funcionários: 10 a 20. Estados: SP.');
    expect(resumoDoIcp({ faturamento_min: 1000000 })).toBe('Faturamento: a partir de R$ 1.000.000.');
    expect(resumoDoIcp({})).toBe('');
  });
});

describe.skipIf(!bancoLocalNoAr)('ICP na Estratégia (banco local)', () => {
  const adm = adminLocal();
  // O ICP de demonstração do seed volta como estava (as chamas das contas dependem dele).
  let icpOriginal: unknown = {};
  beforeAll(async () => { icpOriginal = (await adm.from('workspace_settings').select('icp').eq('workspace_id', EVOLUT).single()).data?.icp ?? {}; });
  afterAll(async () => { await adm.from('workspace_settings').update({ icp: icpOriginal }).eq('workspace_id', EVOLUT); });

  it('sem ICP: a linha diz "Não definido" (nada inventado); a estrategista grava e a linha mostra o resumo', async () => {
    await adm.from('workspace_settings').update({ icp: {} }).eq('workspace_id', EVOLUT);
    const camila = await entrarComoLocal('camila@althius.com.br');
    const antes = await listarEstrategia(camila, EVOLUT);
    expect(antes.linhas.find(l => l.tipo === 'ICP')).toMatchObject({ nome: 'ICP', status: 'Não definido' });
    const r = await salvarIcp(camila, EVOLUT, 'd0000000-0000-0000-0000-000000000002', { cnaes: '8630-5/04, 8630503', ufs: 'sp', faturamento_min: '1.000.000' });
    expect(r).toEqual({ ok: true });
    const depois = await listarEstrategia(camila, EVOLUT);
    expect(depois.linhas.find(l => l.tipo === 'ICP')).toMatchObject({ status: 'Definido', desc: 'CNAE: 8630504, 8630503. Faturamento: a partir de R$ 1.000.000. Estados: SP.' });
    expect(depois.icp).toMatchObject({ cnaes: ['8630504', '8630503'], ufs: ['SP'] });
  });

  it('erro de validação e BDR viram mensagem clara', async () => {
    const camila = await entrarComoLocal('camila@althius.com.br');
    expect(await salvarIcp(camila, EVOLUT, 'd0000000-0000-0000-0000-000000000002', { ufs: 'XX' })).toEqual({ ok: false, mensagem: '"XX" não é sigla de estado (ex.: SP).' });
    const lucas = await entrarComoLocal('lucas@evolut.com.br');
    expect(await salvarIcp(lucas, EVOLUT, 'd0000000-0000-0000-0000-000000000004', { ufs: 'SP' })).toEqual({ ok: false, mensagem: 'Só gestores do cliente (C-level ou estrategista) editam o ICP.' });
  });
});

describe.skipIf(!bancoLocalNoAr)('Estratégia (banco local)', () => {
  it('Evolut: os 4 Playbooks publicados e as personas alvo, com números reais', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const t = await listarEstrategia(aline, EVOLUT);
    const playbooks = t.linhas.filter(l => l.tipo === 'Playbook');
    expect(playbooks.map(l => l.nome).sort()).toEqual(['Playbook · Jax', 'Playbook · Lia', 'Playbook · Neo', 'Playbook · Zoe'].sort());
    expect(playbooks.find(l => l.nome === 'Playbook · Zoe')).toMatchObject({ versao: 'v3.2', status: 'Publicado' });
    expect(playbooks.find(l => l.nome === 'Playbook · Zoe')!.desc).toMatch(/^Missão\. Encontrar as contas/);
    const personas = t.linhas.filter(l => l.tipo === 'Persona');
    expect(personas.map(l => l.nome)).toEqual(['CEO', 'Diretor', 'Sócio', 'Head', 'Gerente']);
    expect(personas[0].desc).toMatch(/Decisor/);
    expect(t.kpis[0]).toEqual(['Playbooks publicados', '4', 'de 4 agentes']);
    expect(t.kpis[1]).toEqual(['Personas alvo', '5', 'cargos que o enriquecimento procura']);
    expect(t.kpis[3][0]).toBe('Contas');
    expect(Number(t.kpis[3][1])).toBeGreaterThanOrEqual(8);
    // Nada do protótipo.
    expect(JSON.stringify(t)).not.toMatch(/3\.420|Importadores de médio porte|Excluir tradings/);
  });

  it('Grão Norte: sem Playbook publicado, diz isso; só as personas padrão aparecem', async () => {
    const eduardo = await entrarComoLocal('eduardo@graonorte.com.br');
    const t = await listarEstrategia(eduardo, GRAO);
    expect(t.linhas.filter(l => l.tipo === 'Playbook')).toEqual([]);
    expect(t.kpis[0]).toEqual(['Playbooks publicados', '0', 'de 4 agentes']);
    expect(t.linhas.filter(l => l.tipo === 'Persona')).toHaveLength(5);
    expect(t.kpis[3]).toEqual(['Contas', '0', 'no workspace']);
  });

  it('isolamento: quem é de um cliente não lê a estratégia de outro', async () => {
    const eduardo = await entrarComoLocal('eduardo@graonorte.com.br');
    const t = await listarEstrategia(eduardo, EVOLUT);
    expect(t.linhas.filter(l => l.tipo === 'Playbook')).toEqual([]);
    expect(t.kpis[3]).toEqual(['Contas', '0', 'no workspace']);
  });
});
