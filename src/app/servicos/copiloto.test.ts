// Seam: serviço do Copiloto com o Supabase local. Repetir a mesma chave não duplica a execução.
import { afterAll, describe, expect, it } from 'vitest';
import { pedirAoCopiloto } from './copiloto';
import { adminLocal, bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';

const WS = 'a0000000-0000-0000-0000-000000000001';
const LUCAS = 'd0000000-0000-0000-0000-000000000004';
const MARCA = 'teste-servico-copiloto ' + Date.now().toString(36);

describe.skipIf(!bancoLocalNoAr)('serviço do Copiloto (banco local)', () => {
  afterAll(async () => {
    await adminLocal().from('executions').delete().like('title', 'Copiloto: ' + MARCA + '%');
  });

  it('a mesma chave devolve a mesma execução e só uma é criada', async () => {
    const cliente = await entrarComoLocal('lucas@evolut.com.br');
    const chave = crypto.randomUUID();
    const [a, b] = await Promise.all([
      pedirAoCopiloto(cliente, WS, LUCAS, MARCA, chave),
      pedirAoCopiloto(cliente, WS, LUCAS, MARCA, chave)
    ]);
    expect(a).toMatchObject({ ok: true, paraAprovacao: false });
    expect(b).toEqual(a);
    const { data } = await adminLocal().from('executions').select('id').like('title', 'Copiloto: ' + MARCA + '%');
    expect(data).toHaveLength(1);
  });

  it('pedido vazio vira erro claro, sem fila', async () => {
    const cliente = await entrarComoLocal('lucas@evolut.com.br');
    expect(await pedirAoCopiloto(cliente, WS, LUCAS, '  ', crypto.randomUUID())).toEqual({ ok: false, mensagem: 'Escreva o pedido.' });
  });
});
