import { afterEach, beforeEach } from 'vitest';
import { adminLocal } from './supabaseLocal';

export function isolarNotificacoes(ids: string[]) {
  let originais: Array<Record<string, any>> = [];
  beforeEach(async () => {
    const { data, error } = await adminLocal().from('notifications')
      .select('id, read_at').in('id', ids);
    if (error) throw error;
    originais = data;
  });
  afterEach(async () => {
    for (const { id, ...valores } of originais) {
      const { error } = await adminLocal().from('notifications').update(valores).eq('id', id);
      if (error) throw error;
    }
  });
}