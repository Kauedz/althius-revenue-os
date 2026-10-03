// Seam: serviço de Tarefas contra Supabase local, criação e leitura pelo contrato público.
// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { criarTarefa, listarTarefas, concluirTarefa, adiarTarefa } from './tarefas';
import { adminLocal, bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';

const EVOLUT='a0000000-0000-0000-0000-000000000001';
const membro=(n:number)=>'d0000000-0000-0000-0000-'+String(n).padStart(12,'0');
const criadas:string[]=[];
afterEach(async()=>{
  if (!criadas.length) return;
  const admin=adminLocal();
  await admin.from('notifications').delete().in('entity_id',criadas);
  // Auditoria permanece append-only; a verificação final reseta o banco local.
  const r=await admin.from('tasks').delete().in('id',criadas.splice(0));
  if(r.error) throw r.error;
});
describe('Tarefas pelo serviço',()=>{
  it('cria e relê a mesma tarefa, sem depender da memória do navegador',async()=>{
    expect(bancoLocalNoAr).toBe(true);
    const cliente=await entrarComoLocal('lucas@evolut.com.br');
    const tarefa=await criarTarefa(cliente,EVOLUT,membro(4),randomUUID(),{
      titulo:'codex-tarefa-Revisar roteiro T1',responsavelId:membro(4),prazo:'2026-10-03T14:00:00Z',canal:'call'
    });
    criadas.push(tarefa.id);
    const relida=(await listarTarefas(await entrarComoLocal('lucas@evolut.com.br'),EVOLUT)).find(t=>t.id===tarefa.id);
    expect(relida).toMatchObject({titulo:'codex-tarefa-Revisar roteiro T1',responsavelId:membro(4),status:'pendente',canal:'call'});
  });
  it('conclui tarefa de mensagem e relê o registro, sem afirmar envio',async()=>{
    const c=await entrarComoLocal('lucas@evolut.com.br');
    const tarefa=await criarTarefa(c,EVOLUT,membro(4),randomUUID(),{
      titulo:'codex-tarefa-Registrar passo de e-mail',responsavelId:membro(4),prazo:new Date().toISOString(),canal:'email'
    });
    criadas.push(tarefa.id);
    await concluirTarefa(c,membro(4),tarefa.id);
    const relida=(await listarTarefas(c,EVOLUT)).find(t=>t.id===tarefa.id);
    expect(relida?.status).toBe('concluida');
    expect(relida?.concluidaEm).toBeTruthy();
  });
  it('repetir a conclusão preserva a data registrada na primeira conclusão',async()=>{
    const c=await entrarComoLocal('lucas@evolut.com.br');
    const tarefa=await criarTarefa(c,EVOLUT,membro(4),randomUUID(),{
      titulo:'codex-tarefa-Repetir conclusão',responsavelId:membro(4),prazo:new Date().toISOString(),canal:'call'
    });
    criadas.push(tarefa.id);
    await concluirTarefa(c,membro(4),tarefa.id);
    const primeira=(await listarTarefas(c,EVOLUT)).find(t=>t.id===tarefa.id);
    await concluirTarefa(c,membro(4),tarefa.id);
    expect((await listarTarefas(c,EVOLUT)).find(t=>t.id===tarefa.id)?.concluidaEm).toBe(primeira?.concluidaEm);
  });
  it('adia a tarefa para uma data definida e relê o novo prazo',async()=>{
    const c=await entrarComoLocal('lucas@evolut.com.br');
    const tarefa=await criarTarefa(c,EVOLUT,membro(4),randomUUID(),{
      titulo:'codex-tarefa-Adiar pelo serviço',responsavelId:membro(4),prazo:'2026-10-03T14:00:00Z',canal:'call'
    });
    criadas.push(tarefa.id);
    await adiarTarefa(c,membro(4),tarefa.id,'2026-10-04T14:00:00Z');
    expect(new Date((await listarTarefas(c,EVOLUT)).find(t=>t.id===tarefa.id)!.prazo).toISOString()).toBe('2026-10-04T14:00:00.000Z');
  });
  it('tarefa criada como concluída tem data da conclusão registrada',async()=>{
    const c=await entrarComoLocal('lucas@evolut.com.br');
    const tarefa=await criarTarefa(c,EVOLUT,membro(4),randomUUID(),{
      titulo:'codex-tarefa-Já concluída',responsavelId:membro(4),prazo:new Date().toISOString(),canal:'call',status:'concluida'
    });
    criadas.push(tarefa.id);
    expect(tarefa.status).toBe('concluida');
    expect((await listarTarefas(c,EVOLUT)).find(t=>t.id===tarefa.id)?.concluidaEm).toBeTruthy();
  });
  it('BDR lê e altera só tarefas próprias; Evolut e Grão Norte ficam isolados',async()=>{
    const lucas=await entrarComoLocal('lucas@evolut.com.br');
    const aline=await entrarComoLocal('aline@evolut.com.br');
    const eduardo=await entrarComoLocal('eduardo@graonorte.com.br');
    const grao='b0000000-0000-0000-0000-000000000001';
    const outra=await criarTarefa(aline,EVOLUT,membro(3),randomUUID(),{
      titulo:'codex-tarefa-Outra BDR',responsavelId:membro(6),prazo:new Date().toISOString(),canal:'call'
    }); criadas.push(outra.id);
    const estrangeira=await criarTarefa(eduardo,grao,membro(9),randomUUID(),{
      titulo:'codex-tarefa-Grão Norte',responsavelId:membro(9),prazo:new Date().toISOString(),canal:'email'
    }); criadas.push(estrangeira.id);
    expect((await listarTarefas(lucas,EVOLUT)).find(t=>t.id===outra.id)).toBeUndefined();
    expect(await listarTarefas(lucas,grao)).toEqual([]);
    expect(await listarTarefas(eduardo,EVOLUT)).toEqual([]);
    expect((await listarTarefas(aline,EVOLUT)).find(t=>t.id===outra.id)?.responsavelId).toBe(membro(6));
    expect((await listarTarefas(eduardo,grao)).find(t=>t.id===estrangeira.id)?.titulo).toBe('codex-tarefa-Grão Norte');
    await expect(concluirTarefa(lucas,membro(4),outra.id)).rejects.toThrow(/responsabilidade/);
    await expect(adiarTarefa(lucas,membro(4),outra.id,'2026-10-04T14:00:00Z')).rejects.toThrow(/responsabilidade/);
    await expect(concluirTarefa(lucas,membro(4),estrangeira.id)).rejects.toThrow(/workspace/);
    await expect(concluirTarefa(lucas,membro(3),outra.id)).rejects.toThrow(/logado/);
    await expect(criarTarefa(aline,EVOLUT,membro(3),randomUUID(),{
      titulo:'codex-tarefa-Responsável estrangeiro',responsavelId:membro(9),prazo:new Date().toISOString(),canal:'call'
    })).rejects.toThrow(/responsável/);
    expect((await listarTarefas(aline,EVOLUT)).find(t=>t.id===outra.id)?.status).toBe('pendente');
    expect((await listarTarefas(eduardo,grao)).find(t=>t.id===estrangeira.id)?.status).toBe('pendente');
  });
});