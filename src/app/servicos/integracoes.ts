// Integracoes em modo leitura. So contas de mensagem reais. O que o banco nao guarda fica "Sem dados ainda".
import type { SupabaseClient } from '@supabase/supabase-js';

export const SEM_DADOS = 'Sem dados ainda';

export interface IntegracaoTela {
  id: string;
  cap: string;
  fornecedor: string;
  modo: string;
  teste: string;
  status: string;
}

export interface IntegracoesTela {
  linhas: IntegracaoTela[];
}

const ERRO_CARGA = 'Não foi possível carregar as integrações.';

const CAP: Record<string, string> = {
  google: 'E-mail',
  microsoft: 'E-mail',
  imap: 'E-mail',
  linkedin: 'LinkedIn',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram'
};

const STATUS: Record<string, string> = {
  connected: 'Conectada',
  attention: 'Atenção',
  disconnected: 'Desconectada'
};

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

interface ContaBruta {
  id?: unknown;
  provider?: unknown;
  display_name?: unknown;
  status?: unknown;
}

export async function listarIntegracoes(cliente: SupabaseClient, workspaceId: string): Promise<IntegracoesTela> {
  const { data, error } = await cliente
    .from('messaging_accounts')
    .select('id, provider, display_name, status')
    .eq('workspace_id', workspaceId)
    .order('provider', { ascending: true });
  if (error) throw new Error(ERRO_CARGA, { cause: error });
  const contas = Array.isArray(data) ? data as ContaBruta[] : [];
  return {
    linhas: contas.map(conta => {
      const nome = texto(conta.display_name);
      const provider = texto(conta.provider);
      const status = texto(conta.status);
      return {
        id: texto(conta.id),
        cap: CAP[provider] || SEM_DADOS,
        fornecedor: nome || SEM_DADOS,
        modo: SEM_DADOS,
        teste: SEM_DADOS,
        status: STATUS[status] || SEM_DADOS
      };
    })
  };
}
