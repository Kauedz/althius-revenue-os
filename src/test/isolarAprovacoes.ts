import { afterEach, beforeEach } from 'vitest';
import { adminLocal } from './supabaseLocal';

/** Restaura também o histórico: decidir uma aprovação altera mais que seu status. */
export function isolarAprovacoes(ids: string[]) {
  let originais: Array<Record<string, any>> = [];
  beforeEach(async () => {
    const { data, error } = await adminLocal().from('approvals')
      .select('id, status, decided_by_member_id, decided_at, decision_notes, history').in('id', ids);
    if (error) throw error;
    originais = data;
  });
  afterEach(async () => {
    for (const { id, ...valores } of originais) {
      const { error } = await adminLocal().from('approvals').update(valores).eq('id', id);
      if (error) throw error;
    }
  });
}
