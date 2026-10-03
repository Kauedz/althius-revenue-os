// Seam: Campanhas no modo real. A lista deixa o prototipo e ativar canal pago nao finge que ligou.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { AlthiusApp } from './AlthiusApp';
import { montarDados, type ContextoReal, type PapelBanco } from './dados';
import { clienteVazio } from '../test/supabaseLocal';
import * as campanhas from './servicos/campanhas';
import { SEM_DADOS } from './servicos/campanhas';

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
  window.location.hash = '#/app/alfa/campaigns';
  render(<AlthiusApp dados={dados} supabase={clienteVazio()} aoSair={() => {}} />);
}

const tela: campanhas.CampanhasTela = {
  podeEditar: true,
  kpis: [
    ['Investimento', SEM_DADOS, SEM_DADOS],
    ['Leads gerados', '0', SEM_DADOS],
    ['Pipeline influenciado', SEM_DADOS, SEM_DADOS],
    ['Campanhas ativas', '0', SEM_DADOS]
  ],
  linhas: [{ id: 'c-real', nome: 'Campanha real da tela', canal: 'LinkedIn Ads', investido: SEM_DADOS, leads: '0', cpl: SEM_DADOS, status: 'Rascunho' }]
};

describe('Campanhas na tela', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('mostra a campanha do banco e esconde as do prototipo', async () => {
    vi.spyOn(campanhas, 'listarCampanhas').mockResolvedValue(tela);
    abrir('estrategista');
    expect(await screen.findByText('Campanha real da tela')).toBeInTheDocument();
    expect(screen.queryByText('Importação sem risco · Q4')).not.toBeInTheDocument();
    expect(screen.queryByText('R$ 30.000')).not.toBeInTheDocument();
    expect(screen.queryByText('R$ 118')).not.toBeInTheDocument();
  });

  it('Nova campanha abre o formulário e não chama o Copiloto', async () => {
    vi.spyOn(campanhas, 'listarCampanhas').mockResolvedValue(tela);
    abrir('estrategista');
    await screen.findByText('Campanha real da tela');
    fireEvent.click(screen.getByRole('button', { name: 'Nova campanha' }));
    expect(await screen.findByRole('button', { name: 'Salvar rascunho' })).toBeInTheDocument();
    expect(screen.queryByText(/criar uma campanha para/)).not.toBeInTheDocument();
  });

  it('Ativar campanha paga não diz que ela foi ligada', async () => {
    vi.spyOn(campanhas, 'listarCampanhas').mockResolvedValue(tela);
    vi.spyOn(campanhas, 'ativarCampanha').mockResolvedValue({
      ok: true, destino: 'aprovacao', mensagem: 'A ativação foi para Aprovações. Quem paga decide a verba.'
    });
    abrir('estrategista');
    fireEvent.click(await screen.findByText('Campanha real da tela'));
    fireEvent.click(await screen.findByRole('button', { name: 'Ativar' }));
    expect(await screen.findByText(/foi para Aprovações/)).toBeInTheDocument();
    expect(screen.queryByText('Campanha ativada.')).not.toBeInTheDocument();
  });
});
