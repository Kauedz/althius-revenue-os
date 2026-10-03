import { afterEach, beforeEach } from 'vitest';
import { adminLocal } from './supabaseLocal';

export function isolarContas(
  ids: string[] = ['c0000000-0000-0000-0000-000000000001'],
  dominiosParaLimpar: string[] = ['empresatestevitest.com.br', 'novainovacaotech.com.br', 'novainovacao-tela.com.br', 'novaconta-tela.com.br']
) {
  let originais: Array<Record<string, any>> = [];

  beforeEach(async () => {
    const { data, error } = await adminLocal()
      .from('accounts')
      .select('id, name, domain, state_uf, city, temperature, is_duplicate, duplicate_of_id, owner_member_id')
      .in('id', ids);
    if (error) throw error;
    originais = data || [];
  });

  afterEach(async () => {
    // Restaura originais alterados
    for (const { id, ...valores } of originais) {
      await adminLocal().from('accounts').update(valores).eq('id', id);
    }
    // Remove registros criados no teste
    if (dominiosParaLimpar.length > 0) {
      await adminLocal().from('accounts').delete().in('domain', dominiosParaLimpar);
    }
    // Remove contas duplicadas criadas em testes
    await adminLocal().from('accounts').delete().eq('is_duplicate', true).eq('domain', 'serraazul.com.br');
  });
}
