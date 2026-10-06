// O que todo adaptador de sinal entrega. Um adaptador conhece UM sinal: monta a entrada de cada fonte (ator da Apify ou
// fonte pública) e transforma o que ela devolveu em acontecimentos. Nada aqui fala com a rede.
export type Frequencia = 'diario' | 'semanal' | 'mensal';

export interface ContaDoPedido { nome: string; dominio: string }
export interface ContextoDaColeta { agora: number; frequencia: Frequencia }

/** Um acontecimento novo na conta. A `chave` identifica o acontecimento: a mesma chave nunca vale duas vezes. */
export interface EventoDeSinal {
  chave: string;
  texto: string;
  evidencia: string;
  fonte: string;
  /** ISO 8601 de quando aconteceu (ou de quando foi visto, se a fonte não diz) */
  quando: string;
}

export interface AdaptadorApify {
  /** Entrada do ator. Ator que não faz parte do sinal é erro (nunca roda um ator qualquer). */
  entrada(ator: string, conta: ContaDoPedido, ctx: ContextoDaColeta): Record<string, unknown>;
  eventos(ator: string, itens: unknown[], conta: ContaDoPedido, ctx: ContextoDaColeta): EventoDeSinal[];
}
