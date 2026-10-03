// Seam: o app no modo real montado com um contexto do banco (sem rede).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { AlthiusApp } from './AlthiusApp';
import { montarDados, type ContextoReal, type PapelBanco } from './dados';
import { clienteVazio } from '../test/supabaseLocal';
import * as execucoes from './servicos/execucoes';
import * as contasServico from './servicos/contas';

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

const execucaoAlfa: execucoes.ExecucaoTela = {
  id: 'ex-alfa', titulo: 'Execução exclusiva Alfa', tipo: 'Pesquisa', agente: 'comercial', campanha: 'Campanha',
  solicitante: 'Pessoa Teste', horario: 'Hoje', status: 'Falhou', progresso: 0, processados: 0, validos: 0,
  credEst: 10, credRes: 0, credCons: 0, plano: [], etapaAtual: 0, logs: [], erros: [], integracoes: [], aprovacao: 'Não exigida'
};
const execucaoBeta = { ...execucaoAlfa, id: 'ex-beta', titulo: 'Execução exclusiva Beta' };
function pendente<T>() {
  let resolver!: (valor: T) => void;
  const promise = new Promise<T>(ok => { resolver = ok; });
  return { promise, resolver };
}
afterEach(() => vi.restoreAllMocks());

describe('execuções durante troca de workspace', () => {
  it('troca na carga inicial mostra somente as execuções do workspace atual', async () => {
    const primeira = pendente<execucoes.ExecucaoTela[]>();
    const listar = vi.spyOn(execucoes, 'listarExecucoes').mockImplementation((_cliente, ws) =>
      ws === 'id-alfa' ? primeira.promise : Promise.resolve([execucaoBeta]));
    abrir(contexto([['alfa', 'estrategista'], ['beta', 'estrategista']]), '#/app/alfa/executions');
    await waitFor(() => expect(listar).toHaveBeenCalledWith(expect.anything(), 'id-alfa', false));
    await act(async () => { window.location.hash = '#/app/beta/executions'; });
    await act(async () => { primeira.resolver([execucaoAlfa]); });
    expect(await screen.findByText('Execução exclusiva Beta')).toBeInTheDocument();
    expect(screen.queryByText('Execução exclusiva Alfa')).not.toBeInTheDocument();
  });
});
it('repetir não volta ao workspace antigo se a pessoa trocar durante a atualização', async () => {
  const atualizacao = pendente<execucoes.ExecucaoTela[]>();
  let cargasAlfa = 0;
  vi.spyOn(execucoes, 'listarExecucoes').mockImplementation((_cliente, ws) =>
    ws === 'id-beta' ? Promise.resolve([execucaoBeta]) : (++cargasAlfa === 1 ? Promise.resolve([execucaoAlfa]) : atualizacao.promise));
  vi.spyOn(execucoes, 'controlarExecucao').mockResolvedValue({ success: true, status: 'queued', execution_id: 'nova-execucao' });
  abrir(contexto([['alfa', 'estrategista'], ['beta', 'estrategista']]), '#/app/alfa/executions/ex-alfa');
  fireEvent.click(await screen.findByRole('button', { name: 'Repetir' }));
  const dialog = await screen.findByRole('alertdialog', { name: 'Repetir execução?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Repetir' }));
  await waitFor(() => expect(cargasAlfa).toBe(2));
  await act(async () => { window.location.hash = '#/app/beta/executions'; });
  await screen.findByText('Execução exclusiva Beta');
  await act(async () => { atualizacao.resolver([execucaoAlfa]); });
  expect(window.location.hash).toBe('#/app/beta/executions');
  expect(screen.queryByText('Execução exclusiva Alfa')).not.toBeInTheDocument();
});

describe('contas no AlthiusApp', () => {
  it('carrega contas pelo serviço e publica no ALTHIUS_MOD e ALTHIUS_COMITES', async () => {
    const contaMock: contasServico.ContaTela = {
      id: 'c-teste',
      nome: 'Empresa Teste',
      segmento: 'Varejo',
      fit: 85,
      temperatura: 2,
      sinal: 'Nova filial',
      dono: 'Pessoa Teste',
      cidade: 'São Paulo, SP',
      decisor: 'Roberto Santos',
      comite: [
        {
          id: 'ct-1',
          nome: 'Roberto Santos',
          cargo: 'Diretor',
          papel: 'decisor',
          foto: '',
          linkedin: '',
          emails: ['roberto@teste.com'],
          fones: []
        }
      ]
    };
    const spy = vi.spyOn(contasServico, 'listarContas').mockResolvedValue([contaMock]);
    abrir(contexto([['alfa', 'clevel']]), '#/app/alfa/accounts');
    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.anything(), 'id-alfa'));
    await waitFor(() => expect((window as any).ALTHIUS_MOD.accounts.linhas).toContainEqual(contaMock));
    expect((window as any).ALTHIUS_COMITES['c-teste']).toEqual(contaMock.comite);
  });

  const contaDe = (ws: string): contasServico.ContaTela => ({
    id: 'c-' + ws, nome: 'Conta ' + ws, segmento: 'Varejo', fit: 80, temperatura: 2, sinal: '—', dono: 'Pessoa Teste', cidade: '—', decisor: 'Contato ' + ws,
    comite: [{ id: 'p-' + ws, nome: 'Contato ' + ws, cargo: 'Diretor', papel: 'decisor', foto: '', linkedin: '', emails: [ws + '@cliente.com.br'], fones: [] }]
  });

  it('trocar de workspace não deixa contatos do anterior nem do protótipo na memória do navegador', async () => {
    vi.spyOn(contasServico, 'listarContas').mockImplementation((_c, ws) => Promise.resolve([contaDe(ws === 'id-alfa' ? 'alfa' : 'beta')]));
    abrir(contexto([['alfa', 'estrategista'], ['beta', 'estrategista']]), '#/app/alfa/accounts');
    await waitFor(() => expect((window as any).ALTHIUS_COMITES['c-alfa']).toBeDefined());
    await act(async () => { window.location.hash = '#/app/beta/accounts'; });
    await waitFor(() => expect((window as any).ALTHIUS_COMITES['c-beta']).toBeDefined());
    expect(Object.keys((window as any).ALTHIUS_COMITES)).toEqual(['c-beta']);
    expect((window as any).ALTHIUS_MOD.accounts.linhas.map((c: { id: string }) => c.id)).toEqual(['c-beta']);
  });

  it('ao sair, as contas e os contatos do cliente somem da memória do navegador', async () => {
    vi.spyOn(contasServico, 'listarContas').mockResolvedValue([contaDe('alfa')]);
    abrir(contexto([['alfa', 'clevel']]), '#/app/alfa/accounts');
    await waitFor(() => expect((window as any).ALTHIUS_COMITES['c-alfa']).toBeDefined());
    cleanup();
    expect((window as any).ALTHIUS_MOD.accounts.linhas).toEqual([]);
    expect((window as any).ALTHIUS_COMITES).toEqual({});
  });
});