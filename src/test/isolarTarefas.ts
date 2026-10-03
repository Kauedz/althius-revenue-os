import { afterEach, vi } from 'vitest';
import { adminLocal } from './supabaseLocal';

export const EVOLUT_TAREFAS='a0000000-0000-0000-0000-000000000001';
export const GRAO_TAREFAS='b0000000-0000-0000-0000-000000000001';
export const membroTarefa=(n:number)=>'d0000000-0000-0000-0000-'+String(n).padStart(12,'0');
/** Apenas restauração de fixtures. As provas das ações usam o serviço/tela. */
export function isolarTarefas() {
  afterEach(async()=>{
    vi.restoreAllMocks();
    const admin=adminLocal();
    const r=await admin.from('tasks').select('id').like('title','codex-tarefa-%');
    if(r.error) throw r.error;
    const ids=(r.data || []).map(t=>t.id);
    if(!ids.length) return;
    for(const [tabela,coluna] of [['notifications','entity_id'],['tasks','id']]) {
      const removidas=await admin.from(tabela).delete().in(coluna,ids);
      if(removidas.error) throw removidas.error;
    }
  });
}