// Carrega do banco o que a pessoa logada enxerga: perfil, workspaces (com o papel em cada um),
// matriz de capacidades e membros. Toda a filtragem por permissão é feita pela RLS do banco;
// aqui só montamos o retrato. Erros sobem com mensagem clara (nada de dado inventado).
import type { SupabaseClient } from '@supabase/supabase-js';
import { sigla, type ContextoReal, type Escopo, type PapelBanco } from './dados';

/** Falha de leitura: o detalhe técnico vai para o console; a pessoa vê uma mensagem compreensível. */
function exigir<T>(resp: { data: T | null; error: { message: string } | null }, oQue: string): T {
  if (resp.error || resp.data === null) {
    if (resp.error) console.error('[carregarContexto] ' + oQue + ':', resp.error);
    throw new Error(`Não foi possível carregar ${oQue}. Tente de novo em instantes.`);
  }
  return resp.data;
}

export async function carregarContexto(cliente: SupabaseClient): Promise<ContextoReal> {
  const { data: auth } = await cliente.auth.getUser();
  if (!auth.user) throw new Error('Sessão expirada. Entre novamente.');
  const uid = auth.user.id;

  const [perfil, superadmin, minhas, workspaces, matriz] = await Promise.all([
    cliente.from('profiles').select('name, email, avatar_url').eq('id', uid).maybeSingle(),
    cliente.rpc('is_superadmin'),
    cliente.from('workspace_members').select('id, workspace_id, role').eq('user_id', uid).eq('status', 'active'),
    cliente.from('workspaces').select('id, name, slug, settings_json, logo_url, created_at').eq('status', 'active')
      .order('created_at').order('name'),
    cliente.from('role_permissions').select('role_id, capability_key, scope, area, capability_name, note')
  ]);

  const p = exigir(perfil, 'seu perfil') as { name: string; email: string; avatar_url: string | null };
  const ehSuperadmin = Boolean(exigir(superadmin, 'seu papel'));
  const minhasLinhas = exigir(minhas, 'seus workspaces') as Array<{ id: string; workspace_id: string; role: PapelBanco }>;
  const wsLinhas = exigir(workspaces, 'os workspaces') as Array<{
    id: string; name: string; slug: string; settings_json: Record<string, string> | null; logo_url: string | null;
  }>;
  const matrizLinhas = exigir(matriz, 'as permissões') as Array<{
    role_id: PapelBanco; capability_key: string; scope: Escopo; area: string; capability_name: string; note: string | null;
  }>;

  const minhaPorWs = new Map(minhasLinhas.map(m => [m.workspace_id, m]));
  const visiveis = wsLinhas.filter(w => minhaPorWs.has(w.id) || ehSuperadmin);

  const idsWs = visiveis.map(w => w.id);
  const membrosLinhas = idsWs.length
    ? exigir(await cliente.from('workspace_members')
        .select('id, workspace_id, user_id, role, status, job_title, joined_at')
        .in('workspace_id', idsWs).order('joined_at'), 'os membros') as Array<{
          id: string; workspace_id: string; user_id: string; role: PapelBanco;
          status: 'active' | 'invited' | 'suspended'; job_title: string | null; joined_at: string;
        }>
    : [];
  const idsPessoas = [...new Set(membrosLinhas.map(m => m.user_id))];
  const perfis = idsPessoas.length
    ? exigir(await cliente.from('profiles').select('id, name, email').in('id', idsPessoas), 'os perfis') as Array<{ id: string; name: string; email: string }>
    : [];
  const perfilPorId = new Map(perfis.map(x => [x.id, x]));

  const slugPorId = new Map(visiveis.map(w => [w.id, w.slug]));
  const membros: ContextoReal['membros'] = Object.fromEntries(visiveis.map(w => [w.slug, []]));
  for (const m of membrosLinhas) {
    const pf = perfilPorId.get(m.user_id);
    membros[slugPorId.get(m.workspace_id)!].push({
      id: m.id,
      userId: m.user_id,
      nome: pf?.name || pf?.email || 'Pessoa sem nome',
      email: pf?.email || '',
      papel: m.role,
      status: m.status,
      cargo: m.job_title,
      entrouEm: m.joined_at
    });
  }

  return {
    usuario: { id: uid, nome: p.name || p.email, email: p.email, fotoUrl: p.avatar_url, superadmin: ehSuperadmin },
    workspaces: visiveis.map(w => {
      const minha = minhaPorWs.get(w.id);
      const cfg = w.settings_json || {};
      return {
        uuid: w.id,
        slug: w.slug,
        nome: w.name,
        sigla: cfg.sigla || sigla(w.name),
        momento: cfg.momento || '',
        logoUrl: w.logo_url,
        papel: minha ? minha.role : 'superadmin',
        membroId: minha ? minha.id : null
      };
    }),
    matriz: matrizLinhas.map(r => ({
      papel: r.role_id, chave: r.capability_key, escopo: r.scope, area: r.area, nome: r.capability_name, nota: r.note || ''
    })),
    membros
  };
}
