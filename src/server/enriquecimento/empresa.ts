// Etapa "empresa" do enriquecimento (ADR 0062). Só fontes públicas e gratuitas, sem chave:
//   1. o site da empresa (o domínio da conta): CNPJ escrito no rodapé/contato e a página da empresa no LinkedIn;
//   2. Receita Federal pelo CNPJ: BrasilAPI e, se ela falhar, minhareceita.org (mesmos dados públicos);
//   3. localização: coordenadas do CEP (BrasilAPI CEP v2), senão o endereço e, por último, a cidade (OpenStreetMap);
//   4. logo: o ícone do próprio site (ou o ícone que o Google guarda do site).
// Nada é inventado: o que não se achou fica vazio. Cada campo diz de onde veio. O banco aplica (manual vence).
import { acharCnpjs, acharLinkedinDaEmpresa, cnpjValido, soDigitos } from './cnpj.ts';
import { mesmaEmpresa } from '../sinais/adaptadores/comum.ts';

export type Campos = Partial<Record<
  'cnpj' | 'razao_social' | 'nome_fantasia' | 'endereco' | 'cep' | 'city' | 'state_uf' | 'telefone' | 'email_empresa' | 'cnae' | 'porte'
  | 'situacao_cadastral' | 'lat' | 'lng' | 'localizacao_precisao' | 'logo_url' | 'linkedin_company_url', string | number>>;
/** `custoUsd`: o que a busca do CNPJ gastou (zero se não buscou; nulo se o custo real não veio). */
export interface ResultadoEmpresa { campos: Campos; fontes: Record<string, string>; custoUsd: number | null }
export interface ContaParaEnriquecer {
  id: string; nome: string; dominio: string | null; cnpj?: string | null; cidade?: string | null; uf?: string | null; cep?: string | null;
  endereco?: string | null; lat?: number | null; lng?: number | null; linkedin_url?: string | null;
}

/** Falha que vale tentar de novo mais tarde (fonte fora do ar ou ocupada). */
export class FonteIndisponivel extends Error {}

export interface OpcoesEmpresa {
  buscar?: typeof fetch;
  /**
   * Só usada quando nem a conta nem o site têm CNPJ: candidatos achados numa busca (Google pela Apify). A Receita confere
   * cada um, e só vale o que tem o nome da conta. Sem esta opção (ou se ela falhar), o CNPJ fica vazio.
   */
  buscarCnpj?: (conta: ContaParaEnriquecer) => Promise<{ candidatos: string[]; custoUsd: number | null }>;
  /** espera entre pedidos ao mesmo serviço (uso justo das APIs públicas; o OpenStreetMap pede 1 por segundo) */
  esperar?: (ms: number) => Promise<void>;
  /** identificação exigida pelo OpenStreetMap */
  agenteHttp?: string;
}

const UA_PADRAO = 'AlthiusRevenueOS/1.0 (enriquecimento de contas; contato@althius.com.br)';
const ESPACO_MS: Record<string, number> = { 'nominatim.openstreetmap.org': 1100, 'brasilapi.com.br': 300, 'minhareceita.org': 300 };
const ultimoPedido = new Map<string, number>();

function criarCliente(o: OpcoesEmpresa) {
  const buscar = o.buscar ?? fetch;
  const esperar = o.esperar ?? (ms => new Promise<void>(r => setTimeout(r, ms)));
  const ua = o.agenteHttp ?? UA_PADRAO;
  async function pedir(url: string, aceitar = 'application/json', prazoMs = 15_000): Promise<Response | null> {
    const host = new URL(url).host;
    const espaco = ESPACO_MS[host] ?? 0;
    if (espaco) {
      const falta = (ultimoPedido.get(host) ?? 0) + espaco - Date.now();
      if (falta > 0) await esperar(falta);
      ultimoPedido.set(host, Date.now());
    }
    try {
      return await buscar(url, { headers: { Accept: aceitar, 'User-Agent': ua }, redirect: 'follow', signal: AbortSignal.timeout(prazoMs) });
    } catch { return null; }
  }
  return { pedir };
}

const titulo = (s: string) => s.toLowerCase().replace(/(^|[\s/-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase())
  .replace(/\b(De|Da|Do|Das|Dos|E)\b/g, m => m.toLowerCase());
const limpo = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : typeof v === 'number' ? String(v) : '');
const UFS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));

/** Lê o HTML de algumas páginas do site (início, contato, política de privacidade). Site fora do ar não é erro. */
async function paginasDoSite(cliente: ReturnType<typeof criarCliente>, dominio: string): Promise<string[]> {
  const paginas: string[] = [];
  const lerTexto = async (url: string) => {
    const r = await cliente.pedir(url, 'text/html', 12_000);
    if (!r || !r.ok || !/html|text/i.test(r.headers.get('content-type') ?? 'text/html')) return null;
    const t = await r.text().catch(() => '');
    return t.slice(0, 1_500_000);
  };
  let base = `https://${dominio}`;
  let inicio = await lerTexto(base);
  if (inicio === null && !dominio.startsWith('www.')) { base = `https://www.${dominio}`; inicio = await lerTexto(base); }
  if (inicio === null) return paginas;
  paginas.push(inicio);
  if (acharCnpjs(inicio).length) return paginas;
  for (const caminho of ['/contato', '/fale-conosco', '/politica-de-privacidade']) {
    const t = await lerTexto(base + caminho);
    if (t) { paginas.push(t); if (acharCnpjs(t).length) break; }
  }
  return paginas;
}

interface DadosReceita {
  razao_social?: string; nome_fantasia?: string; uf?: string; municipio?: string; cep?: string | number; logradouro?: string; numero?: string;
  bairro?: string; complemento?: string; descricao_tipo_de_logradouro?: string; ddd_telefone_1?: string; email?: string | null;
  cnae_fiscal?: number | string; cnae_fiscal_descricao?: string; porte?: string; descricao_situacao_cadastral?: string;
}

/** Receita Federal pelo CNPJ. Nulo = CNPJ não existe. Fonte fora do ar = FonteIndisponivel (tenta depois). */
async function receita(cliente: ReturnType<typeof criarCliente>, cnpj: string): Promise<{ dados: DadosReceita; fonte: string } | null> {
  let foraDoAr = 0;
  for (const [url, fonte] of [[`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, 'Receita Federal (BrasilAPI)'], [`https://minhareceita.org/${cnpj}`, 'Receita Federal (minhareceita)']] as const) {
    const r = await cliente.pedir(url);
    if (!r || r.status === 429 || r.status >= 500) { foraDoAr++; continue; }
    if (r.status === 404 || r.status === 400) return null;
    if (!r.ok) { foraDoAr++; continue; }
    const j = (await r.json().catch(() => null)) as DadosReceita | null;
    if (j && typeof j === 'object' && (j.razao_social || j.municipio)) return { dados: j, fonte };
  }
  if (foraDoAr) throw new FonteIndisponivel('Consulta à Receita Federal fora do ar agora.');
  return null;
}

/** Coordenadas do CEP (BrasilAPI CEP v2). */
async function coordenadasDoCep(cliente: ReturnType<typeof criarCliente>, cep: string) {
  const r = await cliente.pedir(`https://brasilapi.com.br/api/cep/v2/${cep}`);
  if (!r || !r.ok) return null;
  const j = (await r.json().catch(() => null)) as { city?: string; state?: string; location?: { coordinates?: { latitude?: string; longitude?: string } } } | null;
  const lat = Number(j?.location?.coordinates?.latitude), lng = Number(j?.location?.coordinates?.longitude);
  return { cidade: limpo(j?.city) || null, uf: limpo(j?.state).toUpperCase() || null, lat: Number.isFinite(lat) && lat !== 0 ? lat : null, lng: Number.isFinite(lng) && lng !== 0 ? lng : null };
}

/** OpenStreetMap (Nominatim): endereço ou cidade, só no Brasil. */
async function geocodificar(cliente: ReturnType<typeof criarCliente>, consulta: string) {
  const q = new URLSearchParams({ format: 'jsonv2', countrycodes: 'br', limit: '1', q: consulta });
  const r = await cliente.pedir(`https://nominatim.openstreetmap.org/search?${q}`);
  if (!r || !r.ok) return null;
  const j = (await r.json().catch(() => null)) as Array<{ lat?: string; lon?: string }> | null;
  const lat = Number(j?.[0]?.lat), lng = Number(j?.[0]?.lon);
  return Number.isFinite(lat) && Number.isFinite(lng) && j?.[0] ? { lat, lng } : null;
}

/** Ícone do site (o mesmo que a tela tenta primeiro); se o site não tiver, o que o Google guarda do site. */
async function logoDoSite(cliente: ReturnType<typeof criarCliente>, dominio: string): Promise<string> {
  const proprio = `https://${dominio}/apple-touch-icon.png`;
  const r = await cliente.pedir(proprio, 'image/*', 8_000);
  if (r && r.ok && /^image\//i.test(r.headers.get('content-type') ?? '')) return proprio;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(dominio)}&sz=128`;
}

/** Enriquecimento da empresa. Custo zero (só fontes públicas). */
export async function enriquecerEmpresa(conta: ContaParaEnriquecer, o: OpcoesEmpresa = {}): Promise<ResultadoEmpresa> {
  const cliente = criarCliente(o);
  const campos: Campos = {};
  const fontes: Record<string, string> = {};
  const por = (campo: keyof Campos, valor: string | number | null | undefined, fonte: string) => {
    if (valor === null || valor === undefined || valor === '') return;
    campos[campo] = valor;
    fontes[campo] = fonte;
  };
  const dominio = (conta.dominio ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '') || null;

  // 1. Site: CNPJ e LinkedIn da empresa.
  let cnpj = conta.cnpj && cnpjValido(conta.cnpj) ? soDigitos(conta.cnpj) : null;
  if (dominio) {
    const paginas = await paginasDoSite(cliente, dominio);
    if (paginas.length) {
      if (!cnpj) { cnpj = paginas.map(acharCnpjs).flat()[0] ?? null; if (cnpj) por('cnpj', cnpj, 'Site da empresa'); }
      if (!conta.linkedin_url) por('linkedin_company_url', paginas.map(acharLinkedinDaEmpresa).find(Boolean) ?? null, 'Site da empresa');
      por('logo_url', await logoDoSite(cliente, dominio), 'Site da empresa');
    }
  }

  // 1b. Sem CNPJ no site: busca ("CNPJ + nome"). Só vale se a Receita disser que o nome é o da conta (dúvida = não preenche).
  let custoUsd: number | null = 0;
  let rf: Awaited<ReturnType<typeof receita>> = null;
  if (!cnpj && o.buscarCnpj) {
    try {
      const achados = await o.buscarCnpj(conta);
      custoUsd = achados.custoUsd;
      for (const candidato of achados.candidatos.filter(cnpjValido).slice(0, 3)) {
        const consulta = await receita(cliente, soDigitos(candidato));
        if (consulta && (mesmaEmpresa(conta.nome, consulta.dados.nome_fantasia) || mesmaEmpresa(conta.nome, consulta.dados.razao_social))) {
          cnpj = soDigitos(candidato); rf = consulta;
          por('cnpj', cnpj, 'Busca no Google, conferida na Receita Federal');
          break;
        }
      }
    } catch (e) {
      if (e instanceof FonteIndisponivel) throw e; // a Receita fora do ar não é "não achei": tenta de novo depois
    }
  }

  // 2. Receita Federal.
  let cep = conta.cep ? soDigitos(conta.cep) : null;
  let cidade = conta.cidade ?? null, uf = conta.uf ?? null, endereco = conta.endereco ?? null;
  if (cnpj) {
    rf ??= await receita(cliente, cnpj);
    if (rf) {
      const d = rf.dados;
      por('razao_social', limpo(d.razao_social), rf.fonte);
      por('nome_fantasia', limpo(d.nome_fantasia), rf.fonte);
      const cnae = [limpo(d.cnae_fiscal), limpo(d.cnae_fiscal_descricao)].filter(Boolean).join(' - ');
      por('cnae', cnae, rf.fonte);
      por('porte', limpo(d.porte), rf.fonte);
      por('situacao_cadastral', limpo(d.descricao_situacao_cadastral), rf.fonte);
      const tel = soDigitos(limpo(d.ddd_telefone_1));
      if (tel.length >= 10) por('telefone', `(${tel.slice(0, 2)}) ${tel.slice(2, -4)}-${tel.slice(-4)}`, rf.fonte);
      if (d.email && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(limpo(d.email))) por('email_empresa', limpo(d.email).toLowerCase(), rf.fonte);
      const rua = [limpo(d.descricao_tipo_de_logradouro) && !limpo(d.logradouro).toUpperCase().startsWith(limpo(d.descricao_tipo_de_logradouro).toUpperCase()) ? limpo(d.descricao_tipo_de_logradouro) : '', limpo(d.logradouro)].filter(Boolean).join(' ');
      const linha = [rua && titulo(rua), limpo(d.numero), limpo(d.complemento) && titulo(limpo(d.complemento)), limpo(d.bairro) && titulo(limpo(d.bairro))].filter(Boolean).join(', ');
      if (linha) { endereco = linha; por('endereco', linha, rf.fonte); }
      const cepRf = soDigitos(limpo(d.cep));
      if (cepRf.length === 8) { cep = cepRf; por('cep', cepRf, rf.fonte); }
      if (limpo(d.municipio)) { cidade = titulo(limpo(d.municipio)); por('city', cidade, rf.fonte); }
      if (UFS.has(limpo(d.uf).toUpperCase())) { uf = limpo(d.uf).toUpperCase(); por('state_uf', uf, rf.fonte); }
    }
  }

  // 3. Localização (se a conta ainda não tem).
  if (conta.lat == null || conta.lng == null) {
    let achou = false;
    if (cep && cep.length === 8) {
      const c = await coordenadasDoCep(cliente, cep);
      if (c?.cidade && fontes.city) { cidade = c.cidade; por('city', c.cidade, fontes.city); } // mesmo nome, com acento
      if (c && c.lat !== null && c.lng !== null) { por('lat', c.lat, 'BrasilAPI (CEP)'); por('lng', c.lng, 'BrasilAPI (CEP)'); por('localizacao_precisao', 'cep', 'BrasilAPI (CEP)'); achou = true; }
    }
    if (!achou && endereco && cidade && uf) {
      const g = await geocodificar(cliente, `${endereco.split(',').slice(0, 2).join(',')}, ${cidade}, ${uf}, Brasil`);
      if (g) { por('lat', g.lat, 'OpenStreetMap'); por('lng', g.lng, 'OpenStreetMap'); por('localizacao_precisao', 'endereco', 'OpenStreetMap'); achou = true; }
    }
    if (!achou && cidade && uf) {
      const g = await geocodificar(cliente, `${cidade}, ${uf}, Brasil`);
      if (g) { por('lat', g.lat, 'OpenStreetMap'); por('lng', g.lng, 'OpenStreetMap'); por('localizacao_precisao', 'cidade', 'OpenStreetMap'); }
    }
  }
  return { campos, fontes, custoUsd };
}
