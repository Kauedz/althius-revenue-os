// Auxiliar de testes das integrações: as asserções que o protótipo (Deno) usava, sobre o Vitest. Só os testes importam isto.
import { expect } from 'vitest';

export function assertEquals(real: unknown, esperado: unknown, mensagem?: string): void {
  expect(real, mensagem).toEqual(esperado);
}

export function assert(condicao: unknown, mensagem?: string): void {
  expect(Boolean(condicao), mensagem).toBe(true);
}

/** Espera que `fn` rejeite (com a classe e um trecho da mensagem, se dados) e devolve o erro para mais conferências. */
export async function assertRejects<E extends Error = Error>(
  fn: () => Promise<unknown>,
  classe?: new (...args: never[]) => E,
  trecho?: string
): Promise<E> {
  let erro: unknown;
  try { await fn(); } catch (e) { erro = e; }
  expect(erro, 'esperava que rejeitasse').toBeDefined();
  if (classe) expect(erro).toBeInstanceOf(classe);
  if (trecho) expect(String((erro as Error).message)).toContain(trecho);
  return erro as E;
}
