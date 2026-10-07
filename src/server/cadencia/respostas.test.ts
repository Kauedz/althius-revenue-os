// @vitest-environment node
// Respostas da Caixa de entrada (ADR 0068) pelo MESMO envio da cadência: pega, envia pelo mensageiro e conclui.
// No máximo um envio por resposta: resultado incerto não reenvia nem conclui (fica para conferência). Sem chamada real.
import { describe, expect, it } from 'vitest';
import { rodarRespostas, type BancoRespostas, type RespostaParaEnviar } from './respostas.ts';
import type { Mensageiro } from './motor.ts';

const resposta = (n: number, extra: Partial<RespostaParaEnviar> = {}): RespostaParaEnviar => ({
  id: `r-${n}`, execution_id: `e-${n}`, channel: 'email', recipient: 'jonas@serraazul.test', subject: 'Re: conversa', body: 'Combinado.',
  unipile_account_id: 'conta-lucas', idempotency_key: `resposta:r-${n}`, ...extra
});

function banco(fila: RespostaParaEnviar[]) {
  const concluidas: Array<{ id: string; ok: boolean; msg: string | null; erro: string | null }> = [];
  const b: BancoRespostas = {
    pegar: async () => fila,
    concluir: async (id, ok, msg, erro) => { concluidas.push({ id, ok, msg, erro }); return { acao: ok ? 'enviada' : 'falhou' }; }
  };
  return { b, concluidas };
}

describe('respostas da Caixa de entrada', () => {
  it('envia pelo mensageiro com a conta, o canal e a chave de idempotência, e conclui', async () => {
    const { b, concluidas } = banco([resposta(1)]);
    const envios: any[] = [];
    const mensageiro: Mensageiro = { enviar: async p => { envios.push(p); return { ok: true, mensagemId: 'm-1', chatId: 'chat-1' }; } };
    const r = await rodarRespostas({ banco: b, mensageiro, log: () => {} });
    expect(r).toEqual({ vistas: 1, enviadas: 1, falhas: 0, incertas: 0 });
    expect(envios[0]).toEqual({ contaExterna: 'conta-lucas', canal: 'email', destinatario: 'jonas@serraazul.test', assunto: 'Re: conversa', texto: 'Combinado.', chaveIdempotencia: 'resposta:r-1', chatId: null });
    expect(concluidas).toEqual([{ id: 'r-1', ok: true, msg: 'm-1', erro: null }]);
  });

  it('LinkedIn e Instagram (ADR 0069): o id do chat que já existe segue para o mensageiro', async () => {
    const { b } = banco([resposta(1, { channel: 'linkedin', recipient: 'chat-li-9', chat_id: 'chat-li-9' }), resposta(2, { channel: 'instagram', recipient: 'ig-3', chat_id: 'ig-3' })]);
    const envios: any[] = [];
    const mensageiro: Mensageiro = { enviar: async p => { envios.push(p); return { ok: true, mensagemId: 'm', chatId: null }; } };
    expect(await rodarRespostas({ banco: b, mensageiro, log: () => {} })).toMatchObject({ enviadas: 2 });
    expect(envios.map(e => [e.canal, e.chatId])).toEqual([['linkedin', 'chat-li-9'], ['instagram', 'ig-3']]);
  });

  it('o provedor recusou (definitivo): conclui como falha (devolve o crédito)', async () => {
    const { b, concluidas } = banco([resposta(1)]);
    const mensageiro: Mensageiro = { enviar: async () => ({ ok: false, erro: 'HTTP 400', definitivo: true }) };
    expect(await rodarRespostas({ banco: b, mensageiro, log: () => {} })).toMatchObject({ falhas: 1 });
    expect(concluidas).toEqual([{ id: 'r-1', ok: false, msg: null, erro: 'HTTP 400' }]);
  });

  it('resultado incerto (rede caiu): não conclui nem reenvia; fica para conferência', async () => {
    const { b, concluidas } = banco([resposta(1)]);
    const mensageiro: Mensageiro = { enviar: async () => ({ ok: false, erro: 'rede', definitivo: false }) };
    const logs: any[] = [];
    expect(await rodarRespostas({ banco: b, mensageiro, log: l => logs.push(l) })).toMatchObject({ incertas: 1 });
    expect(concluidas).toEqual([]);
    expect(JSON.stringify(logs)).not.toMatch(/jonas|Combinado/); // o log nunca leva destinatário nem texto
  });

  it('sem mensageiro (sem chave), nem pega as respostas: elas esperam', async () => {
    let pegou = false;
    const b: BancoRespostas = { pegar: async () => { pegou = true; return []; }, concluir: async () => ({ acao: 'x' }) };
    expect(await rodarRespostas({ banco: b, mensageiro: null, log: () => {} })).toEqual({ vistas: 0, enviadas: 0, falhas: 0, incertas: 0 });
    expect(pegou).toBe(false);
  });
});
