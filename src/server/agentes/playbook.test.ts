// @vitest-environment node
// Leitura do Playbook publicado pelo sistema (função de sistema do banco, só service_role): sem rede real.
import { describe, expect, it } from 'vitest';
import { playbookViaApi } from './playbook.ts';

function banco(resposta: { status?: number; corpo?: unknown }) {
  const vistos: Array<{ url: string; auth: string | null; corpo: any }> = [];
  const buscar = (async (url: string, init: RequestInit) => {
    vistos.push({ url: String(url), auth: new Headers(init.headers).get('authorization'), corpo: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify(resposta.corpo ?? null), { status: resposta.status ?? 200 });
  }) as unknown as typeof fetch;
  return { buscar, vistos };
}

describe('playbookViaApi', () => {
  it('pede ao banco o Playbook publicado do agente, com a chave de sistema, e devolve versão e texto', async () => {
    const b = banco({ corpo: { versao: '3.2', conteudo: '# Missão' } });
    const lerPlaybook = playbookViaApi('http://banco/rest/v1/', 'chave-de-sistema', b.buscar);
    expect(await lerPlaybook('ws-1', 'comercial')).toEqual({ versao: '3.2', conteudo: '# Missão' });
    expect(b.vistos[0].url).toBe('http://banco/rest/v1/rpc/harness_playbook');
    expect(b.vistos[0].auth).toBe('Bearer chave-de-sistema');
    expect(b.vistos[0].corpo).toEqual({ p_workspace_id: 'ws-1', p_agent_code: 'comercial' });
  });
  it('empresa sem Playbook publicado: nulo (o agente é avisado, não inventa)', async () => {
    expect(await playbookViaApi('http://banco', 'k', banco({ corpo: null }).buscar)('ws-1', 'copy')).toBeNull();
  });
  it('resposta torta do banco também vale como "sem Playbook"', async () => {
    expect(await playbookViaApi('http://banco', 'k', banco({ corpo: { versao: 3 } }).buscar)('ws-1', 'copy')).toBeNull();
  });
  it('banco fora do ar: erro (o lote volta para a fila em vez de responder sem saber a missão)', async () => {
    await expect(playbookViaApi('http://banco', 'k', banco({ status: 500 }).buscar)('ws-1', 'copy')).rejects.toThrow('Playbook');
  });
});
