// Normalização no front: domínio, URL, e-mail com nome e CSV.
//
// Peças portadas do Twenty (https://github.com/twentyhq/twenty), pacote `packages/twenty-shared`, licença MIT,
// commit fa512ae4d42d45d05e8907211709e9d614f447b7. Copyright (c) 2023-present Twenty.com, PBC.
// Aviso completo, lista de arquivos e texto da licença: THIRD_PARTY_NOTICES.md (seção 2).
// O banco tem a sua própria versão em SQL (`public.normalize_domain`, migration 0103); o teste
// `normalizacao.banco.test.ts` garante que as duas dão o mesmo resultado (exceto domínio com acento).

// ───────────────────────── Domínio ─────────────────────────

// Origem: utils/url/isValidHostname.ts (`isValidHostname`).
function hostnameValido(host: string, opcoes?: { permitirLocalhost?: boolean; permitirIp?: boolean }): boolean {
  const permitirIp = opcoes?.permitirIp ?? true;
  const permitirLocalhost = opcoes?.permitirLocalhost ?? true;

  const regex = /^(((?!-))(xn--|_)?[a-z0-9-]{0,61}[a-z0-9]{1,1}\.){1,10}(xn--)?([a-z0-9][a-z0-9-]{0,60}|[a-z0-9-]{1,30}\.[a-z]{2,})$/;
  const bateComRegex = regex.test(host);
  const ehIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
  const ehLocalhost = host === 'localhost' || host === '127.0.0.1';

  if (ehLocalhost && !permitirLocalhost) return false;
  if (ehIp && !permitirIp) return false;
  return bateComRegex || ehLocalhost || ehIp;
}

// Adaptação: o original só reconhece "esquema://"; aqui também sai o "//" sem esquema (como faz a função do banco).
const REGEX_PROTOCOLO = /^([a-z][a-z0-9+.-]*:)?\/\//i;
const REGEX_SEPARADOR_DE_CAMINHO = /[/?#]/;
const REGEX_USUARIO = /^.*@/;
// Adaptação: `\d*` (e não `\d+`) para tirar também ":" sem número, igual ao banco.
const REGEX_PORTA = /:\d*$/;

function tirarWwwEPontosFinais(host: string): string {
  const partes = host.split('.');
  while (partes.length > 0 && partes[partes.length - 1] === '') partes.pop();
  while (partes[0] === 'www') partes.shift();
  return partes.join('.');
}

function paraPunycode(host: string): string {
  try {
    return new URL(`https://${host}`).hostname;
  } catch {
    return host;
  }
}

/**
 * Deixa só o domínio da empresa: sem protocolo, `www.`, porta, caminho, consulta, âncora, `usuario:senha@` nem ponto final,
 * em minúsculas. Domínio com acento vira punycode (`münchen.de` → `xn--mnchen-3ya.de`); o banco guarda o acento como está.
 * Devolve `null` quando o texto não é domínio de empresa (vazio, `localhost`, IP, sem terminação, com espaço).
 * Origem: utils/url/normalizeDomain.ts (`normalizeDomain`). Adaptações: devolve `null` (e não o texto como veio) quando
 * inválido, igual a `public.normalize_domain`; troca `\` por `/` e aceita `//site.com`, como o banco.
 */
export function normalizarDominio(bruto: string | null | undefined): string | null {
  if (typeof bruto !== 'string') return null;
  const [semCaminho = ''] = bruto.trim().replace(/\\/g, '/').replace(REGEX_PROTOCOLO, '').split(REGEX_SEPARADOR_DE_CAMINHO);
  const host = tirarWwwEPontosFinais(semCaminho.replace(REGEX_USUARIO, '').replace(REGEX_PORTA, '').toLowerCase());
  const comPunycode = paraPunycode(host);
  return hostnameValido(comPunycode, { permitirLocalhost: false, permitirIp: false }) ? comPunycode : null;
}

/** Origem: utils/url/isValidDomain.ts (`isValidDomain`). */
export function dominioValido(bruto: string | null | undefined): boolean {
  return normalizarDominio(bruto) !== null;
}

// ───────────────────────── URL ─────────────────────────

// Origem: utils/url/ensureAbsoluteUrl.ts (`ensureAbsoluteUrl`). Adaptação: reconhece http/https em qualquer caixa.
function garantirUrlAbsoluta(valor: string): string {
  const limpo = valor.trim();
  return /^https?:\/\//i.test(limpo) ? limpo : `https://${limpo}`;
}

// Origem: utils/url/absoluteUrlSchema.ts (`absoluteUrlSchema`), sem `zod`: devolve a URL absoluta ou `null`.
function urlAbsolutaOuNulo(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const absoluta = garantirUrlAbsoluta(valor);
  const semProtocolo = absoluta.replace(/^https?:\/\//i, '');

  // Só números não é endereço: deixar o URL() ler isso o transformaria em IP e perderíamos a informação.
  if (/^\d+(?:\/[a-zA-Z]*)?$/.test(semProtocolo)) return null;

  try {
    const url = new URL(absoluta);
    return hostnameValido(url.hostname) ? absoluta : null;
  } catch {
    return null;
  }
}

/**
 * Nome do site de uma URL (em minúsculas, com `www.` se vier). Lança erro em URL inválida.
 * Como no Twenty, aceita `localhost` e IP; para barrar, use `dominioValido`.
 * Origem: utils/url/getUrlHostnameOrThrow.ts (`getUrlHostnameOrThrow`).
 */
export function hostDaUrl(url: string): string {
  const absoluta = urlAbsolutaOuNulo(url);
  if (absoluta === null) throw new Error('URL inválida.');
  try {
    return new URL(absoluta).hostname;
  } catch {
    throw new Error('URL inválida.');
  }
}

// Origem: utils/getUrlSafely.ts + utils/url/normalizeUrlOrigin.ts (`normalizeUrlOrigin`).
// Só tira a barra do fim: o URL() já põe a origem em minúsculas e mantém as sequências com % do resto.
function tirarBarraFinal(urlBruta: string): string {
  let url: URL;
  try {
    url = new URL(urlBruta);
  } catch {
    return urlBruta;
  }
  return (url.origin + url.pathname + url.search + url.hash).replace(/\/$/, '');
}

/** Coloca `https://` se faltar, põe a origem em minúsculas e tira a barra do fim. Origem: utils/url/normalizeUrl.ts. */
export function normalizarUrl(url: string): string {
  const limpa = url.trim();
  if (limpa === '') return limpa;
  return tirarBarraFinal(garantirUrlAbsoluta(limpa));
}

// ───────────────────────── E-mail com nome ─────────────────────────

export interface EmailLido {
  address: string;
  name: string;
}

// Parte a lista em entradas ("Nome <a@x.com>") em , ou ; fora de aspas, de <...> e de (...).
// Nome de grupo ("Time: a@x.com, b@x.com;") é descartado: os membros entram soltos (grupos achatados).
function separarEntradas(texto: string): string[] {
  const entradas: string[] = [];
  let atual = '';
  let emAspas = false;
  let emAngulo = false;
  let profundidadeComentario = 0;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (emAspas) {
      atual += c;
      if (c === '\\' && i + 1 < texto.length) atual += texto[++i];
      else if (c === '"') emAspas = false;
    } else if (profundidadeComentario > 0) {
      atual += c;
      if (c === '\\' && i + 1 < texto.length) atual += texto[++i];
      else if (c === '(') profundidadeComentario++;
      else if (c === ')') profundidadeComentario--;
    } else if (emAngulo) {
      atual += c;
      if (c === '>') emAngulo = false;
    } else if (c === '"') {
      emAspas = true;
      atual += c;
    } else if (c === '(') {
      profundidadeComentario = 1;
      atual += c;
    } else if (c === '<') {
      emAngulo = true;
      atual += c;
    } else if (c === ':') {
      atual = '';
    } else if (c === ',' || c === ';') {
      entradas.push(atual);
      atual = '';
    } else {
      atual += c;
    }
  }
  entradas.push(atual);
  return entradas;
}

// Lê uma entrada: "Nome <a@x.com>", "\"Nome, Sobrenome\" <a@x.com>", "a@x.com", "a@x.com (Nome)" ou só um nome.
function lerEntrada(bruta: string): EmailLido {
  const entreAspas: string[] = [];
  let foraDeAspas = '';
  let angulo: string | null = null;
  let comentario = '';

  for (let i = 0; i < bruta.length; i++) {
    const c = bruta[i];
    if (c === '"') {
      let texto = '';
      for (i++; i < bruta.length && bruta[i] !== '"'; i++) {
        if (bruta[i] === '\\' && i + 1 < bruta.length) i++;
        texto += bruta[i];
      }
      entreAspas.push(texto);
    } else if (c === '(') {
      let profundidade = 1;
      let texto = '';
      for (i++; i < bruta.length; i++) {
        if (bruta[i] === '\\' && i + 1 < bruta.length) {
          texto += bruta[++i];
          continue;
        }
        if (bruta[i] === '(') profundidade++;
        if (bruta[i] === ')' && --profundidade === 0) break;
        texto += bruta[i];
      }
      comentario = comentario ? `${comentario} ${texto}` : texto;
    } else if (c === '<') {
      const fim = bruta.indexOf('>', i + 1);
      angulo = bruta.slice(i + 1, fim === -1 ? undefined : fim);
      i = fim === -1 ? bruta.length : fim;
    } else {
      foraDeAspas += c;
    }
  }

  const palavras = foraDeAspas.split(/\s+/).filter(Boolean);
  if (angulo !== null) {
    return { address: angulo.trim(), name: [...entreAspas, ...palavras].join(' ').trim() };
  }
  const posicaoDoEmail = palavras.findIndex(p => p.includes('@'));
  const address = posicaoDoEmail >= 0 ? palavras[posicaoDoEmail] : '';
  const resto = palavras.filter((_, i) => i !== posicaoDoEmail);
  return { address, name: ([...entreAspas, ...resto].join(' ') || comentario).trim() };
}

/**
 * Lê uma lista de e-mails ("Aline Xavier <a@x.com.br>, \"Xavier, Aline\" <b@x.com.br>; c@x.com.br").
 * Separa por `,` ou `;` (menos dentro de aspas), entende nome entre aspas e achata grupos.
 * Origem: contrato de utils/email/parseEmailAddressList.ts (`parseEmailAddressList`). O original usa o pacote
 * `addressparser`; para não criar dependência nova, este leitor é próprio (veja THIRD_PARTY_NOTICES.md).
 */
export function lerListaDeEmails(texto: string): EmailLido[] {
  if (typeof texto !== 'string') return [];
  return separarEntradas(texto)
    .map(lerEntrada)
    .filter(e => e.address.length > 0 || e.name.length > 0);
}

const NOME_QUE_PEDE_ASPAS = /[()<>[\]:;@\\,."]/;

/** Volta a montar `Nome <e-mail>` (com aspas quando o nome tem vírgula, ponto etc.). Origem: utils/email/formatEmailAddress.ts. */
export function formatarEmail({ address, name }: { address: string; name?: string }): string {
  if (typeof name !== 'string' || name.length === 0) return address;
  const nomeFormatado = NOME_QUE_PEDE_ASPAS.test(name) ? `"${name.replace(/[\\"]/g, '\\$&')}"` : name;
  return `${nomeFormatado} <${address}>`;
}

// ───────────────────────── CSV ─────────────────────────

// Origem: constants/CsvDangerousCharacters.ts e constants/CsvInjectionPreventionZwj.ts.
// Começo de célula que o Excel/LibreOffice lê como fórmula (OWASP "CSV Injection").
const CSV_CARACTERES_PERIGOSOS = /^[=+\-@\t\r]/;
// Caractere invisível (Zero-Width Joiner): quebra a fórmula sem mudar o que a pessoa vê.
const CSV_ZWJ = '\u200D';

/**
 * Prepara um valor para escrever em CSV: entre aspas quando tem vírgula, aspas ou quebra de linha, e aspas dobradas.
 * NÃO protege contra fórmula: na exportação, use `higienizarValorCsv` ANTES.
 * Origem: utils/csv/formatValueForCSV.ts (`formatValueForCSV`).
 */
export function valorParaCsv(valor: unknown): string {
  if (valor == null) return '';
  const texto = typeof valor === 'string' ? valor : (JSON.stringify(valor) ?? '');
  if (texto.includes(',') || texto.includes('"') || texto.includes('\n') || texto.includes('\r')) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

/** Neutraliza injeção de fórmula na exportação: valor que começa com `=`, `+`, `-`, `@`, tab ou CR ganha um caractere invisível na frente. Origem: utils/csv/sanitizeValueForCSVExport.ts. */
export function higienizarValorCsv(valor: unknown): string {
  if (valor == null) return '';
  const texto = typeof valor === 'string' ? valor : String(valor);
  return CSV_CARACTERES_PERIGOSOS.test(texto) ? CSV_ZWJ + texto : texto;
}

export interface LinhaCsv {
  /** número da linha no arquivo (1 = primeira), contando linhas vazias e quebras dentro de aspas */
  numero: number;
  celulas: string[];
}

export interface ResultadoLeituraCsv {
  linhas: LinhaCsv[];
  /** linha em que abriu uma aspa que nunca foi fechada, ou `null` */
  aspasNaoFechadasNaLinha: number | null;
}

// Separador pela primeira linha com conteúdo: `;` se tiver mais `;` que `,` (fora de aspas), senão `,`.
function descobrirSeparador(texto: string): ',' | ';' {
  let virgulas = 0;
  let pontoEVirgulas = 0;
  let emAspas = false;
  let temConteudo = false;
  for (const c of texto) {
    if (c === '"') emAspas = !emAspas;
    else if (!emAspas && (c === '\n' || c === '\r')) {
      if (temConteudo) break;
    } else if (!emAspas && c === ',') {
      virgulas++;
      temConteudo = true;
    } else if (!emAspas && c === ';') {
      pontoEVirgulas++;
      temConteudo = true;
    } else if (c.trim() !== '') temConteudo = true;
  }
  return pontoEVirgulas > virgulas ? ';' : ',';
}

/**
 * Lê um CSV (separador `,` ou `;`, aspas, aspas dobradas, quebra de linha dentro de aspas, BOM, CRLF).
 * Linhas totalmente vazias são ignoradas. Escrito para o Althius (não vem do Twenty).
 */
export function lerCsv(texto: string): ResultadoLeituraCsv {
  const conteudo = texto.replace(/^\uFEFF/, '');
  const separador = descobrirSeparador(conteudo);
  const linhas: LinhaCsv[] = [];
  let celulas: string[] = [];
  let celula = '';
  let emAspas = false;
  let linhaAtual = 1;
  let linhaDoRegistro = 1;
  let aspasAbertasNaLinha: number | null = null;

  const fecharCelula = () => {
    celulas.push(celula);
    celula = '';
  };
  const fecharRegistro = () => {
    fecharCelula();
    if (celulas.some(c => c.trim() !== '')) linhas.push({ numero: linhaDoRegistro, celulas });
    celulas = [];
  };

  for (let i = 0; i < conteudo.length; i++) {
    const c = conteudo[i];
    if (emAspas) {
      if (c === '"') {
        if (conteudo[i + 1] === '"') {
          celula += '"';
          i++;
        } else emAspas = false;
      } else {
        celula += c;
        if (c === '\n') linhaAtual++;
      }
    } else if (c === '"' && celula.trim() === '') {
      celula = '';
      emAspas = true;
      aspasAbertasNaLinha = linhaAtual;
    } else if (c === separador) {
      fecharCelula();
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && conteudo[i + 1] === '\n') i++;
      fecharRegistro();
      linhaAtual++;
      linhaDoRegistro = linhaAtual;
    } else {
      celula += c;
    }
  }
  fecharRegistro();

  return { linhas, aspasNaoFechadasNaLinha: emAspas ? aspasAbertasNaLinha : null };
}
