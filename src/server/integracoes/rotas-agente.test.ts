// @vitest-environment node
// O agente LÊ nos apps conectados (ticket 04 dos agentes conectados), com o acesso de QUEM PEDIU na rodada em andamento
// (decisão do dono). Só ferramentas marcadas como somente leitura; o token do app nunca chega ao agente; tudo vai para a
// auditoria. Servidor do app e banco são FALSOS: nenhum app real é chamado.
import { describe, expect, it } from 'vitest';
import { chaveMestra, cifrar } from '../cofre/cifra.ts';
import { chamarDoAgente, ferramentasDoAgente, proporDoAgente } from './agente.ts';
import type { DepsIntegracoes } from './rotas.ts';
import { bancoFalso } from './mundo-falso.ts';
import { servidorMcpFalso } from './servidor-mcp-falso.ts';
import type { FerramentaMcp } from './mcp-cliente.ts';

const CHAVE = chaveMestra({ COFRE_CHAVE_MESTRA: Buffer.alloc(32, 3).toString('base64') });
const WS = 'ws-1';
const TOKEN_ZOE = 'alt_agente_zoe';
const TOKEN_JAX_OUTRO_CLIENTE = 'alt_agente_outro_cliente';
const TOKEN_PAUSADA = 'alt_agente_pausada';
const TOKEN_SEM_PEDIDO = 'alt_agente_sem_pedido';

const FERRAMENTAS: FerramentaMcp[] = [
  { name: 'get_crm_objects', description: 'Lê objetos do CRM.', inputSchema: { type: 'object', properties: { id: { type: 'string' } } }, annotations: { readOnlyHint: true } },
  { name: 'search_owners', description: 'Busca donos.', inputSchema: { type: 'object' }, annotations: { readOnlyHint: true } },
  { name: 'manage_crm_objects', description: 'Cria ou muda objetos.', inputSchema: { type: 'object' }, annotations: { readOnlyHint: false } },
  { name: 'ferramenta_sem_marca', description: 'Sem anotação.', inputSchema: { type: 'object' } }
];

type Resultados = NonNullable<NonNullable<Parameters<typeof servidorMcpFalso>[0]>['resultados']>;
function montar(o: { resultados?: Resultados; ferramentas?: FerramentaMcp[] } = {}) {
  const mundo = bancoFalso({
    agentes: {
      [TOKEN_ZOE]: { workspaceId: WS, agente: 'comercial', solicitanteId: 'm-aline' },
      [TOKEN_SEM_PEDIDO]: { workspaceId: WS, agente: 'copy', solicitanteId: null },
      [TOKEN_PAUSADA]: { pausado: true },
      [TOKEN_JAX_OUTRO_CLIENTE]: { workspaceId: 'ws-2', agente: 'comercial', solicitanteId: 'm-outro' }
    }
  });
  const mcp = servidorMcpFalso({
    token: 'acc-aline', ferramentas: o.ferramentas ?? FERRAMENTAS,
    resultados: o.resultados ?? { get_crm_objects: { content: [{ type: 'text', text: '{"negocio":"Serra Azul","valor":1500}' }] }, search_owners: { content: [{ type: 'text', text: '[]' }] } }
  });
  const deps: DepsIntegracoes = { banco: mundo.banco, chave: CHAVE, siteUrl: 'https://app.althius.test', buscar: mcp.fetch as typeof fetch, agora: () => 1_000_000 };
  const conectar = async (ws: string, membro: string, token: string, integracao = 'hubspot') => {
    await mundo.banco.acessoSalvar({ workspaceId: ws, membroId: membro, integracao, conta: 'ana@norte.test', portal: null, accessCifrado: cifrar(token, CHAVE), refreshCifrado: null, expiraEm: null, clientId: 'cid', issuer: 'https://mcp.hubspot.com', escopo: null });
  };
  return { deps, mundo, mcp, conectar };
}
const chamadasDeFerramenta = (mcp: ReturnType<typeof montar>['mcp']) => mcp.chamadas.filter(c => c.rpc === 'tools/call');

describe('quem pode usar a ponte', () => {
  it('sem token de agente, ou com um que não é de agente: 401', async () => {
    const m = montar();
    expect((await ferramentasDoAgente(m.deps, '', { integracao: 'hubspot' })).status).toBe(401);
    expect((await ferramentasDoAgente(m.deps, 'jwt-de-pessoa', { integracao: 'hubspot' })).status).toBe(401);
    expect(m.mcp.chamadas).toHaveLength(0);
  });
  it('token de agente inventado: 401 (o banco decide)', async () => {
    const m = montar();
    expect((await ferramentasDoAgente(m.deps, 'alt_agente_inventado', { integracao: 'hubspot' })).status).toBe(401);
  });
  it('agente pausado pelo cliente: 403, sem falar com o app', async () => {
    const m = montar();
    const r = await ferramentasDoAgente(m.deps, TOKEN_PAUSADA, { integracao: 'hubspot' });
    expect(r.status).toBe(403);
    expect(r.corpo.erro).toBe('agente_pausado');
    expect(m.mcp.chamadas).toHaveLength(0);
  });
  it('sem pedido em andamento (nenhuma pessoa pediu agora): 409 e o acesso de ninguém é usado', async () => {
    const m = montar();
    await m.conectar(WS, 'm-aline', 'acc-aline');
    const r = await ferramentasDoAgente(m.deps, TOKEN_SEM_PEDIDO, { integracao: 'hubspot' });
    expect(r.status).toBe(409);
    expect(r.corpo.erro).toBe('sem_pedido_em_andamento');
    expect(m.mcp.chamadas).toHaveLength(0);
  });
  it('integração desconhecida: 404; "em breve": 409; canal de mensagens: 409 (conta de mensagem não é desta ponte)', async () => {
    const m = montar();
    expect((await ferramentasDoAgente(m.deps, TOKEN_ZOE, { integracao: 'inventada' })).status).toBe(404);
    expect((await ferramentasDoAgente(m.deps, TOKEN_ZOE, { integracao: 'rdstation' })).status).toBe(409);
    const canal = await ferramentasDoAgente(m.deps, TOKEN_ZOE, { integracao: 'gmail' });
    expect(canal.status).toBe(409);
    expect(canal.corpo.erro).toBe('canal_de_mensagens');
    expect(m.mcp.chamadas).toHaveLength(0);
  });
  it('pedido sem integração: 400', async () => {
    expect((await ferramentasDoAgente(montar().deps, TOKEN_ZOE, {})).status).toBe(400);
  });
});

describe('o acesso é o de quem pediu', () => {
  it('quem pediu ainda não conectou o app: 409 "precisa conectar", sem chamar o app', async () => {
    const m = montar();
    const r = await ferramentasDoAgente(m.deps, TOKEN_ZOE, { integracao: 'hubspot' });
    expect(r.status).toBe(409);
    expect(r.corpo.erro).toBe('precisa_conectar');
    expect(String(r.corpo.mensagem)).toMatch(/quem pediu/i);
    expect(String(r.corpo.mensagem)).toMatch(/HubSpot/);
    expect(m.mcp.chamadas).toHaveLength(0);
  });
  it('o acesso de OUTRA pessoa do mesmo cliente não vale (cada pessoa usa só o próprio)', async () => {
    const m = montar();
    await m.conectar(WS, 'm-camila', 'acc-camila'); // Camila conectou, mas quem pediu foi a Aline
    const r = await ferramentasDoAgente(m.deps, TOKEN_ZOE, { integracao: 'hubspot' });
    expect(r.corpo.erro).toBe('precisa_conectar');
    expect(m.mcp.chamadas).toHaveLength(0);
  });
  it('o agente não escolhe o workspace nem a pessoa: campos extras no pedido são ignorados', async () => {
    const m = montar();
    await m.conectar(WS, 'm-aline', 'acc-aline');
    await m.conectar(WS, 'm-camila', 'acc-camila');
    const r = await ferramentasDoAgente(m.deps, TOKEN_ZOE, { integracao: 'hubspot', workspaceId: 'ws-2', membroId: 'm-camila' } as never);
    expect(r.status).toBe(200);
    expect(m.mcp.chamadas.every(c => c.cabecalhos.authorization === 'Bearer acc-aline')).toBe(true);
  });
  it('o acesso de outro cliente nunca é usado (isolamento por workspace)', async () => {
    const m = montar();
    await m.conectar('ws-2', 'm-outro', 'acc-outro');
    const r = await ferramentasDoAgente(m.deps, TOKEN_ZOE, { integracao: 'hubspot' });
    expect(r.corpo.erro).toBe('precisa_conectar');
    expect(m.mcp.chamadas).toHaveLength(0);
  });
  it('acesso revogado pelo app: marca "precisa reconectar" e avisa', async () => {
    const m = montar();
    await m.conectar(WS, 'm-aline', 'token-velho-recusado');
    const r = await ferramentasDoAgente(m.deps, TOKEN_ZOE, { integracao: 'hubspot' });
    expect(r.status).toBe(409);
    expect(r.corpo.erro).toBe('precisa_reconectar');
    expect(m.mundo.chamadas).toContain('marcar:precisa_reconectar');
  });
});

describe('listar o que dá para ler', () => {
  it('só as ferramentas somente leitura, com a fonte; escrita e sem marca nunca aparecem', async () => {
    const m = montar();
    await m.conectar(WS, 'm-aline', 'acc-aline');
    const r = await ferramentasDoAgente(m.deps, TOKEN_ZOE, { integracao: 'hubspot' });
    expect(r.status).toBe(200);
    expect(r.corpo.fonte).toBe('HubSpot');
    const nomes = (r.corpo.ferramentas as Array<{ nome: string }>).map(f => f.nome);
    expect(nomes).toEqual(['get_crm_objects', 'search_owners']);
  });
  it('a lista é COMPACTA (descrição curta, sem parâmetros): descrições enormes de apps reais confundem o modelo', async () => {
    const longa = 'REQUIRED FIRST STEP: ' + 'x'.repeat(5000);
    const m = montar({ ferramentas: [{ name: 'get_crm_objects', description: longa, inputSchema: { type: 'object', properties: { id: { type: 'string' } } }, annotations: { readOnlyHint: true } }] });
    await m.conectar(WS, 'm-aline', 'acc-aline');
    const r = await ferramentasDoAgente(m.deps, TOKEN_ZOE, { integracao: 'hubspot' });
    const f = (r.corpo.ferramentas as Array<{ nome: string; descricao: string; parametros?: unknown }>)[0];
    expect(f.descricao.length).toBeLessThanOrEqual(160);
    expect(f.parametros).toBeUndefined();
    expect(JSON.stringify(r).length).toBeLessThan(1000);
  });
  it('o detalhe de UMA ferramenta (descrição inteira e parâmetros) vem sob pedido; só de leitura', async () => {
    const m = montar();
    await m.conectar(WS, 'm-aline', 'acc-aline');
    const r = await ferramentasDoAgente(m.deps, TOKEN_ZOE, { integracao: 'hubspot', ferramenta: 'get_crm_objects' });
    expect(r.status).toBe(200);
    expect(r.corpo.ferramenta).toMatchObject({ nome: 'get_crm_objects', parametros: { type: 'object', properties: { id: { type: 'string' } } } });
    for (const nome of ['manage_crm_objects', 'ferramenta_sem_marca', 'nao_existe']) {
      const x = await ferramentasDoAgente(m.deps, TOKEN_ZOE, { integracao: 'hubspot', ferramenta: nome });
      expect(x.status, nome).toBe(404);
      expect(x.corpo.erro, nome).toBe('ferramenta_nao_encontrada');
    }
  });
  it('o token do app nunca aparece na resposta', async () => {
    const m = montar();
    await m.conectar(WS, 'm-aline', 'acc-aline');
    const r = await ferramentasDoAgente(m.deps, TOKEN_ZOE, { integracao: 'hubspot' });
    expect(JSON.stringify(r)).not.toContain('acc-aline');
  });
});

describe('ler de verdade', () => {
  it('chama a ferramenta de leitura com o token de quem pediu, devolve o texto e a fonte, e audita sem guardar os argumentos', async () => {
    const m = montar();
    await m.conectar(WS, 'm-aline', 'acc-aline');
    const r = await chamarDoAgente(m.deps, TOKEN_ZOE, { integracao: 'hubspot', ferramenta: 'get_crm_objects', argumentos: { id: 'SEGREDO-NO-ARGUMENTO' } });
    expect(r.status).toBe(200);
    expect(r.corpo).toMatchObject({ ok: true, fonte: 'HubSpot', cortado: false });
    expect(String(r.corpo.resultado)).toContain('Serra Azul');
    expect(chamadasDeFerramenta(m.mcp)).toHaveLength(1);
    expect(chamadasDeFerramenta(m.mcp)[0].corpo?.params).toMatchObject({ name: 'get_crm_objects', arguments: { id: 'SEGREDO-NO-ARGUMENTO' } });
    expect(m.mundo.auditoria).toEqual([{ workspaceId: WS, agente: 'comercial', membroId: 'm-aline', integracao: 'hubspot', ferramenta: 'get_crm_objects', resultado: 'ok' }]);
    expect(JSON.stringify(m.mundo.auditoria)).not.toContain('SEGREDO-NO-ARGUMENTO');
    expect(JSON.stringify(r)).not.toContain('acc-aline');
  });
  it('ferramenta que ESCREVE nunca roda, mesmo que o modelo peça: 403, o app não recebe a chamada, auditoria "negado"', async () => {
    const m = montar();
    await m.conectar(WS, 'm-aline', 'acc-aline');
    const r = await chamarDoAgente(m.deps, TOKEN_ZOE, { integracao: 'hubspot', ferramenta: 'manage_crm_objects', argumentos: {} });
    expect(r.status).toBe(403);
    expect(r.corpo.erro).toBe('ferramenta_nao_permitida');
    expect(chamadasDeFerramenta(m.mcp)).toHaveLength(0);
    expect(m.mundo.auditoria[0]).toMatchObject({ ferramenta: 'manage_crm_objects', resultado: 'negado' });
  });
  it('ferramenta sem marca de leitura, ou que não existe: o mesmo 403 (não revela o que existe)', async () => {
    const m = montar();
    await m.conectar(WS, 'm-aline', 'acc-aline');
    for (const nome of ['ferramenta_sem_marca', 'nao_existe']) {
      const r = await chamarDoAgente(m.deps, TOKEN_ZOE, { integracao: 'hubspot', ferramenta: nome, argumentos: {} });
      expect(r.status, nome).toBe(403);
      expect(r.corpo.erro, nome).toBe('ferramenta_nao_permitida');
    }
    expect(chamadasDeFerramenta(m.mcp)).toHaveLength(0);
  });
  it('pedido torto: sem ferramenta ou com argumentos que não são um objeto: 400', async () => {
    const m = montar();
    await m.conectar(WS, 'm-aline', 'acc-aline');
    expect((await chamarDoAgente(m.deps, TOKEN_ZOE, { integracao: 'hubspot' })).status).toBe(400);
    expect((await chamarDoAgente(m.deps, TOKEN_ZOE, { integracao: 'hubspot', ferramenta: 'get_crm_objects', argumentos: 'texto' } as never)).status).toBe(400);
  });
  it('resposta enorme é cortada COM aviso', async () => {
    const m = montar({ resultados: { get_crm_objects: { content: [{ type: 'text', text: 'x'.repeat(50_000) }] } } });
    await m.conectar(WS, 'm-aline', 'acc-aline');
    const r = await chamarDoAgente(m.deps, TOKEN_ZOE, { integracao: 'hubspot', ferramenta: 'get_crm_objects', argumentos: {} });
    expect(r.corpo.cortado).toBe(true);
    expect(String(r.corpo.resultado).length).toBeLessThan(21_000);
    expect(String(r.corpo.resultado)).toMatch(/cortado por tamanho/);
  });
  it('o app devolve erro: o agente recebe "o app recusou" (sem culpar o sistema) e a auditoria diz "erro"', async () => {
    const m = montar({ resultados: { get_crm_objects: { isError: true, content: [{ type: 'text', text: 'Objeto não encontrado' }] } } });
    await m.conectar(WS, 'm-aline', 'acc-aline');
    const r = await chamarDoAgente(m.deps, TOKEN_ZOE, { integracao: 'hubspot', ferramenta: 'get_crm_objects', argumentos: {} });
    expect(r.status).toBe(200);
    expect(r.corpo).toMatchObject({ ok: false, erro: 'o_app_recusou' });
    expect(String(r.corpo.resultado)).toContain('Objeto não encontrado');
    expect(m.mundo.auditoria[0].resultado).toBe('erro');
  });
  it('token do app recusado no meio: marca "precisa reconectar" e avisa', async () => {
    const m = montar();
    await m.conectar(WS, 'm-aline', 'token-velho-recusado');
    const r = await chamarDoAgente(m.deps, TOKEN_ZOE, { integracao: 'hubspot', ferramenta: 'get_crm_objects', argumentos: {} });
    expect(r.status).toBe(409);
    expect(r.corpo.erro).toBe('precisa_reconectar');
  });
  it('a auditoria falhar não derruba a leitura (o registro é tentado, não bloqueia)', async () => {
    const m = montar();
    await m.conectar(WS, 'm-aline', 'acc-aline');
    m.deps.banco.auditarUsoDoAgente = async () => { throw new Error('banco fora'); };
    expect((await chamarDoAgente(m.deps, TOKEN_ZOE, { integracao: 'hubspot', ferramenta: 'get_crm_objects', argumentos: {} })).status).toBe(200);
  });
});

describe('achar a ferramenta de ESCRITA para propor (ticket 05)', () => {
  const comDestrutiva = [...FERRAMENTAS, { name: 'delete_crm_objects', description: 'Apaga.', inputSchema: { type: 'object' }, annotations: { readOnlyHint: false, destructiveHint: true } }];
  it('com escrita=true lista só as que mudam algo e NÃO apagam; sem a marca ou de leitura ficam de fora', async () => {
    const m = montar({ ferramentas: comDestrutiva });
    await m.conectar(WS, 'm-aline', 'acc-aline');
    const r = await ferramentasDoAgente(m.deps, TOKEN_ZOE, { integracao: 'hubspot', escrita: true });
    expect(r.status).toBe(200);
    expect((r.corpo.ferramentas as Array<{ nome: string }>).map(f => f.nome)).toEqual(['manage_crm_objects']);
    expect(r.corpo.tipo).toBe('escrita');
  });
  it('o detalhe de uma ferramenta de escrita vem só com escrita=true (e a de leitura só sem)', async () => {
    const m = montar({ ferramentas: comDestrutiva });
    await m.conectar(WS, 'm-aline', 'acc-aline');
    expect((await ferramentasDoAgente(m.deps, TOKEN_ZOE, { integracao: 'hubspot', ferramenta: 'manage_crm_objects', escrita: true })).status).toBe(200);
    expect((await ferramentasDoAgente(m.deps, TOKEN_ZOE, { integracao: 'hubspot', ferramenta: 'manage_crm_objects' })).status).toBe(404);
    expect((await ferramentasDoAgente(m.deps, TOKEN_ZOE, { integracao: 'hubspot', ferramenta: 'get_crm_objects', escrita: true })).status).toBe(404);
    expect((await ferramentasDoAgente(m.deps, TOKEN_ZOE, { integracao: 'hubspot', ferramenta: 'delete_crm_objects', escrita: true })).status).toBe(404);
  });
  it('listar as de escrita não executa nada e não altera o app', async () => {
    const m = montar();
    await m.conectar(WS, 'm-aline', 'acc-aline');
    await ferramentasDoAgente(m.deps, TOKEN_ZOE, { integracao: 'hubspot', escrita: true });
    expect(chamadasDeFerramenta(m.mcp)).toHaveLength(0);
  });
});

describe('propor uma ação num app (ticket 05): nada roda agora, vira aprovação', () => {
  const pedido = { integracao: 'hubspot', ferramenta: 'manage_crm_objects', argumentos: { id: '7', valor: 5000 }, motivo: 'O cliente confirmou o valor' };

  it('ferramenta que ESCREVE: vira proposta com o app, a conta e o motivo; o app NÃO recebe a chamada', async () => {
    const m = montar();
    await m.conectar(WS, 'm-aline', 'acc-aline');
    const r = await proporDoAgente(m.deps, TOKEN_ZOE, pedido);
    expect(r.status).toBe(200);
    expect(r.corpo).toMatchObject({ ok: true, status: 'aguardando_aprovacao', fonte: 'HubSpot' });
    expect(r.corpo.approval_id).toBeTruthy();
    expect(chamadasDeFerramenta(m.mcp)).toHaveLength(0);
    expect(m.mundo.propostas).toHaveLength(1);
    expect(m.mundo.propostas[0]).toMatchObject({ integracao: 'hubspot', ferramenta: 'manage_crm_objects', appNome: 'HubSpot', conta: 'ana@norte.test', motivo: 'O cliente confirmou o valor', argumentos: { id: '7', valor: 5000 } });
    expect(JSON.stringify(m.mundo.propostas)).not.toContain('acc-aline');
  });
  it('a mesma proposta repetida usa a mesma chave de idempotência (não duplica); outra proposta usa outra', async () => {
    const m = montar();
    await m.conectar(WS, 'm-aline', 'acc-aline');
    await proporDoAgente(m.deps, TOKEN_ZOE, pedido);
    await proporDoAgente(m.deps, TOKEN_ZOE, { ...pedido, argumentos: { valor: 5000, id: '7' } }); // mesma coisa, outra ordem
    await proporDoAgente(m.deps, TOKEN_ZOE, { ...pedido, argumentos: { id: '8' } });
    const chaves = m.mundo.propostas.map(p => p.chave);
    expect(chaves[0]).toBe(chaves[1]);
    expect(chaves[2]).not.toBe(chaves[0]);
  });
  it('ferramenta de LEITURA: orienta a usar integracao_ler (não vira aprovação à toa)', async () => {
    const m = montar();
    await m.conectar(WS, 'm-aline', 'acc-aline');
    const r = await proporDoAgente(m.deps, TOKEN_ZOE, { ...pedido, ferramenta: 'get_crm_objects' });
    expect(r.status).toBe(400);
    expect(r.corpo.erro).toBe('ferramenta_de_leitura');
    expect(m.mundo.propostas).toHaveLength(0);
  });
  it('ferramenta sem marca, destrutiva ou que não existe: 403, sem proposta', async () => {
    const m = montar({ ferramentas: [...FERRAMENTAS, { name: 'delete_crm_objects', description: 'Apaga.', inputSchema: { type: 'object' }, annotations: { readOnlyHint: false, destructiveHint: true } }] });
    await m.conectar(WS, 'm-aline', 'acc-aline');
    for (const nome of ['ferramenta_sem_marca', 'delete_crm_objects', 'nao_existe']) {
      const r = await proporDoAgente(m.deps, TOKEN_ZOE, { ...pedido, ferramenta: nome });
      expect(r.status, nome).toBe(403);
      expect(r.corpo.erro, nome).toBe('ferramenta_nao_permitida');
    }
    expect(m.mundo.propostas).toHaveLength(0);
  });
  it('quem pediu não conectou o app: 409 "precisa conectar" (sem acesso não há em nome de quem agir)', async () => {
    const m = montar();
    const r = await proporDoAgente(m.deps, TOKEN_ZOE, pedido);
    expect(r.status).toBe(409);
    expect(r.corpo.erro).toBe('precisa_conectar');
    expect(m.mundo.propostas).toHaveLength(0);
  });
  it('pedido torto (sem ferramenta, sem motivo, argumentos que não são objeto): 400; token ruim: 401; pausado: 403', async () => {
    const m = montar();
    await m.conectar(WS, 'm-aline', 'acc-aline');
    expect((await proporDoAgente(m.deps, TOKEN_ZOE, { integracao: 'hubspot', motivo: 'x' })).status).toBe(400);
    expect((await proporDoAgente(m.deps, TOKEN_ZOE, { ...pedido, motivo: '  ' })).status).toBe(400);
    expect((await proporDoAgente(m.deps, TOKEN_ZOE, { ...pedido, argumentos: 'texto' } as never)).status).toBe(400);
    expect((await proporDoAgente(m.deps, 'jwt-de-pessoa', pedido)).status).toBe(401);
    expect((await proporDoAgente(m.deps, TOKEN_PAUSADA, pedido)).status).toBe(403);
    expect(m.mundo.propostas).toHaveLength(0);
  });
  it('o banco recusa a proposta: o motivo volta ao agente (400) e o uso fica na auditoria', async () => {
    const m = montar();
    await m.conectar(WS, 'm-aline', 'acc-aline');
    m.mundo.recusarPropostas('Os argumentos passam de 8000 caracteres.');
    const r = await proporDoAgente(m.deps, TOKEN_ZOE, pedido);
    expect(r.status).toBe(400);
    expect(String(r.corpo.mensagem)).toContain('8000');
  });
  it('o uso (proposta) fica na auditoria sem guardar argumentos', async () => {
    const m = montar();
    await m.conectar(WS, 'm-aline', 'acc-aline');
    await proporDoAgente(m.deps, TOKEN_ZOE, pedido);
    expect(m.mundo.auditoria).toEqual([{ workspaceId: WS, agente: 'comercial', membroId: 'm-aline', integracao: 'hubspot', ferramenta: 'proposta:manage_crm_objects', resultado: 'ok' }]);
  });
});
