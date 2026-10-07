// Seam: serviço do Copiloto (ADR 0068) com o Supabase local. A pergunta entra na conversa PRIVADA da pessoa; repetir
// a mesma chave não duplica; nada vira execução nem gasta crédito.
import { afterAll, describe, expect, it } from 'vitest';
import { lerConversaCopiloto, perguntarAoCopiloto } from './copiloto';
import { adminLocal, bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';

const WS = 'a0000000-0000-0000-0000-000000000001';
const LUCAS = 'd0000000-0000-0000-0000-000000000004';
const MARCA = 'teste-servico-copiloto ' + Date.now().toString(36);

describe.skipIf(!bancoLocalNoAr)('serviço do Copiloto (banco local)', () => {
  afterAll(async () => {
    await adminLocal().from('copilot_messages').delete().eq('workspace_id', WS).like('texto', '%' + MARCA + '%');
    await adminLocal().from('copilot_messages').delete().eq('workspace_id', WS).like('texto', 'Não consegui responder agora: teste%');
  });

  it('a mesma chave devolve a mesma pergunta e só uma é criada; nenhuma execução', async () => {
    const cliente = await entrarComoLocal('lucas@evolut.com.br');
    const chave = crypto.randomUUID();
    const execAntes = (await adminLocal().from('executions').select('id', { count: 'exact', head: true }).eq('workspace_id', WS)).count;
    const [a, b] = await Promise.all([perguntarAoCopiloto(cliente, WS, LUCAS, MARCA, chave), perguntarAoCopiloto(cliente, WS, LUCAS, MARCA, chave)]);
    expect(a.ok).toBe(true);
    expect(b).toEqual(a);
    const conversa = await lerConversaCopiloto(cliente, WS, LUCAS);
    expect(conversa.filter(m => m.texto === MARCA)).toEqual([expect.objectContaining({ autor: 'pessoa', estado: 'pendente' })]);
    expect((await adminLocal().from('executions').select('id', { count: 'exact', head: true }).eq('workspace_id', WS)).count).toBe(execAntes);
  });

  it('a resposta e o encaminhamento aparecem na conversa; a falha diz a verdade', async () => {
    const cliente = await entrarComoLocal('lucas@evolut.com.br');
    await perguntarAoCopiloto(cliente, WS, LUCAS, MARCA + ' segunda', crypto.randomUUID());
    const admin = adminLocal();
    const fila = (await admin.rpc('copilot_next', { p_limit: 10 })).data as Array<{ id: string; pergunta: string }>;
    const [p1, p2] = [fila.find(p => p.pergunta === MARCA)!, fila.find(p => p.pergunta === MARCA + ' segunda')!];
    await admin.rpc('copilot_answer', { p_id: p1.id, p_texto: 'Resposta ' + MARCA, p_encaminhar: 'comercial' });
    await admin.rpc('copilot_fail', { p_id: p2.id, p_motivo: 'teste sem modelo' });
    const conversa = await lerConversaCopiloto(cliente, WS, LUCAS);
    expect(conversa.find(m => m.texto === 'Resposta ' + MARCA)).toMatchObject({ autor: 'copiloto', encaminhar: 'comercial', estado: 'respondida' });
    expect(conversa.find(m => m.texto === 'Não consegui responder agora: teste sem modelo.')).toMatchObject({ autor: 'copiloto', estado: 'erro' });
  });

  it('privada: outra pessoa do cliente não lê a conversa; pergunta vazia vira erro claro', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    expect((await lerConversaCopiloto(aline, WS, 'd0000000-0000-0000-0000-000000000003')).filter(m => m.texto.includes(MARCA))).toEqual([]);
    const lucas = await entrarComoLocal('lucas@evolut.com.br');
    expect(await perguntarAoCopiloto(lucas, WS, LUCAS, '  ', crypto.randomUUID())).toEqual({ ok: false, mensagem: 'Escreva a pergunta (até 2.000 caracteres).' });
  });
});
