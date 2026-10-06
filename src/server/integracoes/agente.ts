// A ponte dos agentes com os apps conectados (ticket 04 dos agentes conectados, ADR 0058): o agente LÊ, com o acesso de
// QUEM PEDIU na rodada em andamento (decisão do dono, 06/10/2026). Quem chama é o servidor de ferramentas dos agentes, com o
// token do agente (nunca o login de uma pessoa).
//  - Só ferramentas que o servidor do app marca como SOMENTE LEITURA (readOnlyHint). Escrita nunca passa por aqui: vira
//    proposta e aprovação (ticket 05). Sem a marca, a ferramenta não é oferecida nem executada.
//  - O token do app fica aqui dentro: o agente e o modelo só recebem o resultado.
//  - O workspace e a pessoa vêm do banco (token do agente + rodada em andamento), nunca do pedido.
//  - Cada uso vai para a auditoria (só nomes: nunca argumentos nem o conteúdo devolvido).
import { comSessaoMcp, type FerramentaMcp } from './mcp-cliente.ts';
import { perfilDisponivel, resposta, tokenDaPessoa, type DepsIntegracoes, type Resp } from './rotas.ts';
import { PERFIS, type PerfilDeIntegracao } from './perfis.ts';
import { ErroDeProvedor } from './tipos.ts';
import type { UsoDoAgente } from './banco.ts';

const LIMITE_RESPOSTA = 20_000;
const PREFIXO_TOKEN = 'alt_agente_';
const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

type Contexto = { ok: true; perfil: PerfilDeIntegracao; workspaceId: string; agente: string; solicitanteId: string; tokenDoApp: string } | { ok: false; r: Resp };

/** Tudo o que as duas rotas têm em comum: quem é o agente, quem pediu, qual app e o token do app dessa pessoa. */
async function contexto(d: DepsIntegracoes, tokenDoAgente: string, integracao: string): Promise<Contexto> {
  const token = texto(tokenDoAgente);
  if (!token.startsWith(PREFIXO_TOKEN)) return { ok: false, r: resposta(401, { erro: 'nao_autorizado' }) };
  if (!integracao) return { ok: false, r: resposta(400, { erro: 'pedido_invalido' }) };
  const ctx = await d.banco.contextoDoAgente(token);
  if (!ctx.ok) {
    if (ctx.motivo === 'agente_pausado') return { ok: false, r: resposta(403, { erro: 'agente_pausado', mensagem: 'Este agente está pausado pelo cliente.' }) };
    return { ok: false, r: ctx.motivo === 'indisponivel' ? resposta(502, { erro: 'indisponivel' }) : resposta(401, { erro: 'nao_autorizado' }) };
  }
  const p = perfilDisponivel(integracao);
  if (!p.ok) return p;
  if (p.perfil.via === 'mensagens') return { ok: false, r: resposta(409, { erro: 'canal_de_mensagens', mensagem: 'Contas de mensagem (e-mail, WhatsApp, LinkedIn…) não são desta ferramenta.' }) };
  if (!ctx.solicitanteId) {
    return { ok: false, r: resposta(409, { erro: 'sem_pedido_em_andamento', mensagem: 'Nenhuma pessoa pediu isto agora, então não há acesso a usar.' }) };
  }
  const t = await tokenDaPessoa(d, p.perfil, ctx.workspaceId, ctx.solicitanteId);
  if (!t.ok) {
    if (t.r.corpo.erro === 'precisa_reconectar') {
      const semAcesso = t.r.corpo.motivo === 'sem_acesso';
      return { ok: false, r: resposta(409, {
        erro: semAcesso ? 'precisa_conectar' : 'precisa_reconectar',
        mensagem: semAcesso
          ? `Quem pediu ainda não conectou o ${p.perfil.nome}. A pessoa precisa conectar em Integrações para o agente poder consultar.`
          : `A conexão de quem pediu com o ${p.perfil.nome} expirou ou foi revogada. A pessoa precisa conectar de novo em Integrações.`
      }) };
    }
    return { ok: false, r: t.r };
  }
  return { ok: true, perfil: p.perfil, workspaceId: ctx.workspaceId, agente: ctx.agente, solicitanteId: ctx.solicitanteId, tokenDoApp: t.token };
}

const somenteLeitura = (f: FerramentaMcp) => f.annotations?.readOnlyHint === true;

const auditar = async (d: DepsIntegracoes, uso: UsoDoAgente) => {
  // O registro é tentado, mas nunca bloqueia nem derruba a leitura.
  try { await d.banco.auditarUsoDoAgente(uso); } catch { /* o serviço de integrações loga a falha; a leitura segue */ }
};

const revogado = async (d: DepsIntegracoes, c: Extract<Contexto, { ok: true }>) => {
  await d.banco.acessoMarcar(c.workspaceId, c.solicitanteId, c.perfil.id, 'precisa_reconectar');
  return resposta(409, { erro: 'precisa_reconectar', mensagem: `A conexão de quem pediu com o ${c.perfil.nome} foi revogada. A pessoa precisa conectar de novo em Integrações.` });
};

const opcoesMcp = (d: DepsIntegracoes, c: Extract<Contexto, { ok: true }>) => ({ url: c.perfil.mcp!.url, cabecalhos: { Authorization: `Bearer ${c.tokenDoApp}` }, fetch: d.buscar });

/** A lista é compacta de propósito: as descrições de apps reais passam de 60 KB e confundem o modelo. O detalhe vem sob pedido. */
const primeiraFrase = (t: string) => { const limpo = t.replace(/s+/g, ' ').trim(); return limpo.length <= 160 ? limpo : limpo.slice(0, 157).trimEnd() + '...'; };

/** O que o agente pode LER neste app (só ferramentas somente leitura). Com `ferramenta`: o detalhe de uma só. */
export async function ferramentasDoAgente(d: DepsIntegracoes, tokenDoAgente: string, corpo: unknown): Promise<Resp> {
  const b = (corpo && typeof corpo === 'object' ? corpo : {}) as { integracao?: unknown; ferramenta?: unknown };
  const integracao = texto(b.integracao);
  const detalhe = texto(b.ferramenta);
  const c = await contexto(d, tokenDoAgente, integracao);
  if (!c.ok) return c.r;
  try {
    const lista = (await comSessaoMcp(opcoesMcp(d, c), s => s.ferramentas())).filter(somenteLeitura);
    if (detalhe) {
      const f = lista.find(x => x.name === detalhe);
      if (!f) return resposta(404, { erro: 'ferramenta_nao_encontrada', mensagem: 'Não há uma ferramenta de leitura com esse nome neste app.' });
      return resposta(200, { fonte: c.perfil.nome, ferramenta: { nome: f.name, descricao: (f.description ?? '').slice(0, 3000), parametros: f.inputSchema ?? { type: 'object' } } });
    }
    return resposta(200, { fonte: c.perfil.nome, ferramentas: lista.map(f => ({ nome: f.name, descricao: primeiraFrase(f.description ?? '') })) });
  } catch (e) {
    if (e instanceof ErroDeProvedor && e.tipo === 'nao_autorizado') return revogado(d, c);
    return resposta(502, { erro: 'indisponivel' });
  }
}

/** Lê com UMA ferramenta somente leitura. Confere a marca a cada chamada, no próprio servidor do app: nunca confia no modelo. */
export async function chamarDoAgente(d: DepsIntegracoes, tokenDoAgente: string, corpo: unknown): Promise<Resp> {
  const b = (corpo && typeof corpo === 'object' ? corpo : {}) as { integracao?: unknown; ferramenta?: unknown; argumentos?: unknown };
  const integracao = texto(b.integracao);
  const ferramenta = texto(b.ferramenta);
  const argumentos = b.argumentos === undefined ? {} : b.argumentos;
  if (!ferramenta || !argumentos || typeof argumentos !== 'object' || Array.isArray(argumentos)) {
    // Ainda confere o token antes de dizer qualquer coisa sobre o pedido.
    const c0 = await contexto(d, tokenDoAgente, integracao || '-');
    if (!c0.ok && c0.r.status !== 404 && c0.r.status !== 409) return c0.r;
    return resposta(400, { erro: 'pedido_invalido' });
  }
  const c = await contexto(d, tokenDoAgente, integracao);
  if (!c.ok) return c.r;
  const uso = (resultado: UsoDoAgente['resultado']): UsoDoAgente => ({ workspaceId: c.workspaceId, agente: c.agente, membroId: c.solicitanteId, integracao: c.perfil.id, ferramenta, resultado });
  try {
    const saida = await comSessaoMcp(opcoesMcp(d, c), async s => {
      const f = (await s.ferramentas()).find(x => x.name === ferramenta);
      if (!f || !somenteLeitura(f)) return null; // escrita, sem marca ou inexistente: o mesmo "não"
      return s.chamar(ferramenta, argumentos as Record<string, unknown>);
    });
    if (saida === null) {
      await auditar(d, uso('negado'));
      return resposta(403, { erro: 'ferramenta_nao_permitida', mensagem: 'Esta ferramenta não é de leitura. Mudanças em apps só entram por proposta, com aprovação de uma pessoa.' });
    }
    const partes = (saida.content ?? []).map(p => (p as { text?: unknown })?.text).filter((t): t is string => typeof t === 'string');
    const bruto = partes.length ? partes.join('\n') : saida.structuredContent !== undefined ? JSON.stringify(saida.structuredContent) : '';
    const cortado = bruto.length > LIMITE_RESPOSTA;
    const resultado = cortado ? bruto.slice(0, LIMITE_RESPOSTA).trimEnd() + '\n… (resultado cortado por tamanho: peça um recorte menor)' : bruto;
    await auditar(d, uso(saida.isError ? 'erro' : 'ok'));
    return saida.isError
      ? resposta(200, { ok: false, erro: 'o_app_recusou', fonte: c.perfil.nome, resultado, cortado })
      : resposta(200, { ok: true, fonte: c.perfil.nome, resultado, cortado });
  } catch (e) {
    if (e instanceof ErroDeProvedor && e.tipo === 'nao_autorizado') return revogado(d, c);
    await auditar(d, uso('erro'));
    return resposta(502, { erro: 'indisponivel' });
  }
}

/** Os apps que a ponte atende (os de servidor MCP; canais de mensagem não). Usado pela descrição das ferramentas. */
export const APPS_DA_PONTE = Object.values(PERFIS).filter(p => p.situacao === 'disponivel' && p.mcp && p.via !== 'mensagens').map(p => p.id);
