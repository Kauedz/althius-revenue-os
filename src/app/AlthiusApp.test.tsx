// Seam: o app no modo real montado com um contexto do banco (sem rede).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { AlthiusApp } from './AlthiusApp';
import { montarDados, type ContextoReal, type PapelBanco } from './dados';
import { clienteVazio } from '../test/supabaseLocal';
import * as execucoes from './servicos/execucoes';
import * as contasServico from './servicos/contas';
import * as relatoriosServico from './servicos/relatorios';
import * as agentesServico from './servicos/agentes';

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
// No banco real todo workspace tem os 4 agentes (migration 0082); aqui o cliente é vazio, então simulamos os 4,
// com a mesma demora de rede que o protótipo usava (a carga do workspace não é instantânea na vida real).
beforeEach(() => {
  vi.spyOn(agentesServico, 'listarAgentes').mockImplementation((_c, _ws, base) =>
    new Promise(ok => setTimeout(() => ok(base as agentesServico.AgenteTela[]), 380)));
});
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
      ultimoContato: 'há 2 dias · E-mail · mensagem nossa',
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
    id: 'c-' + ws, nome: 'Conta ' + ws, segmento: 'Varejo', fit: 80, temperatura: 2, sinal: '—', dono: 'Pessoa Teste', cidade: '—', decisor: 'Contato ' + ws, ultimoContato: 'Sem contato ainda',
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

  it('a tela de contas ganha a coluna "Último contato" depois do último sinal, uma vez só', async () => {
    vi.spyOn(contasServico, 'listarContas').mockResolvedValue([contaDe('alfa')]);
    abrir(contexto([['alfa', 'clevel']]), '#/app/alfa/accounts');
    await waitFor(() => expect((window as any).ALTHIUS_COMITES['c-alfa']).toBeDefined());
    const chaves = (window as any).ALTHIUS_MOD.accounts.colunas.map((c: string[]) => c[0]);
    expect(chaves.indexOf('ultimoContato')).toBe(chaves.indexOf('sinal') + 1);
    expect(chaves.filter((k: string) => k === 'ultimoContato')).toHaveLength(1);
    expect((window as any).ALTHIUS_MOD.accounts.linhas[0].ultimoContato).toBe('Sem contato ainda');
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

describe('enriquecimento de contas na tela (ADR 0062)', () => {
  const FOTO = 'https://media.licdn.com/dms/image/ana-lima.jpg';
  const base = (id: string, nome: string, extra: Partial<contasServico.ContaTela> = {}): contasServico.ContaTela => ({
    id, nome, segmento: 'Varejo', fit: 80, temperatura: 2, sinal: '—', dono: 'Pessoa Teste', cidade: '—', decisor: 'A mapear', ultimoContato: 'Sem contato ainda', comite: [], ...extra
  });
  const pin = (nome: string) => screen.findByRole('button', { name: new RegExp('^' + nome) });

  it('a foto do contato (endereço https vindo do banco) fica disponível para a tela', async () => {
    const conta = base('c-foto', 'Conta com Foto', {
      decisor: 'Ana Lima',
      comite: [{ id: 'p1', nome: 'Ana Lima', cargo: 'Diretora', papel: 'decisor', foto: FOTO, linkedin: '', emails: [], fones: [] }]
    });
    vi.spyOn(contasServico, 'listarContas').mockResolvedValue([conta]);
    abrir(contexto([['alfa', 'clevel']]), '#/app/alfa/accounts');
    await waitFor(() => expect((window as any).ALTHIUS_COMITES['c-foto']).toBeDefined());
    expect((window as any).ALTHIUS_FOTOS[FOTO]).toBe(FOTO);
    // As fotos de demonstração continuam lá.
    expect(Object.keys((window as any).ALTHIUS_FOTOS).length).toBeGreaterThan(1);
  });

  it('ao sair, a foto do contato do cliente some da memória do navegador', async () => {
    const conta = base('c-sai', 'Conta que Sai', {
      comite: [{ id: 'p3', nome: 'Ana Lima', cargo: 'Diretora', papel: 'decisor', foto: FOTO, linkedin: '', emails: [], fones: [] }]
    });
    vi.spyOn(contasServico, 'listarContas').mockResolvedValue([conta]);
    abrir(contexto([['alfa', 'clevel']]), '#/app/alfa/accounts');
    await waitFor(() => expect((window as any).ALTHIUS_FOTOS[FOTO]).toBe(FOTO));
    cleanup();
    expect((window as any).ALTHIUS_FOTOS[FOTO]).toBeUndefined();
  });

  it('foto que não é endereço https não vira entrada em ALTHIUS_FOTOS', async () => {
    const conta = base('c-js', 'Conta Foto Estranha', {
      comite: [{ id: 'p2', nome: 'Beto', cargo: 'Diretor', papel: 'decisor', foto: 'javascript:alert(1)', linkedin: '', emails: [], fones: [] }]
    });
    vi.spyOn(contasServico, 'listarContas').mockResolvedValue([conta]);
    abrir(contexto([['alfa', 'clevel']]), '#/app/alfa/accounts');
    await waitFor(() => expect((window as any).ALTHIUS_COMITES['c-js']).toBeDefined());
    expect((window as any).ALTHIUS_FOTOS['javascript:alert(1)']).toBeUndefined();
  });

  it('mapa do Início: coordenada vira pin exato, só o estado vira pin aproximado e sem nada vai para "Sem localização"', async () => {
    vi.spyOn(contasServico, 'listarContas').mockResolvedValue([
      base('c-exata', 'Conta Exata', { cidade: 'Campinas, SP', uf: 'SP', geo: { lat: -22.9, lng: -47.06, aprox: false } }),
      base('c-uf', 'Conta Só Estado', { cidade: 'Curitiba, PR', uf: 'PR', geo: null }),
      base('c-nada', 'Conta Sem Nada')
    ]);
    abrir(contexto([['alfa', 'clevel']]), '#/app/alfa/home');
    const exata = await pin('Conta Exata');
    expect(exata).toHaveAttribute('data-aprox', 'false');
    expect(exata).toHaveAttribute('data-semlocal', 'false');
    const aprox = await pin('Conta Só Estado');
    expect(aprox).toHaveAttribute('data-aprox', 'true');
    // A conta sem nada não tem pin próprio: está só no marcador "Sem localização".
    expect(screen.queryByRole('button', { name: /^Conta Sem Nada/ })).not.toBeInTheDocument();
    const sem = await pin('Sem localização');
    expect(sem).toHaveAttribute('data-semlocal', 'true');
    expect(sem).toHaveAccessibleName(/1 conta\./);
  });

  it('clicar em "Sem localização" lista as contas sem endereço', async () => {
    vi.spyOn(contasServico, 'listarContas').mockResolvedValue([
      base('c-exata', 'Conta Exata', { cidade: 'Campinas, SP', uf: 'SP', geo: { lat: -22.9, lng: -47.06, aprox: false } }),
      base('c-nada', 'Conta Sem Nada')
    ]);
    abrir(contexto([['alfa', 'clevel']]), '#/app/alfa/home');
    const sem = await pin('Sem localização');
    expect(screen.queryByText('Conta Sem Nada')).not.toBeInTheDocument();
    fireEvent.click(sem);
    expect(await screen.findByText('Conta Sem Nada')).toBeInTheDocument();
    // O painel é o de "Sem localização" (1 conta), não o de um estado.
    expect(screen.getByText('1 conta · região sem endereço')).toBeInTheDocument();
  });

  it('o marcador "Sem localização" não promete abrir uma conta e a lista não fala de "SL"', async () => {
    vi.spyOn(contasServico, 'listarContas').mockResolvedValue([base('c-nada', 'Conta Sem Nada')]);
    abrir(contexto([['alfa', 'clevel']]), '#/app/alfa/home');
    const sem = await pin('Sem localização');
    expect(within(sem).queryByText('Abrir conta e comitê')).not.toBeInTheDocument();
    expect(within(sem).getByText('Ver quais contas')).toBeInTheDocument();
    fireEvent.click(sem);
    expect(await screen.findByRole('button', { name: 'Ver a conta em Contas e leads' })).toBeInTheDocument();
    expect(screen.queryByText(/de SL/)).not.toBeInTheDocument();
  });

  it('todas as contas com endereço: nenhum marcador "Sem localização"', async () => {
    vi.spyOn(contasServico, 'listarContas').mockResolvedValue([
      base('c-exata', 'Conta Exata', { cidade: 'Campinas, SP', uf: 'SP', geo: { lat: -22.9, lng: -47.06, aprox: false } })
    ]);
    abrir(contexto([['alfa', 'clevel']]), '#/app/alfa/home');
    await pin('Conta Exata');
    expect(screen.queryByRole('button', { name: /^Sem localização/ })).not.toBeInTheDocument();
  });

  it('pessoa achada pelo enriquecimento sem e-mail nem telefone não mostra "undefined" no comitê', async () => {
    const conta = base('c-sem-canal', 'Conta Sem Canal', {
      decisor: 'Ana Lima',
      comite: [{ id: 'p4', nome: 'Ana Lima', cargo: 'Diretora', papel: 'decisor', foto: '', linkedin: '', emails: [], fones: [] }]
    });
    vi.spyOn(contasServico, 'listarContas').mockResolvedValue([conta]);
    abrir(contexto([['alfa', 'clevel']]), '#/app/alfa/accounts');
    fireEvent.click(await screen.findByText('Conta Sem Canal'));
    expect(await screen.findByText('Diretora')).toBeInTheDocument();
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
    expect(screen.getByText('Sem e-mail nem telefone ainda')).toBeInTheDocument();
  });

  it('pessoa com só o e-mail mostra só o e-mail no comitê', async () => {
    const conta = base('c-so-email', 'Conta Só Email', {
      decisor: 'Ana Lima',
      comite: [{ id: 'p5', nome: 'Ana Lima', cargo: 'Diretora', papel: 'decisor', foto: '', linkedin: '', emails: ['ana@cliente.com.br'], fones: [] }]
    });
    vi.spyOn(contasServico, 'listarContas').mockResolvedValue([conta]);
    abrir(contexto([['alfa', 'clevel']]), '#/app/alfa/accounts');
    fireEvent.click(await screen.findByText('Conta Só Email'));
    expect(await screen.findByText('ana@cliente.com.br')).toBeInTheDocument();
  });

  it('salvar o site da conta grava o domínio no banco (update_account)', async () => {
    vi.spyOn(contasServico, 'listarContas').mockResolvedValue([base('c-site', 'Conta do Site')]);
    const editar = vi.spyOn(contasServico, 'editarConta').mockResolvedValue({ id: 'c-site', nome: 'Conta do Site', dominio: 'contadosite.com.br' });
    abrir(contexto([['alfa', 'clevel']]), '#/app/alfa/accounts');
    fireEvent.click(await screen.findByText('Conta do Site'));
    fireEvent.click(await screen.findByRole('button', { name: /Adicionar site e puxar o logo/ }));
    fireEvent.change(await screen.findByLabelText('Site da empresa'), { target: { value: 'https://www.contadosite.com.br/' } });
    fireEvent.click(screen.getByRole('button', { name: 'Puxar logo' }));
    await waitFor(() => expect(editar).toHaveBeenCalledWith(expect.anything(), 'm-alfa', { id: 'c-site', dominio: 'contadosite.com.br' }));
  });
});

describe('relatórios no AlthiusApp', () => {
  it('não mostra os números fictícios do protótipo', async () => {
    const relatorio = relatoriosServico.relatorioSemDados();
    relatorio.kpis[0] = { label: 'Pipeline em aberto', valor: 'R$ 0,00', delta: 'negócios ativos' };
    const spy = vi.spyOn(relatoriosServico, 'listarRelatorios').mockResolvedValue(relatorio);
    abrir(contexto([['alfa', 'clevel']]), '#/app/alfa/analytics');
    await waitFor(() => expect(spy).toHaveBeenCalledWith(expect.anything(), 'id-alfa'));
    expect(await screen.findByRole('heading', { name: 'Relatórios' })).toBeInTheDocument();
    expect((await screen.findAllByText('Sem dados ainda')).length).toBeGreaterThan(0);
    expect(screen.queryByText(/4,8/)).not.toBeInTheDocument();
    expect(screen.queryByText(/US\$/)).not.toBeInTheDocument();
    expect(screen.queryByText('512')).not.toBeInTheDocument();
  });
});
