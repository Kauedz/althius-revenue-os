// Estratégia ligada ao banco (ADR 0064): mostra só o que existe. Não há tabela de ICP; o ICP mora no Playbook de cada agente
// (ADR 0057). Seed: a Evolut tem os 4 Playbooks publicados; o Grão Norte não tem nenhum. Ambos têm as personas alvo padrão.
import { describe, expect, it } from 'vitest';
import { bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';
import { estrategiaVazia, listarEstrategia, resumoDoPlaybook } from './estrategia';

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
