// O que todo adaptador de sinal entrega. Um adaptador conhece UM sinal: monta a entrada de cada fonte (ator da Apify ou
// fonte pública) e transforma o que ela devolveu em acontecimentos. Nada aqui fala com a rede.
export type Frequencia = 'diario' | 'semanal' | 'mensal';

/** Contato da conta com LinkedIn, como o banco entrega: decisor primeiro e o retrato anterior (null na primeira vez). */
export interface ContatoDoPedido { id: string; nome: string; papel: string | null; linkedinUrl: string; snapshot: Record<string, unknown> | null }
export interface ContaDoPedido {
  nome: string;
  dominio: string;
  /** nome da empresa como o LinkedIn escreve (ex.: Magalu), quando a conta o guarda */
  linkedinNome?: string | null;
  linkedinUrl?: string | null;
  contatos?: ContatoDoPedido[];
}
/** O que guardar de cada contato para comparar na próxima rodada (nunca vira evento por si só). */
export interface Retrato { chave: string; dados: Record<string, unknown> }
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
  /** Sinais de pessoas: o retrato novo de cada contato, guardado só depois de o resultado ser entregue. */
  retratos?(ator: string, itens: unknown[], conta: ContaDoPedido): Retrato[];
}
