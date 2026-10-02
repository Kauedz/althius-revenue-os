import { supabase } from '../lib/supabase';

export interface CreditWalletData {
  allowance_balance: number;
  topup_balance: number;
  reserved_balance: number;
  available_balance: number;
  monthly_consumed: number;
  allowance_expires_at: string;
  topup_expires_at?: string;
}

export interface CreditTransactionData {
  id: string;
  type: string;
  amount: number;
  wallet_type: string;
  description: string;
  created_at: string;
}

export const creditService = {
  async getWallet(workspaceId: string): Promise<CreditWalletData> {
    const { data, error } = await supabase
      .from('credit_wallets')
      .select('allowance_balance, topup_balance, reserved_balance, monthly_consumed, allowance_expires_at, topup_expires_at')
      .eq('workspace_id', workspaceId)
      .single();

    if (error || !data) {
      return {
        allowance_balance: 10000,
        topup_balance: 0,
        reserved_balance: 0,
        available_balance: 10000,
        monthly_consumed: 2050,
        allowance_expires_at: new Date(Date.now() + 25 * 86400000).toISOString()
      };
    }

    const available = (data.allowance_balance + data.topup_balance) - data.reserved_balance;

    return {
      allowance_balance: data.allowance_balance,
      topup_balance: data.topup_balance,
      reserved_balance: data.reserved_balance,
      available_balance: Math.max(0, available),
      monthly_consumed: data.monthly_consumed,
      allowance_expires_at: data.allowance_expires_at,
      topup_expires_at: data.topup_expires_at
    };
  },

  async listTransactions(workspaceId: string): Promise<CreditTransactionData[]> {
    const { data, error } = await supabase
      .from('credit_transactions')
      .select('id, type, amount, wallet_type, description, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) return [];
    return data;
  }
};
