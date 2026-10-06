// Tipos compartilhados do mecanismo de integrações. O erro de quem falou com o provedor nunca carrega token.

/**
 * Quem falou com o provedor (servidor MCP, servidor de autorização) e não deu certo. `nao_autorizado` é um 401/403;
 * `indisponivel` é rede, tempo esgotado, 429 ou 5xx; `protocolo` é uma resposta que não fala o que se esperava;
 * `rpc` é um erro JSON-RPC do servidor MCP (com o código).
 */
export class ErroDeProvedor extends Error {
  readonly tipo: 'nao_autorizado' | 'indisponivel' | 'protocolo' | 'rpc';
  readonly status?: number;
  readonly codigo?: number | string;
  readonly wwwAuthenticate?: string;
  constructor(tipo: 'nao_autorizado' | 'indisponivel' | 'protocolo' | 'rpc', mensagem: string, status?: number, codigo?: number | string, wwwAuthenticate?: string) {
    super(mensagem);
    this.name = 'ErroDeProvedor';
    this.tipo = tipo;
    this.status = status;
    this.codigo = codigo;
    this.wwwAuthenticate = wwwAuthenticate;
  }
}

/** Tira de um texto qualquer dos segredos informados, para uma mensagem de erro nunca devolver um token. */
export function redigir(texto: string, segredos: readonly (string | undefined | null)[], limite = 300): string {
  let limpo = texto;
  for (const segredo of segredos) {
    if (segredo && segredo.length >= 6) limpo = limpo.split(segredo).join('[segredo]');
  }
  return limpo.length > limite ? `${limpo.slice(0, limite)}…` : limpo;
}
