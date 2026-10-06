// @vitest-environment node
// Seam: rodada do aprendizado compartilhado contra o banco local (sem ninguém ter aceitado, nada é lido nem sugerido).
import { describe, expect, it } from 'vitest';
import { rodarAprendizado } from './ciclo.ts';
import { adminLocal, bancoLocalNoAr, entrarComoLocal, SERVICE_LOCAL, URL_LOCAL } from '../../test/supabaseLocal';

describe.skipIf(!bancoLocalNoAr)('Aprendizado compartilhado (banco local)', () => {
  it('sem clientes que aceitaram, a rodada não lê nem sugere nada', async () => {
    await adminLocal().from('learning_consent').delete().neq('workspace_id', '00000000-0000-0000-0000-000000000000');
    const r = await rodarAprendizado({ base: `${URL_LOCAL}/rest/v1`, chaveServico: SERVICE_LOCAL });
    expect(r).toEqual({ ok: true, clientes_contribuindo: 0, padroes: 0, sugestoes_novas: 0 });
  });
  it('usuário logado (nem o superadmin) não roda o motor', async () => {
    const rafael = await entrarComoLocal('rafael@althius.com.br');
    const { error } = await rafael.rpc('aprendizado_executar', { p_k_min: 3, p_envios_min: 30 });
    expect(error).not.toBeNull();
  });
});
