// @vitest-environment node
// Seam: serviço da página de Integrações no modo real. Fala com o banco (estado) e com o backend (iniciar, desconectar).
// Nunca mostra token nem dólar; todo erro vira uma mensagem para a pessoa.
import { describe, expect, it } from 'vitest';
import { carregarIntegracoes, desconectarIntegracao, iniciarConexaoIntegracao, montarConexoes, resultadoDaConexao } from './integracoes';

const sessao = (token: string | null = 'jwt-1') => ({ auth: { getSession: async () => ({ data: { session: token ? { access_token: token } : null } }) } });
const clienteComRpc = (data: unknown, error: unknown = null) => ({ ...sessao(), rpc: async (nome: string, args: unknown) => { (clienteComRpc as unknown as { visto: unknown }).visto = [nome, args]; return { data, error }; } }) as any;
const resposta = (status: number, corpo: unknown) => (async () => new Response(JSON.stringify(corpo), { status })) as unknown as typeof fetch;

describe('carregar o estado das integrações', () => {
  it('lê o estado do banco e devolve só o que a pessoa conectou, com a conta do app', async () => {
    const c = clienteComRpc([
      { integracao: 'notion', habilitada: true, portal: null, meu_estado: 'conectado', minha_conta: 'Acme', conectados: 2 },
      { integracao: 'hubspot', habilitada: true, portal: 'p1', meu_estado: null, minha_conta: null, conectados: 1 },
      { integracao: 'apollo', habilitada: true, portal: null, meu_estado: 'precisa_reconectar', minha_conta: null, conectados: 0 }
    ]);
    const r = await carregarIntegracoes(c, 'ws-1');
    expect(r).toEqual({ notion: { estado: 'conectado', conta: 'Acme', conectados: 2 }, apollo: { estado: 'precisa_reconectar', conta: null, conectados: 0 } });
    expect((clienteComRpc as unknown as { visto: unknown }).visto).toEqual(['integration_estado', { p_workspace_id: 'ws-1' }]);
  });
  it('banco com erro: erro claro (nunca devolve estado inventado)', async () => {
    await expect(carregarIntegracoes(clienteComRpc(null, { message: 'x' }), 'ws-1')).rejects.toThrow(/integrações/i);
  });
  it('resposta fora do formato vira lista vazia, sem quebrar a tela', async () => {
    expect(await carregarIntegracoes(clienteComRpc({ qualquer: 1 }), 'ws-1')).toEqual({});
  });
});

describe('iniciar a conexão', () => {
  const pedir = (buscar: typeof fetch, cliente = sessao() as any) => iniciarConexaoIntegracao(cliente, 'ws-1', 'm-1', 'notion', buscar);

  it('manda o login e o pedido ao backend e devolve o link de consentimento', async () => {
    let visto: { url: string; auth: string; corpo: unknown } | null = null;
    const buscar = (async (u: string, init: RequestInit) => { visto = { url: u, auth: (init.headers as Record<string, string>).Authorization, corpo: JSON.parse(String(init.body)) }; return new Response(JSON.stringify({ url: 'https://mcp.notion.com/authorize?x=1' }), { status: 200 }); }) as unknown as typeof fetch;
    expect(await pedir(buscar)).toEqual({ ok: true, url: 'https://mcp.notion.com/authorize?x=1' });
    expect(visto).toEqual({ url: '/integracoes/iniciar', auth: 'Bearer jwt-1', corpo: { workspaceId: 'ws-1', membroId: 'm-1', integracao: 'notion' } });
  });
  it('sem sessão: pede para entrar de novo, sem chamar o backend', async () => {
    let chamou = 0;
    const r = await pedir((async () => { chamou++; return new Response('{}'); }) as unknown as typeof fetch, sessao(null) as any);
    expect(r).toMatchObject({ ok: false });
    expect((r as { mensagem: string }).mensagem).toMatch(/sessão/i);
    expect(chamou).toBe(0);
  });
  const CASOS: Array<[number, unknown, RegExp]> = [
    [403, { erro: 'sem_permissao' }, /C-level, estrategista e superadmin/],
    [409, { erro: 'em_breve', motivo: 'O servidor da Gong está em preview fechado.' }, /preview fechado/],
    [409, { erro: 'canal_de_mensagens' }, /Caixa de entrada/],
    [503, { erro: 'nao_configurada' }, /configurada pela Althius/],
    [503, { erro: 'integracoes_indisponiveis' }, /não está disponível neste ambiente/],
    [502, { erro: 'indisponivel' }, /Tente de novo/],
    [401, { erro: 'nao_autorizado' }, /sessão/i]
  ];
  for (const [status, corpo, esperado] of CASOS) {
    it(`status ${status} (${(corpo as { erro: string }).erro}) vira uma mensagem clara`, async () => {
      const r = await pedir(resposta(status, corpo));
      expect(r.ok).toBe(false);
      expect((r as { mensagem: string }).mensagem).toMatch(esperado);
    });
  }
  it('só aceita link seguro (https); rede fora do ar vira mensagem', async () => {
    expect((await pedir(resposta(200, { url: 'http://inseguro.test' }))).ok).toBe(false);
    expect((await pedir(resposta(200, { url: 'javascript:alert(1)' }))).ok).toBe(false);
    expect((await pedir((async () => { throw new Error('rede'); }) as unknown as typeof fetch)).ok).toBe(false);
  });
  it('canal de mensagem: o mesmo pedido, o backend repassa à Unipile e devolve o link', async () => {
    const r = await iniciarConexaoIntegracao(sessao() as any, 'ws-1', 'm-1', 'gmail', resposta(200, { url: 'https://hospedado.exemplo.test/x' }));
    expect(r).toEqual({ ok: true, url: 'https://hospedado.exemplo.test/x' });
  });
});

describe('desconectar', () => {
  it('chama o backend e confirma; falha vira mensagem', async () => {
    expect(await desconectarIntegracao(sessao() as any, 'ws-1', 'notion', resposta(200, { ok: true }))).toEqual({ ok: true });
    const r = await desconectarIntegracao(sessao() as any, 'ws-1', 'notion', resposta(502, { erro: 'falha_no_banco' }));
    expect(r.ok).toBe(false);
  });
});

describe('o aviso do retorno do consentimento', () => {
  it('sucesso: confirma com o nome do app', () => {
    expect(resultadoDaConexao('?conexao=ok&integracao=notion')).toEqual({ tipo: 'ok', titulo: 'Notion conectado', mensagem: 'Pronto: sua conta do Notion está conectada à Althius.' });
  });
  const MOTIVOS: Array<[string, RegExp]> = [
    ['recusada', /não autorizou/i], ['expirada', /venceu/i], ['usada', /já foi usado/i], ['invalida', /inválido/i],
    ['portal_diferente', /outro portal/i], ['portal_nao_identificado', /não conseguimos identificar o portal/i], ['indisponivel', /não respondeu/i], ['participacao_inativa', /não participa/i], ['qualquer-outro', /Não foi possível concluir/i]
  ];
  for (const [motivo, esperado] of MOTIVOS) {
    it(`erro "${motivo}" explica o que houve`, () => {
      const r = resultadoDaConexao(`?conexao=erro&integracao=notion&motivo=${motivo}`)!;
      expect(r.tipo).toBe('erro');
      expect(r.mensagem).toMatch(esperado);
    });
  }
  it('sem o parâmetro, ou com integração desconhecida, não mostra nada; nunca ecoa texto da URL', () => {
    expect(resultadoDaConexao('')).toBeNull();
    expect(resultadoDaConexao('?outra=coisa')).toBeNull();
    expect(resultadoDaConexao('?conexao=ok&integracao=<script>')).toBeNull();
    expect(JSON.stringify(resultadoDaConexao('?conexao=erro&integracao=notion&motivo=<b>x</b>'))).not.toContain('<b>');
  });
});

describe('o mapa de conectores conectados para os cartões', () => {
  it('junta os apps (OAuth) e as contas de mensagem (Caixa de entrada) por id do catálogo', () => {
    const mapa = montarConexoes(
      { notion: { estado: 'conectado', conta: 'Acme', conectados: 1 }, apollo: { estado: 'precisa_reconectar', conta: null, conectados: 0 } },
      { email: { conta: 'aline@evolut.com.br', via: 'gmail' }, linkedin: { conta: 'Aline X' }, whatsapp: null, instagram: null }
    );
    expect(Object.keys(mapa).sort()).toEqual(['apollo', 'gmail', 'linkedin', 'notion']);
    expect(mapa.notion).toMatchObject({ conta: 'Acme', agentes: [] });
    expect(mapa.notion.erro).toBeUndefined();
    expect(mapa.apollo.erro).toBe(true);
    expect(mapa.gmail.conta).toBe('aline@evolut.com.br');
    expect(mapa.linkedin.conta).toBe('Aline X');
  });
  it('e-mail pelo Outlook aparece no cartão do Outlook (não no do Gmail); sem nada conectado, mapa vazio', () => {
    const mapa = montarConexoes({}, { email: { conta: 'a@b.test', via: 'outlook' }, linkedin: null, whatsapp: null, instagram: null });
    expect(Object.keys(mapa)).toEqual(['outlook']);
    expect(montarConexoes({}, null)).toEqual({});
  });
});
