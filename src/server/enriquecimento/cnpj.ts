// CNPJ: conferência dos dígitos verificadores e leitura do CNPJ escrito no site da empresa (rodapé, contato, política de
// privacidade). Número que não passa na conta dos dígitos é descartado: melhor sem CNPJ do que com o CNPJ errado.

/** Só números. */
export const soDigitos = (s: string) => s.replace(/\D/g, '');

/** Confere os dois dígitos verificadores (regra da Receita). */
export function cnpjValido(entrada: string): boolean {
  const d = soDigitos(entrada);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const digito = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base.split('').reduce((t, c, i) => t + Number(c) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = digito(d.slice(0, 12));
  const d2 = digito(d.slice(0, 12) + d1);
  return d.endsWith(`${d1}${d2}`);
}

/**
 * CNPJs válidos escritos numa página, do mais citado para o menos citado. Aceita com ou sem pontuação
 * ("12.345.678/0001-95" ou "12345678000195"), mas não pega pedaço de número maior (telefone, código de barras).
 */
export function acharCnpjs(html: string): string[] {
  const texto = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ');
  const contagem = new Map<string, number>();
  for (const m of texto.matchAll(/(?<![\d./-])(\d{2}\.?\d{3}\.?\d{3}\s?\/?\s?\d{4}\s?-?\s?\d{2})(?![\d./-]*\d)/g)) {
    const d = soDigitos(m[1]);
    if (cnpjValido(d)) contagem.set(d, (contagem.get(d) ?? 0) + 1);
  }
  return [...contagem.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
}

/** O que se pergunta ao Google para achar o CNPJ de uma conta que o site não mostra: nome, cidade e estado. */
export function consultaDoCnpj(c: { nome: string; cidade?: string | null; uf?: string | null }): string {
  return ['CNPJ', `"${c.nome.replace(/"/g, '')}"`, c.cidade, c.uf].filter(Boolean).join(' ');
}

/**
 * CNPJs válidos citados nos títulos e nas descrições dos resultados do Google, do mais citado para o menos citado.
 * Só serve de candidato: quem decide é a Receita (o nome tem que bater com o da conta).
 */
export function cnpjsDosResultados(itens: unknown[]): string[] {
  const textos: string[] = [];
  for (const it of itens) {
    const organicos = it && typeof it === 'object' ? (it as { organicResults?: unknown }).organicResults : null;
    if (!Array.isArray(organicos)) continue;
    for (const o of organicos) {
      if (!o || typeof o !== 'object') continue;
      const { title, description } = o as { title?: unknown; description?: unknown };
      textos.push(`${typeof title === 'string' ? title : ''} ${typeof description === 'string' ? description : ''}`);
    }
  }
  return acharCnpjs(textos.join(' | '));
}

/** A página da empresa no LinkedIn citada no site (ajuda a achar as pessoas certas). */
export function acharLinkedinDaEmpresa(html: string): string | null {
  const m = html.match(/https?:\/\/(?:[a-z]{2,3}\.)?(?:www\.)?linkedin\.com\/company\/([A-Za-z0-9_%.-]+)/i);
  return m ? `https://www.linkedin.com/company/${m[1].replace(/[.]+$/, '')}` : null;
}
