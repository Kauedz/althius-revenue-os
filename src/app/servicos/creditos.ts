import type { SupabaseClient } from '@supabase/supabase-js';

export interface MovimentoCredito {
  id: string;
  data: string;
  tipo: 'entrada' | 'saida';
  desc: string;
  quem: string;
  ag?: string;
  cr: number;
}
export interface PoliticaCredito {
  modo: 'auto' | 'aprovacao';
  teto: number;
  limite: number;
  recarga: boolean;
}
export interface CreditosTela {
  disponivel: number;
  extrato: MovimentoCredito[];
  politica: PoliticaCredito;
}
const AGENTES: Record<string, string> = {
  comercial: 'Agente Comercial',
  marketing: 'Agente de Marketing',
  copy: 'Agente de Copy',
  revops: 'Agente de RevOps'
};
const diaSp = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));

export async function lerCreditos(cliente: SupabaseClient, workspaceId: string): Promise<CreditosTela> {
  const carteira = await cliente.from('credit_wallets').select('allowance_balance,topup_balance,reserved_balance').eq('workspace_id', workspaceId).maybeSingle();
  if (carteira.error) throw new Error('Não foi possível carregar o saldo de créditos.', { cause: carteira.error });
  if (!carteira.data) throw new Error('Este workspace ainda não tem carteira de créditos.');
  const extrato = await cliente.from('credit_transactions').select('id,type,amount,description,agent_code,created_at').eq('workspace_id', workspaceId).order('created_at', { ascending: true }).order('id', { ascending: true });
  if (extrato.error) throw new Error('Não foi possível carregar o extrato de créditos.', { cause: extrato.error });
  const politica = await cliente.from('workspace_settings').select('credit_mode,approval_threshold,monthly_credit_limit,auto_topup_enabled').eq('workspace_id', workspaceId).maybeSingle();
  if (politica.error) throw new Error('Não foi possível carregar as regras de créditos.', { cause: politica.error });
  const linhas: MovimentoCredito[] = [];
  for (const row of extrato.data || []) {
    if (row.type === 'reserve' || row.type === 'release') continue;
    const entrada = row.type === 'grant' || row.type === 'topup';
    const saida = row.type === 'consume' || row.type === 'expiration';
    if (!entrada && !saida) throw new Error('Movimento de crédito desconhecido.');
    if (row.agent_code && !AGENTES[row.agent_code]) throw new Error('Não foi possível identificar o agente do extrato.');
    const quem = row.agent_code ? AGENTES[row.agent_code] : row.type === 'grant' ? 'Althius · franquia mensal' : 'Workspace';
    linhas.push({ id: row.id, data: diaSp(row.created_at), tipo: entrada ? 'entrada' : 'saida', desc: row.description, quem, ...(row.agent_code ? { ag: row.agent_code } : {}), cr: row.amount });
  }
  const p = politica.data;
  return {
    disponivel: Math.max(0, carteira.data.allowance_balance + carteira.data.topup_balance - carteira.data.reserved_balance),
    extrato: linhas,
    politica: {
      modo: p?.credit_mode === 'approval' ? 'aprovacao' : 'auto',
      teto: p?.approval_threshold ?? 500,
      limite: p?.monthly_credit_limit ?? 5000,
      recarga: Boolean(p?.auto_topup_enabled)
    }
  };
}

export async function comprarCreditos(cliente: SupabaseClient, workspaceId: string, membroId: string, quantidade: number) {
  const { data, error } = await cliente.rpc('credit_purchase', { p_workspace_id: workspaceId, p_member_id: membroId, p_amount: quantidade });
  if (error) throw new Error(error.code === '42501' ? 'Você não tem permissão para comprar créditos.' : 'Não foi possível registrar a compra de créditos.', { cause: error });
  if (!data?.success) throw new Error(data?.reason || 'A compra de créditos não foi registrada.');
  return data as { success: true; status: string; approval_id?: string; amount?: number };
}

export async function salvarPoliticaCreditos(cliente: SupabaseClient, workspaceId: string, membroId: string, politica: PoliticaCredito) {
  const { data, error } = await cliente.rpc('credit_policy_save', {
    p_workspace_id: workspaceId,
    p_member_id: membroId,
    p_mode: politica.modo === 'aprovacao' ? 'approval' : 'auto',
    p_threshold: politica.teto,
    p_monthly_limit: politica.limite,
    p_auto_topup: politica.recarga
  });
  if (error) throw new Error(error.code === '42501' ? 'Só o C-level e o superadmin mudam as regras de créditos.' : 'Não foi possível gravar as regras de créditos.', { cause: error });
  if (!data?.success) throw new Error(data?.reason || 'As regras de créditos não foram gravadas.');
}
