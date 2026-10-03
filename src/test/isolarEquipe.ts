import { afterEach, beforeEach } from 'vitest';
import { adminLocal } from './supabaseLocal';

export const EVOLUT_EQUIPE = 'a0000000-0000-0000-0000-000000000001';
export const GRAO_EQUIPE = 'b0000000-0000-0000-0000-000000000001';
export const membroEquipe = (n: number) => 'd0000000-0000-0000-0000-' + String(n).padStart(12, '0');

/** Só restaura membros do seed e apaga convites criados pelos nossos testes.
 * Auditoria é imutável: cada teste consulta por entidade/chave, sem apagar registros.
 */
export function isolarEquipe() {
  let originais: Array<{ id: string; role: string; status: string }> = [];
  beforeEach(async () => {
    const { data, error } = await adminLocal().from('workspace_members').select('id, role, status')
      .in('workspace_id', [EVOLUT_EQUIPE, GRAO_EQUIPE]);
    if (error) throw error;
    originais = data;
  });
  afterEach(async () => {
    for (const { id, ...estado } of originais) {
      const { error } = await adminLocal().from('workspace_members').update(estado).eq('id', id);
      if (error) throw error;
    }
    const { error } = await adminLocal().from('workspace_invites').delete()
      .in('workspace_id', [EVOLUT_EQUIPE, GRAO_EQUIPE]).like('email', 'equipe-teste-%@example.test');
    if (error) throw error;
  });
}
