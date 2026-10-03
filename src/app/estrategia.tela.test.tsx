// Seam: Estrategia no modo real. A lista deixa de ser a do prototipo assim que a pagina abre.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
});
