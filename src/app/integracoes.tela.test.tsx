// Seam: Integracoes no modo real. A lista vem do banco, o erro oferece Tentar de novo e trocar de workspace nao mistura dados.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { configure } from '@testing-library/react';
configure({ asyncUtilTimeout: 4000 });
import '../v18/data.js';
import '../v18/module.js';
import { AlthiusApp } from './AlthiusApp';
import { montarDados, type ContextoReal, type PapelBanco } from './dados';
import { clienteVazio } from '../test/supabaseLocal';
import * as integracoes from './servicos/integracoes';
import { SEM_DADOS } from './servicos/integracoes';

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
  window.location.hash = '#/app/alfa/integrations';
  render(<AlthiusApp dados={dados} supabase={clienteVazio()} aoSair={() => {}} />);
}

const tela: integracoes.IntegracoesTela = {
  linhas: [{ id: 'n-real', cap: 'E-mail', fornecedor: 'pessoa@cliente.com.br', modo: SEM_DADOS, teste: SEM_DADOS, status: 'Conectada' }]
};

describe('Integracoes na tela', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('mostra a conta do banco e esconde HubSpot e Apify', async () => {
    vi.spyOn(integracoes, 'listarIntegracoes').mockResolvedValue(tela);
    abrir('estrategista');
    expect(await screen.findByText('pessoa@cliente.com.br')).toBeInTheDocument();
    expect(screen.getAllByText(SEM_DADOS).length).toBeGreaterThan(0);
    expect(screen.queryByText('HubSpot')).not.toBeInTheDocument();
    expect(screen.queryByText('Apify')).not.toBeInTheDocument();
    expect(screen.queryByText('Hoje, 07:30')).not.toBeInTheDocument();
  });

  it('nao mostra Conectar ferramenta nem Testar conexao', async () => {
    vi.spyOn(integracoes, 'listarIntegracoes').mockResolvedValue(tela);
    abrir('estrategista');
    fireEvent.click(await screen.findByText('pessoa@cliente.com.br'));
    expect(screen.queryByRole('button', { name: 'Conectar ferramenta' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Testar conexão' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reconectar' })).not.toBeInTheDocument();
    expect(screen.queryByText('Escolha a ferramenta. A conexão abre em uma janela segura.')).not.toBeInTheDocument();
    expect(screen.queryByText('Teste concluído sem erros.')).not.toBeInTheDocument();
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
    vi.spyOn(integracoes, 'listarIntegracoes').mockImplementation(async () => {
      if (falhar) throw new Error('Sem conexão para carregar as integrações.');
      return tela;
    });
    // O jsdom avisa a troca de endereço um instante depois. Sem esperar, esse aviso apaga o diálogo.
    await act(async () => {
      window.location.hash = '#/app/alfa/integrations';
      await new Promise(r => setTimeout(r, 0));
    });
    abrir('estrategista');
    const dialogo = await screen.findByRole('alertdialog', { name: 'Não foi possível carregar as integrações' });
    expect(dialogo).toHaveTextContent('Sem conexão');
    expect(screen.queryByText('HubSpot')).not.toBeInTheDocument();
    expect(screen.queryByText('Apify')).not.toBeInTheDocument();
    expect(screen.queryByText('Conectores')).not.toBeInTheDocument();
    falhar = false;
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('pessoa@cliente.com.br')).toBeInTheDocument();
    expect(screen.queryByText('Google Sheets')).not.toBeInTheDocument();
    expect(screen.queryByText('Apollo')).not.toBeInTheDocument();
  });

  it('trocar de workspace nao deixa a conta do workspace anterior', async () => {
    vi.spyOn(integracoes, 'listarIntegracoes').mockImplementation(async (_c, id) => ({
      linhas: [{ ...tela.linhas[0], id: 'n-' + id, fornecedor: id === 'id-alfa' ? 'alfa@cliente.com.br' : 'beta@cliente.com.br' }]
    }));
    abrirDois('estrategista', 'integrations');
    expect(await screen.findByText('alfa@cliente.com.br')).toBeInTheDocument();
    await irPara('#/app/beta/integrations');
    expect(await screen.findByText('beta@cliente.com.br')).toBeInTheDocument();
    expect(screen.queryByText('alfa@cliente.com.br')).not.toBeInTheDocument();
    expect(screen.queryByText('HubSpot')).not.toBeInTheDocument();
    expect(screen.queryByText('Conectores')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Conectar ferramenta' })).not.toBeInTheDocument();
  });

});
