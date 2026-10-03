// Seam: Conteudos no modo real. A biblioteca vem do banco, o erro oferece Tentar de novo e trocar de workspace nao mistura dados.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { configure } from '@testing-library/react';
configure({ asyncUtilTimeout: 4000 });
import '../v18/data.js';
import '../v18/module.js';
import { AlthiusApp } from './AlthiusApp';
import { montarDados, type ContextoReal, type PapelBanco } from './dados';
import { clienteVazio } from '../test/supabaseLocal';
import * as conteudos from './servicos/conteudos';
import { SEM_DADOS } from './servicos/conteudos';

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
  window.location.hash = '#/app/alfa/contents';
  render(<AlthiusApp dados={dados} supabase={clienteVazio()} aoSair={() => {}} />);
}

const tela: conteudos.ConteudosTela = {
  podeEditar: true,
  linhas: [{ id: 'k-real', nome: 'Peca real da tela', formato: 'E-mail', persona: SEM_DADOS, status: 'Rascunho', texto: 'Texto real' }]
};

describe('Conteudos na tela', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('mostra a peca do banco e esconde as do prototipo', async () => {
    vi.spyOn(conteudos, 'listarConteudos').mockResolvedValue(tela);
    abrir('estrategista');
    expect(await screen.findByText('Peca real da tela')).toBeInTheDocument();
    expect(screen.queryByText('E-mail T1 · vaga de importação')).not.toBeInTheDocument();
    expect(screen.queryByText('Roteiro de ligação gatekeeper')).not.toBeInTheDocument();
  });

  it('Gerar conteúdo abre o formulário e não chama o Copiloto', async () => {
    vi.spyOn(conteudos, 'listarConteudos').mockResolvedValue(tela);
    abrir('estrategista');
    await screen.findByText('Peca real da tela');
    fireEvent.click(screen.getByRole('button', { name: 'Gerar conteúdo' }));
    expect(await screen.findByRole('button', { name: 'Salvar rascunho' })).toBeInTheDocument();
    expect(screen.queryByText(/Gerar um conteúdo sobre/)).not.toBeInTheDocument();
  });

  it('Publicar que pede aprovação não diz que o conteúdo foi aprovado', async () => {
    vi.spyOn(conteudos, 'listarConteudos').mockResolvedValue(tela);
    vi.spyOn(conteudos, 'publicarConteudo').mockResolvedValue({
      ok: true, destino: 'aprovacao', mensagem: 'A publicação foi para Aprovações. O conteúdo não foi publicado.'
    });
    abrir('estrategista');
    fireEvent.click(await screen.findByText('Peca real da tela'));
    fireEvent.click(await screen.findByRole('button', { name: 'Publicar' }));
    expect(await screen.findByText(/não foi publicado/)).toBeInTheDocument();
    expect(screen.queryByText('Conteúdo aprovado.')).not.toBeInTheDocument();
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
    vi.spyOn(conteudos, 'listarConteudos').mockImplementation(async () => {
      if (falhar) throw new Error('Sem conexão para carregar os conteúdos.');
      return tela;
    });
    // O jsdom avisa a troca de endereço um instante depois. Sem esperar, esse aviso apaga o diálogo.
    await act(async () => {
      window.location.hash = '#/app/alfa/contents';
      await new Promise(r => setTimeout(r, 0));
    });
    abrir('estrategista');
    const dialogo = await screen.findByRole('alertdialog', { name: 'Não foi possível carregar os conteúdos' });
    expect(dialogo).toHaveTextContent('Sem conexão');
    expect(screen.queryByText('E-mail T1 · vaga de importação')).not.toBeInTheDocument();
    expect(screen.queryByText('Guia: conta e ordem sem risco cambial')).not.toBeInTheDocument();
    falhar = false;
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Peca real da tela')).toBeInTheDocument();
    expect(screen.queryByText('Roteiro de ligação gatekeeper')).not.toBeInTheDocument();
    expect(screen.queryByText('Conteúdo aprovado.')).not.toBeInTheDocument();
  });

  it('trocar de workspace nao deixa a peca do workspace anterior', async () => {
    vi.spyOn(conteudos, 'listarConteudos').mockImplementation(async (_c, id) => ({
      podeEditar: true,
      linhas: [{ ...tela.linhas[0], id: 'k-' + id, nome: id === 'id-alfa' ? 'Peca da Alfa' : 'Peca da Beta' }]
    }));
    abrirDois('estrategista', 'contents');
    expect(await screen.findByText('Peca da Alfa')).toBeInTheDocument();
    await irPara('#/app/beta/contents');
    expect(await screen.findByText('Peca da Beta')).toBeInTheDocument();
    expect(screen.queryByText('Peca da Alfa')).not.toBeInTheDocument();
    expect(screen.queryByText('E-mail T1 · vaga de importação')).not.toBeInTheDocument();
    expect(screen.queryByText('Post: 3 erros na primeira importação')).not.toBeInTheDocument();
  });

});
