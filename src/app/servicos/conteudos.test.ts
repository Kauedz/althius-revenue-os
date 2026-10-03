// @vitest-environment node
// Seam: Conteudos lista a biblioteca. Rascunho cria e edita. Publicar nao finge aprovacao.
import { afterAll, describe, expect, it } from 'vitest';
import { SEM_DADOS, listarConteudos, publicarConteudo, salvarConteudo } from './conteudos';
import { adminLocal, bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const GRAO = 'b0000000-0000-0000-0000-000000000001';
const CAMILA = 'd0000000-0000-0000-0000-000000000002';
const LUCAS = 'd0000000-0000-0000-0000-000000000004';
const EDUARDO = 'd0000000-0000-0000-0000-000000000009';
const NOME = 'Conteudo da Evolut no teste da tela';
const NAO_EDITA = 'Seu papel não edita conteúdo.';
const NAO_PARTICIPA = 'Você não participa deste workspace.';
const PUBLICADO = 'Conteúdo publicado.';
const NAO_PUBLICADO = 'A publicação foi para Aprovações. O conteúdo não foi publicado.';

function rpcOk(data: unknown) {
  return { rpc: () => Promise.resolve({ data, error: null }) } as any;
}

describe('listarConteudos (unitario)', () => {
  it('rotula formato e status e deixa persona vazia como Sem dados ainda', async () => {
    const tela = await listarConteudos(rpcOk({
      ok: true,
      pode_editar: true,
      itens: [
        { id: '1', name: 'Peca real', format: 'email', persona: '', body: 'ola', status: 'rascunho', updated_at: '2026-10-01' },
        { id: '2', name: 'Outra', format: 'anuncio', persona: 'Financeiro', body: '', status: 'ativo', updated_at: '2026-09-01' }
      ]
    }), 'ws', 'm');
    const texto = JSON.stringify(tela);
    expect(texto).not.toMatch(/US\$|R\$|E-mail T1|Guia: conta e ordem|gatekeeper/);
    expect(tela.podeEditar).toBe(true);
    expect(tela.linhas[0]).toMatchObject({ nome: 'Peca real', formato: 'E-mail', persona: SEM_DADOS, status: 'Rascunho', texto: 'ola' });
    expect(tela.linhas[1]).toMatchObject({ formato: 'Anúncio', persona: 'Financeiro', status: 'Ativo', texto: SEM_DADOS });
  });

  it('lista vazia nao inventa o prototipo', async () => {
    const tela = await listarConteudos(rpcOk({ ok: true, pode_editar: false, itens: [] }), 'ws', 'm');
    expect(tela.linhas).toEqual([]);
    expect(JSON.stringify(tela)).not.toMatch(/Supply Chain|gatekeeper|3 erros/);
  });

  it('falha de rede vira erro claro', async () => {
    const cliente = { rpc: () => Promise.resolve({ data: null, error: { message: 'x' } }) } as any;
    await expect(listarConteudos(cliente, 'ws', 'm')).rejects.toThrow('Não foi possível carregar os conteúdos.');
  });

  it('publicar que pede aprovacao devolve a mensagem sem dizer que publicou', async () => {
    const r = await publicarConteudo(rpcOk({ ok: true, destino: 'aprovacao', mensagem: NAO_PUBLICADO }), 'ws', 'm', '1');
    expect(r).toEqual({ ok: true, destino: 'aprovacao', mensagem: NAO_PUBLICADO });
  });
});

describe.skipIf(!bancoLocalNoAr)('Conteudos (banco local)', () => {
  const criados: string[] = [];
  afterAll(async () => {
    if (!criados.length) return;
    const admin = adminLocal();
    const aprovs = await admin.from('approvals').select('id, payload_json');
    const idsAprov = (aprovs.data || []).filter(a => criados.includes(String((a.payload_json as { content_id?: string } | null)?.content_id))).map(a => a.id);
    if (idsAprov.length) {
      await admin.from('notifications').delete().in('entity_id', idsAprov);
      await admin.from('approvals').delete().in('id', idsAprov);
    }
    const execs = await admin.from('executions').select('id, metadata_json');
    const idsExec = (execs.data || []).filter(e => criados.includes(String((e.metadata_json as { content_id?: string } | null)?.content_id))).map(e => e.id);
    if (idsExec.length) await admin.from('executions').delete().in('id', idsExec);
    await admin.from('content_items').delete().in('id', criados);
  });

  it('estrategista cria, publica e editar volta a rascunho; BDR nao edita; Grao Norte nao ve', async () => {
    const camila = await entrarComoLocal('camila@althius.com.br');
    const salvo = await salvarConteudo(camila, EVOLUT, CAMILA, { nome: NOME, formato: 'E-mail', persona: '', texto: 'Texto do teste' });
    expect(salvo.ok).toBe(true);
    if (salvo.ok) criados.push(salvo.id);
    const tela = await listarConteudos(camila, EVOLUT, CAMILA);
    expect(tela.podeEditar).toBe(true);
    expect(tela.linhas.find(l => l.nome === NOME)).toMatchObject({ status: 'Rascunho', formato: 'E-mail', persona: SEM_DADOS });
    const id = tela.linhas.find(l => l.nome === NOME)!.id;
    const pub = await publicarConteudo(camila, EVOLUT, CAMILA, id);
    expect(pub).toEqual({ ok: true, destino: 'publicado', mensagem: PUBLICADO });
    const ativo = await listarConteudos(camila, EVOLUT, CAMILA);
    expect(ativo.linhas.find(l => l.id === id)?.status).toBe('Ativo');
    const editado = await salvarConteudo(camila, EVOLUT, CAMILA, { id, nome: NOME + ' editado', formato: 'Post', persona: '', texto: 'Texto novo' });
    expect(editado.ok).toBe(true);
    const depois = await listarConteudos(camila, EVOLUT, CAMILA);
    expect(depois.linhas.find(l => l.id === id)).toMatchObject({ nome: NOME + ' editado', formato: 'Post', status: 'Rascunho' });
    expect(JSON.stringify(depois)).not.toMatch(/US\$|R\$|E-mail T1|gatekeeper/);

    const lucas = await entrarComoLocal('lucas@evolut.com.br');
    const negado = await salvarConteudo(lucas, EVOLUT, LUCAS, { nome: 'Conteudo do Lucas no teste', formato: 'PDF', persona: '', texto: 'nao' });
    expect(negado).toEqual({ ok: false, mensagem: NAO_EDITA });
    const leitura = await listarConteudos(lucas, EVOLUT, LUCAS);
    expect(leitura.podeEditar).toBe(false);
    expect(leitura.linhas.some(l => l.id === id)).toBe(true);

    const eduardo = await entrarComoLocal('eduardo@graonorte.com.br');
    await expect(listarConteudos(eduardo, EVOLUT, EDUARDO)).rejects.toThrow(NAO_PARTICIPA);
    const grao = await listarConteudos(eduardo, GRAO, EDUARDO);
    expect(JSON.stringify(grao)).not.toContain(NOME);
    expect(grao.linhas).toEqual([]);
  });
});
