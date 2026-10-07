// Camada de execução das ferramentas do agente (ADR 0061). Todas as chamadas do Hermes ao servidor MCP da Althius passam
// por aqui, com o mesmo ciclo:
//   política → detecção de laço → execução com prazo → (só leitura) nova tentativa com espera crescente → corte da saída
//   → evento.
// Padrões estudados no Gemini CLI (Apache-2.0, engenharia reversa em docs/reverse-engineering/). O código é nosso:
//  - toda ferramenta tem um TIPO na política; sem política, não roda (fecha em vez de abrir).
//  - leitura pode ser repetida quando a falha é passageira; proposta e ação externa NUNCA (poderia duplicar).
//  - a mesma chamada repetida 5 vezes seguidas é laço: o agente é parado com um aviso, nada é executado.
//  - saída grande é cortada (início e fim) com aviso, para não estourar o contexto do modelo.
//  - erro tem tipo; os que não adiantam repetir (token inválido, agente pausado) dizem "não tente de novo".
//  - cada chamada gera UM evento só com números e nomes: nunca argumentos nem conteúdo (privacidade, ADR 0058).
import { createHash } from 'node:crypto';
import type { CallToolResult } from '@modelcontextprotocol/server';

export type TipoDeFerramenta = 'leitura' | 'proposta' | 'acao_externa';
export type TipoDeErro =
  | 'entrada_invalida' | 'nao_autorizado' | 'agente_pausado' | 'nao_configurado' | 'indisponivel'
  | 'tempo_esgotado' | 'laco_detectado' | 'sem_politica' | 'recusado' | 'inesperado';

/** Erro com tipo, para a camada de execução saber se adianta tentar de novo. */
export class ErroDeFerramenta extends Error {
  readonly tipo: TipoDeErro;
  constructor(mensagem: string, tipo: TipoDeErro, opcoes?: { cause?: unknown }) {
    super(mensagem, opcoes);
    this.name = 'ErroDeFerramenta';
    this.tipo = tipo;
  }
}

/** Falhas passageiras: só estas são repetidas, e só em ferramenta de leitura. Prazo estourado não se repete: o tempo já foi gasto. */
export const TRANSITORIOS: ReadonlySet<TipoDeErro> = new Set(['indisponivel']);
/** Não adianta o agente repetir: precisa de uma pessoa. */
export const DEFINITIVOS: ReadonlySet<TipoDeErro> = new Set(['nao_autorizado', 'agente_pausado', 'nao_configurado']);

export interface Politica { tipo: TipoDeFerramenta; prazoMs?: number }

const PRAZO_PADRAO: Record<TipoDeFerramenta, number> = { leitura: 30_000, proposta: 20_000, acao_externa: 75_000 };
const TENTATIVAS: Record<TipoDeFerramenta, number> = { leitura: 3, proposta: 1, acao_externa: 1 };

/**
 * A política de cada ferramenta do servidor MCP da Althius. Ferramenta nova sem linha aqui não roda (teste confere).
 * "acao_externa" gasta crédito ou fala com fornecedor: nunca é repetida sozinha.
 */
export const POLITICA_DAS_FERRAMENTAS: Readonly<Record<string, Politica>> = {
  buscar_contatos: { tipo: 'leitura' },
  listar_membros: { tipo: 'leitura' },
  listar_tarefas: { tipo: 'leitura' },
  listar_cadencias: { tipo: 'leitura' },
  listar_contas: { tipo: 'leitura' },
  listar_quadros: { tipo: 'leitura' },
  listar_negocios: { tipo: 'leitura' },
  listar_habilidades: { tipo: 'leitura' },
  listar_sinais: { tipo: 'leitura' },
  listar_campanhas: { tipo: 'leitura' },
  integracao_ferramentas: { tipo: 'leitura', prazoMs: 65_000 },
  integracao_ler: { tipo: 'leitura', prazoMs: 65_000 },
  integracao_propor: { tipo: 'proposta', prazoMs: 65_000 },
  propor_atualizacao: { tipo: 'proposta' },
  propor_tarefa: { tipo: 'proposta' },
  propor_inscricao_cadencia: { tipo: 'proposta' },
  propor_negocio: { tipo: 'proposta' },
  propor_contas: { tipo: 'proposta' },
  propor_enriquecimento: { tipo: 'proposta' },
  propor_levar_ao_pipeline: { tipo: 'proposta' },
  propor_plano: { tipo: 'proposta', prazoMs: 45_000 },
  propor_mover_negocio: { tipo: 'proposta' },
  propor_campanha: { tipo: 'proposta' },
  propor_verba_campanha: { tipo: 'proposta' },
  propor_status_campanha: { tipo: 'proposta' },
  sinais_catalogo: { tipo: 'leitura' },
  sinais_buscar_fontes: { tipo: 'leitura' },
  sinais_detalhar_fonte: { tipo: 'leitura' },
  sinais_testar_fonte: { tipo: 'acao_externa' },
  sinais_propor_receita: { tipo: 'proposta' }
};

/** O que fica registrado de cada chamada. Só números e nomes. */
export interface EventoDeFerramenta {
  evento: 'ferramenta';
  chamada: number;
  nome: string;
  tipo: TipoDeFerramenta | null;
  resultado: 'ok' | 'erro';
  erro_tipo: TipoDeErro | null;
  duracao_ms: number;
  tentativas: number;
  caracteres_saida: number;
  cortado: boolean;
}

export interface OpcoesExecucao {
  politica?: Readonly<Record<string, Politica>>;
  /** recebe um evento por chamada (o principal escreve no stderr; o stdout é do protocolo MCP) */
  registrar?: (e: EventoDeFerramenta) => void;
  agora?: () => number;
  dormir?: (ms: number) => Promise<void>;
  aleatorio?: () => number;
  /** acima disto (caracteres), a saída de texto é cortada com aviso */
  limiteSaida?: number;
  /** quantas chamadas idênticas seguidas contam como laço */
  limiteLaco?: number;
}

const META_ERRO = 'althius/erro';

/** Resultado de erro com o tipo junto (o agente vê a mensagem; a execução vê o tipo). */
export function falhaTipada(mensagem: string, tipo: TipoDeErro): CallToolResult {
  const texto = DEFINITIVOS.has(tipo) ? `${mensagem} Não tente de novo: isso precisa de uma pessoa.` : mensagem;
  return { content: [{ type: 'text', text: texto }], isError: true, _meta: { [META_ERRO]: tipo } };
}

/** O tipo de um erro qualquer: o nosso tipado, ou um erro marcado como passageiro, ou "inesperado". */
export function tipoDoErro(e: unknown): TipoDeErro {
  if (e instanceof ErroDeFerramenta) return e.tipo;
  if (e && typeof e === 'object' && (e as { transitorio?: unknown }).transitorio === true) return 'indisponivel';
  return 'inesperado';
}

export function falhaDe(e: unknown): CallToolResult {
  return falhaTipada(e instanceof Error ? e.message : 'Falha inesperada na Althius.', tipoDoErro(e));
}

/** Espera crescente com variação de ±30% (evita todos tentarem no mesmo instante): 500 ms, 1 s, 2 s… até 4 s. */
export function espera(tentativa: number, aleatorio: () => number = Math.random): number {
  const base = Math.min(4000, 500 * 2 ** Math.max(0, tentativa - 1));
  return Math.max(0, Math.round(base + base * 0.3 * (aleatorio() * 2 - 1)));
}

/** Corta texto grande guardando 20% do início e 80% do fim (o fim costuma ter o que importa), com aviso. */
export function cortarTexto(texto: string, limite: number): { texto: string; cortado: boolean } {
  if (texto.length <= limite) return { texto, cortado: false };
  const inicio = Math.floor(limite * 0.2);
  const fim = limite - inicio;
  const omitidos = texto.length - inicio - fim;
  return {
    texto: `${texto.slice(0, inicio)}\n… [${omitidos} caracteres omitidos: o resultado era grande demais. Peça um recorte menor (filtro, conta ou limite).] …\n${texto.slice(-fim)}`,
    cortado: true
  };
}

const estavel = (v: unknown): string => {
  if (Array.isArray(v)) return '[' + v.map(estavel).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v as object).sort().map(k => JSON.stringify(k) + ':' + estavel((v as Record<string, unknown>)[k])).join(',') + '}';
  return JSON.stringify(v ?? null);
};

type Manipulador = (args: unknown, extra: unknown) => CallToolResult | Promise<CallToolResult>;

const TEMPO = Symbol('tempo esgotado');

/** Cria o executor de UMA sessão (um processo MCP = um agente de um cliente). */
export function criarExecutor(o: OpcoesExecucao = {}) {
  const politicas = o.politica ?? POLITICA_DAS_FERRAMENTAS;
  const agora = o.agora ?? Date.now;
  const dormir = o.dormir ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms)));
  const aleatorio = o.aleatorio ?? Math.random;
  const limiteSaida = o.limiteSaida ?? 20_000;
  const limiteLaco = o.limiteLaco ?? 5;
  let chamadas = 0;
  let ultima = '';
  let repeticoes = 0;

  const comPrazo = async (p: Promise<CallToolResult>, ms: number): Promise<CallToolResult | typeof TEMPO> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([p, new Promise<typeof TEMPO>(r => { timer = setTimeout(() => r(TEMPO), ms); })]);
    } finally { if (timer) clearTimeout(timer); }
  };

  function envolver(nome: string, manipulador: Manipulador): Manipulador {
    return async (args, extra) => {
      const n = ++chamadas;
      const inicio = agora();
      const politica = politicas[nome];
      const fechar = (r: CallToolResult, tentativas: number): CallToolResult => {
        let caracteres = 0;
        let cortado = false;
        const content = (r.content ?? []).map(parte => {
          if (parte.type !== 'text') return parte;
          const c = cortarTexto(parte.text, limiteSaida);
          caracteres += c.texto.length;
          cortado ||= c.cortado;
          return c.cortado ? { ...parte, text: c.texto } : parte;
        });
        const erroTipo = r.isError ? ((r._meta?.[META_ERRO] as TipoDeErro | undefined) ?? 'recusado') : null;
        try {
          o.registrar?.({ evento: 'ferramenta', chamada: n, nome, tipo: politica?.tipo ?? null, resultado: r.isError ? 'erro' : 'ok', erro_tipo: erroTipo, duracao_ms: Math.max(0, agora() - inicio), tentativas, caracteres_saida: caracteres, cortado });
        } catch { /* registrar nunca derruba a ferramenta */ }
        return { ...r, content };
      };

      if (!politica) return fechar(falhaTipada(`A ferramenta ${nome} não tem política de execução e foi bloqueada.`, 'sem_politica'), 0);

      // Laço: a mesma chamada (nome + argumentos) várias vezes seguidas não roda de novo.
      const assinatura = nome + ':' + createHash('sha256').update(estavel(args)).digest('hex');
      repeticoes = assinatura === ultima ? repeticoes + 1 : 1;
      ultima = assinatura;
      if (repeticoes >= limiteLaco) {
        return fechar(falhaTipada(`Você já chamou ${nome} com os mesmos argumentos ${repeticoes} vezes seguidas: parece um laço. Use o que já recebeu, mude a abordagem ou explique à pessoa o que está faltando.`, 'laco_detectado'), 0);
      }

      const maximo = TENTATIVAS[politica.tipo];
      const prazo = politica.prazoMs ?? PRAZO_PADRAO[politica.tipo];
      let resultado: CallToolResult = falhaTipada('Falha inesperada na Althius.', 'inesperado');
      let tentativa = 0;
      while (tentativa < maximo) {
        tentativa++;
        try {
          const r = await comPrazo(Promise.resolve().then(() => manipulador(args, extra)), prazo);
          resultado = r === TEMPO
            ? falhaTipada(`A ferramenta ${nome} passou de ${Math.round(prazo / 1000)} s e foi interrompida.${politica.tipo === 'leitura' ? '' : ' Pode ter sido registrada mesmo assim: confira antes de pedir de novo.'}`, 'tempo_esgotado')
            : r;
        } catch (e) {
          resultado = falhaDe(e);
        }
        const tipo = resultado.isError ? (resultado._meta?.[META_ERRO] as TipoDeErro | undefined) : undefined;
        if (!tipo || !TRANSITORIOS.has(tipo) || tentativa >= maximo) break;
        await dormir(espera(tentativa, aleatorio));
      }
      return fechar(resultado, tentativa);
    };
  }

  return { envolver };
}

/** Linha de log em JSON no stderr (o stdout é do protocolo MCP). */
export const registrarNoStderr = (e: EventoDeFerramenta) => { process.stderr.write(JSON.stringify({ nivel: e.resultado === 'ok' ? 'info' : 'aviso', msg: 'mcp_ferramenta', ...e }) + '\n'); };
