// Fonte de prospecção como DADO (ADR 0067). A fonte diz, só com dados, como chamar o ator e como ler o que ele devolve:
//  - a entrada troca {{variáveis}} pelos parâmetros da busca ("{{max}}" sozinho vira número); parâmetro opcional vazio
//    some da entrada; variável sem valor no meio de um texto é erro (nunca chama o ator pela metade);
//  - o mapeamento só aponta campos do item ("a.b.0.c", com alternativas "a|b") para o formato comum que o banco aceita.
// Nada aqui executa código vindo da fonte. Sem dependências: roda no contêiner `prospeccao` só com Node.

/** Erro de montagem da entrada. Vira falha da busca, com o crédito devolvido. */
export class ErroDeEntrada extends Error {}

/** O item no formato que `prospect_finish` aceita. */
export interface ItemProspeccao {
  chave: string;
  nome: string;
  site?: string;
  cnpj?: string;
  telefone?: string;
  endereco?: string;
  cidade?: string;
  uf?: string;
  categoria?: string;
  porte?: string;
  capital_social?: number;
  lat?: number;
  lng?: number;
  dados?: Record<string, unknown>;
}

export interface MapeamentoProspeccao {
  chave: string;
  prefixo_chave?: string;
  nome: string;
  site?: string;
  cnpj?: string;
  telefone?: string;
  endereco?: string;
  cidade?: string;
  uf?: string;
  categoria?: string;
  porte?: string;
  capital_social?: string;
  lat?: string;
  lng?: string;
  /** campos extras guardados como estão (ex.: nota no Google Maps) */
  dados?: string[];
  [outro: string]: unknown;
}

const MARCA = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
const SOME = Symbol('some');

function trocar(valor: unknown, vars: Record<string, string | number>): unknown {
  if (typeof valor === 'string') {
    const unica = /^\{\{\s*([a-zA-Z0-9_]+)\s*\}\}$/.exec(valor);
    if (unica) {
      const v = vars[unica[1]];
      if (v === undefined || v === '') return SOME;
      return v;
    }
    return valor.replace(MARCA, (_, nome: string) => {
      const v = vars[nome];
      if (v === undefined || v === '') throw new ErroDeEntrada(`A fonte precisa do parâmetro {{${nome}}}, que a busca não tem.`);
      return String(v);
    });
  }
  if (Array.isArray(valor)) {
    const lista = valor.map(v => trocar(v, vars)).filter(v => v !== SOME);
    return lista.length ? lista : SOME;
  }
  if (valor && typeof valor === 'object') {
    const saida: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(valor)) {
      const t = trocar(v, vars);
      if (t !== SOME) saida[k] = t;
    }
    return saida;
  }
  return valor;
}

/** A entrada do ator para esta busca. Só entram as variáveis citadas na entrada (filtros do ICP ficam de fora). */
export function montarEntrada(entrada: Record<string, unknown>, parametros: Record<string, unknown>, max: number): Record<string, unknown> {
  const vars: Record<string, string | number> = { max };
  for (const [k, v] of Object.entries(parametros ?? {})) if (typeof v === 'string' || typeof v === 'number') vars[k] = typeof v === 'string' ? v.trim() : v;
  const r = trocar(entrada ?? {}, vars);
  return r === SOME ? {} : (r as Record<string, unknown>);
}

/** O valor de um campo do item por caminho com pontos; "a|b" tenta a, depois b. */
export function lerCampo(item: unknown, caminho: string | undefined): unknown {
  if (!caminho) return undefined;
  for (const alternativa of caminho.split('|')) {
    let atual: unknown = item;
    for (const parte of alternativa.trim().split('.')) {
      if (atual === null || atual === undefined) break;
      if (Array.isArray(atual)) atual = /^\d+$/.test(parte) ? atual[Number(parte)] : undefined;
      else if (typeof atual === 'object') atual = (atual as Record<string, unknown>)[parte];
      else atual = undefined;
    }
    if (atual !== undefined && atual !== null && atual !== '') return atual;
  }
  return undefined;
}

const texto = (v: unknown): string | undefined => {
  if (Array.isArray(v)) return texto(v[0]);
  const t = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : typeof v === 'number' ? String(v) : '';
  return t || undefined;
};

const numero = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string' || !v.trim()) return undefined;
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : undefined;
};

/** "R$ 10.000,50" → 10000.5; "10000.5" → 10000.5. */
const dinheiro = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string') return undefined;
  const t = v.replace(/[^0-9.,-]/g, '');
  if (!t) return undefined;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : undefined;
};

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const UFS: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE', 'distrito federal': 'DF', 'espirito santo': 'ES', goias: 'GO',
  maranhao: 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG', para: 'PA', paraiba: 'PB', parana: 'PR', pernambuco: 'PE',
  piaui: 'PI', 'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO', roraima: 'RR', 'santa catarina': 'SC',
  'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO'
};
const SIGLAS = new Set(Object.values(UFS));

/** A sigla da UF a partir de "São Paulo", "sp" ou "State of São Paulo". Desconhecida: nulo (nunca chuta). */
export function siglaDaUf(v: unknown): string | null {
  const t = texto(v);
  if (!t) return null;
  if (SIGLAS.has(t.toUpperCase())) return t.toUpperCase();
  const s = semAcento(t).replace(/^(state of|estado de|estado do|estado da)\s+/, '');
  return UFS[s] ?? null;
}

/** Porte da Receita ("MICRO EMPRESA", "EMPRESA DE PEQUENO PORTE", "DEMAIS") nos três valores do filtro. */
function porteDe(v: unknown): string | undefined {
  const t = texto(v);
  if (!t) return undefined;
  const s = semAcento(t);
  if (s.startsWith('micro') || s === 'me' || s === '01' || s === '1') return 'MICRO';
  if (s.includes('pequeno porte') || s === 'epp' || s === '03' || s === '3') return 'EPP';
  if (s.startsWith('demais') || s === '05' || s === '5') return 'DEMAIS';
  return t.toUpperCase().slice(0, 40);
}

/** Os itens do ator no formato comum. Item sem chave ou sem nome, ou com erro do ator, fica de fora. */
export function mapearItens(itens: unknown[], m: MapeamentoProspeccao): ItemProspeccao[] {
  const saida: ItemProspeccao[] = [];
  for (const bruto of Array.isArray(itens) ? itens : []) {
    if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto) || (bruto as { error?: unknown }).error) continue;
    const item = bruto as Record<string, unknown>;
    let chave = texto(lerCampo(item, m.chave));
    const nome = texto(lerCampo(item, m.nome));
    if (!chave || !nome) continue;
    const cnpj = m.cnpj ? texto(lerCampo(item, m.cnpj))?.replace(/\D/g, '') : undefined;
    if (m.cnpj && m.chave === m.cnpj) chave = cnpj;
    if (!chave) continue;
    const x: ItemProspeccao = { chave: `${m.prefixo_chave ?? ''}${chave}`.slice(0, 200), nome: nome.slice(0, 200) };
    const pegar = (campo: keyof ItemProspeccao & keyof MapeamentoProspeccao) => texto(lerCampo(item, m[campo] as string | undefined));
    const site = pegar('site'); if (site) x.site = site;
    if (cnpj && /^\d{14}$/.test(cnpj)) x.cnpj = cnpj;
    const tel = pegar('telefone'); if (tel) x.telefone = tel;
    const end = pegar('endereco'); if (end) x.endereco = end;
    const cid = pegar('cidade'); if (cid) x.cidade = cid;
    const uf = siglaDaUf(lerCampo(item, m.uf)); if (uf) x.uf = uf;
    const cat = pegar('categoria'); if (cat) x.categoria = cat;
    const porte = porteDe(lerCampo(item, m.porte)); if (porte) x.porte = porte;
    const cap = dinheiro(lerCampo(item, m.capital_social)); if (cap !== undefined) x.capital_social = cap;
    const lat = numero(lerCampo(item, m.lat)); if (lat !== undefined) x.lat = lat;
    const lng = numero(lerCampo(item, m.lng)); if (lng !== undefined) x.lng = lng;
    if (Array.isArray(m.dados)) {
      const dados: Record<string, unknown> = {};
      for (const campo of m.dados) {
        const v = item[campo];
        if (typeof v === 'number' || typeof v === 'boolean' || (typeof v === 'string' && v.trim() && v.length <= 300)) dados[campo] = v;
      }
      if (Object.keys(dados).length) x.dados = dados;
    }
    saida.push(x);
  }
  return saida;
}
