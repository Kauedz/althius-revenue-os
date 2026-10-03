// @vitest-environment node
// Seam: Estrategia (pagina strategy) lista ICP e proposta de valor do workspace.
import { afterAll, describe, expect, it } from 'vitest';
import { SEM_DADOS, listarEstrategia, salvarEstrategia, definirSituacaoEstrategia } from './estrategia';
import { adminLocal, bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const GRAO = 'b0000000-0000-0000-0000-000000000001';
const CAMILA = 'd0000000-0000-0000-0000-000000000002';
const ALINE = 'd0000000-0000-0000-0000-000000000003';
const LUCAS = 'd0000000-0000-0000-0000-000000000004';
const EDUARDO = 'd0000000-0000-0000-0000-000000000009';
const NOME = 'ICP da Evolut no teste da tela';
const SO_LE = 'Seu papel só lê a estratégia.';
const NAO_VE = 'Seu papel não vê a estratégia.';
const NAO_PARTICIPA = 'Você não participa deste workspace.';
const ERRO_CARGA = 'Não foi possível carregar a estratégia.';
const EM_REVISAO = 'Em revisão';

function rpcOk(data: unknown) {
  return { rpc: () => Promise.resolve({ data, error: null }) } as any;
}

describe('listarEstrategia (unitario)', () => {
  it('rotula ICP e proposta e deixa o que nao existe como Sem dados ainda', async () => {
    const tela = await listarEstrategia(rpcOk({
      ok: true,
      pode_editar: true,
      itens: [
        { id: '1', kind: 'icp', name: 'ICP real', version: 'v2', status: 'ativo', body: 'texto', resp: 'Camila', updated_at: '2026-10-01T12:00:00Z' },
        { id: '2', kind: 'oferta', name: 'Oferta real', version: 'v1', status: 'em_revisao', body: '', resp: '', updated_at: '2026-09-01T12:00:00Z' },
        { id: '3', kind: 'icp', name: 'Rascunho', version: 'v9', status: 'rascunho', body: 'x', resp: 'Camila', updated_at: '2026-10-02T12:00:00Z' }
      ]
    }), 'ws', 'm');
    const texto = JSON.stringify(tela);
    expect(texto).not.toMatch(/US\$|dolar|Importadores|3\.420|Excluir tradings/);
    expect(tela.podeEditar).toBe(true);
    expect(tela.kpis[0]).toEqual(['ICP vigente', 'v2', SEM_DADOS]);
    expect(tela.kpis.slice(1).every((k: [string, string, string]) => k[1] === SEM_DADOS && k[2] === SEM_DADOS)).toBe(true);
    expect(tela.linhas[0]).toMatchObject({ nome: 'ICP real', tipo: 'ICP', versao: 'v2', status: 'Ativo', resp: 'Camila' });
    expect(tela.linhas[1]).toMatchObject({ nome: 'Oferta real', tipo: 'Proposta de valor', status: EM_REVISAO, resp: SEM_DADOS, desc: SEM_DADOS });
    expect(tela.linhas[2].status).toBe('Rascunho');
  });

  it('lista vazia nao inventa o prototipo', async () => {
    const tela = await listarEstrategia(rpcOk({ ok: true, pode_editar: false, itens: [] }), 'ws', 'm');
    expect(tela.linhas).toEqual([]);
    expect(tela.podeEditar).toBe(false);
    expect(tela.kpis.every((k: [string, string, string]) => k[1] === SEM_DADOS)).toBe(true);
    expect(JSON.stringify(tela)).not.toMatch(/Importadores|3\.420|Excluir tradings|v4/);
  });

  it('papel sem acesso vira a mensagem do banco', async () => {
    await expect(listarEstrategia(rpcOk({ ok: false, erro: NAO_VE }), 'ws', 'm')).rejects.toThrow(NAO_VE);
  });

  it('falha de rede vira erro claro', async () => {
    const cliente = { rpc: () => Promise.resolve({ data: null, error: { message: 'x', code: '08000' } }) } as any;
    await expect(listarEstrategia(cliente, 'ws', 'm')).rejects.toThrow(ERRO_CARGA);
  });
});

describe('salvarEstrategia (unitario)', () => {
  it('devolve o erro de quem so le', async () => {
    const r = await salvarEstrategia(rpcOk({ ok: false, erro: SO_LE }), 'ws', 'm', { tipo: 'ICP', nome: 'X', versao: 'v1', texto: '' });
    expect(r).toEqual({ ok: false, mensagem: SO_LE });
  });
});

describe.skipIf(!bancoLocalNoAr)('Estrategia (banco local)', () => {
  const criados: string[] = [];
  afterAll(async () => {
    if (!criados.length) return;
    await adminLocal().from('strategy_items').delete().in('id', criados);
  });

  it('estrategista grava, C-level le sem editar, BDR nao ve, Grao Norte nao ve a Evolut', async () => {
    const camila = await entrarComoLocal('camila@althius.com.br');
    const salvo = await salvarEstrategia(camila, EVOLUT, CAMILA, { tipo: 'ICP', nome: NOME, versao: 'v9', texto: 'Texto do teste' });
    expect(salvo.ok).toBe(true);
    if (salvo.ok) criados.push(salvo.id);
    const tela = await listarEstrategia(camila, EVOLUT, CAMILA);
    expect(tela.podeEditar).toBe(true);
    expect(tela.linhas.some(l => l.nome === NOME && l.versao === 'v9' && l.status === 'Rascunho')).toBe(true);
    expect(tela.kpis[0][1]).toBe(SEM_DADOS);
    const id = tela.linhas.find(l => l.nome === NOME)!.id;
    const pub = await definirSituacaoEstrategia(camila, EVOLUT, CAMILA, id, 'ativo');
    expect(pub).toEqual({ ok: true });
    const depois = await listarEstrategia(camila, EVOLUT, CAMILA);
    expect(depois.kpis[0][1]).toBe('v9');
    expect(depois.linhas.find(l => l.id === id)?.status).toBe('Ativo');

    const aline = await entrarComoLocal('aline@evolut.com.br');
    const leitura = await listarEstrategia(aline, EVOLUT, ALINE);
    expect(leitura.podeEditar).toBe(false);
    expect(leitura.linhas.some(l => l.nome === NOME)).toBe(true);
    const negado = await salvarEstrategia(aline, EVOLUT, ALINE, { tipo: 'Proposta de valor', nome: 'Oferta da Aline no teste', versao: 'v1', texto: 'nao' });
    expect(negado).toEqual({ ok: false, mensagem: SO_LE });

    const lucas = await entrarComoLocal('lucas@evolut.com.br');
    await expect(listarEstrategia(lucas, EVOLUT, LUCAS)).rejects.toThrow(NAO_VE);

    const eduardo = await entrarComoLocal('eduardo@graonorte.com.br');
    await expect(listarEstrategia(eduardo, EVOLUT, EDUARDO)).rejects.toThrow(NAO_PARTICIPA);
    const grao = await listarEstrategia(eduardo, GRAO, EDUARDO);
    expect(JSON.stringify(grao)).not.toContain(NOME);
    expect(grao.kpis[0][1]).toBe(SEM_DADOS);
  });
});
