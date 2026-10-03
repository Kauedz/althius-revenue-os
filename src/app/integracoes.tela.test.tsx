// Seam: Integracoes no modo real. A lista deixa o prototipo e o botao de conectar some.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
});
