// Seam: montarDados(contexto do banco, dados do protótipo) -> objeto no formato que o front v18 lê.
import { describe, expect, it } from 'vitest';
import { montarDados, sigla, type ContextoReal } from './dados';

const demo = {
  ROLES: {
    superadmin: { id: 'superadmin', label: 'Superadmin', usuario: 'Rafael Nunes', email: 'rafael@althius.com.br', sigla: 'RN' },
    estrategista: { id: 'estrategista', label: 'Estrategista', usuario: 'Camila Duarte', email: 'camila@althius.com.br', sigla: 'CD' },
    cliente: { id: 'cliente', label: 'C-level', usuario: 'Aline Xavier', email: 'aline@evolut.com.br', sigla: 'AX' },
    bdr: { id: 'bdr', label: 'BDR/SDR', usuario: 'Lucas Teixeira', email: 'lucas@evolut.com.br', sigla: 'LT' }
  },
  PERMS: {
    superadmin: ['home', 'credits', 'ws.switch', 'copilot', 'admin'],
    estrategista: ['home', 'credits', 'ws.switch', 'copilot', 'providers.view'],
    cliente: ['home', 'credits', 'copilot', 'agents.request'],
    bdr: ['home', 'tasks', 'copilot']
  },
  WORKSPACES: [{ id: 'evolut', nome: 'Evolut Trading', sigla: 'EV', momento: 'Execução' }],
  AGENTS: [{ id: 'comercial' }]
};

const capsDemo = {
  papeis: [['superadmin', 'Superadmin'], ['estrategista', 'Estrategista'], ['cliente', 'C-level'], ['bdr', 'BDR/SDR']],
  grupos: [{ nome: 'Workspace', itens: [{ k: 'ws.switch', nome: 'Trocar de workspace', v: ['s', 'a', 'n', 'n'], nota: '' }] }]
};

const matriz = (chave: string, escopos: [string, string, string, string]): ContextoReal['matriz'] =>
  (['superadmin', 'estrategista', 'clevel', 'bdr'] as const).map((papel, i) => ({
    papel, chave, escopo: escopos[i] as ContextoReal['matriz'][number]['escopo'], area: 'Workspace', nome: 'Nome ' + chave, nota: ''
  }));

const contexto: ContextoReal = {
  usuario: { id: 'u-aline', nome: 'Aline Xavier', email: 'aline@evolut.com.br', fotoUrl: null, superadmin: false },
  workspaces: [
    { uuid: 'ws-1', slug: 'evolut', nome: 'Evolut Trading', sigla: 'EV', momento: 'Execução', logoUrl: null, papel: 'clevel', membroId: 'm-aline' },
    { uuid: 'ws-2', slug: 'grao', nome: 'Grão Norte Alimentos', sigla: 'GN', momento: 'Preparação', logoUrl: 'https://x/logo.png', papel: 'bdr', membroId: 'm-2' }
  ],
  matriz: [
    ...matriz('ws.switch', ['all', 'assigned', 'none', 'none']),
    ...matriz('credits.buy', ['all', 'request', 'all', 'none']),
    ...matriz('accounts.edit', ['all', 'all', 'all', 'own'])
  ],
  membros: {
    evolut: [
      { id: 'm-aline', userId: 'u-aline', nome: 'Aline Xavier', email: 'aline@evolut.com.br', papel: 'clevel', status: 'active', cargo: 'Diretora', entrouEm: '2026-09-01' },
      { id: 'm-camila', userId: 'u-camila', nome: 'Camila Duarte', email: 'camila@althius.com.br', papel: 'estrategista', status: 'active', cargo: null, entrouEm: '2026-09-02' },
      { id: 'm-paula', userId: 'u-paula', nome: 'Paula Gomes', email: 'paula@evolut.com.br', papel: 'bdr', status: 'invited', cargo: null, entrouEm: '2026-09-03' }
    ]
  }
};

describe('montarDados', () => {
  const D = montarDados(contexto, demo, capsDemo);

  it('Conteúdos e Equipe e acessos saem do modo real: são protótipo fixo, sem banco (a equipe real fica em Configurações)', () => {
    const comPaginas = { ...demo, PERMS: Object.fromEntries(Object.entries(demo.PERMS).map(([p, ks]) => [p, [...ks, 'contents', 'team', 'strategy']])),
      NAV: [{ secao: 'Operação', itens: [['agents', 'Agentes', 'AG'], ['contents', 'Conteúdos', 'CO']] }, { secao: 'Plataforma', itens: [['team', 'Equipe e acessos', 'EQ'], ['settings', 'Configurações', 'CF']] }] };
    const R = montarDados(contexto, comPaginas, capsDemo) as unknown as { PERMS: Record<string, string[]>; NAV: Array<{ secao: string; itens: string[][] }> };
    for (const [papel, ks] of Object.entries(R.PERMS)) {
      expect(ks, papel).not.toContain('contents');
      expect(ks, papel).not.toContain('team');
      expect(ks, papel).toContain('strategy');
    }
    expect(R.NAV.flatMap(s => s.itens.map(i => i[0]))).toEqual(['agents', 'settings']);
  });

  it('workspaces vêm do banco, identificados pelo slug que vai na URL', () => {
    expect(D.WORKSPACES).toEqual([
      { id: 'evolut', nome: 'Evolut Trading', sigla: 'EV', momento: 'Execução', logoUrl: null },
      { id: 'grao', nome: 'Grão Norte Alimentos', sigla: 'GN', momento: 'Preparação', logoUrl: 'https://x/logo.png' }
    ]);
  });

  it('o usuário logado aparece em todos os papéis (não há troca de papel fora da demonstração)', () => {
    for (const papel of ['superadmin', 'estrategista', 'cliente', 'bdr']) {
      expect(D.ROLES[papel]).toMatchObject({ usuario: 'Aline Xavier', email: 'aline@evolut.com.br', sigla: 'AX' });
    }
    expect(D.ROLES.cliente.label).toBe('C-level');
  });

  it('capacidade com escopo "Sim" ou "Atribuídos" libera a ação; os demais escopos não', () => {
    expect(D.PERMS.superadmin).toContain('ws.switch');
    expect(D.PERMS.estrategista).toContain('ws.switch');
    expect(D.PERMS.cliente).not.toContain('ws.switch');
    expect(D.PERMS.cliente).toContain('credits.buy');
    expect(D.PERMS.estrategista).not.toContain('credits.buy'); // "Pede"
    expect(D.PERMS.bdr).not.toContain('accounts.edit'); // "Só o seu" é tratado tela a tela
  });

  it('páginas e chaves só de tela continuam vindo do protótipo, sem as capacidades da matriz antiga', () => {
    expect(D.PERMS.cliente).toEqual(expect.arrayContaining(['home', 'credits', 'copilot', 'agents.request']));
    expect(D.PERMS.bdr).toEqual(expect.arrayContaining(['home', 'tasks', 'copilot']));
  });

  it('a matriz "O que cada papel pode fazer" é montada a partir do banco', () => {
    const C = D.CAPS;
    expect(C.papeis).toEqual(capsDemo.papeis);
    const itens = C.grupos.flatMap(g => g.itens);
    expect(itens.find(i => i.k === 'credits.buy')).toMatchObject({ nome: 'Nome credits.buy', v: ['s', 'q', 's', 'n'] });
    expect(itens.find(i => i.k === 'accounts.edit')?.v).toEqual(['s', 's', 's', 'p']);
  });

  it('membros vêm do banco com papel do front, origem e convite pendente', () => {
    expect(D.membros.evolut).toEqual([
      { id: 'm-aline', nome: 'Aline Xavier', email: 'aline@evolut.com.br', papel: 'cliente', origem: 'Evolut Trading', dono: true },
      { id: 'm-camila', nome: 'Camila Duarte', email: 'camila@althius.com.br', papel: 'estrategista', origem: 'Althius' },
      { id: 'm-paula', nome: 'Paula Gomes', email: 'paula@evolut.com.br', papel: 'bdr', origem: 'Evolut Trading', pendente: true }
    ]);
  });

  it('o papel por workspace vem da associação do usuário', () => {
    expect(D.papelNoWorkspace('evolut')).toBe('cliente');
    expect(D.papelNoWorkspace('grao')).toBe('bdr');
  });

  it('dados ainda não ligados ao banco seguem do protótipo', () => {
    expect(D.AGENTS).toBe(demo.AGENTS);
  });
});

describe('sigla', () => {
  it('usa até duas iniciais e ignora espaços', () => {
    expect(sigla('Aline Xavier')).toBe('AX');
    expect(sigla('  rafael   nunes  silva')).toBe('RN');
    expect(sigla('Bruna')).toBe('B');
    expect(sigla('   ')).toBe('');
  });
});

describe('montarDados em papéis e bordas', () => {
  const base = contexto;

  it('slug desconhecido usa o papel do primeiro workspace', () => {
    const D = montarDados(base, demo, capsDemo);
    expect(D.papelNoWorkspace('nao-existe')).toBe('cliente');
  });

  it('sem workspace, superadmin continua superadmin e os demais caem em BDR', () => {
    const sem = { ...base, workspaces: [] as ContextoReal['workspaces'] };
    expect(montarDados({ ...sem, usuario: { ...base.usuario, superadmin: true } }, demo, capsDemo).papelNoWorkspace('evolut')).toBe('superadmin');
    expect(montarDados(sem, demo, capsDemo).papelNoWorkspace('evolut')).toBe('bdr');
  });

  it('workspace no banco devolve o id interno ou nada', () => {
    const D = montarDados(base, demo, capsDemo);
    expect(D.workspaceNoBanco('evolut')).toEqual({ uuid: 'ws-1', membroId: 'm-aline' });
    expect(D.workspaceNoBanco('sumiu')).toBeNull();
  });

  it('membro suspenso some; o dono é o C-level ativo mais antigo, não o convite', () => {
    const ctx: ContextoReal = {
      ...base,
      membros: {
        evolut: [
          { id: 'm-convite', userId: 'u-c', nome: 'Convidado C', email: 'c@evolut.com.br', papel: 'clevel', status: 'invited', cargo: null, entrouEm: '2026-01-01' },
          { id: 'm-suspenso', userId: 'u-s', nome: 'Suspenso', email: 's@evolut.com.br', papel: 'bdr', status: 'suspended', cargo: null, entrouEm: '2026-01-02' },
          { id: 'm-novo', userId: 'u-n', nome: 'Novo C', email: 'n@evolut.com.br', papel: 'clevel', status: 'active', cargo: null, entrouEm: '2026-09-10' },
          { id: 'm-aline', userId: 'u-aline', nome: 'Aline Xavier', email: 'aline@evolut.com.br', papel: 'clevel', status: 'active', cargo: null, entrouEm: '2026-09-01' }
        ],
        grao: []
      }
    };
    const lista = montarDados(ctx, demo, capsDemo).membros.evolut;
    expect(lista.map(m => m.id)).toEqual(['m-convite', 'm-novo', 'm-aline']);
    expect(lista.find(m => m.id === 'm-aline')).toMatchObject({ dono: true, papel: 'cliente' });
    expect(lista.find(m => m.id === 'm-novo')).not.toHaveProperty('dono');
    expect(lista.find(m => m.id === 'm-convite')).toMatchObject({ pendente: true });
    expect(lista.find(m => m.id === 'm-convite')).not.toHaveProperty('dono');
    expect(montarDados(ctx, demo, capsDemo).membros.grao).toEqual([]);
  });

  it('escopo só ver vira a letra da matriz e área nova vai para o fim', () => {
    const ctx: ContextoReal = {
      ...base,
      matriz: [
        ...base.matriz,
        { papel: 'superadmin', chave: 'credits.policy', escopo: 'all', area: 'Dinheiro', nome: 'Regras', nota: 'Quem paga.' },
        { papel: 'estrategista', chave: 'credits.policy', escopo: 'read', area: 'Dinheiro', nome: 'Regras', nota: '' },
        { papel: 'clevel', chave: 'credits.policy', escopo: 'all', area: 'Dinheiro', nome: 'Regras', nota: '' },
        { papel: 'bdr', chave: 'credits.policy', escopo: 'none', area: 'Dinheiro', nome: 'Regras', nota: '' }
      ]
    };
    const grupos = montarDados(ctx, demo, capsDemo).CAPS.grupos;
    expect(grupos.map(g => g.nome)).toEqual(['Workspace', 'Dinheiro']);
    expect(grupos[1].itens[0]).toMatchObject({ k: 'credits.policy', v: ['s', 'l', 's', 'n'], nota: 'Quem paga.' });
  });

  it('papel sem ficha no protótipo ainda aparece com o nome de quem está logado', () => {
    const semBdr = { ...demo, ROLES: { superadmin: demo.ROLES.superadmin, estrategista: demo.ROLES.estrategista, cliente: demo.ROLES.cliente } };
    expect(montarDados(base, semBdr, capsDemo).ROLES.bdr).toMatchObject({ id: 'bdr', label: 'bdr', usuario: 'Aline Xavier', sigla: 'AX' });
  });
});