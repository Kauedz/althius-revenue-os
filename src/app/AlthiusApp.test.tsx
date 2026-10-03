// Seam: o app no modo real montado com um contexto do banco (sem rede).
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { AlthiusApp } from './AlthiusApp';
import { montarDados, type ContextoReal, type PapelBanco } from './dados';
import { clienteVazio } from '../test/supabaseLocal';

const demo = { data: window.ALTHIUS_DATA!, caps: window.ALTHIUS_CAPS };
const ESCOPOS: Record<string, [string, string, string, string]> = {
  'ws.switch': ['all', 'assigned', 'none', 'none'],
  'team.invite': ['all', 'all', 'all', 'none']
};

function contexto(papeis: Array<[slug: string, papel: PapelBanco, logo?: string]>): ContextoReal {
  return {
    usuario: { id: 'u1', nome: 'Pessoa Teste', email: 'pessoa@cliente.com.br', fotoUrl: null, superadmin: false },
    workspaces: papeis.map(([slug, papel, logo]) => ({
      uuid: 'id-' + slug, slug, nome: 'WS ' + slug, sigla: slug.slice(0, 2).toUpperCase(), momento: 'Execução', logoUrl: logo || null, papel, membroId: 'm-' + slug
    })),
    matriz: Object.entries(ESCOPOS).flatMap(([chave, v]) => (['superadmin', 'estrategista', 'clevel', 'bdr'] as const)
      .map((papel, i) => ({ papel, chave, escopo: v[i] as ContextoReal['matriz'][number]['escopo'], area: 'Workspace', nome: chave, nota: '' }))),
    membros: Object.fromEntries(papeis.map(([slug, papel]) => [slug, [
      { id: 'm-' + slug, userId: 'u1', nome: 'Pessoa Teste', email: 'pessoa@cliente.com.br', papel, status: 'active' as const, cargo: null, entrouEm: '2026-09-01' }
    ]]))
  };
}

function abrir(ctx: ContextoReal, rota: string) {
  const dados = montarDados(ctx, demo.data, demo.caps);
  window.ALTHIUS_DATA = dados;
  window.ALTHIUS_CAPS = dados.CAPS;
  window.location.hash = rota;
  render(<AlthiusApp dados={dados} supabase={clienteVazio()} aoSair={() => {}} />);
}

describe('AlthiusApp (modo real)', () => {
  it('C-level não troca de workspace (matriz: ws.switch = Não), mesmo sendo membro de outro', async () => {
    abrir(contexto([['alfa', 'clevel'], ['beta', 'bdr']]), '#/app/alfa/home');
    const rail = await screen.findByRole('navigation', { name: 'Workspaces' });
    await within(rail).findByRole('link', { name: 'WS alfa' });
    expect(within(rail).queryByRole('link', { name: 'WS beta' })).not.toBeInTheDocument();
  });

  it('estrategista troca entre os workspaces em que foi colocado', async () => {
    abrir(contexto([['alfa', 'estrategista'], ['beta', 'estrategista']]), '#/app/alfa/home');
    const rail = await screen.findByRole('navigation', { name: 'Workspaces' });
    expect(await within(rail).findByRole('link', { name: 'WS beta' })).toBeInTheDocument();
  });

  it('logo do workspace vem do banco quando existe', async () => {
    abrir(contexto([['alfa', 'estrategista', 'https://cdn.exemplo.com/alfa.png']]), '#/app/alfa/home');
    const rail = await screen.findByRole('navigation', { name: 'Workspaces' });
    const link = await within(rail).findByRole('link', { name: 'WS alfa' });
    expect(link.querySelector('img')?.getAttribute('src')).toBe('https://cdn.exemplo.com/alfa.png');
  });

  it('menu do avatar não oferece troca de papel', async () => {
    abrir(contexto([['alfa', 'superadmin']]), '#/app/alfa/home');
    await within(await screen.findByRole('navigation', { name: 'Navegação principal' })).findByRole('link', { name: /Início/ });
    (await screen.findByRole('button', { name: 'Perfil e papel' })).click();
    const perfil = await screen.findByRole('dialog', { name: 'Perfil' });
    expect(perfil).toHaveTextContent('Pessoa Teste');
    expect(perfil).not.toHaveTextContent('Modo demonstração');
  });

  it('papel vale por workspace: na rota do workspace onde é BDR, a pessoa é BDR', async () => {
    abrir(contexto([['alfa', 'estrategista'], ['beta', 'bdr']]), '#/app/beta/home');
    const nav = await screen.findByRole('navigation', { name: 'Navegação principal' });
    await within(nav).findByRole('link', { name: /Início/ });
    expect(within(nav).queryByRole('link', { name: /Estratégia/ })).not.toBeInTheDocument();
  });
});
