// Etapa "pessoas" do enriquecimento (ADR 0062): até 5 personas da conta, com foto e LinkedIn, e telefone quando houver
// fonte configurada. Duas fontes da Apify combinadas, porque a busca de perfis do LinkedIn custa caro por página e
// comeria o crédito inteiro (medido em 06/10/2026: ~US$ 0,10 por página de busca):
//   1. busca no Google ("site:linkedin.com/in" + cargos alvo + nome da empresa): acha os perfis por centavos;
//   2. leitor de perfis do LinkedIn só nos 5 escolhidos: traz nome, cargo atual e FOTO (US$ 0,004 por perfil).
// Se o leitor de perfis falhar, a pessoa entra com o que o Google mostrou (sem foto). Telefone pessoal só com uma fonte
// configurada pelo superadmin (ENRIQ_TELEFONE_ATOR); sem ela, nada de telefone (nunca inventado). Cada dado leva a fonte.
// O gasto nunca passa do teto do pedido (o que o cliente paga).
import type { Coletor } from '../sinais/ciclo.ts';

export interface Persona { cargo: string; papel?: string }
export interface PessoaAchada {
  nome: string; cargo: string | null; papel: 'decisor' | 'influenciador' | 'campeao'; linkedin_url: string; foto_url: string | null;
  telefones: Array<{ numero: string; fonte: string }>;
}
export interface PedidoPessoas {
  conta: { nome: string; dominio: string | null; razao_social?: string | null; linkedin_url?: string | null };
  personas: Persona[];
  max: number;
  /** LinkedIn (normalizado, sem "https://www.linkedin.com/in/") de quem a conta já tem */
  jaTem: string[];
  tetoUsd: number;
}
export interface FonteDeTelefone {
  ator: string;
  /** entrada do ator; "{{linkedin_url}}" vira o perfil e "{{linkedin_urls}}" a lista */
  entrada: Record<string, unknown>;
  /** quanto custa, no máximo, por pessoa (para dividir o teto) */
  maxUsdPorPessoa?: number;
}
export interface OpcoesPessoas {
  pool: Coletor;
  telefone?: FonteDeTelefone | null;
  esperaCustoMs?: number;
  atorBusca?: string;
  atorPerfil?: string;
}
export interface ResultadoPessoas { pessoas: PessoaAchada[]; custoUsd: number | null }

export const ATOR_BUSCA = 'apify/google-search-scraper';
export const ATOR_PERFIL = 'harvestapi/linkedin-profile-scraper';

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const slugDe = (url: string) => (url.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1] ?? '').toLowerCase();
const PALAVRAS_GENERICAS = new Set(['ltda', 'sa', 's/a', 'eireli', 'me', 'epp', 'grupo', 'brasil', 'do', 'da', 'de', 'dos', 'das', 'e', 'cia', 'industria', 'comercio']);

/** Palavras que identificam a empresa num texto (sem "Ltda", "S.A." etc.). */
export function marcasDaEmpresa(conta: PedidoPessoas['conta']): string[] {
  const nomes = [conta.nome, conta.dominio ? conta.dominio.split('.')[0] : ''].filter(Boolean);
  const marcas = new Set<string>();
  for (const n of nomes) {
    const limpo = semAcento(n).replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(p => p.length > 2 && !PALAVRAS_GENERICAS.has(p));
    if (limpo.length) marcas.add(limpo.slice(0, 2).join(' '));
  }
  return [...marcas];
}

export function consultaDoGoogle(p: PedidoPessoas): string {
  const cargos = p.personas.map(x => `"${x.cargo.replace(/"/g, '')}"`).slice(0, 8).join(' OR ');
  return `site:linkedin.com/in (${cargos}) "${p.conta.nome.replace(/"/g, '')}"`;
}

const papelValido = (x: unknown): PessoaAchada['papel'] => (x === 'decisor' || x === 'campeao' ? x : 'influenciador');

/** Que persona alvo o cargo encaixa (a primeira da lista vence), ou nulo. */
export function personaDoCargo(cargo: string, personas: Persona[]): Persona | null {
  const c = semAcento(cargo);
  return personas.find(p => new RegExp(`(^|[^a-z])${semAcento(p.cargo).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(c)) ?? null;
}

interface Candidato { nome: string; cargo: string | null; persona: Persona; url: string; ordem: number }

/** Lê os resultados do Google: "Nome - Cargo - Empresa | LinkedIn". Só quem cita a empresa e é persona alvo. */
export function candidatosDoGoogle(itens: unknown[], p: PedidoPessoas): Candidato[] {
  const marcas = marcasDaEmpresa(p.conta);
  const ja = new Set(p.jaTem.map(s => s.toLowerCase().replace(/\/+$/, '')));
  const vistos = new Set<string>();
  const saida: Candidato[] = [];
  for (const it of itens) {
    const organicos = (it && typeof it === 'object' ? (it as { organicResults?: unknown }).organicResults : null);
    if (!Array.isArray(organicos)) continue;
    for (const o of organicos as Array<Record<string, unknown>>) {
      const url = typeof o.url === 'string' ? o.url : '';
      const slug = slugDe(url);
      if (!slug || ja.has(slug) || vistos.has(slug)) continue;
      const titulo = String(o.title ?? '').replace(/\s*[|–-]\s*LinkedIn.*$/i, '').trim();
      const texto = semAcento(`${o.title ?? ''} ${o.description ?? ''}`);
      if (marcas.length && !marcas.some(m => texto.includes(m))) continue;
      const partes = titulo.split(/\s+[-–—]\s+/).map(s => s.trim()).filter(Boolean);
      const nome = partes[0] ?? '';
      if (!nome || /linkedin/i.test(nome) || nome.length > 80) continue;
      const cargo = partes.length > 1 ? partes[1] : null;
      const persona = personaDoCargo(cargo ?? String(o.description ?? ''), p.personas);
      if (!persona) continue;
      vistos.add(slug);
      saida.push({ nome, cargo, persona, url: `https://www.linkedin.com/in/${slug}`, ordem: p.personas.indexOf(persona) });
    }
  }
  // Primeiro os cargos mais importantes da lista do cliente; mantém a ordem do Google entre iguais.
  return saida.map((c, i) => ({ c, i })).sort((a, b) => a.c.ordem - b.c.ordem || a.i - b.i).map(x => x.c);
}

/** Lê um perfil devolvido pelo leitor de perfis (os nomes de campo variam; só aceita foto https). */
export function lerPerfil(item: unknown): { slug: string; nome: string | null; cargo: string | null; foto: string | null } | null {
  if (!item || typeof item !== 'object') return null;
  const r = item as Record<string, unknown>;
  const url = [r.linkedinUrl, r.url, r.profileUrl].find(v => typeof v === 'string') as string | undefined;
  const slug = (url ? slugDe(url) : '') || (typeof r.publicIdentifier === 'string' ? r.publicIdentifier.toLowerCase() : '');
  if (!slug) return null;
  const nome = [r.firstName, r.lastName].filter(v => typeof v === 'string' && v.trim()).join(' ').trim() || (typeof r.fullName === 'string' ? r.fullName : '') || null;
  const atual = Array.isArray(r.currentPosition) ? (r.currentPosition[0] as Record<string, unknown> | undefined) : undefined;
  const cargo = (typeof atual?.position === 'string' && atual.position) || (typeof r.headline === 'string' && r.headline) || null;
  const fotoBruta = [r.photo, r.profilePicture, r.pictureUrl, (r.profilePicture as { url?: unknown } | undefined)?.url]
    .find(v => typeof v === 'string' && /^https:\/\//i.test(v)) as string | undefined;
  return { slug, nome, cargo: cargo ? String(cargo).slice(0, 160) : null, foto: fotoBruta ?? null };
}

/** Acha números de telefone em qualquer campo chamado telefone/phone/mobile de um item. */
export function telefonesDoItem(item: unknown): string[] {
  const achados = new Set<string>();
  const visitar = (v: unknown, chave: string, prof: number) => {
    if (prof > 4 || v == null) return;
    if (typeof v === 'string' || typeof v === 'number') {
      if (/phone|telefone|mobile|celular|whats/i.test(chave)) {
        const d = String(v).replace(/\D/g, '');
        if (d.length >= 10 && d.length <= 13) achados.add(String(v).trim());
      }
      return;
    }
    if (Array.isArray(v)) { v.forEach(x => visitar(x, chave, prof + 1)); return; }
    if (typeof v === 'object') for (const [k, x] of Object.entries(v as Record<string, unknown>)) visitar(x, `${chave}.${k}`, prof + 1);
  };
  visitar(item, '', 0);
  return [...achados];
}

const preencher = (v: unknown, url: string, urls: string[]): unknown => {
  if (typeof v === 'string') return v === '{{linkedin_urls}}' ? urls : v.replace(/\{\{linkedin_url\}\}/g, url);
  if (Array.isArray(v)) return v.flatMap(x => (x === '{{linkedin_urls}}' ? urls : [preencher(x, url, urls)]));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, preencher(x, url, urls)]));
  return v;
};

export async function acharPessoas(p: PedidoPessoas, o: OpcoesPessoas): Promise<ResultadoPessoas> {
  const max = Math.max(0, Math.min(5, p.max));
  let custo: number | null = 0;
  const somar = (c: number | null) => { custo = custo === null || c === null ? null : custo + c; };
  const gasto = () => custo ?? p.tetoUsd; // custo desconhecido: assume o pior para não passar do teto
  if (!max || !p.personas.length) return { pessoas: [], custoUsd: 0 };

  // 1. Google. Teto pequeno: uma página basta.
  const tetoBusca = Math.min(0.02, p.tetoUsd / 3);
  const busca = await o.pool.coletar(o.atorBusca ?? ATOR_BUSCA, {
    queries: consultaDoGoogle(p), maxPagesPerQuery: 1, countryCode: 'br', mobileResults: false,
    maximumLeadsEnrichmentRecords: 0, aiModeSearch: { enableAiMode: false }
  }, { maxItens: 1, tetoUsd: tetoBusca, esperaCustoMs: o.esperaCustoMs });
  somar(busca.custoUsd);
  const escolhidos = candidatosDoGoogle(busca.itens, p).slice(0, max);
  if (!escolhidos.length) return { pessoas: [], custoUsd: custo };

  // 2. Perfis (foto e cargo atual). Falhou: segue com o que o Google mostrou.
  const perfis = new Map<string, NonNullable<ReturnType<typeof lerPerfil>>>();
  const reservaTelefone = o.telefone ? Math.min(p.tetoUsd / 3, (o.telefone.maxUsdPorPessoa ?? 0.01) * escolhidos.length) : 0;
  const tetoPerfis = Math.max(0, p.tetoUsd - gasto() - reservaTelefone);
  if (tetoPerfis >= 0.004 * 1.5) {
    try {
      const r = await o.pool.coletar(o.atorPerfil ?? ATOR_PERFIL, {
        queries: escolhidos.map(c => c.url), profileScraperMode: 'Profile details no email ($4 per 1k)'
      }, { maxItens: escolhidos.length, tetoUsd: tetoPerfis, esperaCustoMs: o.esperaCustoMs });
      somar(r.custoUsd);
      for (const it of r.itens) { const pf = lerPerfil(it); if (pf) perfis.set(pf.slug, pf); }
    } catch { /* sem foto: segue com o Google */ }
  }

  const pessoas: PessoaAchada[] = escolhidos.map(c => {
    const pf = perfis.get(slugDe(c.url));
    return { nome: pf?.nome || c.nome, cargo: pf?.cargo || c.cargo, papel: papelValido(c.persona.papel), linkedin_url: c.url, foto_url: pf?.foto ?? null, telefones: [] };
  });

  // 3. Telefone (só com fonte configurada). Cada número leva a fonte (LGPD).
  if (o.telefone) {
    const tetoTel = Math.max(0, p.tetoUsd - gasto());
    if (tetoTel > 0) {
      try {
        const urls = pessoas.map(x => x.linkedin_url);
        const r = await o.pool.coletar(o.telefone.ator, preencher(o.telefone.entrada, urls[0], urls) as Record<string, unknown>,
          { maxItens: urls.length, tetoUsd: tetoTel, esperaCustoMs: o.esperaCustoMs });
        somar(r.custoUsd);
        const fonte = `Apify (${o.telefone.ator})`.slice(0, 60);
        for (const it of r.itens) {
          const slug = lerPerfil(it)?.slug ?? '';
          const alvo = pessoas.find(x => slugDe(x.linkedin_url) === slug) ?? (pessoas.length === 1 ? pessoas[0] : undefined);
          if (!alvo) continue;
          for (const numero of telefonesDoItem(it)) if (!alvo.telefones.some(t => t.numero === numero)) alvo.telefones.push({ numero, fonte });
        }
      } catch { /* sem telefone */ }
    }
  }
  return { pessoas, custoUsd: custo };
}
