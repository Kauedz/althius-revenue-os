// Adaptador entre o banco (Supabase) e o formato de dados que o front v18 lê
// (window.ALTHIUS_DATA e window.ALTHIUS_CAPS). Função pura: fácil de testar.

/** Papel como está no banco. */
export type PapelBanco = 'superadmin' | 'estrategista' | 'clevel' | 'bdr';
/** Papel como o front v18 chama (o C-level ainda é "cliente" no protótipo). */
export type PapelFront = 'superadmin' | 'estrategista' | 'cliente' | 'bdr';
export type Escopo = 'all' | 'assigned' | 'own' | 'read' | 'request' | 'none';

export const PAPEL_FRONT: Record<PapelBanco, PapelFront> = {
  superadmin: 'superadmin',
  estrategista: 'estrategista',
  clevel: 'cliente',
  bdr: 'bdr'
};
const PAPEIS_FRONT: PapelFront[] = ['superadmin', 'estrategista', 'cliente', 'bdr'];
const LETRA_ESCOPO: Record<Escopo, string> = { all: 's', assigned: 'a', own: 'p', read: 'l', request: 'q', none: 'n' };
/** Escopos que liberam a ação direto na tela; "Só o seu", "Só ver" e "Pede" são tratados por tela. */
const LIBERA: Escopo[] = ['all', 'assigned'];

export interface ContextoReal {
  usuario: { id: string; nome: string; email: string; fotoUrl: string | null; superadmin: boolean };
  workspaces: Array<{
    uuid: string;
    slug: string;
    nome: string;
    sigla: string;
    momento: string;
    logoUrl: string | null;
    papel: PapelBanco;
    membroId: string | null;
  }>;
  matriz: Array<{ papel: PapelBanco; chave: string; escopo: Escopo; area: string; nome: string; nota: string }>;
  membros: Record<string, Array<{
    id: string;
    userId: string;
    nome: string;
    email: string;
    papel: PapelBanco;
    status: 'active' | 'invited' | 'suspended';
    cargo: string | null;
    entrouEm: string;
  }>>;
}

interface CapsFront {
  papeis: string[][];
  grupos: Array<{ nome: string; itens: Array<{ k: string; nome: string; v: string[]; nota: string }> }>;
}

export interface MembroFront {
  id: string;
  nome: string;
  email: string;
  papel: PapelFront;
  origem: string;
  dono?: true;
  pendente?: true;
}

/** Iniciais para avatar e workspace: "Aline Xavier" -> "AX". */
export const sigla = (nome: string) =>
  nome.split(/\s+/).filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Demo = Record<string, any>;

export function montarDados(ctx: ContextoReal, demo: Demo, capsDemo: CapsFront) {
  const WORKSPACES = ctx.workspaces.map(w => ({ id: w.slug, nome: w.nome, sigla: w.sigla, momento: w.momento, logoUrl: w.logoUrl }));

  const ROLES = Object.fromEntries(PAPEIS_FRONT.map(p => [p, {
    ...(demo.ROLES?.[p] || { id: p, label: p }),
    usuario: ctx.usuario.nome,
    email: ctx.usuario.email,
    sigla: sigla(ctx.usuario.nome)
  }]));

  const chavesMatriz = new Set(ctx.matriz.map(m => m.chave));
  const PERMS = Object.fromEntries(PAPEIS_FRONT.map(p => {
    const daTela: string[] = (demo.PERMS?.[p] || []).filter((k: string) => !chavesMatriz.has(k));
    const daMatriz = ctx.matriz.filter(m => PAPEL_FRONT[m.papel] === p && LIBERA.includes(m.escopo)).map(m => m.chave);
    return [p, [...daTela, ...daMatriz]];
  }));

  // "O que cada papel pode fazer": mesma ordem de áreas e itens do protótipo; o que for novo vai ao fim.
  const ordemItem = new Map<string, number>();
  const ordemArea = new Map<string, number>();
  capsDemo.grupos.forEach((g, gi) => { ordemArea.set(g.nome, gi); g.itens.forEach((it, ii) => ordemItem.set(it.k, gi * 1000 + ii)); });
  const porChave = new Map<string, { k: string; nome: string; area: string; nota: string; v: string[] }>();
  for (const m of ctx.matriz) {
    const item = porChave.get(m.chave) || { k: m.chave, nome: m.nome, area: m.area, nota: m.nota || '', v: ['n', 'n', 'n', 'n'] };
    item.v[PAPEIS_FRONT.indexOf(PAPEL_FRONT[m.papel])] = LETRA_ESCOPO[m.escopo];
    if (!item.nota && m.nota) item.nota = m.nota;
    porChave.set(m.chave, item);
  }
  const areas = [...new Set([...porChave.values()].map(i => i.area))]
    .sort((a, b) => (ordemArea.get(a) ?? 999) - (ordemArea.get(b) ?? 999));
  const CAPS: CapsFront = {
    papeis: capsDemo.papeis,
    grupos: areas.map(area => ({
      nome: area,
      itens: [...porChave.values()]
        .filter(i => i.area === area)
        .sort((a, b) => (ordemItem.get(a.k) ?? 1e9) - (ordemItem.get(b.k) ?? 1e9))
        .map(({ k, nome, v, nota }) => ({ k, nome, v, nota }))
    }))
  };

  const membros: Record<string, MembroFront[]> = {};
  for (const w of ctx.workspaces) {
    const lista = (ctx.membros[w.slug] || []).filter(m => m.status !== 'suspended');
    const dono = [...lista].filter(m => m.papel === 'clevel' && m.status === 'active')
      .sort((a, b) => a.entrouEm.localeCompare(b.entrouEm))[0];
    membros[w.slug] = lista.map(m => ({
      id: m.id,
      nome: m.nome,
      email: m.email,
      papel: PAPEL_FRONT[m.papel],
      origem: /@althius\.com\.br$/i.test(m.email) ? 'Althius' : w.nome,
      ...(dono && m.id === dono.id ? { dono: true as const } : {}),
      ...(m.status === 'invited' ? { pendente: true as const } : {})
    }));
  }

  const papelNoWorkspace = (slug: string): PapelFront => {
    const w = ctx.workspaces.find(x => x.slug === slug) || ctx.workspaces[0];
    if (!w) return ctx.usuario.superadmin ? 'superadmin' : 'bdr';
    return PAPEL_FRONT[w.papel];
  };

  /** Id interno do workspace (pelo slug da URL) e o id de membro da pessoa logada nele. */
  const workspaceNoBanco = (slug: string) => {
    const w = ctx.workspaces.find(x => x.slug === slug);
    return w ? { uuid: w.uuid, membroId: w.membroId } : null;
  };

  const proprios = { WORKSPACES, ROLES, PERMS, CAPS, membros, papelNoWorkspace, workspaceNoBanco };
  // Campos do protótipo ainda não ligados ao banco (AGENTS, EXECUTIONS...) passam direto.
  return { ...demo, ...proprios } as Demo & typeof proprios;
}

export type DadosAlthius = ReturnType<typeof montarDados>;
