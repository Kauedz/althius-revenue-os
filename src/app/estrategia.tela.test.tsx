// Seam: Estrategia no modo real. A lista vem do banco, o erro oferece Tentar de novo e trocar de workspace nao mistura dados.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { configure } from '@testing-library/react';
configure({ asyncUtilTimeout: 4000 });
import '../v18/data.js';
import '../v18/module.js';
import { AlthiusApp } from './AlthiusApp';
import { montarDados, type ContextoReal, type PapelBanco } from './dados';
import { clienteVazio } from '../test/supabaseLocal';
import * as estrategia from './servicos/estrategia';
import { SEM_DADOS } from './servicos/estrategia';

const demo = { data: window.ALTHIUS_DATA!, caps: window.ALTHIUS_CAPS };

function contexto(papel: PapelBanco): ContextoReal {
  return {
    usuario: { id: 'u1', nome: 'Pessoa Teste', email: 'pessoa@cliente.com.br', fotoUrl: null, superadmin: false },
    workspaces: [{ uuid: 'id-alfa', slug: 'alfa', nome: 'WS alfa', sigla: 'AL', momento: 'Execução', logoUrl: null, papel, membroId: 'm-alfa' }],
    matriz: [],
    membros: { alfa: [{ id: 'm-alfa', userId: 'u1', nome: 'Pessoa Teste', email: 'pessoa@cliente.com.br', papel, status: 'active', cargo: null, entrouEm: '2026-09-01' }] }
  };
}

function abrir(papel: PapelBanco) {
  const dados = montarDados(contexto(papel), demo.data, demo.caps);
  window.ALTHIUS_DATA = dados;
  window.ALTHIUS_CAPS = dados.CAPS;
  window.location.hash = '#/app/alfa/strategy';
  render(<AlthiusApp dados={dados} supabase={clienteVazio()} aoSair={() => {}} />);
}

const telaEditor: estrategia.EstrategiaTela = {
  podeEditar: true,
  kpis: [
    ['ICP vigente', SEM_DADOS, SEM_DADOS],
    ['Personas', SEM_DADOS, SEM_DADOS],
    ['Segmentos', SEM_DADOS, SEM_DADOS],
    ['Contas no ICP', SEM_DADOS, SEM_DADOS]
  ],
  linhas: [{ id: 's-real', nome: 'ICP real da tela', tipo: 'ICP', versao: 'v9', status: 'Rascunho', resp: 'Pessoa Teste', desc: 'Texto real' }]
};

describe('Estrategia na tela', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('mostra o item do banco e esconde as linhas do prototipo', async () => {
    vi.spyOn(estrategia, 'listarEstrategia').mockResolvedValue(telaEditor);
    abrir('estrategista');
    expect(await screen.findByText('ICP real da tela')).toBeInTheDocument();
    expect(screen.queryByText('Importadores de médio porte · Sudeste')).not.toBeInTheDocument();
    expect(screen.queryByText('Excluir tradings concorrentes')).not.toBeInTheDocument();
    expect(screen.queryByText('3.420')).not.toBeInTheDocument();
  });

  it('Nova hipótese abre o formulário e não avisa que um rascunho foi criado', async () => {
    vi.spyOn(estrategia, 'listarEstrategia').mockResolvedValue(telaEditor);
    abrir('estrategista');
    await screen.findByText('ICP real da tela');
    fireEvent.click(screen.getByRole('button', { name: 'Nova hipótese' }));
    expect(await screen.findByRole('button', { name: 'Salvar rascunho' })).toBeInTheDocument();
    expect(screen.queryByText(/Hipótese criada como rascunho/)).not.toBeInTheDocument();
  });

  it('C-level não cria a hipótese encenada', async () => {
    const spy = vi.spyOn(estrategia, 'listarEstrategia').mockResolvedValue({ ...telaEditor, podeEditar: false, linhas: [] });
    abrir('clevel');
    await waitFor(() => expect(spy).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Nova hipótese' }));
    expect(await screen.findByText('Seu papel só lê a estratégia.')).toBeInTheDocument();
    expect(screen.queryByText(/Hipótese criada como rascunho/)).not.toBeInTheDocument();
  });

function contextoDois(papel: PapelBanco): ContextoReal {
  const base = contexto(papel);
  return {
    ...base,
    workspaces: [
      base.workspaces[0],
      { uuid: 'id-beta', slug: 'beta', nome: 'Beta Industrial', sigla: 'BE', momento: 'Preparação', logoUrl: null, papel, membroId: 'm-beta' }
    ],
    membros: {
      alfa: base.membros.alfa,
      beta: [{ id: 'm-beta', userId: 'u1', nome: 'Pessoa Teste', email: 'pessoa@cliente.com.br', papel, status: 'active', cargo: null, entrouEm: '2026-09-01' }]
    }
  };
}

function abrirDois(papel: PapelBanco, pagina: string) {
  const dados = montarDados(contextoDois(papel), demo.data, demo.caps);
  window.ALTHIUS_DATA = dados;
  window.ALTHIUS_CAPS = dados.CAPS;
  window.location.hash = '#/app/alfa/' + pagina;
  render(<AlthiusApp dados={dados} supabase={clienteVazio()} aoSair={() => {}} />);
}

async function irPara(hash: string) {
  await act(async () => { window.location.hash = hash; });
}

  it('erro de leitura avisa com clareza e Tentar de novo traz o banco', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let falhar = true;
    vi.spyOn(estrategia, 'listarEstrategia').mockImplementation(async () => {
      if (falhar) throw new Error('Sem conexão para carregar a estratégia.');
      return telaEditor;
    });
    // O jsdom avisa a troca de endereço um instante depois. Sem esperar, esse aviso apaga o diálogo.
    await act(async () => {
      window.location.hash = '#/app/alfa/strategy';
      await new Promise(r => setTimeout(r, 0));
    });
    abrir('estrategista');
    const dialogo = await screen.findByRole('alertdialog', { name: 'Não foi possível carregar a estratégia' });
    expect(dialogo).toHaveTextContent('Sem conexão');
    expect(screen.queryByText('Importadores de médio porte · Sudeste')).not.toBeInTheDocument();
    expect(screen.queryByText('Diretor(a) de Supply Chain')).not.toBeInTheDocument();
    falhar = false;
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('ICP real da tela')).toBeInTheDocument();
    expect(screen.queryByText('Excluir tradings concorrentes')).not.toBeInTheDocument();
    expect(screen.queryByText('3.420')).not.toBeInTheDocument();
  });

  it('trocar de workspace nao deixa o item do workspace anterior', async () => {
    vi.spyOn(estrategia, 'listarEstrategia').mockImplementation(async (_c, id) => ({
      ...telaEditor,
      linhas: [{ id: 's-' + id, nome: id === 'id-alfa' ? 'ICP da Alfa' : 'ICP da Beta', tipo: 'ICP', versao: 'v1', status: 'Rascunho', resp: 'Pessoa Teste', desc: 'Texto real' }]
    }));
    abrirDois('estrategista', 'strategy');
    expect(await screen.findByText('ICP da Alfa')).toBeInTheDocument();
    await irPara('#/app/beta/strategy');
    expect(await screen.findByText('ICP da Beta')).toBeInTheDocument();
    expect(screen.queryByText('ICP da Alfa')).not.toBeInTheDocument();
    expect(screen.queryByText('Importadores de médio porte · Sudeste')).not.toBeInTheDocument();
    expect(screen.queryByText('3.420')).not.toBeInTheDocument();
  });

});
