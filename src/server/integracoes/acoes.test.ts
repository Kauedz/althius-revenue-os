// @vitest-environment node
// O executor das ações APROVADAS (ticket 05 dos agentes conectados): pega do banco, uma por vez, as ações que uma pessoa
// aprovou e roda no app, com o acesso de quem pediu. No máximo uma vez, e só se a ferramenta ainda for de escrita.
// Banco e servidor do app são FALSOS: nenhum app real é chamado.
import { describe, expect, it } from 'vitest';
import { chaveMestra, cifrar } from '../cofre/cifra.ts';
import { executarAcoesAprovadas } from './acoes.ts';
import type { DepsIntegracoes } from './rotas.ts';
import { bancoFalso } from './mundo-falso.ts';
import { servidorMcpFalso } from './servidor-mcp-falso.ts';
import type { FerramentaMcp } from './mcp-cliente.ts';

const CHAVE = chaveMestra({ COFRE_CHAVE_MESTRA: Buffer.alloc(32, 4).toString('base64') });
const WS = 'ws-1';

const FERRAMENTAS: FerramentaMcp[] = [
  { name: 'manage_crm_objects', description: 'Cria ou muda.', inputSchema: { type: 'object' }, annotations: { readOnlyHint: false } },
  { name: 'get_crm_objects', description: 'Lê.', inputSchema: { type: 'object' }, annotations: { readOnlyHint: true } },
  { name: 'delete_crm_objects', description: 'Apaga.', inputSchema: { type: 'object' }, annotations: { readOnlyHint: false, destructiveHint: true } },
  { name: 'ferramenta_sem_marca', description: 'Sem anotação.', inputSchema: { type: 'object' } }
];
const acao = (extra: Record<string, unknown> = {}) => ({ approvalId: 'ap-1', workspaceId: WS, membroId: 'm-aline', agente: 'comercial', integracao: 'hubspot', ferramenta: 'manage_crm_objects', argumentos: { id: '7', valor: 5000 }, ...extra });

type Resultados = NonNullable<NonNullable<Parameters<typeof servidorMcpFalso>[0]>['resultados']>;
function montar(o: { resultados?: Resultados; statusFixo?: number; tokenDoApp?: string } = {}) {
  const mundo = bancoFalso();
  const mcp = servidorMcpFalso({ token: 'acc-aline', ferramentas: FERRAMENTAS, statusFixo: o.statusFixo, resultados: o.resultados ?? { manage_crm_objects: { content: [{ type: 'text', text: 'Negócio 7 atualizado para 5000' }] } } });
  const deps: DepsIntegracoes = { banco: mundo.banco, chave: CHAVE, siteUrl: 'https://app.althius.test', buscar: mcp.fetch as typeof fetch, agora: () => 1_000_000 };
  const conectar = () => mundo.banco.acessoSalvar({ workspaceId: WS, membroId: 'm-aline', integracao: 'hubspot', conta: 'ana@norte.test', portal: null, accessCifrado: cifrar(o.tokenDoApp ?? 'acc-aline', CHAVE), refreshCifrado: null, expiraEm: null, clientId: 'cid', issuer: 'https://mcp.hubspot.com', escopo: null });
  return { deps, mundo, mcp, conectar };
}
const escritas = (mcp: ReturnType<typeof montar>['mcp']) => mcp.chamadas.filter(c => c.rpc === 'tools/call');

describe('executar ações aprovadas', () => {
  it('roda a ferramenta com os argumentos APROVADOS e o token de quem pediu; conclui com o resumo e audita', async () => {
    const m = montar();
    await m.conectar();
    m.mundo.acoesAprovadas.push(acao());
    expect(await executarAcoesAprovadas(m.deps)).toBe(1);
    expect(escritas(m.mcp)).toHaveLength(1);
    expect(escritas(m.mcp)[0].corpo?.params).toMatchObject({ name: 'manage_crm_objects', arguments: { id: '7', valor: 5000 } });
    expect(escritas(m.mcp)[0].cabecalhos.authorization).toBe('Bearer acc-aline');
    expect(m.mundo.acoesConcluidas).toEqual([{ approvalId: 'ap-1', ok: true, resumo: 'Negócio 7 atualizado para 5000' }]);
    expect(m.mundo.auditoria).toEqual([{ workspaceId: WS, agente: 'comercial', membroId: 'm-aline', integracao: 'hubspot', ferramenta: 'manage_crm_objects', resultado: 'ok' }]);
  });
  it('sem nada aprovado, não faz nada (nem fala com o app)', async () => {
    const m = montar();
    expect(await executarAcoesAprovadas(m.deps)).toBe(0);
    expect(m.mcp.chamadas).toHaveLength(0);
  });
  it('várias aprovadas: uma depois da outra, cada uma concluída', async () => {
    const m = montar();
    await m.conectar();
    m.mundo.acoesAprovadas.push(acao({ approvalId: 'ap-1' }), acao({ approvalId: 'ap-2' }), acao({ approvalId: 'ap-3' }));
    expect(await executarAcoesAprovadas(m.deps)).toBe(3);
    expect(m.mundo.acoesConcluidas.map(c => c.approvalId)).toEqual(['ap-1', 'ap-2', 'ap-3']);
  });
  it('quem pediu não está mais conectado: conclui com falha clara e o app não é tocado', async () => {
    const m = montar();
    m.mundo.acoesAprovadas.push(acao());
    await executarAcoesAprovadas(m.deps);
    expect(m.mcp.chamadas).toHaveLength(0);
    expect(m.mundo.acoesConcluidas[0]).toMatchObject({ approvalId: 'ap-1', ok: false });
    expect(m.mundo.acoesConcluidas[0].resumo).toMatch(/conectar/i);
  });
  it('a ferramenta virou de leitura, sumiu ou ficou destrutiva desde a aprovação: não executa', async () => {
    for (const nome of ['get_crm_objects', 'delete_crm_objects', 'ferramenta_sem_marca', 'nao_existe_mais']) {
      const m = montar();
      await m.conectar();
      m.mundo.acoesAprovadas.push(acao({ ferramenta: nome }));
      await executarAcoesAprovadas(m.deps);
      expect(escritas(m.mcp), nome).toHaveLength(0);
      expect(m.mundo.acoesConcluidas[0], nome).toMatchObject({ ok: false });
    }
  });
  it('o app devolve erro: conclui com falha e o texto do app; auditoria "erro"', async () => {
    const m = montar({ resultados: { manage_crm_objects: { isError: true, content: [{ type: 'text', text: 'Permissão negada no HubSpot' }] } } });
    await m.conectar();
    m.mundo.acoesAprovadas.push(acao());
    await executarAcoesAprovadas(m.deps);
    expect(m.mundo.acoesConcluidas[0]).toMatchObject({ ok: false });
    expect(m.mundo.acoesConcluidas[0].resumo).toContain('Permissão negada');
    expect(m.mundo.auditoria[0].resultado).toBe('erro');
  });
  it('app fora do ar: conclui com falha e NÃO tenta de novo sozinho (poderia executar duas vezes)', async () => {
    const m = montar({ statusFixo: 503 });
    await m.conectar();
    m.mundo.acoesAprovadas.push(acao());
    expect(await executarAcoesAprovadas(m.deps)).toBe(1);
    expect(m.mundo.acoesConcluidas).toHaveLength(1);
    expect(m.mundo.acoesConcluidas[0]).toMatchObject({ ok: false });
    expect(m.mundo.acoesAprovadas).toHaveLength(0); // nada volta para a fila
  });
  it('token do app recusado: marca "precisa reconectar" e conclui com falha', async () => {
    const m = montar({ tokenDoApp: 'token-velho-recusado' });
    await m.conectar();
    m.mundo.acoesAprovadas.push(acao());
    await executarAcoesAprovadas(m.deps);
    expect(m.mundo.chamadas).toContain('marcar:precisa_reconectar');
    expect(m.mundo.acoesConcluidas[0]).toMatchObject({ ok: false });
  });
  it('o resumo é curto e nunca leva o token do app', async () => {
    const m = montar({ resultados: { manage_crm_objects: { content: [{ type: 'text', text: 'x'.repeat(5000) }] } } });
    await m.conectar();
    m.mundo.acoesAprovadas.push(acao());
    await executarAcoesAprovadas(m.deps);
    expect(m.mundo.acoesConcluidas[0].resumo.length).toBeLessThanOrEqual(400);
    expect(JSON.stringify(m.mundo.acoesConcluidas)).not.toContain('acc-aline');
  });
  it('uma ação que quebra não impede as seguintes', async () => {
    const m = montar();
    await m.conectar();
    m.mundo.acoesAprovadas.push(acao({ approvalId: 'ap-1', integracao: 'inventada' }), acao({ approvalId: 'ap-2' }));
    await executarAcoesAprovadas(m.deps);
    expect(m.mundo.acoesConcluidas.map(c => [c.approvalId, c.ok])).toEqual([['ap-1', false], ['ap-2', true]]);
  });
  it('tem um teto por rodada (não prende o serviço se houver muitas)', async () => {
    const m = montar();
    await m.conectar();
    for (let i = 0; i < 30; i++) m.mundo.acoesAprovadas.push(acao({ approvalId: `ap-${i}` }));
    expect(await executarAcoesAprovadas(m.deps, { maximo: 10 })).toBe(10);
  });
});
