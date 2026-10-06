import { describe, expect, it } from 'vitest';
import { emitirLinkDeAprovacao } from './links';

const f = (status: number, corpo: unknown) => {
  const chamadas: Array<{ url: string; h: Record<string, string>; corpo: any }> = [];
  const buscar = (async (url: string, init: RequestInit) => { chamadas.push({ url, h: init.headers as Record<string, string>, corpo: JSON.parse(init.body as string) }); return { ok: status < 300, status, json: async () => corpo }; }) as unknown as typeof fetch;
  return { buscar, chamadas };
};
const base = { base: 'http://rest:3000/', chaveServico: 'chave-servico', siteUrl: 'https://app.exemplo.com.br/', aprovacaoId: 'ap1', decisorMembroId: 'm1' };

describe('emitirLinkDeAprovacao', () => {
  it('monta o endereço com o token e usa a chave de serviço só no cabeçalho', async () => {
    const { buscar, chamadas } = f(200, { ok: true, token: 'alt_aprov_abc', link_id: 'l1', expires_at: '2026-10-06T13:00:00Z' });
    const r = await emitirLinkDeAprovacao({ ...base, prazoMinutos: 30 }, buscar);
    expect(r).toEqual({ ok: true, link: { url: 'https://app.exemplo.com.br/#/aprovar/alt_aprov_abc', expiraEm: '2026-10-06T13:00:00Z', linkId: 'l1' } });
    expect(chamadas[0].url).toBe('http://rest:3000/rpc/approval_link_issue');
    expect(chamadas[0].corpo).toEqual({ p_approval_id: 'ap1', p_decider_member_id: 'm1', p_ttl_minutes: 30 });
    expect(chamadas[0].h.Authorization).toBe('Bearer chave-servico');
    expect(JSON.stringify(chamadas[0].corpo)).not.toContain('chave-servico');
  });
  it('recusa do banco vira erro nomeado, sem inventar link', async () => {
    expect(await emitirLinkDeAprovacao(base, f(200, { ok: false, status: 'decisor_invalido' }).buscar)).toEqual({ ok: false, erro: 'decisor_invalido' });
    expect(await emitirLinkDeAprovacao(base, f(200, { ok: true }).buscar)).toEqual({ ok: false, erro: 'falha_no_banco' });
    expect(await emitirLinkDeAprovacao(base, f(500, {}).buscar)).toEqual({ ok: false, erro: 'falha_no_banco' });
  });
  it('prazo padrão de 60 minutos', async () => {
    const { buscar, chamadas } = f(200, { ok: false, status: 'prazo_invalido' });
    await emitirLinkDeAprovacao(base, buscar);
    expect(chamadas[0].corpo.p_ttl_minutes).toBe(60);
  });
});
