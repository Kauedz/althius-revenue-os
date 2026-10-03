// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { cancelarConviteEquipe, convidarEquipe, listarEquipe, mudarPapelEquipe, suspenderMembroEquipe, type ConviteEquipe, type EnvioConviteEquipe } from './equipe';
import { adminLocal, bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';
import { EVOLUT_EQUIPE as EVOLUT, GRAO_EQUIPE as GRAO, isolarEquipe, membroEquipe as m } from '../../test/isolarEquipe';

class EnvioFalso implements EnvioConviteEquipe {
  registros = new Map<string, ConviteEquipe>();
  async enviar(convite: ConviteEquipe): Promise<'pendente'> {
    this.registros.set(convite.chave, convite);
    return 'pendente';
  }
}
const emailTeste = () => 'equipe-teste-' + randomUUID() + '@example.test';

describe('Equipe e convites (banco local, sem API externa)', () => {
  isolarEquipe();
  it('exige banco local e lista os membros reais', async () => {
    expect(bancoLocalNoAr).toBe(true);
    const equipe = await listarEquipe(await entrarComoLocal('aline@evolut.com.br'), EVOLUT);
    expect(equipe.membros).toHaveLength(6);
    expect(equipe.membros.find(p => p.id === m(4))).toMatchObject({ nome: 'Lucas Teixeira', papel: 'bdr', status: 'active' });
  });
  it('registra convite e repete a mesma chave sem duplicar nem chamar provedor externo', async () => {
    const c = await entrarComoLocal('aline@evolut.com.br'), chave = randomUUID(), email = emailTeste(), envio = new EnvioFalso();
    const primeiro = await convidarEquipe(c, EVOLUT, m(3), email.toUpperCase(), 'clevel', chave, envio);
    const segundo = await convidarEquipe(c, EVOLUT, m(3), email, 'clevel', chave, envio);
    expect(segundo.convite.id).toBe(primeiro.convite.id);
    expect(primeiro.envio).toBe('pendente');
    expect(envio.registros.size).toBe(1);
    expect((await listarEquipe(c, EVOLUT)).convites.filter(x => x.email === email)).toHaveLength(1);
    const { data, error } = await adminLocal().from('audit_logs').select('id').eq('entity_id', primeiro.convite.id).eq('action', 'membro.convidado');
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
  it('implementação disponível registra pendência, sem afirmar envio', async () => {
    const resultado = await convidarEquipe(await entrarComoLocal('camila@althius.com.br'), EVOLUT, m(2), emailTeste(), 'estrategista', randomUUID());
    expect(resultado.envio).toBe('pendente');
    expect(resultado.convite.envio).toBe('pending');
  });
  it('cancelamento persiste e não permite usar a mesma chave para enviar convite cancelado', async () => {
    const c = await entrarComoLocal('aline@evolut.com.br'), email = emailTeste(), chave = randomUUID(), envio = new EnvioFalso();
    const { convite } = await convidarEquipe(c, EVOLUT, m(3), email, 'bdr', chave, envio);
    await cancelarConviteEquipe(c, EVOLUT, m(3), convite.id);
    expect((await listarEquipe(c, EVOLUT)).convites.find(x => x.id === convite.id)).toBeUndefined();
    await expect(convidarEquipe(c, EVOLUT, m(3), email, 'bdr', chave, envio)).rejects.toThrow(/cancelado|ativo/);
  });
  it('muda papel e registra autor e mudança na Auditoria', async () => {
    const c = await entrarComoLocal('aline@evolut.com.br');
    await mudarPapelEquipe(c, EVOLUT, m(3), m(4), 'clevel');
    expect((await listarEquipe(c, EVOLUT)).membros.find(x => x.id === m(4))?.papel).toBe('clevel');
    const { data, error } = await adminLocal().from('audit_logs').select('actor_member_id, workspace_id, new_values')
      .eq('entity_id', m(4)).eq('action', 'membro.papel_mudado').order('created_at', { ascending: false }).limit(1);
    expect(error).toBeNull();
    expect(data?.[0]).toMatchObject({ actor_member_id: m(3), workspace_id: EVOLUT, new_values: { papel_anterior: 'bdr', papel_novo: 'clevel' } });
  });
  it('duas suspensões simultâneas preservam o último C-level', async () => {
    const c = await entrarComoLocal('camila@althius.com.br');
    const r = await Promise.allSettled([suspenderMembroEquipe(c, EVOLUT, m(2), m(3)), suspenderMembroEquipe(c, EVOLUT, m(2), m(5))]);
    expect(r.filter(x => x.status === 'fulfilled')).toHaveLength(1);
    expect(r.filter(x => x.status === 'rejected')).toHaveLength(1);
    expect((await listarEquipe(c, EVOLUT)).membros.filter(x => x.papel === 'clevel' && x.status === 'active')).toHaveLength(1);
    const suspenso = r[0].status === 'fulfilled' ? 'aline@evolut.com.br' : 'mateus@evolut.com.br';
    expect((await listarEquipe(await entrarComoLocal(suspenso), EVOLUT)).membros).toEqual([]);
  });
  it('Grão Norte não lê ou altera membros e convites da Evolut', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const { convite } = await convidarEquipe(aline, EVOLUT, m(3), emailTeste(), 'bdr', randomUUID());
    const eduardo = await entrarComoLocal('eduardo@graonorte.com.br');
    expect(await listarEquipe(eduardo, EVOLUT)).toEqual({ membros: [], convites: [] });
    expect((await listarEquipe(eduardo, GRAO)).membros).toHaveLength(3);
    await expect(mudarPapelEquipe(eduardo, EVOLUT, m(9), m(4), 'clevel')).rejects.toThrow(/workspace/);
    await expect(suspenderMembroEquipe(eduardo, GRAO, m(9), m(4))).rejects.toThrow(/membro/);
    await expect(cancelarConviteEquipe(eduardo, EVOLUT, m(9), convite.id)).rejects.toThrow(/workspace/);
  });
  it('BDR não convida nem se passa pelo C-level', async () => {
    const c = await entrarComoLocal('lucas@evolut.com.br');
    await expect(convidarEquipe(c, EVOLUT, m(4), emailTeste(), 'bdr', randomUUID())).rejects.toThrow(/papel/);
    await expect(convidarEquipe(c, EVOLUT, m(3), emailTeste(), 'bdr', randomUUID())).rejects.toThrow(/logado/);
  });
  it('estrategista não cria superadmin e ninguém muda o próprio papel', async () => {
    const c = await entrarComoLocal('camila@althius.com.br');
    await expect(convidarEquipe(c, EVOLUT, m(2), emailTeste(), 'superadmin', randomUUID())).rejects.toThrow(/acima/);
    await expect(mudarPapelEquipe(c, EVOLUT, m(2), m(2), 'bdr')).rejects.toThrow(/próprio/);
  });
  it('rejeição de rede vira erro claro com Tentar de novo, sem sucesso inventado', async () => {
    const c = await entrarComoLocal('aline@evolut.com.br');
    const falho = new Proxy(c, { get(alvo, campo) {
      if (campo === 'rpc') return () => Promise.reject(new Error('fetch failed'));
      return Reflect.get(alvo, campo, alvo);
    } });
    await expect(convidarEquipe(falho, EVOLUT, m(3), emailTeste(), 'bdr', randomUUID())).rejects.toThrow(/Não foi possível.*Tentar de novo/);
  });

  it('falha do adaptador preserva convite e retry reutiliza registro e chave', async () => {
    const c = await entrarComoLocal('aline@evolut.com.br'), email = emailTeste(), chave = randomUUID();
    const envio: EnvioConviteEquipe = { async enviar() { throw new Error('provedor indisponível'); } };
    await expect(convidarEquipe(c, EVOLUT, m(3), email, 'bdr', chave, envio)).rejects.toThrow(/Convite registrado.*Tentar de novo/);
    const salvo = (await listarEquipe(c, EVOLUT)).convites.find(x => x.email === email)!;
    const tentativa = await convidarEquipe(c, EVOLUT, m(3), email, 'bdr', chave, new EnvioFalso());
    expect(tentativa.convite.id).toBe(salvo.id);
    expect(tentativa.convite.chave).toBe(chave);
  });
  it('falha ao ler perfis vira erro, sem inventar membros', async () => {
    const c = await entrarComoLocal('aline@evolut.com.br');
    const falho = new Proxy(c, { get(alvo, campo) {
      if (campo === 'from') return (tabela: string) => {
        if (tabela === 'profiles') throw new Error('sem rede');
        return alvo.from(tabela);
      };
      return Reflect.get(alvo, campo, alvo);
    } });
    await expect(listarEquipe(falho, EVOLUT)).rejects.toThrow(/Não foi possível.*Tentar de novo/);
  });
});
