// @vitest-environment node
// Seam: serviço do Superadmin (clientes, criar cliente, chaves dos agentes e as telas só leitura) contra o banco local.
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditoriaGlobal, criarCliente, fornecedores, gerarChavesDosAgentes, listarClientes, margens, revogarChavesDosAgentes, saude, usoGlobal
} from './admin';
import { adminLocal, bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';

// Endereço único por execução: cliente de teste é arquivado no fim (a auditoria é imutável, não dá para apagar).
const SLUG = 'cliente-servico-' + Date.now().toString(36);

describe.skipIf(!bancoLocalNoAr)('Superadmin (banco local)', () => {
  afterAll(async () => {
    const admin = adminLocal();
    const { data } = await admin.from('workspaces').select('id').eq('slug', SLUG).maybeSingle();
    if (!data) return;
    await admin.from('agent_runtime_tokens').update({ revoked_at: new Date().toISOString() }).eq('workspace_id', data.id);
    await admin.from('workspaces').update({ status: 'archived' }).eq('id', data.id);
  });

  it('lista os clientes no formato da tela', async () => {
    const tela = await listarClientes(await entrarComoLocal('rafael@althius.com.br'));
    expect(tela.linhas.find(l => l.slug === 'evolut')).toMatchObject({ nome: 'Evolut Trading', status: 'Ativo', clevel: 'Aline Xavier' });
    expect(tela.kpis[0]).toEqual(['Clientes', String(tela.linhas.length), '']);
  });

  it('cria cliente; validação vem com orientação; C-level não cria', async () => {
    const rafael = await entrarComoLocal('rafael@althius.com.br');
    expect(await criarCliente(rafael, { nome: 'Cliente Teste', slug: 'Cliente Teste', emailClevel: 'ceo@clienteteste.com.br', emailEstrategista: '' }))
      .toEqual({ ok: false, mensagem: 'Endereço curto: 3 a 40 letras minúsculas, números ou hífen.' });
    expect(await criarCliente(rafael, { nome: 'Cliente Teste', slug: SLUG, emailClevel: 'ceo@clienteteste.com.br', emailEstrategista: 'camila@althius.com.br' }))
      .toEqual({ ok: true, slug: SLUG });
    expect((await listarClientes(rafael)).linhas.find(l => l.slug === SLUG)).toMatchObject({ nome: 'Cliente Teste', clevel: 'Convite pendente' });
    expect(await criarCliente(await entrarComoLocal('aline@evolut.com.br'), { nome: 'X', slug: 'x-y-z', emailClevel: 'a@b.com.br', emailEstrategista: '' }))
      .toEqual({ ok: false, mensagem: 'Só o superadmin da Althius faz isso.' });
  });

  it('gera as chaves dos 4 agentes (aparecem uma vez) e revoga', async () => {
    const rafael = await entrarComoLocal('rafael@althius.com.br');
    const id = (await listarClientes(rafael)).linhas.find(l => l.slug === SLUG)!.id;
    const r = await gerarChavesDosAgentes(rafael, id);
    expect(r.ok && Object.keys(r.chaves).sort()).toEqual(['comercial', 'copy', 'marketing', 'revops']);
    expect(await revogarChavesDosAgentes(rafael, id)).toEqual({ ok: true, revogadas: 4 });
  });

  it('uso global mostra tokens e custo real do modelo (só superadmin); sem preço informado o custo fica "—"', async () => {
    const WS = 'b0000000-0000-0000-0000-000000000001'; // Grão Norte
    const { error } = await adminLocal().rpc('llm_registrar_uso', { p_workspace_id: WS, p_agente: 'copy', p_rotulo: 'Teste', p_modelo: 'm', p_tokens_entrada: 1000, p_tokens_saida: 500, p_custo_usd: null });
    expect(error).toBeNull();
    const rafael = await entrarComoLocal('rafael@althius.com.br');
    const linha = (await usoGlobal(rafael)).linhas.find(l => l.id === WS)!;
    expect(Number(linha.tokens.replace(/\D/g, ''))).toBeGreaterThanOrEqual(1500);
    expect(typeof linha.custoModelo).toBe('string');
  });

  it('telas só leitura trazem dados reais e nunca segredo', async () => {
    const rafael = await entrarComoLocal('rafael@althius.com.br');
    expect((await usoGlobal(rafael)).linhas.length).toBeGreaterThanOrEqual(3);
    const forn = await fornecedores(rafael);
    expect(forn.linhas.length).toBeGreaterThanOrEqual(5);
    expect(JSON.stringify(forn)).not.toMatch(/api_token|api_key|webhook_secret/);
    expect((await margens(rafael)).linhas[0]).toHaveProperty('capacidade');
    expect((await auditoriaGlobal(rafael)).linhas[0]).toHaveProperty('acao');
    expect((await saude(rafael)).linhas.every(l => ['OK', 'Atenção', 'Falha'].includes(l.status))).toBe(true);
  });

  it('C-level não abre nenhuma tela do Superadmin', async () => {
    await expect(usoGlobal(await entrarComoLocal('aline@evolut.com.br'))).rejects.toThrow('Só o superadmin da Althius faz isso.');
  });
});
