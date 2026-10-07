// O modelo de IA do Copiloto passa pelo mesmo gateway dos agentes (ADR 0050): chave do cofre, reserva automática e
// registro de uso (rótulo "copiloto"). A falha vira um motivo curto e verdadeiro para a pessoa, nunca uma resposta.
import type { RespostaGateway } from '../gateway/gateway.ts';

export type Mensagem = { role: 'system' | 'user' | 'assistant'; content: string };
export type Modelo = (workspaceId: string, mensagens: Mensagem[]) => Promise<{ ok: true; texto: string } | { ok: false; motivo: string }>;

export function modeloViaGateway(g: { conversar(workspace: string, agente: string, corpo: string): Promise<RespostaGateway> }): Modelo {
  return async (workspaceId, mensagens) => {
    let r: RespostaGateway;
    try { r = await g.conversar(workspaceId, 'copiloto', JSON.stringify({ messages: mensagens, stream: false })); }
    catch { return { ok: false, motivo: 'falha ao falar com o modelo de IA' }; }
    if (r.status === 503) return { ok: false, motivo: 'o modelo de IA não está configurado (o superadmin cadastra em Fornecedores)' };
    if (r.status !== 200) return { ok: false, motivo: 'nenhum modelo de IA respondeu agora; tente de novo em instantes' };
    let j: unknown;
    try { j = JSON.parse(r.corpo); } catch { return { ok: false, motivo: 'o modelo de IA devolveu uma resposta ilegível' }; }
    const texto = (j as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;
    if (typeof texto !== 'string' || !texto.trim()) return { ok: false, motivo: 'o modelo de IA devolveu uma resposta vazia' };
    return { ok: true, texto };
  };
}
