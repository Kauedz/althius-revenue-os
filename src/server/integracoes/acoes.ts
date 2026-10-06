// O executor das ações APROVADAS dos agentes nos apps (ticket 05 dos agentes conectados, ADR 0058).
// O agente só propõe; uma pessoa aprova; aqui a ação roda UMA vez, com o acesso de quem pediu.
//  - O banco entrega uma ação por vez e a marca "executando" ANTES de tocar no app. Falhou ou travou: nunca é repetida
//    sozinha (a ação pode já ter acontecido no app; repetir poderia duplicar o registro do cliente).
//  - Antes de rodar, confere de novo no servidor do app que a ferramenta ainda existe, ainda ESCREVE e não é destrutiva.
//  - O resumo guardado é curto e nunca leva token; o resultado completo não é guardado.
import { comSessaoMcp } from './mcp-cliente.ts';
import { PERFIS } from './perfis.ts';
import { tokenDaPessoa, type DepsIntegracoes } from './rotas.ts';
import { ErroDeProvedor } from './tipos.ts';
import type { AcaoAprovada, UsoDoAgente } from './banco.ts';

const LIMITE_RESUMO = 300;
const resumir = (t: string) => { const limpo = t.replace(/\s+/g, ' ').trim(); return limpo.length <= LIMITE_RESUMO ? limpo : limpo.slice(0, LIMITE_RESUMO - 3).trimEnd() + '...'; };

type Saida = { ok: boolean; resumo: string };

async function executar(d: DepsIntegracoes, a: AcaoAprovada): Promise<Saida> {
  const perfil = PERFIS[a.integracao];
  if (!perfil || perfil.situacao !== 'disponivel' || !perfil.mcp) return { ok: false, resumo: 'O app desta ação não está mais disponível.' };
  const t = await tokenDaPessoa(d, perfil, a.workspaceId, a.membroId);
  if (!t.ok) {
    return { ok: false, resumo: t.r.status === 409 ? `Quem pediu precisa conectar o ${perfil.nome} de novo em Integrações. A ação não foi feita.` : `O ${perfil.nome} não respondeu. A ação não foi repetida: confira no app.` };
  }
  try {
    const saida = await comSessaoMcp({ url: perfil.mcp.url, cabecalhos: { Authorization: `Bearer ${t.token}` }, fetch: d.buscar }, async s => {
      const f = (await s.ferramentas()).find(x => x.name === a.ferramenta);
      // Só roda se AINDA for uma ferramenta de escrita e não destrutiva (o servidor do app pode ter mudado desde a aprovação).
      if (!f || f.annotations?.readOnlyHint !== false || f.annotations?.destructiveHint === true) return null;
      return s.chamar(a.ferramenta, a.argumentos);
    });
    if (saida === null) return { ok: false, resumo: 'A ferramenta mudou ou não existe mais no app. A ação não foi feita.' };
    const partes = (saida.content ?? []).map(p => (p as { text?: unknown })?.text).filter((x): x is string => typeof x === 'string');
    const texto = partes.length ? partes.join(' ') : saida.structuredContent !== undefined ? JSON.stringify(saida.structuredContent) : '';
    return saida.isError ? { ok: false, resumo: resumir(texto) || `O ${perfil.nome} recusou a ação.` } : { ok: true, resumo: resumir(texto) || 'Feito.' };
  } catch (e) {
    if (e instanceof ErroDeProvedor && e.tipo === 'nao_autorizado') {
      await d.banco.acessoMarcar(a.workspaceId, a.membroId, perfil.id, 'precisa_reconectar');
      return { ok: false, resumo: `A conexão de quem pediu com o ${perfil.nome} foi revogada. A ação não foi feita.` };
    }
    return { ok: false, resumo: `O ${perfil.nome} não respondeu. A ação não foi repetida: confira no app antes de pedir de novo.` };
  }
}

/** Executa as ações aprovadas que estiverem esperando (uma por vez, no máximo `maximo` por rodada). Devolve quantas rodou. */
export async function executarAcoesAprovadas(d: DepsIntegracoes, o: { maximo?: number } = {}): Promise<number> {
  const maximo = o.maximo ?? 10;
  let feitas = 0;
  while (feitas < maximo) {
    const a = await d.banco.acaoReivindicar();
    if (!a) break;
    feitas++;
    let saida: Saida;
    try { saida = await executar(d, a); } catch { saida = { ok: false, resumo: 'Erro inesperado. A ação não foi repetida: confira no app.' }; }
    const uso: UsoDoAgente = { workspaceId: a.workspaceId, agente: a.agente, membroId: a.membroId, integracao: a.integracao, ferramenta: a.ferramenta, resultado: saida.ok ? 'ok' : 'erro' };
    try { await d.banco.auditarUsoDoAgente(uso); } catch { /* o registro é tentado; não trava a fila */ }
    try { await d.banco.acaoConcluir(a.approvalId, saida.ok, saida.resumo); } catch { /* fica "executando" e o banco a marca como interrompida depois; nunca é repetida */ }
  }
  return feitas;
}
