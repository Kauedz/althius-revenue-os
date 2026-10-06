// Adaptador GENÉRICO (ADR 0060): a receita que o agente montou e uma pessoa aprovou diz, só com dados, como chamar o ator
// e como ler o que ele devolve. Nada aqui executa código vindo da receita: a entrada troca {{variáveis}} da conta e o
// mapeamento só aponta campos do item ("a.b.0.c") e monta textos com {{campo}}.
//  - vinculo "empresa": o item só vale se o nome da empresa nele for o da conta (mesma regra dos adaptadores da equipe).
//  - vinculo "dominio": o item só vale se o site nele for o domínio da conta.
//  - vinculo "entrada": a própria entrada já é da conta (o site ou o perfil dela), então todo item é dela.
// Na dúvida, o item NÃO vira evento: um sinal de outra empresa é pior que um sinal perdido.
import type { AdaptadorApify, ContaDoPedido, ContextoDaColeta, EventoDeSinal } from './tipos.ts';
import { JANELA_EM_DIAS, dataIso, dentroDaJanela, evento, mesmaEmpresa, normalizar, objeto, semRepetidos } from './comum.ts';

export interface MapeamentoGenerico {
  /** texto do evento, com {{campo}} do item (ex.: "Abriu vaga de {{title}}") */
  texto: string;
  /** o que identifica o acontecimento, com {{campo}} (ex.: "{{url}}"); o mesmo valor nunca vale duas vezes */
  chave: string;
  vinculo: 'empresa' | 'dominio' | 'entrada';
  /** campo do item com o nome da empresa (vinculo "empresa") */
  empresa?: string;
  /** campo do item com o site da empresa (vinculo "dominio") */
  dominio?: string;
  /** campo do item com a data do acontecimento; fora da janela da frequência, não vira evento */
  quando?: string;
  /** campo do item com o link de prova */
  link?: string;
  /** texto da evidência, com {{campo}}; sem isto, vale o texto mais o link */
  evidencia?: string;
  /** nome da origem do dado para o cliente (ex.: "Google News") */
  fonte?: string;
}

export interface FonteGenerica {
  ator: string;
  entrada: Record<string, unknown>;
  mapeamento: MapeamentoGenerico;
  descricao?: string;
}

/** Erro de montagem da entrada (ex.: a conta não tem o dado que a receita pede). Vira falha da fonte, crédito devolvido. */
export class ErroDeEntrada extends Error {}

export const VARIAVEIS = ['empresa', 'dominio', 'site', 'linkedin_empresa', 'linkedin_url', 'dias'] as const;

const limparDominio = (v: unknown): string => {
  if (typeof v !== 'string') return '';
  return v.trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split(/[/?#:]/)[0] ?? '';
};

/** As variáveis que a entrada pode usar, com o valor desta conta. */
export function variaveisDaConta(conta: ContaDoPedido, ctx: ContextoDaColeta): Record<string, string> {
  const dominio = limparDominio(conta.dominio);
  return {
    empresa: (conta.nome ?? '').trim(),
    dominio,
    site: dominio ? `https://${dominio}` : '',
    linkedin_empresa: (conta.linkedinNome ?? '').trim() || (conta.nome ?? '').trim(),
    linkedin_url: (conta.linkedinUrl ?? '').trim(),
    dias: String(JANELA_EM_DIAS[ctx.frequencia])
  };
}

const MARCA = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

function trocarNaEntrada(valor: unknown, vars: Record<string, string>): unknown {
  if (typeof valor === 'string') {
    const unica = /^\{\{\s*([a-zA-Z0-9_]+)\s*\}\}$/.exec(valor);
    const troca = (nome: string) => {
      if (!(nome in vars)) throw new ErroDeEntrada(`A receita usa a variável {{${nome}}}, que não existe (use ${VARIAVEIS.map(v => `{{${v}}}`).join(', ')}).`);
      if (!vars[nome]) throw new ErroDeEntrada(`A conta não tem o dado {{${nome}}} que a fonte precisa.`);
      return vars[nome];
    };
    // "{{dias}}" sozinho vira número: muitos atores pedem número, não texto.
    if (unica && unica[1] === 'dias') return Number(troca('dias'));
    return valor.replace(MARCA, (_, nome: string) => troca(nome));
  }
  if (Array.isArray(valor)) return valor.map(v => trocarNaEntrada(v, vars));
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, trocarNaEntrada(v, vars)]));
  return valor;
}

/** A entrada do ator para esta conta. Variável desconhecida ou sem valor é erro: nunca chama o ator com entrada pela metade. */
export function montarEntrada(entrada: Record<string, unknown>, conta: ContaDoPedido, ctx: ContextoDaColeta): Record<string, unknown> {
  return trocarNaEntrada(entrada, variaveisDaConta(conta, ctx)) as Record<string, unknown>;
}

/** O valor de um campo do item por caminho com pontos ("company.name", "links.0.url"). */
export function lerCampo(item: unknown, caminho: string | undefined): unknown {
  if (!caminho) return undefined;
  let atual: unknown = item;
  for (const parte of caminho.split('.')) {
    if (atual === null || atual === undefined) return undefined;
    if (Array.isArray(atual)) atual = /^\d+$/.test(parte) ? atual[Number(parte)] : undefined;
    else if (typeof atual === 'object') atual = (atual as Record<string, unknown>)[parte];
    else return undefined;
  }
  return atual;
}

const comoTexto = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : typeof v === 'number' || typeof v === 'boolean' ? String(v) : '');

/** O modelo preenchido com os campos do item. `vazio` diz se TODOS os campos citados vieram vazios. */
export function preencher(modelo: string, item: unknown): { texto: string; vazio: boolean } {
  let citados = 0, cheios = 0;
  const texto = modelo.replace(MARCA, (_, caminho: string) => {
    citados++;
    const v = comoTexto(lerCampo(item, caminho));
    if (v) cheios++;
    return v;
  }).replace(/\s+/g, ' ').trim();
  return { texto, vazio: citados > 0 ? cheios === 0 : !texto };
}

function daConta(m: MapeamentoGenerico, item: unknown, conta: ContaDoPedido): boolean {
  if (m.vinculo === 'entrada') return true;
  if (m.vinculo === 'empresa') {
    const nome = lerCampo(item, m.empresa);
    return mesmaEmpresa(conta.nome, nome) || (!!conta.linkedinNome && mesmaEmpresa(conta.linkedinNome, nome));
  }
  if (m.vinculo === 'dominio') {
    const d = limparDominio(conta.dominio);
    const noItem = limparDominio(comoTexto(lerCampo(item, m.dominio)));
    return !!d && !!noItem && (noItem === d || noItem.endsWith(`.${d}`));
  }
  return false;
}

/** Os eventos que o mapeamento tira dos itens. Usado pela coleta e pelo teste do agente (para ele ver o que sairia). */
export function eventosDoMapeamento(fonte: FonteGenerica, itens: unknown[], conta: ContaDoPedido, ctx: ContextoDaColeta): EventoDeSinal[] {
  const m = fonte.mapeamento;
  const saida: EventoDeSinal[] = [];
  for (const bruto of itens) {
    const item = objeto(bruto);
    if (!Object.keys(item).length || item.error) continue;
    if (!daConta(m, item, conta)) continue;
    const texto = preencher(m.texto, item);
    const chave = preencher(m.chave, item);
    if (texto.vazio || chave.vazio || !texto.texto || !chave.texto) continue;
    const data = m.quando ? dataIso(lerCampo(item, m.quando)) : null;
    if (data && !dentroDaJanela(data, ctx.agora, ctx.frequencia)) continue;
    const quando = data ?? new Date(ctx.agora).toISOString();
    const link = comoTexto(lerCampo(item, m.link));
    const evidencia = m.evidencia ? preencher(m.evidencia, item).texto : '';
    saida.push(evento({
      chave: `ag|${normalizar(chave.texto) || chave.texto.toLowerCase()}`,
      texto: texto.texto,
      evidencia: [evidencia || texto.texto, link].filter(Boolean).join(' ').trim(),
      fonte: (m.fonte ?? '').trim() || (fonte.descricao ?? '').trim() || 'Fonte externa',
      quando
    }));
  }
  return semRepetidos(saida);
}

/** Adaptador de UMA fonte genérica: só aceita o ator da própria fonte. */
export function criarAdaptadorGenerico(fonte: FonteGenerica): AdaptadorApify {
  return {
    entrada(ator, conta, ctx) {
      if (ator !== fonte.ator) throw new Error(`O ator ${ator} não faz parte desta fonte.`);
      return montarEntrada(fonte.entrada ?? {}, conta, ctx);
    },
    eventos(ator, itens, conta, ctx) {
      if (ator !== fonte.ator) return [];
      return eventosDoMapeamento(fonte, itens, conta, ctx);
    }
  };
}
