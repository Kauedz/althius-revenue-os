// O Playbook publicado de cada agente, lido pelo SISTEMA (função de sistema do banco, só service_role) a cada pedido:
// publicar uma versão nova vale na resposta seguinte, sem reiniciar nada. Rascunho nunca chega aqui (o banco só devolve o publicado).
import type { PlaybookDoAgente } from './prompts.ts';

export type LerPlaybook = (workspaceId: string, agente: string) => Promise<PlaybookDoAgente | null>;

export function playbookViaApi(base: string, chaveServico: string, buscar: typeof fetch = fetch): LerPlaybook {
  return async (workspaceId, agente) => {
    let r: Response;
    try {
      r = await buscar(`${base.replace(/\/$/, '')}/rpc/harness_playbook`, {
        method: 'POST',
        headers: { apikey: chaveServico, Authorization: `Bearer ${chaveServico}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_workspace_id: workspaceId, p_agent_code: agente })
      });
    } catch { throw new Error('não consegui ler o Playbook (rede)'); }
    if (!r.ok) throw new Error(`não consegui ler o Playbook (HTTP ${r.status})`);
    const d = (await r.json().catch(() => null)) as { versao?: unknown; conteudo?: unknown } | null;
    return d && typeof d.versao === 'string' && typeof d.conteudo === 'string' && d.conteudo.trim() ? { versao: d.versao, conteudo: d.conteudo } : null;
  };
}
