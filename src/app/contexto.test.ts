// @vitest-environment node
// Seam: carregarContexto(cliente Supabase logado) -> o que a pessoa enxerga, direto do banco local.
// Requer o Supabase local com o seed (npx supabase start). Sem ele, o teste é pulado com aviso.
import { describe, expect, it } from 'vitest';
import { carregarContexto } from './contexto';

import { bancoLocalNoAr as bancoNoAr, entrarComoLocal as entrarComo, novoClienteLocal } from '../test/supabaseLocal';

describe.skipIf(!bancoNoAr)('carregarContexto (banco local)', () => {
  it('BDR vê só o workspace dele, com papel bdr', async () => {
    const ctx = await carregarContexto(await entrarComo('lucas@evolut.com.br'));
    expect(ctx.usuario).toMatchObject({ nome: 'Lucas Teixeira', email: 'lucas@evolut.com.br', superadmin: false });
    expect(ctx.workspaces.map(w => [w.slug, w.papel])).toEqual([['evolut', 'bdr']]);
    expect(ctx.workspaces[0]).toMatchObject({ nome: 'Evolut Trading', sigla: 'EV', momento: 'Execução' });
  });

  it('estrategista vê só os workspaces em que foi colocado', async () => {
    const ctx = await carregarContexto(await entrarComo('camila@althius.com.br'));
    expect(ctx.workspaces.map(w => [w.slug, w.papel])).toEqual([['evolut', 'estrategista'], ['grao', 'estrategista']]);
  });

  it('superadmin vê todos os workspaces', async () => {
    const ctx = await carregarContexto(await entrarComo('rafael@althius.com.br'));
    expect(ctx.usuario.superadmin).toBe(true);
    expect(ctx.workspaces.map(w => w.slug)).toEqual(['evolut', 'grao', 'vertice']);
    expect(ctx.workspaces.every(w => w.papel === 'superadmin')).toBe(true);
  });

  it('a matriz completa vem do banco: 33 capacidades x 4 papéis', async () => {
    const ctx = await carregarContexto(await entrarComo('aline@evolut.com.br'));
    expect(ctx.matriz).toHaveLength(132);
    expect(ctx.matriz.find(m => m.papel === 'estrategista' && m.chave === 'credits.buy')?.escopo).toBe('request');
  });

  it('membros do workspace vêm com nome e e-mail', async () => {
    const ctx = await carregarContexto(await entrarComo('aline@evolut.com.br'));
    const nomes = ctx.membros.evolut.map(m => m.nome).sort();
    expect(nomes).toEqual(['Aline Xavier', 'Bruna Lima', 'Camila Duarte', 'Lucas Teixeira', 'Mateus Maia', 'Rafael Nunes']);
    expect(ctx.membros.evolut.find(m => m.nome === 'Lucas Teixeira')).toMatchObject({ email: 'lucas@evolut.com.br', papel: 'bdr' });
  });

  it('sem login, falha com mensagem clara', async () => {
    const anonimo = novoClienteLocal();
    await expect(carregarContexto(anonimo)).rejects.toThrow('Sessão expirada');
  });
});
