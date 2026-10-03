// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { controlarExecucao, listarExecucoes } from './execucoes';
import { adminLocal, bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';
const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const GRAO = 'b0000000-0000-0000-0000-000000000001';
const RAFAEL = 'd0000000-0000-0000-0000-000000000001';
const CAMILA = 'd0000000-0000-0000-0000-000000000002';
const ALINE = 'd0000000-0000-0000-0000-000000000003';
const LUCAS = 'd0000000-0000-0000-0000-000000000004';
const CAMILA_GRAO = 'd0000000-0000-0000-0000-000000000008';
const EM_EXECUCAO = 'ec000000-0000-0000-0000-000000001042';
const PAUSADA = 'ec000000-0000-0000-0000-000000001039';
const CONCLUIDA = 'ec000000-0000-0000-0000-000000001037';
const AGENDADA = 'ec000000-0000-0000-0000-000000001036';
const NA_FILA = 'ec000000-0000-0000-0000-000000001035';

function clienteConsultas(respostas: Array<{ data: unknown; error: { message?: string } | null }>) {
  let i = 0;
  return {
    from() {
      const atual = respostas[i++] ?? { data: [], error: null };
      const cadeia: any = new Proxy(function () {}, {
        get: (_alvo: unknown, prop: string) => (prop === 'then'
          ? (ok: (v: unknown) => unknown, falha?: (e: unknown) => unknown) => Promise.resolve(atual).then(ok, falha)
          : cadeia),
        apply: () => cadeia
      });
      return cadeia;
    },
    rpc: async () => ({ data: null, error: { message: 'custos' } })
  };
}

const linha = {
  id: 'e1', title: 'Lista', execution_type: 'Lista', agent_code: 'comercial', campaign_name: '-',
  requested_by_member_id: 'm1', requester_label: null, display_time: 'Hoje, 09:00', created_at: '2026-10-02T12:00:00Z',
  status: 'running', progress: 1, processed_count: 1, valid_count: 1, estimated_credits: 1, reserved_credits: 1, actual_credits: 0,
  plan: [], current_step: 0, logs: [], errors: [], integrations: [], approval_label: 'Não exigida'
};

describe('listarExecucoes quando a consulta falha', () => {
  it('erro ao ler execuções', async () => {
    await expect(listarExecucoes(clienteConsultas([{ data: null, error: { message: 'rede' } }]) as never, EVOLUT))
      .rejects.toThrow('Não foi possível carregar as execuções.');
  });

  it('erro ao ler os solicitantes', async () => {
    const semRotulo = { ...linha, requester_label: null };
    await expect(listarExecucoes(clienteConsultas([
      { data: [semRotulo], error: null },
      { data: null, error: { message: 'membros' } }
    ]) as never, EVOLUT)).rejects.toThrow('Não foi possível carregar os solicitantes.');
  });

  it('erro ao ler os perfis', async () => {
    await expect(listarExecucoes(clienteConsultas([
      { data: [{ ...linha, requester_label: null }], error: null },
      { data: [{ id: 'm1', user_id: 'u1' }], error: null },
      { data: null, error: { message: 'perfis' } }
    ]) as never, EVOLUT)).rejects.toThrow('Não foi possível carregar os solicitantes.');
  });

  it('solicitante que não dá para identificar', async () => {
    await expect(listarExecucoes(clienteConsultas([
      { data: [{ ...linha, requester_label: null, requested_by_member_id: 'sumiu' }], error: null },
      { data: [], error: null }
    ]) as never, EVOLUT)).rejects.toThrow('Não foi possível identificar o solicitante da execução.');
  });

  it('estado que a tela não conhece', async () => {
    await expect(listarExecucoes(clienteConsultas([
      { data: [{ ...linha, status: 'inventado', requester_label: 'Camila Duarte' }], error: null }
    ]) as never, EVOLUT)).rejects.toThrow('O estado da execução não é reconhecido.');
  });
});

describe('controlarExecucao quando a função recusa', () => {
  it('erro genérico e motivo vazio', async () => {
    await expect(controlarExecucao({ rpc: async () => ({ data: null, error: { code: '08000', message: 'rede' } }) } as never, 'e', 'm', 'pause'))
      .rejects.toThrow('Não foi possível registrar o controle da execução.');
    await expect(controlarExecucao({ rpc: async () => ({ data: { success: false }, error: null }) } as never, 'e', 'm', 'pause'))
      .rejects.toThrow('O controle da execução não foi registrado.');
    await expect(controlarExecucao({ rpc: async () => ({ data: { success: false, reason: 'Esta ação não é permitida no estado atual da execução.' }, error: null }) } as never, 'e', 'm', 'pause'))
      .rejects.toThrow('Esta ação não é permitida no estado atual da execução.');
  });
});

async function foto(id: string) {
  const { data, error } = await adminLocal().from('executions').select('status, logs, reserved_credits').eq('id', id).single();
  if (error) throw error;
  return data;
}
async function restaurar(id: string, original: { status: string; logs: unknown; reserved_credits: number }) {
  const { error } = await adminLocal().from('executions').update(original).eq('id', id);
  if (error) throw error;
}

describe.skipIf(!bancoLocalNoAr)('Execuções (banco local)', () => {
  it('C-level lê as oito execuções com detalhes do banco, sem custo real', async () => {
    const execs = await listarExecucoes(await entrarComoLocal('aline@evolut.com.br'), EVOLUT);
    expect(execs).toHaveLength(8);
    expect(execs[0]).toMatchObject({ id: 'ec000000-0000-0000-0000-000000001042', titulo: 'Qualificar 1.200 importadores do Sudeste', tipo: 'Lista', status: 'Em execução', progresso: 64, processados: 768, validos: 512, credEst: 1800, credRes: 1800, credCons: 1150, etapaAtual: 3, solicitante: 'Camila Duarte' });
    expect(execs[0].plano).toHaveLength(5);
    expect(execs[0].logs).toContain('09:31 512 contas com fit acima de 70');
    expect(execs.every(e => !('custo' in e))).toBe(true);
  });
  it('estrategista lê só as execuções do workspace escolhido', async () => {
    const camila = await entrarComoLocal('camila@althius.com.br');
    expect(await listarExecucoes(camila, EVOLUT)).toHaveLength(8);
    expect(await listarExecucoes(camila, GRAO)).toEqual([]);
    expect(await listarExecucoes(camila, 'c0000000-0000-0000-0000-000000000001')).toEqual([]);
  });
  it('BDR não lê execuções nem por consulta direta', async () => {
    expect(await listarExecucoes(await entrarComoLocal('lucas@evolut.com.br'), EVOLUT)).toEqual([]);
  });
  it('só superadmin recebe custos em dólar', async () => {
    const execs = await listarExecucoes(await entrarComoLocal('rafael@althius.com.br'), EVOLUT, true);
    expect(execs[0].custo).toBe('US$ 41,20');
    await expect(listarExecucoes(await entrarComoLocal('camila@althius.com.br'), EVOLUT, true)).rejects.toThrow('Não foi possível carregar os custos');
  });
  it('C-level e BDR também não recebem custo real', async () => {
    await expect(listarExecucoes(await entrarComoLocal('aline@evolut.com.br'), EVOLUT, true)).rejects.toThrow('Não foi possível carregar os custos');
    await expect(listarExecucoes(await entrarComoLocal('lucas@evolut.com.br'), EVOLUT, true)).rejects.toThrow('Não foi possível carregar os custos');
  });
  it('superadmin sem a faixa de custo não vê dólar', async () => {
    const execs = await listarExecucoes(await entrarComoLocal('rafael@althius.com.br'), EVOLUT, false);
    expect(execs).toHaveLength(8);
    expect(execs.every(e => !('custo' in e))).toBe(true);
  });

  it('C-level e BDR não controlam execução', async () => {
    await expect(controlarExecucao(await entrarComoLocal('aline@evolut.com.br'), EM_EXECUCAO, ALINE, 'pause'))
      .rejects.toThrow('Você não tem permissão para controlar esta execução.');
    await expect(controlarExecucao(await entrarComoLocal('lucas@evolut.com.br'), EM_EXECUCAO, LUCAS, 'cancel'))
      .rejects.toThrow('Você não tem permissão para controlar esta execução.');
    expect((await foto(EM_EXECUCAO)).status).toBe('running');
  });

  it('estrategista de outro workspace não controla a execução', async () => {
    await expect(controlarExecucao(await entrarComoLocal('camila@althius.com.br'), EM_EXECUCAO, CAMILA_GRAO, 'pause'))
      .rejects.toThrow('Você não tem permissão para controlar esta execução.');
  });

  it('execução que não existe', async () => {
    await expect(controlarExecucao(await entrarComoLocal('camila@althius.com.br'), '00000000-0000-0000-0000-00000000abce', CAMILA, 'cancel'))
      .rejects.toThrow('Esta execução não existe ou não está disponível.');
  });

  it('ação incompatível com o estado é recusada', async () => {
    const antes = await foto(CONCLUIDA);
    try {
      await expect(controlarExecucao(await entrarComoLocal('camila@althius.com.br'), CONCLUIDA, CAMILA, 'pause'))
        .rejects.toThrow('Esta ação não é permitida no estado atual da execução.');
      expect((await foto(CONCLUIDA)).status).toBe(antes.status);
    } finally {
      await restaurar(CONCLUIDA, antes);
    }
  });

  it('estrategista pausa execução em andamento', async () => {
    const antes = await foto(EM_EXECUCAO);
    try {
      expect(await controlarExecucao(await entrarComoLocal('camila@althius.com.br'), EM_EXECUCAO, CAMILA, 'pause'))
        .toMatchObject({ success: true, status: 'paused' });
      expect((await foto(EM_EXECUCAO)).status).toBe('paused');
    } finally {
      await restaurar(EM_EXECUCAO, antes);
    }
  });

  it('superadmin pausa execução agendada', async () => {
    const antes = await foto(AGENDADA);
    try {
      expect(await controlarExecucao(await entrarComoLocal('rafael@althius.com.br'), AGENDADA, RAFAEL, 'pause'))
        .toMatchObject({ success: true, status: 'paused' });
    } finally {
      await restaurar(AGENDADA, antes);
    }
  });

  it('estrategista retoma execução pausada', async () => {
    const antes = await foto(PAUSADA);
    try {
      expect(await controlarExecucao(await entrarComoLocal('camila@althius.com.br'), PAUSADA, CAMILA, 'resume'))
        .toMatchObject({ success: true, status: 'queued' });
    } finally {
      await restaurar(PAUSADA, antes);
    }
  });

  it('estrategista cancela execução na fila', async () => {
    const antes = await foto(NA_FILA);
    try {
      expect(await controlarExecucao(await entrarComoLocal('camila@althius.com.br'), NA_FILA, CAMILA, 'cancel'))
        .toMatchObject({ success: true, status: 'cancelled' });
    } finally {
      await restaurar(NA_FILA, antes);
    }
  });

  it('estrategista refaz execução concluída', async () => {
    const antes = await foto(CONCLUIDA);
    let nova: string | undefined;
    try {
      const r = await controlarExecucao(await entrarComoLocal('camila@althius.com.br'), CONCLUIDA, CAMILA, 'repeat');
      nova = r.execution_id;
      expect(r).toMatchObject({ success: true, status: 'queued' });
      expect(nova).toBeTruthy();
      expect((await foto(CONCLUIDA)).status).toBe('completed');
    } finally {
      if (nova) await adminLocal().from('executions').delete().eq('id', nova);
      await restaurar(CONCLUIDA, antes);
    }
  });
});