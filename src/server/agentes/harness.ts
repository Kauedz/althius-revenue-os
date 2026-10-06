// Harness de canal para os agentes (PR 12, desenho do Buzz): quem pega os lotes da fila do banco, entrega a um
// executor, avisa que está vivo e devolve a resposta. Toda a regra (fila por canal, um por agente, agrupamento,
// tentativas, créditos, política) mora no Postgres (migration 0110); aqui só se repete o ciclo.
// O executor (o Hermes Agent) entra por uma interface nossa: nos testes é uma versão falsa, e sem executor NADA é
// respondido (os pedidos esperam na fila; nunca existe resposta inventada).
export interface MensagemDoLote { id: string; autor_id: string | null; autor?: string | null; papel?: string | null; texto: string; em: string }
export interface ContextoDoLote { tipo: 'member' | 'agent'; autor_id: string | null; autor?: string | null; agente: string | null; texto: string; em: string }

export interface LoteHarness {
  run_id: string;
  workspace_id: string;
  channel_id: string;
  canal: string;
  agente: 'comercial' | 'marketing' | 'copy' | 'revops';
  tentativa: number;
  /** o que o agente deve responder (as mensagens próximas do canal, agrupadas) */
  mensagens: MensagemDoLote[];
  /** até 10 mensagens anteriores do mesmo canal, para o agente entender a conversa */
  contexto: ContextoDoLote[];
}

/** `somente`: lista de "workspace/agente" que têm executor. Sem ela, pega todos; com ela (mesmo vazia), só esses. */
export interface OpcoesPegar { silencioS?: number; esperaMaximaS?: number; prazoS?: number; limite?: number; somente?: string[] }

export interface BancoHarness {
  recolher(semBatidaS: number): Promise<number>;
  pegar(opcoes: OpcoesPegar): Promise<LoteHarness[]>;
  batida(runId: string): Promise<boolean>;
  terminar(runId: string, resultado: { ok: boolean; resposta?: string; erro?: string }): Promise<void>;
}

export interface ExecutorAgente {
  /** Devolve o texto da resposta. Falha = lança erro (o lote volta para a fila com espera crescente). */
  responder(lote: LoteHarness, sinal: AbortSignal): Promise<string>;
}

export interface OpcoesCiclo {
  banco: BancoHarness;
  executor: ExecutorAgente;
  /** de quanto em quanto tempo avisa que está vivo (ms). Padrão 20 s. */
  batidaMs?: number;
  /** sem batida por este tempo (s), o lote é recolhido. Padrão 90 s. */
  semBatidaS?: number;
  pegar?: OpcoesPegar;
  /** Quais "workspace/agente" têm executor agora. Sem executor, o pedido espera na fila (sem gastar tentativa nem crédito). */
  executoresRegistrados?: () => string[] | Promise<string[]>;
  /** Uma linha por lote: nunca recebe o texto das mensagens. */
  log?: (linha: Record<string, unknown>) => void;
}

export interface ResumoCiclo { recolhidos: number; lotes: number; respondidos: number; falhas: number }

const curto = (e: unknown) => (e instanceof Error ? e.message : 'erro').slice(0, 200);

export async function rodarCicloHarness(o: OpcoesCiclo): Promise<ResumoCiclo> {
  const log = o.log ?? (() => {});
  const resumo: ResumoCiclo = { recolhidos: await o.banco.recolher(o.semBatidaS ?? 90), lotes: 0, respondidos: 0, falhas: 0 };
  const somente = o.executoresRegistrados ? await o.executoresRegistrados() : undefined;
  const lotes = await o.banco.pegar({ ...(o.pegar ?? {}), ...(somente ? { somente } : {}) });
  resumo.lotes = lotes.length;

  await Promise.all(lotes.map(async lote => {
    const controle = new AbortController();
    let recolhido = false;
    const batimento = setInterval(() => {
      o.banco.batida(lote.run_id).then(vivo => {
        if (!vivo) { recolhido = true; controle.abort(); }
      }, () => { /* falha passageira de rede: o próximo batimento tenta de novo */ });
    }, o.batidaMs ?? 20_000);
    try {
      const resposta = await o.executor.responder(lote, controle.signal);
      if (recolhido) { log({ nivel: 'aviso', msg: 'harness_lote_recolhido', run_id: lote.run_id }); return; }
      await o.banco.terminar(lote.run_id, { ok: true, resposta });
      resumo.respondidos++;
      log({ nivel: 'info', msg: 'harness_lote_respondido', run_id: lote.run_id, agente: lote.agente, mensagens: lote.mensagens.length });
    } catch (e) {
      // Lote já recolhido pelo banco (sem batida a tempo): ele já voltou para a fila, nada a avisar.
      if (recolhido) { log({ nivel: 'aviso', msg: 'harness_lote_recolhido', run_id: lote.run_id }); return; }
      resumo.falhas++;
      log({ nivel: 'aviso', msg: 'harness_lote_falhou', run_id: lote.run_id, agente: lote.agente, erro: curto(e) });
      await o.banco.terminar(lote.run_id, { ok: false, erro: curto(e) }).catch(() => { /* o recolhimento por falta de batida devolve o lote */ });
    } finally {
      clearInterval(batimento);
    }
  }));
  return resumo;
}

/** Ponte com o Postgres pela API do banco (PostgREST), com a chave de serviço (só existe no contêiner). */
export function bancoHarnessViaApi(base: string, chaveServico: string, buscar: typeof fetch = fetch): BancoHarness {
  const chamar = async <T>(funcao: string, args: Record<string, unknown>): Promise<T> => {
    const r = await buscar(`${base.replace(/\/$/, '')}/rpc/${funcao}`, {
      method: 'POST',
      headers: { apikey: chaveServico, Authorization: `Bearer ${chaveServico}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
    if (!r.ok) throw new Error(`banco recusou ${funcao}: HTTP ${r.status}`);
    return (await r.json()) as T;
  };
  return {
    recolher: semBatidaS => chamar<number>('agent_harness_reap', { p_heartbeat_timeout_seconds: semBatidaS }),
    pegar: o => chamar<LoteHarness[]>('agent_harness_claim', {
      p_quiet_seconds: o.silencioS ?? 3, p_max_wait_seconds: o.esperaMaximaS ?? 15, p_deadline_seconds: o.prazoS ?? 300, p_limit: o.limite ?? 5,
      p_only: o.somente ?? null
    }),
    batida: runId => chamar<boolean>('agent_harness_heartbeat', { p_run_id: runId }),
    terminar: async (runId, r) => {
      await chamar('agent_harness_finish', { p_run_id: runId, p_ok: r.ok, p_reply: r.resposta ?? null, p_error: r.erro ?? null });
    }
  };
}
