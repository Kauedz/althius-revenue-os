// Contas e leads: base qualificada do workspace no formato que a tela do v18 lê
// (fonte/module.js -> ALTHIUS_MOD.accounts e ALTHIUS_COMITES).
import type { SupabaseClient } from '@supabase/supabase-js';

/** Pessoa do comitê de compras vinculada a uma conta. */
export interface ContatoComiteTela {
  id: string;
  nome: string;
  cargo: string;
  papel: 'decisor' | 'influenciador' | 'campeao';
  foto: string;
  linkedin: string;
  emails: string[];
  fones: string[];
}

/** Conta qualificada no formato consumido pelas telas do front v18. */
export interface ContaTela {
  id: string;
  nome: string;
  segmento: string;
  fit: number;
  temperatura: number;
  sinal: string;
  dono: string;
  cidade: string;
  decisor: string;
  dominio?: string;
  logoUrl?: string | null;
  comite?: ContatoComiteTela[];
}

/** Lista as contas ativas do workspace com responsáveis, decisores e comitê mapeado. */
export async function listarContas(cliente: SupabaseClient, workspaceId: string): Promise<ContaTela[]> {
  const { data, error } = await cliente
    .from('accounts')
    .select('id, name, domain, logo_url, segment, fit, temperature, last_signal_text, owner_member_id, city, state_uf, status')
    .eq('workspace_id', workspaceId)
    .eq('status', 'ativa')
    .order('fit', { ascending: false });

  if (error) throw new Error('Não foi possível carregar as contas e leads.', { cause: error });
  if (!data || !data.length) return [];

  const donoIds = [...new Set(data.map(a => a.owner_member_id).filter(Boolean) as string[])];
  const nomes = await nomesDosMembros(cliente, donoIds);

  const accountIds = data.map(a => a.id);
  const { data: contatosData, error: errContatos } = await cliente
    .from('contacts')
    .select('id, account_id, name, job_title, buying_role, photo_url, linkedin_status')
    .in('account_id', accountIds);

  if (errContatos) throw new Error('Não foi possível carregar os contatos das contas.', { cause: errContatos });

  const contactIds = (contatosData || []).map(c => c.id);
  const { data: canaisData, error: errCanais } = contactIds.length
    ? await cliente
        .from('contact_channels')
        .select('contact_id, type, value, position')
        .in('contact_id', contactIds)
        .order('position', { ascending: true })
    : { data: [], error: null };

  if (errCanais) throw new Error('Não foi possível carregar os canais dos contatos.', { cause: errCanais });

  // Agrupa canais por contato
  const canaisPorContato = new Map<string, { emails: string[]; fones: string[] }>();
  for (const canal of canaisData || []) {
    const atual = canaisPorContato.get(canal.contact_id) || { emails: [], fones: [] };
    if (canal.type === 'email') {
      atual.emails.push(canal.value);
    } else if (canal.type === 'phone' || canal.type === 'whatsapp') {
      atual.fones.push(canal.value);
    }
    canaisPorContato.set(canal.contact_id, atual);
  }

  // Agrupa contatos por conta
  const comitePorConta = new Map<string, ContatoComiteTela[]>();
  for (const c of contatosData || []) {
    const lista = comitePorConta.get(c.account_id) || [];
    const canais = canaisPorContato.get(c.id) || { emails: [], fones: [] };
    lista.push({
      id: c.id,
      nome: c.name,
      cargo: c.job_title || '',
      papel: (c.buying_role || 'influenciador') as 'decisor' | 'influenciador' | 'campeao',
      foto: c.photo_url || '',
      linkedin: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(c.name)}`,
      emails: canais.emails,
      fones: canais.fones
    });
    comitePorConta.set(c.account_id, lista);
  }

  return data.map(a => {
    const comite = comitePorConta.get(a.id) || [];
    const decisorContato = comite.find(p => p.papel === 'decisor');
    const cidadeFormatada = [a.city, a.state_uf].filter(Boolean).join(', ') || '—';

    return {
      id: a.id,
      nome: a.name,
      segmento: a.segment || '—',
      fit: typeof a.fit === 'number' ? a.fit : 0,
      temperatura: typeof a.temperature === 'number' ? a.temperature : 1,
      sinal: a.last_signal_text || '—',
      dono: (a.owner_member_id && nomes.get(a.owner_member_id)) || 'Alguém do time',
      cidade: cidadeFormatada,
      decisor: decisorContato ? decisorContato.nome : 'A mapear',
      dominio: a.domain,
      logoUrl: a.logo_url,
      comite
    };
  });
}

async function nomesDosMembros(cliente: SupabaseClient, membroIds: string[]): Promise<Map<string, string>> {
  if (!membroIds.length) return new Map();
  const { data: membros, error: erroMembros } = await cliente.from('workspace_members').select('id, user_id').in('id', membroIds);
  if (erroMembros) throw new Error('Não foi possível carregar os responsáveis pelas contas.', { cause: erroMembros });
  const userIds = [...new Set((membros || []).map(m => m.user_id))];
  const { data: perfis, error: erroPerfis } = userIds.length
    ? await cliente.from('profiles').select('id, name').in('id', userIds)
    : { data: [] as Array<{ id: string; name: string }>, error: null };
  if (erroPerfis) throw new Error('Não foi possível carregar os responsáveis pelas contas.', { cause: erroPerfis });
  const nomePorUser = new Map((perfis || []).map(p => [p.id, p.name]));
  return new Map((membros || []).map(m => [m.id, nomePorUser.get(m.user_id) || '']));
}

export interface NovaContaInput {
  nome: string;
  dominio: string;
  uf?: string;
  cidade?: string;
  temperatura?: number;
  donoMembroId?: string;
}

export interface EditarContaInput {
  id: string;
  nome?: string;
  dominio?: string;
  uf?: string;
  cidade?: string;
  temperatura?: number;
  donoMembroId?: string;
}

export interface ContaImportacaoItem {
  name: string;
  domain: string;
  state_uf?: string;
  city?: string;
}

export interface ResultadoImportacao {
  total: number;
  criadas: number;
  duplicadas: number;
}

export async function criarConta(
  cliente: SupabaseClient,
  workspaceId: string,
  membroId: string,
  dados: NovaContaInput
): Promise<{ id: string; nome: string; dominio: string }> {
  const { data, error } = await cliente.rpc('create_account', {
    p_workspace_id: workspaceId,
    p_member_id: membroId,
    p_name: dados.nome,
    p_domain: dados.dominio,
    p_state_uf: dados.uf ?? null,
    p_city: dados.cidade ?? null,
    p_temperature: dados.temperatura ?? 1,
    p_owner_member_id: dados.donoMembroId ?? null
  });

  if (error || !data) {
    throw new Error('Não foi possível criar a conta.', { cause: error });
  }

  return {
    id: data.id,
    nome: data.name,
    dominio: data.domain
  };
}

export async function editarConta(
  cliente: SupabaseClient,
  membroId: string,
  dados: EditarContaInput
): Promise<{ id: string; nome: string; dominio: string }> {
  const { data, error } = await cliente.rpc('update_account', {
    p_account_id: dados.id,
    p_member_id: membroId,
    p_name: dados.nome ?? null,
    p_domain: dados.dominio ?? null,
    p_state_uf: dados.uf ?? null,
    p_city: dados.cidade ?? null,
    p_temperature: dados.temperatura ?? null,
    p_owner_member_id: dados.donoMembroId ?? null
  });

  if (error || !data) {
    throw new Error('Não foi possível atualizar a conta.', { cause: error });
  }

  return {
    id: data.id,
    nome: data.name,
    dominio: data.domain
  };
}

export async function importarContas(
  cliente: SupabaseClient,
  workspaceId: string,
  membroId: string,
  contas: ContaImportacaoItem[]
): Promise<ResultadoImportacao> {
  const { data, error } = await cliente.rpc('import_accounts', {
    p_workspace_id: workspaceId,
    p_member_id: membroId,
    p_contas: contas
  });

  if (error || !data) {
    throw new Error('Não foi possível importar as contas.', { cause: error });
  }

  return data as ResultadoImportacao;
}
