// @vitest-environment node
// Seam: serviço de Canais (listarCanais, lerMensagens, criarCanal, enviarNoCanal, editarMensagem, reagir,
// arquivarCanal) contra o banco local, verificado pelo próprio serviço.
import { afterAll, describe, expect, it } from 'vitest';
import { arquivarCanal, criarCanal, editarMensagem, enviarNoCanal, lerMensagens, listarCanais, reagir } from './canais';
import { adminLocal, bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const LUCAS = 'd0000000-0000-0000-0000-000000000004';
const BRUNA = 'd0000000-0000-0000-0000-000000000006';
const SLUG = 'teste-servico-' + Date.now().toString(36);

describe.skipIf(!bancoLocalNoAr)('Canais (banco local)', () => {
  afterAll(async () => {
    const admin = adminLocal();
    await admin.from('chat_channels').update({ archived_at: new Date().toISOString() }).eq('workspace_id', EVOLUT).eq('slug', SLUG);
    await admin.from('executions').delete().like('title', 'Pedido no #' + SLUG + '%');
  });

  it('BDR vê #geral e os canais em que participa, com pessoas e agentes', async () => {
    const canais = await listarCanais(await entrarComoLocal('lucas@evolut.com.br'), EVOLUT);
    expect(canais.map(c => c.id)).toEqual(expect.arrayContaining(['geral', 'sinais-de-compra', 'prospeccao', 'cadencia-t1-t7']));
    expect(canais.find(c => c.id === 'prospeccao')).toMatchObject({ geral: false, agentes: ['comercial', 'copy'], desc: 'Listas, qualificação e enriquecimento' });
    expect(canais.find(c => c.id === 'prospeccao')!.pessoas.sort()).toEqual(['Bruna Lima', 'Camila Duarte', 'Lucas Teixeira']);
    expect((await listarCanais(await entrarComoLocal('bruna@evolut.com.br'), EVOLUT)).map(c => c.id)).not.toContain('cadencia-t1-t7');
  });

  it('mensagens vêm no formato da tela, com agente e autor', async () => {
    const msgs = await lerMensagens(await entrarComoLocal('lucas@evolut.com.br'), EVOLUT, 'sinais-de-compra', LUCAS);
    expect(msgs[0]).toMatchObject({ autor: 'Zoe', sigla: 'ZO', agente: true });
    expect(msgs.find(m => m.autor === 'Lucas Teixeira')).toMatchObject({ texto: 'Perfeito. Sobe para a cadência T1 hoje à tarde.', agente: false, sigla: 'LT' });
  });

  it('cria canal, envia, chama agente, edita, reage e arquiva', async () => {
    const lucas = await entrarComoLocal('lucas@evolut.com.br');
    expect(await criarCanal(lucas, EVOLUT, LUCAS, { nome: SLUG, desc: 'teste', pessoas: [BRUNA], agentes: ['comercial'] })).toEqual({ ok: true, slug: SLUG });
    expect(await enviarNoCanal(lucas, EVOLUT, LUCAS, SLUG, 'Bom dia', null, null)).toEqual({ ok: true });
    expect(await enviarNoCanal(lucas, EVOLUT, LUCAS, SLUG, '@Zoe ajuda?', null, 'comercial')).toEqual({ ok: true });
    let msgs = await lerMensagens(lucas, EVOLUT, SLUG, LUCAS);
    expect(msgs.at(-1)).toMatchObject({ autor: 'Althius', texto: 'Pedido enviado para Zoe. A resposta chega aqui quando terminar.' });
    const minha = msgs.find(m => m.texto === 'Bom dia')!;
    expect(await editarMensagem(lucas, EVOLUT, LUCAS, minha.id, 'Bom dia, Bruna')).toEqual({ ok: true });
    const bruna = await entrarComoLocal('bruna@evolut.com.br');
    expect(await reagir(bruna, EVOLUT, BRUNA, minha.id, '👍')).toEqual({ ok: true });
    msgs = await lerMensagens(lucas, EVOLUT, SLUG, LUCAS);
    expect(msgs.find(m => m.id === minha.id)).toMatchObject({ texto: 'Bom dia, Bruna', editada: true, reacoes: { '👍': { n: 1, minha: false, quem: ['Bruna Lima'] } } });
    expect(await arquivarCanal(bruna, EVOLUT, BRUNA, SLUG)).toEqual({ ok: false, mensagem: 'Só quem criou o canal ou um gestor muda o canal.' });
    expect(await arquivarCanal(lucas, EVOLUT, LUCAS, SLUG)).toEqual({ ok: true });
    expect((await listarCanais(lucas, EVOLUT)).map(c => c.id)).not.toContain(SLUG);
  });

  it('Grão Norte não vê os canais da Evolut', async () => {
    expect(await listarCanais(await entrarComoLocal('eduardo@graonorte.com.br'), EVOLUT)).toEqual([]);
  });
});
