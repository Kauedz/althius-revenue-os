// Sinal vagas_cargo: vagas abertas da conta no LinkedIn. Ator principal `valig/linkedin-jobs-scraper` (US$ 0,0004 por
// vaga) e reserva `curious_coder/linkedin-jobs-scraper` (US$ 0,002 por vaga). Fontes conferidas em 06/10/2026
// (docs/sinais/atores-por-sinal.md). A chave do acontecimento vem do protótipo: empresa + cargo + ano.
//
// Limite conhecido: o filtro por empresa usa o nome como o LinkedIn escreve ("Magalu" acha vagas; "Magazine Luiza"
// não achou nenhuma). Conta com nome diferente do LinkedIn volta sem vagas; isso aparece como "sem novidade".
import type { AdaptadorApify, ContaDoPedido, ContextoDaColeta, EventoDeSinal, Frequencia } from './tipos.ts';
import { dataCurta, dataIso, dentroDaJanela, evento, mesmaEmpresa, nomeDaEmpresa, normalizar, objeto, primeiroTexto, recortar, semRepetidos } from './comum.ts';

const VALIG = 'valig/linkedin-jobs-scraper';
const CURIOUS = 'curious_coder/linkedin-jobs-scraper';
const MAX_VAGAS = 25;

const JANELA_VALIG: Record<Frequencia, string> = { diario: 'r86400', semanal: 'r604800', mensal: 'r2592000' };
const JANELA_CURIOUS: Record<Frequencia, string> = { diario: 'past24Hours', semanal: 'pastWeek', mensal: 'pastMonth' };

/** O cargo para comparação: sem marca de gênero ("Engenheiro(a)") e com as abreviações por extenso. */
export function cargoDaVaga(titulo: string): string {
  const saida: string[] = [];
  for (const p of normalizar(titulo).split(' ')) {
    if ((p === 'a' || p === 'as') && /os?$/.test(saida[saida.length - 1] ?? '')) continue;
    saida.push(p === 'sr' ? 'senior' : p === 'pl' ? 'pleno' : p === 'jr' ? 'junior' : p);
  }
  return saida.join(' ');
}

function leitura(ator: string, bruto: Record<string, unknown>) {
  const porValig = ator === VALIG;
  return {
    empresa: primeiroTexto(bruto, 'companyName'),
    titulo: primeiroTexto(bruto, 'title'),
    local: primeiroTexto(bruto, 'location'),
    link: porValig ? primeiroTexto(bruto, 'url', 'applyUrl') : primeiroTexto(bruto, 'link', 'applyUrl'),
    descricao: porValig ? primeiroTexto(bruto, 'description') : primeiroTexto(bruto, 'descriptionText'),
    publicadaEm: dataIso(porValig ? bruto.postedDate : bruto.postedAt)
  };
}

export const adaptadorDeVagas: AdaptadorApify = {
  entrada(ator: string, conta: ContaDoPedido, ctx: ContextoDaColeta) {
    if (ator === VALIG) return { companyName: [conta.nome], location: 'Brazil', datePosted: JANELA_VALIG[ctx.frequencia], limit: MAX_VAGAS };
    if (ator === CURIOUS) return { keywords: conta.nome, location: 'Brazil', datePosted: JANELA_CURIOUS[ctx.frequencia], limitPerSource: MAX_VAGAS, scrapeCompany: false };
    throw new Error(`O ator ${ator} não faz parte do sinal de vagas.`);
  },

  eventos(ator: string, itens: unknown[], conta: ContaDoPedido, ctx: ContextoDaColeta): EventoDeSinal[] {
    const saida: EventoDeSinal[] = [];
    for (const item of itens) {
      const bruto = objeto(item);
      const v = leitura(ator, bruto);
      if (!v.titulo || !mesmaEmpresa(conta.nome, v.empresa)) continue;
      // Sem data de publicação, vale a da coleta (a busca já filtrou pelo período).
      const quando = v.publicadaEm ?? new Date(ctx.agora).toISOString();
      if (v.publicadaEm && !dentroDaJanela(v.publicadaEm, ctx.agora, ctx.frequencia)) continue;
      const onde = v.local ? ` em ${v.local}` : '';
      const trecho = v.descricao ? ` ${recortar(v.descricao, 400)}` : '';
      saida.push(evento({
        chave: `vaga|${nomeDaEmpresa(conta.nome)}|${cargoDaVaga(v.titulo)}|${quando.slice(0, 4)}`,
        texto: `Abriu vaga de ${v.titulo}${onde}`,
        evidencia: `${v.titulo} — ${conta.nome}${onde}, publicada em ${dataCurta(quando)} (LinkedIn Jobs). ${v.link}${trecho}`.trim(),
        fonte: 'LinkedIn Jobs',
        quando
      }));
    }
    return semRepetidos(saida);
  }
};
