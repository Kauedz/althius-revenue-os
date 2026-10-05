// Nomes e siglas de EXIBIÇÃO dos quatro agentes fixos (decisão do dono): Zoe, Jax, Lia e Neo.
// Os códigos técnicos (comercial, marketing, copy, revops) não mudam: banco, Hermes e permissões usam eles.
// O app marca cada avatar pela sigla, então a sigla tem de ser a mesma do protótipo (src/v18/data.js);
// o teste agentes-exibicao.test.ts garante isso. Serviços NÃO escrevem nome de agente à mão: usam este módulo.
export const AGENTES_EXIBICAO = {
  comercial: { nome: 'Zoe', sigla: 'ZO' },
  marketing: { nome: 'Jax', sigla: 'JA' },
  copy: { nome: 'Lia', sigla: 'LI' },
  revops: { nome: 'Neo', sigla: 'NE' }
} as const;

export type CodigoAgente = keyof typeof AGENTES_EXIBICAO;

const conhecido = (codigo: string): codigo is CodigoAgente => Object.prototype.hasOwnProperty.call(AGENTES_EXIBICAO, codigo);

/** Nome de exibição. Código desconhecido não vira nome inventado: devolve o próprio código. */
export const nomeDoAgente = (codigo: string): string => (conhecido(codigo) ? AGENTES_EXIBICAO[codigo].nome : codigo);

/** Sigla de duas letras (a mesma que o protótipo usa para marcar o avatar). */
export const siglaDoAgente = (codigo: string): string => (conhecido(codigo) ? AGENTES_EXIBICAO[codigo].sigla : codigo.slice(0, 2).toUpperCase());
