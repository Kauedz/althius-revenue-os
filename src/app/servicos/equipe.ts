// Equipe e convites: o banco decide a hierarquia; o navegador nunca usa segredos.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContextoReal, PapelBanco } from '../dados';

export type MembroEquipe = ContextoReal['membros'][string][number];
export interface ConviteEquipe {
  id: string;
  workspaceId: string;
  email: string;
  papel: PapelBanco;
  chave: string;
  status: 'pending' | 'canceled' | 'expired';
  envio: 'pending' | 'sent' | 'failed';
  expiraEm: string;
}
export interface Equipe {
  membros: MembroEquipe[];
  convites: ConviteEquipe[];
}
/** Adaptador próprio: implementação real chamará nosso backend, nunca o provedor no front. */
export interface EnvioConviteEquipe {
  enviar(convite: ConviteEquipe): Promise<'pendente' | 'enviado'>;
}
const envioPendente: EnvioConviteEquipe = {
  // TODO ADR 0025: envio e aceite reais. O registro no banco já é a fila durável.
  async enviar() { return 'pendente'; }
};

function falha(mensagem: string, causa: unknown): Error {
  return new Error(mensagem + ' Tentar de novo.', { cause: causa });
}

async function rpc(cliente: SupabaseClient, nome: string, parametros: Record<string, unknown>, mensagem: string) {
  let resposta;
  try {
    resposta = await cliente.rpc(nome, parametros);
  } catch (erro) {
    throw falha(mensagem, erro);
  }
  if (resposta.error) {
    const erro = resposta.error;
    const motivo = ['42501', '23514', '22023', '23505'].includes(erro.code) ? erro.message : mensagem;
    throw falha(motivo, erro);
  }
  if (!resposta.data?.id) throw falha(mensagem, resposta);
  return resposta.data;
}

interface ConviteBanco {
  id: string; workspace_id: string; email: string; role: PapelBanco; idempotency_key: string;
  status: ConviteEquipe['status']; delivery_status: ConviteEquipe['envio']; expires_at: string;
}
const conviteDaLinha = (c: ConviteBanco): ConviteEquipe => ({
  id: c.id, workspaceId: c.workspace_id, email: c.email, papel: c.role,
  chave: c.idempotency_key, status: c.status, envio: c.delivery_status, expiraEm: c.expires_at
});

export async function listarEquipe(cliente: SupabaseClient, workspaceId: string): Promise<Equipe> {
  try {
    const [membros, convites] = await Promise.all([
      cliente.from('workspace_members').select('id, user_id, role, status, job_title, joined_at')
        .eq('workspace_id', workspaceId).order('joined_at').order('id'),
      cliente.from('workspace_invites').select('id, workspace_id, email, role, idempotency_key, status, delivery_status, expires_at')
        .eq('workspace_id', workspaceId).eq('status', 'pending').gt('expires_at', new Date().toISOString())
        .order('created_at').order('id')
    ]);
    if (membros.error || convites.error || !membros.data || !convites.data) {
      throw falha('Não foi possível carregar a equipe e os convites.', membros.error || convites.error);
    }
    const ids = [...new Set(membros.data.map(m => m.user_id))];
    const perfis = ids.length ? await cliente.from('profiles').select('id, name, email').in('id', ids) : { data: [], error: null };
    if (perfis.error || !perfis.data) throw falha('Não foi possível carregar os perfis da equipe.', perfis.error);
    const porId = new Map(perfis.data.map(p => [p.id, p]));
    return {
      membros: membros.data.map(m => {
        const perfil = porId.get(m.user_id);
        if (!perfil) throw falha('O perfil de um membro não está disponível.', m.id);
        return {
          id: m.id, userId: m.user_id, nome: perfil.name || perfil.email, email: perfil.email,
          papel: m.role as PapelBanco, status: m.status as MembroEquipe['status'],
          cargo: m.job_title, entrouEm: m.joined_at
        };
      }),
      convites: convites.data.map(conviteDaLinha)
    };
  } catch (erro) {
    if (erro instanceof Error && erro.message.includes('Tentar de novo.')) throw erro;
    throw falha('Não foi possível carregar a equipe e os convites.', erro);
  }
}

export async function convidarEquipe(
  cliente: SupabaseClient, workspaceId: string, membroId: string, email: string, papel: PapelBanco,
  chave: string, envio: EnvioConviteEquipe = envioPendente
): Promise<{ convite: ConviteEquipe; envio: 'pendente' | 'enviado' }> {
  const convite = conviteDaLinha(await rpc(cliente, 'team_invite', {
    p_workspace_id: workspaceId, p_member_id: membroId, p_email: email, p_role: papel, p_idempotency_key: chave
  }, 'Não foi possível registrar o convite.'));
  // Repetir uma chave cancelada/expirada nunca pode pedir novo envio.
  if (convite.status !== 'pending' || Date.parse(convite.expiraEm) <= Date.now()) {
    throw falha('Este convite está cancelado ou não está mais ativo.', convite);
  }
  try {
    return { convite, envio: await envio.enviar(convite) };
  } catch (erro) {
    // O convite continua registrado: Tentar de novo reutiliza a mesma chave.
    throw falha('Convite registrado, mas não foi possível solicitar o envio do e-mail.', erro);
  }
}

export async function mudarPapelEquipe(cliente: SupabaseClient, workspaceId: string, membroId: string, alvoId: string, papel: PapelBanco): Promise<void> {
  await rpc(cliente, 'team_change_role', {
    p_workspace_id: workspaceId, p_member_id: membroId, p_target_member_id: alvoId, p_role: papel
  }, 'Não foi possível mudar o papel.');
}
export async function suspenderMembroEquipe(cliente: SupabaseClient, workspaceId: string, membroId: string, alvoId: string): Promise<void> {
  await rpc(cliente, 'team_suspend_member', {
    p_workspace_id: workspaceId, p_member_id: membroId, p_target_member_id: alvoId
  }, 'Não foi possível suspender o membro.');
}
export async function cancelarConviteEquipe(cliente: SupabaseClient, workspaceId: string, membroId: string, conviteId: string): Promise<void> {
  await rpc(cliente, 'team_cancel_invite', {
    p_workspace_id: workspaceId, p_member_id: membroId, p_invite_id: conviteId
  }, 'Não foi possível cancelar o convite.');
}
