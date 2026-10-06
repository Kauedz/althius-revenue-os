// Descobre a conta do app (para o cartão mostrar com quem a pessoa entrou) e o portal (para o primeiro acesso fixar o portal
// do workspace, ADR 0056), com o token recém-obtido: os campos do endpoint de token, as chamadas do perfil e, por último,
// uma ferramenta do servidor MCP. Portado do protótipo AppAlthius (_shared/integracoes/identificacao.ts), só o caminho OAuth.
// Nada aqui devolve nem registra token: o resultado é só o portal e a conta.
import { comSessaoMcp, type OpcoesDoClienteMcp } from './mcp-cliente.ts';
import { primeiroValor, type Identificacao } from './perfis.ts';
import { ErroDeProvedor } from './tipos.ts';

export type ResultadoDaIdentificacao =
  | { ok: true; portal: string | null; conta: string | null }
  | { ok: false; motivo: 'indisponivel' | 'nao_identificada' };

export interface DepsDaIdentificacao {
  fetch?: typeof fetch;
  /** A sessão MCP já autenticada, para o fallback por ferramenta. */
  mcp?: OpcoesDoClienteMcp;
  /** A resposta inteira do endpoint de token (para ler campos próprios do app). Nunca sai desta função. */
  respostaDoToken?: Record<string, unknown>;
}

/** O JSON da primeira parte de texto de um resultado de ferramenta; nulo se não for JSON. */
function jsonDoResultado(resultado: { content: unknown[]; structuredContent?: unknown }): unknown {
  if (resultado.structuredContent && typeof resultado.structuredContent === 'object') return resultado.structuredContent;
  for (const parte of resultado.content) {
    const texto = (parte as { text?: unknown })?.text;
    if (typeof texto !== 'string') continue;
    try { return JSON.parse(texto); } catch { /* texto livre: nada a ler como campo */ }
  }
  return null;
}

export async function identificarConta(identificacao: Identificacao | undefined, credencial: string, deps: DepsDaIdentificacao = {}): Promise<ResultadoDaIdentificacao> {
  const buscar = deps.fetch ?? fetch;
  let portal: string | null = null;
  let conta: string | null = null;

  if (identificacao?.daRespostaDoToken && deps.respostaDoToken) {
    portal = primeiroValor(deps.respostaDoToken, identificacao.daRespostaDoToken.portal);
    conta = primeiroValor(deps.respostaDoToken, identificacao.daRespostaDoToken.conta);
  }

  let algumaRespondeu = false;
  let semRede = false;
  for (const r of identificacao?.requisicoes ?? []) {
    if (portal !== null && conta !== null) break;
    const cabecalhos: Record<string, string> = { Accept: 'application/json' };
    for (const [nome, valor] of Object.entries(r.cabecalhos ?? {})) cabecalhos[nome] = valor.replaceAll('{credencial}', credencial);
    let resposta: Response;
    try {
      resposta = await buscar(r.url.replaceAll('{credencial}', encodeURIComponent(credencial)), { method: r.metodo, headers: cabecalhos, signal: AbortSignal.timeout(15_000) });
    } catch { semRede = true; continue; }
    if (resposta.status === 429 || resposta.status >= 500) { await resposta.body?.cancel().catch(() => {}); semRede = true; continue; }
    // 401/403: aquela API não aceita este token; segue para o próximo caminho.
    if (!resposta.ok) { await resposta.body?.cancel().catch(() => {}); continue; }
    algumaRespondeu = true;
    const corpo = await resposta.json().catch(() => null);
    portal ??= primeiroValor(corpo, r.portal);
    conta ??= primeiroValor(corpo, r.conta);
  }

  if (identificacao?.porFerramentaMcp && deps.mcp && (portal === null || conta === null)) {
    const alvo = identificacao.porFerramentaMcp;
    try {
      const resultado = await comSessaoMcp(deps.mcp, sessao => sessao.chamar(alvo.ferramenta, alvo.argumentos ?? {}));
      const corpo = jsonDoResultado(resultado);
      portal ??= primeiroValor(corpo, alvo.portal);
      conta ??= primeiroValor(corpo, alvo.conta);
      algumaRespondeu = true;
    } catch (e) {
      if (e instanceof ErroDeProvedor && e.tipo === 'indisponivel') semRede = true;
    }
  }

  if (portal !== null || conta !== null) return { ok: true, portal, conta };
  return { ok: false, motivo: semRede && !algumaRespondeu ? 'indisponivel' : 'nao_identificada' };
}
