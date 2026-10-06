// Executor que entrega o lote do canal ao Hermes Agent (Nous Research, MIT) pelo servidor de API compatível com OpenAI
// (POST /v1/chat/completions, Bearer, resposta em choices[0].message.content). Formato CONFERIDO na documentação do
// Hermes (website/docs/user-guide/features/api-server.md, commit 56f7986) e em execução real com o nosso MCP.
// O Hermes raciocina; quem lê e propõe no banco é o MCP da Althius, com o token do agente (ADR 0024).
import type { ExecutorAgente, LoteHarness } from './harness.ts';
import type { ExecutorRegistrado } from './hosts.ts';
import { ajustarResposta, montarMensagens } from './prompts.ts';

export interface OpcoesHermes {
  resolver: (workspaceId: string, agente: string) => ExecutorRegistrado | null;
  /** tempo máximo de um pedido (ms). Padrão 240 s, abaixo do prazo do lote (300 s). */
  limiteMs?: number;
  buscar?: typeof fetch;
}

export function executorHermes(o: OpcoesHermes): ExecutorAgente {
  const buscar = o.buscar ?? fetch;
  return {
    async responder(lote: LoteHarness, sinal: AbortSignal): Promise<string> {
      const host = o.resolver(lote.workspace_id, lote.agente);
      // Erros daqui vão para o log: nunca levam a chave, o endereço interno nem o texto das mensagens.
      if (!host) throw new Error('sem executor registrado para este agente');
      let r: Response;
      const prazo = AbortSignal.timeout(o.limiteMs ?? 240_000);
      try {
        r = await buscar(`${host.url}/v1/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${host.chave}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: host.modelo, messages: montarMensagens(lote), stream: false }),
          signal: AbortSignal.any([sinal, prazo])
        });
      } catch (e) {
        // O sinal de parada (lote recolhido) e o prazo abortam do mesmo jeito: quem estourou o prazo é o `prazo`.
        throw new Error(prazo.aborted && !sinal.aborted ? 'o executor demorou demais' : 'o executor não respondeu (rede)');
      }
      if (!r.ok) throw new Error(`o executor respondeu HTTP ${r.status}`);
      let dados: unknown;
      try { dados = await r.json(); } catch { throw new Error('o executor devolveu resposta ilegível'); }
      const conteudo = (dados as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;
      if (typeof conteudo !== 'string' || !conteudo.trim()) throw new Error('o executor devolveu resposta vazia');
      return ajustarResposta(conteudo);
    }
  };
}
