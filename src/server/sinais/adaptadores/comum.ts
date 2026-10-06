// Ajudantes dos adaptadores de sinal. Portados do protótipo AppAlthius (signal-runner/adaptadores/comum.ts), só o que o
// ticket 01 usa. Nada aqui fala com a rede.
import type { EventoDeSinal, Frequencia } from './tipos.ts';

/** Limites dos campos de evento: um texto maior que o limite seria cortado de forma feia pelo banco. */
export const LIMITES = { chave: 300, texto: 300, fonte: 200, evidencia: 2000 } as const;

const DIA_MS = 24 * 60 * 60 * 1000;

export function recortar(texto: string, max: number): string {
  const limpo = texto.replace(/\s+/g, ' ').trim();
  return limpo.length <= max ? limpo : `${limpo.slice(0, max - 1).trimEnd()}…`;
}

/** Minúsculas, sem acento, só letras e números separados por um espaço: a forma de comparar textos. */
export function normalizar(valor: unknown): string {
  if (typeof valor !== 'string') return '';
  return valor.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : typeof valor === 'number' ? String(valor) : '';
}

export function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Record<string, unknown>) : {};
}

/** O primeiro texto não vazio entre os campos dados. */
export function primeiroTexto(item: Record<string, unknown>, ...campos: string[]): string {
  for (const campo of campos) {
    const v = texto(item[campo]);
    if (v) return v;
  }
  return '';
}

// Só as formas jurídicas saem do nome: "Banco do Brasil" continua diferente de "Banco".
const FORMAS_JURIDICAS = new Set(['ltda', 'sa', 'me', 'epp', 'eireli', 'inc', 'llc', 'ltd', 'corp', 'plc', 'gmbh', 'cia']);

/** O nome da empresa para comparação: normalizado e sem a forma jurídica do fim ("Acme S.A." vira "acme"). */
export function nomeDaEmpresa(nome: unknown): string {
  const partes = normalizar(nome).split(' ').filter(Boolean);
  while (partes.length > 1) {
    const ultima = partes[partes.length - 1];
    if (FORMAS_JURIDICAS.has(ultima)) partes.pop();
    else if (ultima === 'a' && partes[partes.length - 2] === 's' && partes.length > 2) partes.splice(-2);
    else break;
  }
  return partes.join(' ');
}

/** Se a empresa do resultado é a conta. Na dúvida, não é: um sinal de outra empresa é pior que um sinal perdido. */
export function mesmaEmpresa(nomeDaConta: string, nomeNoResultado: unknown): boolean {
  const a = nomeDaEmpresa(nomeDaConta);
  return a.length > 0 && a === nomeDaEmpresa(nomeNoResultado);
}

/** Uma data do ator em ISO 8601, ou nulo: aceita ISO, "AAAA-MM-DD" e milissegundos/segundos desde 1970. */
export function dataIso(valor: unknown): string | null {
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    const d = new Date(valor < 1e11 ? valor * 1000 : valor);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const bruto = texto(valor);
  if (!bruto) return null;
  if (/^\d{10,13}$/.test(bruto)) return dataIso(Number(bruto));
  const ms = Date.parse(bruto);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/** Quantos dias para trás a coleta olha, com uma folga para a rodada atrasar um pouco (a chave evita repetir). */
export const JANELA_EM_DIAS: Record<Frequencia, number> = { diario: 2, semanal: 8, mensal: 32 };

export function dentroDaJanela(iso: string, agora: number, frequencia: Frequencia): boolean {
  return Date.parse(iso) >= agora - JANELA_EM_DIAS[frequencia] * DIA_MS;
}

export function dataCurta(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

/** O evento dentro dos limites do banco. */
export function evento(e: EventoDeSinal): EventoDeSinal {
  return {
    chave: recortar(e.chave, LIMITES.chave),
    texto: recortar(e.texto, LIMITES.texto),
    evidencia: recortar(e.evidencia, LIMITES.evidencia),
    fonte: recortar(e.fonte, LIMITES.fonte),
    quando: e.quando
  };
}

/** Um evento por acontecimento: dos repetidos, fica o mais antigo. */
export function semRepetidos(eventos: EventoDeSinal[]): EventoDeSinal[] {
  const porChave = new Map<string, EventoDeSinal>();
  for (const e of eventos) {
    const anterior = porChave.get(e.chave);
    if (!anterior || Date.parse(e.quando) < Date.parse(anterior.quando)) porChave.set(e.chave, e);
  }
  return [...porChave.values()];
}
