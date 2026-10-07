// Gateway do modelo de IA (ADR 0050). O Hermes de cada cliente fala com ESTE endereço (formato OpenAI) usando o token do
// próprio agente; aqui a chave real do provedor vem do cofre, o pedido é traduzido se o provedor for a Claude, o uso é
// registrado por cliente/agente e, se o principal falhar, o reserva responde. A chave do provedor nunca sai daqui.
import type { Cofre, SegredoLido } from '../cofre/cofre.ts';
import { comoStream, deAnthropic, paraAnthropic } from './traduzir.ts';

export const NOME_LOGICO = 'althius';
export const URL_CLAUDE = 'https://api.anthropic.com/v1';

export interface DepsGateway {
  baseBanco: string;
  chaveServico: string;
  cofre: Cofre;
  buscar?: typeof fetch;
  agora?: () => number;
  deMolhoMs?: number;
  prazoMs?: number;
}
export interface PedidoGateway { metodo: string; caminho: string; autorizacao: string | undefined; corpo: string }
export interface RespostaGateway { status: number; tipo: string; corpo: string }

const erro = (status: number, tipo: string, message: string): RespostaGateway => ({ status, tipo: 'application/json', corpo: JSON.stringify({ error: { message, type: tipo } }) });
const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);

export function criarGateway(d: DepsGateway) {
  const buscar = d.buscar ?? fetch;
  const agora = d.agora ?? Date.now;
  const deMolho = d.deMolhoMs ?? 60_000;
  const prazo = d.prazoMs ?? 120_000;
  const ateQuando = new Map<string, number>();
  const rpc = (funcao: string, args: Record<string, unknown>) => buscar(`${d.baseBanco.replace(/\/$/, '')}/rpc/${funcao}`, {
    method: 'POST', headers: { apikey: d.chaveServico, Authorization: `Bearer ${d.chaveServico}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args)
  });

  async function identificar(token: string): Promise<{ ok: true; workspace: string; agente: string } | { ok: false; r: RespostaGateway }> {
    let r: Response;
    try { r = await rpc('agent_runtime_resolve', { p_token: token }); } catch { return { ok: false, r: erro(502, 'banco_indisponivel', 'Banco indisponível.') }; }
    if (r.ok) {
      const t = (await r.json().catch(() => null)) as { workspace_id?: string; agent_code?: string } | null;
      if (t?.workspace_id && t.agent_code) return { ok: true, workspace: t.workspace_id, agente: t.agent_code };
      return { ok: false, r: erro(502, 'banco_indisponivel', 'Banco indisponível.') };
    }
    const c = (await r.json().catch(() => ({}))) as { code?: string };
    if (c.code === '55000') return { ok: false, r: erro(403, 'agente_pausado', 'Agente pausado pelo cliente.') };
    if (c.code === '28000') return { ok: false, r: erro(401, 'token_invalido', 'Token do agente inválido ou revogado.') };
    return { ok: false, r: erro(502, 'banco_indisponivel', 'Banco indisponível.') };
  }

  /** Chama um provedor. Devolve a resposta no formato OpenAI ou o motivo da falha (texto curto, sem segredo). */
  async function chamar(m: SegredoLido, corpo: Record<string, any>): Promise<{ ok: true; resp: Record<string, any> } | { ok: false; motivo: string }> {
    const api = m.config.api === 'anthropic' ? 'anthropic' : 'openai';
    const base = String(m.config.base_url ?? '').trim().replace(/\/+$/, '') || (api === 'anthropic' ? URL_CLAUDE : '');
    const nome = String(m.config.modelo ?? '').trim();
    if (!base || !nome) return { ok: false, motivo: 'Modelo sem endereço ou sem nome.' };
    let url: string; let headers: Record<string, string>; let envio: Record<string, any>;
    if (api === 'anthropic') {
      url = `${base}/messages`;
      headers = { 'x-api-key': m.segredo, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' };
      envio = paraAnthropic(corpo, nome);
    } else {
      url = `${base}/chat/completions`;
      headers = { Authorization: `Bearer ${m.segredo}`, 'Content-Type': 'application/json' };
      envio = { ...corpo, model: nome, stream: false };
      delete envio.stream_options;
    }
    let r: Response;
    try { r = await buscar(url, { method: 'POST', headers, body: JSON.stringify(envio), signal: AbortSignal.timeout(prazo) }); }
    catch { return { ok: false, motivo: 'Provedor fora do ar ou lento demais.' }; }
    if (r.status === 401 || r.status === 403) return { ok: false, motivo: 'Chave recusada pelo provedor.' };
    if (r.status === 429) return { ok: false, motivo: 'Limite de uso do provedor.' };
    if (!r.ok) return { ok: false, motivo: `Provedor respondeu com erro (${r.status}).` };
    const j = (await r.json().catch(() => null)) as Record<string, any> | null;
    if (!j) return { ok: false, motivo: 'Resposta do provedor ilegível.' };
    if (api === 'anthropic') return { ok: true, resp: deAnthropic(j, NOME_LOGICO) };
    if (!Array.isArray(j.choices) || !j.choices[0]?.message) return { ok: false, motivo: 'Resposta do provedor em formato inesperado.' };
    return { ok: true, resp: { ...j, model: NOME_LOGICO } };
  }

  async function conversar(workspace: string, agente: string, textoCorpo: string): Promise<RespostaGateway> {
    let corpo: Record<string, any>;
    try { corpo = JSON.parse(textoCorpo); } catch { return erro(400, 'pedido_invalido', 'Pedido inválido.'); }
    if (!corpo || typeof corpo !== 'object' || !Array.isArray(corpo.messages)) return erro(400, 'pedido_invalido', 'Pedido inválido.');
    let modelos: SegredoLido[];
    try { modelos = await d.cofre.ler('modelo_ia'); } catch { return erro(503, 'modelo_indisponivel', 'Não foi possível ler os modelos de IA cadastrados.'); }
    if (!modelos.length) return erro(503, 'modelo_indisponivel', 'Nenhum modelo de IA configurado. O superadmin cadastra em Fornecedores.');
    const ordem = modelos.map((m, i) => ({ m, i })).sort((a, b) => (numero(a.m.config.prioridade) ?? 50) - (numero(b.m.config.prioridade) ?? 50) || a.i - b.i).map(x => x.m);
    const livres = ordem.filter(m => (ateQuando.get(m.id) ?? 0) <= agora());
    // Se todos estão de molho, tenta mesmo assim (melhor tentar do que parar tudo).
    for (const m of livres.length ? livres : ordem) {
      const r = await chamar(m, corpo);
      if (!r.ok) {
        ateQuando.set(m.id, agora() + deMolho);
        await d.cofre.marcarUso(m.id, r.motivo);
        continue;
      }
      ateQuando.delete(m.id);
      await d.cofre.marcarUso(m.id, null);
      const entrada = Number(r.resp.usage?.prompt_tokens) || 0;
      const saida = Number(r.resp.usage?.completion_tokens) || 0;
      const pe = numero(m.config.preco_entrada); const ps = numero(m.config.preco_saida);
      const custo = pe !== null && ps !== null ? (entrada * pe + saida * ps) / 1e6 : null;
      try {
        await rpc('llm_registrar_uso', { p_workspace_id: workspace, p_agente: agente, p_rotulo: m.rotulo, p_modelo: String(m.config.modelo ?? ''), p_tokens_entrada: entrada, p_tokens_saida: saida, p_custo_usd: custo });
      } catch { /* o registro é complementar: nunca derruba a resposta */ }
      return corpo.stream === true
        ? { status: 200, tipo: 'text/event-stream', corpo: comoStream(r.resp) }
        : { status: 200, tipo: 'application/json', corpo: JSON.stringify(r.resp) };
    }
    return erro(502, 'modelo_indisponivel', 'Nenhum modelo de IA conseguiu responder agora.');
  }

  async function tratar(p: PedidoGateway): Promise<RespostaGateway> {
    const token = /^Bearer (.+)$/.exec(p.autorizacao ?? '')?.[1] ?? '';
    if (!token) return erro(401, 'token_invalido', 'Falta o token do agente.');
    const id = await identificar(token);
    if (!id.ok) return id.r;
    if (p.metodo === 'GET' && p.caminho === '/v1/models') {
      return { status: 200, tipo: 'application/json', corpo: JSON.stringify({ object: 'list', data: [{ id: NOME_LOGICO, object: 'model', owned_by: 'althius' }] }) };
    }
    if (p.metodo === 'POST' && p.caminho === '/v1/chat/completions') return conversar(id.workspace, id.agente, p.corpo);
    return erro(404, 'nao_encontrado', 'Rota não encontrada.');
  }

  return { tratar, conversar };
}
