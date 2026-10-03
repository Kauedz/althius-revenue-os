// Seam: Campanhas no modo real. A lista vem do banco, o erro oferece Tentar de novo e trocar de workspace nao mistura dados.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { configure } from '@testing-library/react';
configure({ asyncUtilTimeout: 4000 });
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
    vi.spyOn(campanhas, 'listarCampanhas').mockImplementation(async () => {
      if (falhar) throw new Error('Sem conexão para carregar as campanhas.');
      return tela;
    });
    // O jsdom avisa a troca de endereço um instante depois. Sem esperar, esse aviso apaga o diálogo.
    await act(async () => {
      window.location.hash = '#/app/alfa/campaigns';
      await new Promise(r => setTimeout(r, 0));
    });
    abrir('estrategista');
    const dialogo = await screen.findByRole('alertdialog', { name: 'Não foi possível carregar as campanhas' });
    expect(dialogo).toHaveTextContent('Sem conexão');
    expect(screen.queryByText('Importação sem risco · Q4')).not.toBeInTheDocument();
    expect(screen.queryByText('R$ 30.000')).not.toBeInTheDocument();
    falhar = false;
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Campanha real da tela')).toBeInTheDocument();
    expect(screen.queryByText('R$ 118')).not.toBeInTheDocument();
  });

  it('trocar de workspace nao deixa a campanha do workspace anterior', async () => {
    vi.spyOn(campanhas, 'listarCampanhas').mockImplementation(async (_c, id) => ({
      ...tela,
      linhas: [{ ...tela.linhas[0], id: 'c-' + id, nome: id === 'id-alfa' ? 'Campanha da Alfa' : 'Campanha da Beta' }]
    }));
    abrirDois('estrategista', 'campaigns');
    expect(await screen.findByText('Campanha da Alfa')).toBeInTheDocument();
    await irPara('#/app/beta/campaigns');
    expect(await screen.findByText('Campanha da Beta')).toBeInTheDocument();
    expect(screen.queryByText('Campanha da Alfa')).not.toBeInTheDocument();
    expect(screen.queryByText('Importação sem risco · Q4')).not.toBeInTheDocument();
    expect(screen.queryByText('R$ 30.000')).not.toBeInTheDocument();
  });

});
