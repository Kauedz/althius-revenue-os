// @vitest-environment node
// Seam: gateway com o banco local de verdade (token de agente real, registro de uso real) e provedor FALSO. Nenhuma API externa.
import { describe, expect, it } from 'vitest';
import { criarGateway } from './gateway.ts';
import { criarServidorGateway } from './servidor.ts';
import type { Cofre } from '../cofre/cofre.ts';
import { adminLocal, bancoLocalNoAr, entrarComoLocal, SERVICE_LOCAL, URL_LOCAL } from '../../test/supabaseLocal';
import type { AddressInfo } from 'node:net';
import { createHash } from 'node:crypto';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const ALINE = 'd0000000-0000-0000-0000-000000000003';

describe.skipIf(!bancoLocalNoAr)('Gateway do modelo (banco local)', () => {
  it('token de agente real: responde pelo provedor falso, registra o uso do cliente e recusa token inválido', async () => {
    const admin = adminLocal();
    const { data: token, error } = await admin.rpc('agent_runtime_token_create', { p_workspace_id: EVOLUT, p_agent_code: 'comercial', p_member_id: ALINE });
    expect(error).toBeNull();

    const chamadasProvedor: string[] = [];
    const provedor = (async (url: string, init: RequestInit) => {
      if (String(url).startsWith('https://')) {
        chamadasProvedor.push(`${url}|${(init.headers as Record<string, string>).Authorization}`);
        return Response.json({ id: 'c', object: 'chat.completion', created: 1, model: 'x', choices: [{ index: 0, message: { role: 'assistant', content: 'Resposta do provedor falso' }, finish_reason: 'stop' }], usage: { prompt_tokens: 4000, completion_tokens: 1000, total_tokens: 5000 } });
      }
      return fetch(url, init);
    }) as unknown as typeof fetch;
    const cofre: Cofre = {
      ler: async () => [{ id: 'm1', rotulo: 'Principal (teste)', segredo: 'chave-secreta-do-provedor', config: { api: 'openai', base_url: 'https://provedor.exemplo.test/v1', modelo: 'modelo-real', prioridade: 1, preco_entrada: 2, preco_saida: 10 } }],
      marcarUso: async () => {}, invalidar: () => {}
    };
    const servidor = criarServidorGateway(criarGateway({ baseBanco: `${URL_LOCAL}/rest/v1`, chaveServico: SERVICE_LOCAL, cofre, buscar: provedor }));
    await new Promise<void>(r => servidor.listen(0, '127.0.0.1', r));
    const url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
    try {
      const rafael = await entrarComoLocal('rafael@althius.com.br');
      const antes = (await rafael.rpc('admin_usage')).data.find((u: any) => u.id === EVOLUT);

      const ok = await fetch(`${url}/v1/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'althius', messages: [{ role: 'user', content: 'Oi' }] }) });
      expect(ok.status).toBe(200);
      expect((await ok.json()).choices[0].message.content).toBe('Resposta do provedor falso');
      expect(chamadasProvedor[0]).toBe('https://provedor.exemplo.test/v1/chat/completions|Bearer chave-secreta-do-provedor');

      const depois = (await rafael.rpc('admin_usage')).data.find((u: any) => u.id === EVOLUT);
      expect(depois.tokens_mes - antes.tokens_mes).toBe(5000);
      expect(Number(depois.custo_modelo_usd) - Number(antes.custo_modelo_usd)).toBeCloseTo((4000 * 2 + 1000 * 10) / 1e6, 6);

      const ruim = await fetch(`${url}/v1/chat/completions`, { method: 'POST', headers: { Authorization: 'Bearer alt_agente_inventado', 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [] }) });
      expect(ruim.status).toBe(401);
      expect(chamadasProvedor).toHaveLength(1);

    } finally {
      await new Promise<void>(r => servidor.close(() => r()));
      // revoga só o token deste teste (pelo hash), sem mexer nos de outros testes
      await admin.from('agent_runtime_tokens').update({ revoked_at: new Date().toISOString() }).eq('token_hash', createHash('sha256').update(String(token)).digest('hex'));
    }
  });
});
