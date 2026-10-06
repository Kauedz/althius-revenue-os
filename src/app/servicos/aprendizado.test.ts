// @vitest-environment node
// Seam: consentimento do aprendizado compartilhado (ADR 0052) contra o banco local.
import { afterAll, describe, expect, it } from 'vitest';
import { decidirConsentimento, lerConsentimento, marcarAvisoVisto } from './aprendizado';
import { adminLocal, bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const ALINE = 'd0000000-0000-0000-0000-000000000003';
const CAMILA = 'd0000000-0000-0000-0000-000000000002';
const LUCAS = 'd0000000-0000-0000-0000-000000000004';

describe.skipIf(!bancoLocalNoAr)('Consentimento do aprendizado (banco local)', () => {
  afterAll(async () => {
    // volta ao estado original (sem aceite, aviso por ver): apaga as linhas de teste pela chave de serviço
    await adminLocal().from('learning_consent').delete().in('workspace_id', [EVOLUT]);
  });

  it('C-level: começa desligado, vê o aviso uma vez só, aceita e desliga', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const antes = await lerConsentimento(aline, EVOLUT, ALINE);
    expect(antes).toMatchObject({ ok: true });
    if (!antes.ok) return;
    expect(antes.estado.podeDecidir).toBe(true);
    // O aviso é "gasto" uma única vez (no banco local pode já ter sido visto por outro teste).
    const primeira = await marcarAvisoVisto(aline, EVOLUT, ALINE);
    const segunda = await marcarAvisoVisto(aline, EVOLUT, ALINE);
    expect(segunda).toBe(false);
    expect(typeof primeira).toBe('boolean');

    expect(await decidirConsentimento(aline, EVOLUT, ALINE, true)).toEqual({ ok: true });
    const aceito = await lerConsentimento(aline, EVOLUT, ALINE);
    expect(aceito.ok && aceito.estado.aceito && aceito.estado.avisoVisto).toBe(true);
    expect(await decidirConsentimento(aline, EVOLUT, ALINE, false)).toEqual({ ok: true });
    const desligado = await lerConsentimento(aline, EVOLUT, ALINE);
    expect(desligado.ok && desligado.estado.aceito).toBe(false);
  });

  it('estrategista e BDR leem o estado mas não decidem (mensagem clara)', async () => {
    const camila = await entrarComoLocal('camila@althius.com.br');
    const r = await lerConsentimento(camila, EVOLUT, CAMILA);
    expect(r.ok && r.estado.podeDecidir).toBe(false);
    expect(await decidirConsentimento(camila, EVOLUT, CAMILA, true)).toEqual({ ok: false, mensagem: 'Só o C-level do workspace decide sobre isso.' });
    const lucas = await entrarComoLocal('lucas@evolut.com.br');
    expect(await marcarAvisoVisto(lucas, EVOLUT, LUCAS)).toBe(false);
  });

  it('usar o membro de outra pessoa: erro, sem expor detalhe', async () => {
    const lucas = await entrarComoLocal('lucas@evolut.com.br');
    const r = await lerConsentimento(lucas, EVOLUT, ALINE);
    expect(r).toEqual({ ok: false, mensagem: 'Não foi possível ler esta configuração. Tente de novo.' });
  });
});
