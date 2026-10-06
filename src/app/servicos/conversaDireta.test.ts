// Conversa direta e privada com um agente (migration 124): o serviço fala com as funções do banco; erro vira mensagem clara.
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { arquivarConversa, abrirConversa, listarConversas, quandoFoi, renomearConversa, tituloDaPrimeiraMensagem } from './conversaDireta';

const WS = 'ws-1';
const MEMBRO = 'm-1';

function cliente(respostas: Record<string, { data?: unknown; error?: { code?: string; message?: string } | null }>) {
  const chamadas: Array<{ funcao: string; args: Record<string, unknown> }> = [];
  const c = { rpc: async (funcao: string, args: Record<string, unknown>) => { chamadas.push({ funcao, args }); return respostas[funcao] ?? { data: null, error: { message: 'sem resposta' } }; } };
  return { cliente: c as unknown as SupabaseClient, chamadas };
}

describe('listarConversas', () => {
  it('traz as conversas do agente com título, quando e se o agente está respondendo', async () => {
    const agora = new Date('2026-10-06T15:00:00Z');
    const { cliente: c, chamadas } = cliente({ agent_direct_list: { data: [
      { slug: 'dm-comercial-a', titulo: 'Prioridades de hoje', atualizada_em: '2026-10-06T14:59:40Z', ultima: 'Oi', aguardando: true },
      { slug: 'dm-comercial-b', titulo: 'Objeções', atualizada_em: '2026-10-05T12:00:00Z', ultima: null, aguardando: false }
    ] } });
    const r = await listarConversas(c, WS, MEMBRO, 'comercial', agora);
    expect(chamadas[0]).toEqual({ funcao: 'agent_direct_list', args: { p_workspace_id: WS, p_member_id: MEMBRO, p_agente: 'comercial' } });
    expect(r.map(x => [x.slug, x.titulo, x.aguardando])).toEqual([['dm-comercial-a', 'Prioridades de hoje', true], ['dm-comercial-b', 'Objeções', false]]);
    expect(r[0].quando).toBe('agora');
    expect(r[1].quando).toBe('ontem');
  });
  it('falha do banco: lança erro claro (a tela mostra "Tentar de novo"), nunca lista inventada', async () => {
    const { cliente: c } = cliente({ agent_direct_list: { data: null, error: { code: '500', message: 'x' } } });
    await expect(listarConversas(c, WS, MEMBRO, 'comercial')).rejects.toThrow('Não foi possível carregar as conversas.');
  });
  it('resposta que não é lista: vazia', async () => {
    const { cliente: c } = cliente({ agent_direct_list: { data: null } });
    expect(await listarConversas(c, WS, MEMBRO, 'comercial')).toEqual([]);
  });
});

describe('abrir, renomear e arquivar', () => {
  it('abre uma conversa nova com o título (ou nulo, que vira "Nova conversa" no banco)', async () => {
    const { cliente: c, chamadas } = cliente({ agent_direct_create: { data: { ok: true, slug: 'dm-copy-x' } } });
    expect(await abrirConversa(c, WS, MEMBRO, 'copy', 'Texto para a Serra Azul')).toEqual({ ok: true, slug: 'dm-copy-x' });
    expect(chamadas[0].args).toEqual({ p_workspace_id: WS, p_member_id: MEMBRO, p_agente: 'copy', p_titulo: 'Texto para a Serra Azul' });
    await abrirConversa(c, WS, MEMBRO, 'copy');
    expect(chamadas[1].args.p_titulo).toBeNull();
  });
  it('o banco recusa (ex.: BDR com o Jax): a mensagem do banco chega à tela', async () => {
    const { cliente: c } = cliente({ agent_direct_create: { data: { ok: false, erro: 'Seu papel conversa só com a Zoe e a Lia.' } } });
    expect(await abrirConversa(c, WS, MEMBRO, 'marketing')).toEqual({ ok: false, mensagem: 'Seu papel conversa só com a Zoe e a Lia.' });
  });
  it('sem permissão (42501) ou queda: mensagem clara', async () => {
    const a = cliente({ agent_direct_create: { data: null, error: { code: '42501' } } });
    expect(await abrirConversa(a.cliente, WS, MEMBRO, 'comercial')).toEqual({ ok: false, mensagem: 'Você não tem permissão para esta ação.' });
    const b = cliente({ agent_direct_create: { data: null, error: { code: '500' } } });
    expect(await abrirConversa(b.cliente, WS, MEMBRO, 'comercial')).toEqual({ ok: false, mensagem: 'Não foi possível concluir agora. Tente de novo.' });
  });
  it('renomear e arquivar chamam as funções certas', async () => {
    const { cliente: c, chamadas } = cliente({ agent_direct_title: { data: { ok: true } }, agent_direct_archive: { data: { ok: true } } });
    expect(await renomearConversa(c, WS, MEMBRO, 'dm-x', 'Novo nome')).toEqual({ ok: true });
    expect(await arquivarConversa(c, WS, MEMBRO, 'dm-x')).toEqual({ ok: true });
    expect(chamadas.map(x => x.funcao)).toEqual(['agent_direct_title', 'agent_direct_archive']);
    expect(chamadas[0].args).toEqual({ p_workspace_id: WS, p_member_id: MEMBRO, p_slug: 'dm-x', p_titulo: 'Novo nome' });
  });
});

describe('título e horário', () => {
  it('o título nasce da primeira mensagem: uma linha, até 40 caracteres, sem espaços sobrando', () => {
    expect(tituloDaPrimeiraMensagem('  Quais contas devo priorizar hoje?  ')).toBe('Quais contas devo priorizar hoje?');
    expect(tituloDaPrimeiraMensagem('linha um\nlinha dois')).toBe('linha um linha dois');
    expect(tituloDaPrimeiraMensagem('x'.repeat(100)).length).toBeLessThanOrEqual(40);
    expect(tituloDaPrimeiraMensagem('x'.repeat(100))).toMatch(/…$/);
    expect(tituloDaPrimeiraMensagem('   ')).toBe('Nova conversa');
  });
  it('quandoFoi: agora, hora de hoje, ontem e data', () => {
    const agora = new Date('2026-10-06T15:00:00');
    expect(quandoFoi('2026-10-06T14:59:50', agora)).toBe('agora');
    expect(quandoFoi('2026-10-06T09:05:00', agora)).toBe('09:05');
    expect(quandoFoi('2026-10-05T20:00:00', agora)).toBe('ontem');
    expect(quandoFoi('2026-09-28T20:00:00', agora)).toBe('28 set');
  });
});
