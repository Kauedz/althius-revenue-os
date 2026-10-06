import { describe, expect, it } from 'vitest';
import { rodarAprendizado } from './ciclo.ts';

const resposta = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status });

describe('ciclo do aprendizado compartilhado', () => {
  it('chama o motor com a chave de serviço e devolve o resumo', async () => {
    let visto: { url: string; auth: string; corpo: unknown } | null = null;
    const buscar = (async (url: string, init: RequestInit) => {
      visto = { url, auth: (init.headers as Record<string, string>).Authorization, corpo: JSON.parse(String(init.body)) };
      return resposta(200, { clientes_contribuindo: 4, padroes: 2, sugestoes_novas: 1 });
    }) as unknown as typeof fetch;
    const r = await rodarAprendizado({ base: 'http://banco/', chaveServico: 'servico', buscar });
    expect(r).toEqual({ ok: true, clientes_contribuindo: 4, padroes: 2, sugestoes_novas: 1 });
    expect(visto!.url).toBe('http://banco/rpc/aprendizado_executar');
    expect(visto!.auth).toBe('Bearer servico');
    expect(visto!.corpo).toEqual({ p_k_min: 3, p_envios_min: 30 });
  });
  it('os mínimos de proteção podem subir, nunca descer abaixo do piso do banco', async () => {
    let corpo: any;
    const buscar = (async (_u: string, init: RequestInit) => { corpo = JSON.parse(String(init.body)); return resposta(200, {}); }) as unknown as typeof fetch;
    await rodarAprendizado({ base: 'http://b', chaveServico: 's', buscar, kMin: 5, enviosMin: 100 });
    expect(corpo).toEqual({ p_k_min: 5, p_envios_min: 100 });
    await rodarAprendizado({ base: 'http://b', chaveServico: 's', buscar, kMin: 1, enviosMin: 1 });
    expect(corpo).toEqual({ p_k_min: 3, p_envios_min: 20 });
  });
  it('banco recusa ou cai: erro claro, sem derrubar o serviço', async () => {
    const recusa = (async () => resposta(500, { code: 'XX000' })) as unknown as typeof fetch;
    expect(await rodarAprendizado({ base: 'http://b', chaveServico: 's', buscar: recusa })).toEqual({ ok: false, erro: 'banco recusou o motor (HTTP 500)' });
    const cai = (async () => { throw new Error('rede'); }) as unknown as typeof fetch;
    expect(await rodarAprendizado({ base: 'http://b', chaveServico: 's', buscar: cai })).toEqual({ ok: false, erro: 'banco indisponível' });
  });
});
