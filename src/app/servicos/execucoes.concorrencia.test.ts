// @vitest-environment node
// Duas conexões reais: o consumo retém o lock até o cancelamento esperar por ele.
import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { describe, expect, it, vi } from 'vitest';
import { bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';

const executar = promisify(execFile);
const container = 'supabase_db_althius-revenue-os';
const args = ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'];
async function sql(texto: string) {
  return (await executar('docker', [...args, '-c', texto])).stdout.trim();
}

describe.skipIf(!bancoLocalNoAr)('concorrência dos créditos no controle de execuções', () => {
  it('cancelar após consumo simultâneo preserva a reserva da outra execução', async () => {
    const ws = randomUUID(), membro = randomUUID(), a = randomUUID(), b = randomUUID();
    await sql(`BEGIN;
      INSERT INTO public.workspaces(id,name,slug) VALUES('${ws}','Teste de concorrência','concorrencia-${ws}');
      INSERT INTO public.workspace_members(id,workspace_id,user_id,role) VALUES('${membro}','${ws}','e0000000-0000-0000-0000-000000000002','estrategista');
      INSERT INTO public.executions(id,workspace_id,requested_by_member_id,capability_key,status) VALUES
        ('${a}','${ws}','${membro}','accounts.import','running'), ('${b}','${ws}','${membro}','accounts.import','running');
      INSERT INTO public.credit_wallets(workspace_id,reserved_balance) VALUES('${ws}',200);
      INSERT INTO public.credit_transactions(workspace_id,execution_id,type,amount,wallet_type,description) VALUES
        ('${ws}','${a}','reserve',100,'both','Teste A'), ('${ws}','${b}','reserve',100,'both','Teste B');
      COMMIT;`);
    const consumo = spawn('docker', args, { windowsHide: true });
    let erros = '';
    consumo.stderr.on('data', chunk => { erros += chunk.toString(); });
    const terminou = new Promise<void>((ok, falha) => {
      consumo.once('error', falha);
      consumo.once('close', codigo => codigo === 0 ? ok() : falha(new Error(erros)));
    });
    try {
      const cliente = await entrarComoLocal('camila@althius.com.br');
      const consumiu = new Promise<void>(ok => {
        let saida = '';
        consumo.stdout.on('data', chunk => {
          saida += chunk.toString();
          if (saida.includes('CONSUMO_RETIDO')) ok();
        });
      });
      consumo.stdin.write(`BEGIN; SELECT public.credit_consume('${ws}','${a}',100,100,'Consumo A','consume-${a}');\n\\echo CONSUMO_RETIDO\n`.replaceAll('\\n', '\n'));
      await consumiu;
      const cancelamento = cliente.rpc('execution_control', { p_execution_id: a, p_member_id: membro, p_action: 'cancel' }).then(r => r);
      // Espera a disputa de lock acontecer de fato, sem depender da velocidade da máquina.
      await vi.waitFor(async () => {
        expect(await sql("SELECT count(*) FROM pg_stat_activity WHERE state='active' AND wait_event_type='Lock' AND query LIKE '%execution_control%';")).toBe('1');
      }, { timeout: 6000, interval: 100 });
      consumo.stdin.end('COMMIT;\n');
      await terminou;
      const resultado = await cancelamento;
      expect(resultado.error).toBeNull();
      expect(resultado.data.success).toBe(true);
      expect(await sql(`SELECT reserved_balance FROM public.credit_wallets WHERE workspace_id='${ws}';`)).toBe('100');
      expect(await sql(`SELECT count(*) FROM public.credit_transactions WHERE execution_id='${a}' AND type='release';`)).toBe('0');
      await cliente.auth.signOut();
    } finally {
      if (!consumo.stdin.destroyed) consumo.stdin.end('ROLLBACK;\n');
      await terminou.catch(() => {});
      await sql(`BEGIN; SET LOCAL session_replication_role=replica; DELETE FROM public.audit_logs WHERE workspace_id='${ws}'; SET LOCAL session_replication_role=origin; UPDATE public.chat_channels SET is_general=false WHERE workspace_id='${ws}'; DELETE FROM public.workspace_members WHERE workspace_id='${ws}'; DELETE FROM public.workspaces WHERE id='${ws}'; COMMIT;`);
    }
  }, 20000);
});