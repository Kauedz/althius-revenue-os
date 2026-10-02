// Auxiliares usados pelo template gerado (template.generated.tsx).
// Reproduzem exatamente a semântica do runtime "dc" do protótipo v18.
import { createElement, isValidElement, type CSSProperties, type ReactNode } from 'react';

/**
 * Interpolação de texto {{ x }}: undefined/null/boolean não renderizam; elementos e listas passam direto.
 * Valores primitivos vão dentro de <span class="sc-interp">, como no runtime original: em containers
 * flex esse span é um item próprio e recebe o `gap`, o que muda o espaçamento visível.
 */
export function __t(value: unknown): ReactNode {
  if (value === undefined || value === null || typeof value === 'boolean') return null;
  if (isValidElement(value) || Array.isArray(value)) return value as ReactNode;
  return createElement('span', { className: 'sc-interp' }, String(value));
}

/** Parte dinâmica de um atributo misto ("a {{ x }} b"): undefined/null viram texto vazio. */
export function __s(value: unknown): unknown {
  return value ?? '';
}

/** sc-for: qualquer coisa que não seja array vira lista vazia. */
export function __arr<T>(value: T[] | unknown): T[] {
  return Array.isArray(value) ? value : [];
}

const camel = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** Estilo em texto CSS ("a: b; c: d") vira objeto do React; objetos passam direto. */
export function __css(value: unknown): CSSProperties | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return value as CSSProperties;
  const out: Record<string, string> = {};
  for (const decl of value.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    out[prop.startsWith('--') ? prop : camel(prop)] = decl.slice(i + 1).trim();
  }
  return out as CSSProperties;
}

/** value controlado: undefined vira '' (como no runtime). */
export function __val(value: unknown): unknown {
  return value === undefined ? '' : value;
}

/** checked controlado: undefined vira false. */
export function __ck(value: unknown): unknown {
  return value === undefined ? false : value;
}

/** Junta a classe do template com as classes de hover geradas. */
export function __cls(base: unknown, extra: string): string {
  return [base, extra].filter(Boolean).join(' ');
}
