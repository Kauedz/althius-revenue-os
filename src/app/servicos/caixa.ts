// Caixa de entrada: só conversas com contatos do CRM (o filtro fica no banco, na chegada da mensagem).
// A RLS decide quem vê o quê: BDR só a própria conexão; C-level, estrategista e superadmin leem.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ConversaTela {
  id: string;
  de: string;
  assunto: string;
  canal: string;
  intencao: string;
  quando: string;
  conta: string;
}

export interface CaixaTela {
  kpis: Array<[rotulo: string, valor: string, detalhe: string]>;
  linhas: ConversaTela[];
}

const CANAL: Record<string, string> = { email: 'E-mail', linkedin: 'LinkedIn', whatsapp: 'WhatsApp', instagram: 'Instagram' };
const INTENCAO: Record<string, string> = {
  positiva: 'Positiva', adiar: 'Adiar', objecao: 'Objeção', neutra: 'Neutra', opt_out: 'Opt-out', automatica: 'Automática'
};
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const dd = (n: number) => String(n).padStart(2, '0');

export function formatarQuando(iso: string, agora = new Date()): string {
  const d = new Date(iso);
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dias = Math.round((dia(agora) - dia(d)) / 86_400_000);
  if (dias <= 0) return dd(d.getHours()) + ':' + dd(d.getMinutes());
  if (dias === 1) return 'Ontem';
  if (dias < 7) return DIAS[d.getDay()];
  return dd(d.getDate()) + ' ' + MESES[d.getMonth()];
}

function tempoMedioDeResposta(mensagens: Array<{ conversation_id: string; direction: string; created_at: string }>): string {
  // Para cada mensagem recebida, o tempo até a primeira resposta enviada depois dela na mesma conversa.
  const esperas: number[] = [];
  const pendente = new Map<string, number>();
  for (const m of mensagens) {
    const t = new Date(m.created_at).getTime();
    if (m.direction === 'in') { if (!pendente.has(m.conversation_id)) pendente.set(m.conversation_id, t); }
    else if (pendente.has(m.conversation_id)) { esperas.push(t - pendente.get(m.conversation_id)!); pendente.delete(m.conversation_id); }
  }
  if (!esperas.length) return '—';
  const minutos = Math.round(esperas.reduce((s, e) => s + e, 0) / esperas.length / 60_000);
  return minutos < 60 ? `${minutos} min` : `${Math.round(minutos / 60)} h`;
}

export async function listarCaixa(cliente: SupabaseClient, workspaceId: string, agora = new Date()): Promise<CaixaTela> {
  const { data: conversas, error } = await cliente
    .from('conversations')
    .select('id, channel, intent, unread, last_message_at, contact:contacts(name), account:accounts(name)')
    .eq('workspace_id', workspaceId)
    .order('last_message_at', { ascending: false });
  if (error) throw new Error('Não foi possível carregar a caixa de entrada.', { cause: error });
  const ids = (conversas || []).map(c => c.id);
  const { data: mensagens, error: erroMensagens } = ids.length
    ? await cliente.from('messages').select('conversation_id, direction, text, created_at').in('conversation_id', ids).order('created_at')
    : { data: [] as Array<{ conversation_id: string; direction: string; text: string; created_at: string }>, error: null };
  if (erroMensagens) throw new Error('Não foi possível carregar as mensagens.', { cause: erroMensagens });

  const ultimaRecebida = new Map<string, string>();
  for (const m of mensagens || []) if (m.direction === 'in') ultimaRecebida.set(m.conversation_id, m.text);
  const semana = agora.getTime() - 7 * 86_400_000;
  const lista = conversas || [];
  const nome = (x: unknown) => (x as { name?: string } | null)?.name || '—';

  return {
    kpis: [
      ['Não lidas', String(lista.filter(c => c.unread).length), ''],
      ['Positivas', String(lista.filter(c => c.intent === 'positiva' && new Date(c.last_message_at).getTime() >= semana).length), 'na semana'],
      ['Objeções', String(lista.filter(c => c.intent === 'objecao').length), ''],
      ['Tempo de resposta', tempoMedioDeResposta(mensagens || []), 'média']
    ],
    linhas: lista.map(c => ({
      id: c.id,
      de: nome(c.contact),
      assunto: ultimaRecebida.get(c.id) || '—',
      canal: CANAL[c.channel] || c.channel,
      intencao: INTENCAO[c.intent || 'neutra'] || 'Neutra',
      quando: formatarQuando(c.last_message_at, agora),
      conta: nome(c.account)
    }))
  };
}

export type ResultadoCaixa = { ok: true } | { ok: false; mensagem: string };

async function chamar(cliente: SupabaseClient, funcao: string, workspaceId: string, membroId: string, conversaId: string, falha: string) {
  const { data, error } = await cliente.rpc(funcao, { p_workspace_id: workspaceId, p_member_id: membroId, p_conversation_id: conversaId });
  if (error) {
    console.error('[' + funcao + ']', error);
    return { ok: false as const, mensagem: error.code === '42501' ? 'Você não tem permissão para esta ação.' : falha };
  }
  return data?.ok ? { ok: true as const, data } : { ok: false as const, mensagem: (data?.erro as string) || falha };
}

export async function marcarLida(cliente: SupabaseClient, workspaceId: string, membroId: string, conversaId: string): Promise<ResultadoCaixa> {
  const r = await chamar(cliente, 'inbox_mark_read', workspaceId, membroId, conversaId, 'Não foi possível abrir a conversa.');
  return r.ok ? { ok: true } : r;
}

export async function pedirSugestaoDeResposta(
  cliente: SupabaseClient, workspaceId: string, membroId: string, conversaId: string
): Promise<{ ok: true; execucaoId: string } | { ok: false; mensagem: string }> {
  const r = await chamar(cliente, 'inbox_request_reply', workspaceId, membroId, conversaId, 'Não foi possível pedir a sugestão. Tente de novo.');
  return r.ok ? { ok: true, execucaoId: r.data.execution_id } : r;
}

export async function excluirContatoDoCrm(cliente: SupabaseClient, workspaceId: string, membroId: string, conversaId: string): Promise<ResultadoCaixa> {
  const r = await chamar(cliente, 'inbox_opt_out', workspaceId, membroId, conversaId, 'Não foi possível excluir o contato. Tente de novo.');
  return r.ok ? { ok: true } : r;
}

/** Conexões pessoais da pessoa logada neste workspace, no formato que o v18 lê (inboxCon). */
export type ConexoesTela = Record<'email' | 'linkedin' | 'whatsapp' | 'instagram', { conta: string; via?: string } | null>;

const VIA_EMAIL: Record<string, string> = { google: 'gmail', microsoft: 'outlook', imap: 'imap' };

export async function minhasConexoes(cliente: SupabaseClient, workspaceId: string): Promise<ConexoesTela> {
  const { data: usuario } = await cliente.auth.getUser();
  const conexoes: ConexoesTela = { email: null, linkedin: null, whatsapp: null, instagram: null };
  if (!usuario.user) return conexoes;
  const { data, error } = await cliente
    .from('messaging_accounts')
    .select('provider, display_name, status, member:workspace_members!inner(user_id)')
    .eq('workspace_id', workspaceId)
    .eq('member.user_id', usuario.user.id)
    .eq('status', 'connected');
  if (error) throw new Error('Não foi possível carregar suas conexões.', { cause: error });
  for (const c of data || []) {
    const conta = c.display_name || '—';
    if (VIA_EMAIL[c.provider]) conexoes.email = { conta, via: VIA_EMAIL[c.provider] };
    else if (c.provider === 'linkedin' || c.provider === 'whatsapp' || c.provider === 'instagram') conexoes[c.provider as 'linkedin' | 'whatsapp' | 'instagram'] = { conta };
  }
  return conexoes;
}

/** Conta da pessoa que a ponte diz que caiu: pede nova autorização (attention) ou foi desligada (disconnected). */
export interface ContaComProblema { provider: string; status: 'attention' | 'disconnected'; canal: string }

const NOME_DO_CANAL: Record<string, string> = { google: 'e-mail (Gmail)', microsoft: 'e-mail (Outlook)', imap: 'e-mail', linkedin: 'LinkedIn', whatsapp: 'WhatsApp', instagram: 'Instagram' };

/** As contas da PRÓPRIA pessoa, neste workspace, que precisam ser reconectadas (ADR 0071). Só leitura. */
export async function minhasContasComProblema(cliente: SupabaseClient, workspaceId: string): Promise<ContaComProblema[]> {
  const { data: usuario } = await cliente.auth.getUser();
  if (!usuario.user) return [];
  const { data, error } = await cliente
    .from('messaging_accounts')
    .select('provider, status, member:workspace_members!inner(user_id)')
    .eq('workspace_id', workspaceId)
    .eq('member.user_id', usuario.user.id)
    .in('status', ['attention', 'disconnected']);
  if (error) throw new Error('Não foi possível conferir suas conexões.', { cause: error });
  return (data || []).map(c => ({ provider: c.provider as string, status: c.status as 'attention' | 'disconnected', canal: NOME_DO_CANAL[c.provider as string] ?? String(c.provider) }));
}

/** O texto do pop-up: diz qual canal caiu, o que fazer e que nada se perdeu. */
export function textoDoAvisoDeConexao(contas: ContaComProblema[]): { titulo: string; texto: string } {
  const canais = contas.map(c => c.canal);
  const lista = canais.length > 1 ? canais.slice(0, -1).join(', ') + ' e ' + canais[canais.length - 1] : canais[0];
  const plural = canais.length > 1;
  const caiu = contas.some(c => c.status === 'disconnected');
  return {
    titulo: plural ? 'Contas desconectadas' : 'Conta desconectada',
    texto: (plural ? `Estas conexões precisam ser refeitas: ${lista}. ` : `A conexão do seu ${lista} ${caiu ? 'foi desconectada' : 'pede uma nova autorização'}. `)
      + 'Enquanto isso, você não recebe nem envia mensagens por ' + (plural ? 'elas' : 'ele') + '. Reconecte na Caixa de entrada: as conversas e o histórico continuam guardados.'
  };
}

// ---- Caixa de entrada em conversa (ADR 0068): uma conversa por EMPRESA, como um grupo (não é grupo de verdade).

export interface MensagemDaEmpresa {
  id: string;
  conversaId: string;
  autor: string;
  canal: string;
  direcao: 'in' | 'out';
  texto: string;
  quandoIso: string;
  quando: string;
  /** intenção da conversa, na última mensagem recebida dela (positiva, objeção, adiar, neutra...) */
  intencao: string | null;
}
export interface DestinoDeResposta { conversaId: string; rotulo: string; podeEnviar: boolean; motivo: string | null }
export interface EmpresaDaCaixa {
  id: string;
  nome: string;
  pessoas: string[];
  naoLidas: number;
  ultimaIso: string;
  quando: string;
  ultima: string;
  conversas: string[];
  conversasNaoLidas: string[];
  mensagens: MensagemDaEmpresa[];
  destinos: DestinoDeResposta[];
}

interface ConversaBruta {
  id: string; channel: string; intent: string | null; unread: boolean; last_message_at: string;
  contact: unknown; account: unknown; messaging_account: unknown;
}
interface MensagemBruta { id: string; conversation_id: string; direction: string; text: string; sent_by: string; created_at: string }

const umObjeto = <T>(x: unknown): T | null => (Array.isArray(x) ? (x[0] ?? null) : (x as T | null));

/** Agrupa as conversas (já filtradas pela visibilidade do banco) por empresa. `membroId`: quem está vendo. */
export function agruparPorEmpresa(conversas: ConversaBruta[], mensagens: MensagemBruta[], membroId: string | null, agora = new Date()): EmpresaDaCaixa[] {
  const grupos = new Map<string, EmpresaDaCaixa>();
  const porConversa = new Map<string, { pessoa: string; canal: string; intencao: string; minha: boolean; empresa: EmpresaDaCaixa }>();
  for (const c of conversas) {
    const conta = umObjeto<{ id?: string; name?: string }>(c.account);
    const contato = umObjeto<{ id?: string; name?: string }>(c.contact);
    const dono = umObjeto<{ member_id?: string }>(c.messaging_account)?.member_id ?? null;
    const chave = conta?.id || 'contato:' + (contato?.id || c.id);
    let g = grupos.get(chave);
    if (!g) {
      g = { id: chave, nome: conta?.name || contato?.name || '—', pessoas: [], naoLidas: 0, ultimaIso: c.last_message_at, quando: '', ultima: '—',
            conversas: [], conversasNaoLidas: [], mensagens: [], destinos: [] };
      grupos.set(chave, g);
    }
    const pessoa = contato?.name || '—';
    const canal = CANAL[c.channel] || c.channel;
    if (!g.pessoas.includes(pessoa)) g.pessoas.push(pessoa);
    if (c.unread) { g.naoLidas++; g.conversasNaoLidas.push(c.id); }
    if (c.last_message_at > g.ultimaIso) g.ultimaIso = c.last_message_at;
    g.conversas.push(c.id);
    const minha = !!membroId && dono === membroId;
    // E-mail e WhatsApp enviam mensagem nova; LinkedIn e Instagram respondem DENTRO da conversa que já existe (ADR 0069).
    g.destinos.push({
      conversaId: c.id, rotulo: `${pessoa} · ${canal}`, podeEnviar: minha,
      motivo: !minha ? 'Só quem conectou esta conta responde por ela.' : null
    });
    porConversa.set(c.id, { pessoa, canal, intencao: INTENCAO[c.intent || 'neutra'] || 'Neutra', minha, empresa: g });
  }
  const ultimaRecebida = new Map<string, string>();
  for (const m of mensagens) if (m.direction === 'in') ultimaRecebida.set(m.conversation_id, m.id);
  for (const m of [...mensagens].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const c = porConversa.get(m.conversation_id);
    if (!c) continue;
    const entrada = m.direction === 'in';
    const autor = entrada ? c.pessoa : m.sent_by === 'automation' ? 'Automação' : m.sent_by === 'agent' ? 'Agente' : c.minha ? 'Você' : 'Equipe';
    c.empresa.mensagens.push({
      id: m.id, conversaId: m.conversation_id, autor, canal: c.canal, direcao: entrada ? 'in' : 'out', texto: m.text,
      quandoIso: m.created_at, quando: formatarQuando(m.created_at, agora), intencao: entrada && ultimaRecebida.get(m.conversation_id) === m.id ? c.intencao : null
    });
  }
  const lista = [...grupos.values()];
  for (const g of lista) {
    g.quando = formatarQuando(g.ultimaIso, agora);
    const u = g.mensagens[g.mensagens.length - 1];
    if (u) g.ultima = (u.direcao === 'out' ? `${u.autor}: ` : '') + u.texto;
  }
  return lista.sort((a, b) => b.ultimaIso.localeCompare(a.ultimaIso));
}

/** As conversas visíveis para quem está vendo (RLS), agrupadas por empresa, com os números da Caixa. */
export async function listarCaixaPorEmpresa(cliente: SupabaseClient, workspaceId: string, agora = new Date()): Promise<CaixaTela & { empresas: EmpresaDaCaixa[] }> {
  const [base, conversas, membro] = await Promise.all([
    listarCaixa(cliente, workspaceId, agora),
    cliente.from('conversations')
      .select('id, channel, intent, unread, last_message_at, contact:contacts(id, name), account:accounts(id, name), messaging_account:messaging_accounts(member_id)')
      .eq('workspace_id', workspaceId).order('last_message_at', { ascending: false }),
    cliente.auth.getUser().then(async u => u.data.user
      ? (await cliente.from('workspace_members').select('id').eq('workspace_id', workspaceId).eq('user_id', u.data.user.id).maybeSingle()).data?.id ?? null
      : null)
  ]);
  if (conversas.error) throw new Error('Não foi possível carregar a caixa de entrada.', { cause: conversas.error });
  const ids = (conversas.data || []).map(c => c.id);
  const msgs = ids.length
    ? await cliente.from('messages').select('id, conversation_id, direction, text, sent_by, created_at').in('conversation_id', ids).order('created_at')
    : { data: [] as MensagemBruta[], error: null };
  if (msgs.error) throw new Error('Não foi possível carregar as mensagens.', { cause: msgs.error });
  return { ...base, empresas: agruparPorEmpresa((conversas.data || []) as ConversaBruta[], (msgs.data || []) as MensagemBruta[], membro as string | null, agora) };
}

/** Responde numa conversa (pessoa e canal dela) pelo caminho de envio que já existe (ADR 0068). */
export async function responderNaCaixa(cliente: SupabaseClient, workspaceId: string, membroId: string, conversaId: string, texto: string, assunto: string, chave: string)
  : Promise<{ ok: true; id: string } | { ok: false; mensagem: string }> {
  const { data, error } = await cliente.rpc('inbox_reply', {
    p_workspace_id: workspaceId, p_member_id: membroId, p_conversation_id: conversaId, p_texto: texto, p_assunto: assunto || null, p_chave: chave
  });
  if (error) {
    if (error.code === '22023' && error.message) return { ok: false, mensagem: error.message };
    return { ok: false, mensagem: error.code === '42501' ? 'Você não tem permissão para esta ação.' : 'Não foi possível enviar a resposta. Tente de novo.' };
  }
  if (!data?.ok) return { ok: false, mensagem: data?.erro || 'Não foi possível enviar a resposta. Tente de novo.' };
  return { ok: true, id: data.id };
}
