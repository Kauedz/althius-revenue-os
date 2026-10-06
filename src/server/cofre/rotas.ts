// Rotas do cofre (ADR 0049), chamadas pela tela do superadmin com o login dele. Quem confere "é superadmin" é o banco
// (cofre_conferir_superadmin com o JWT da pessoa); só depois o servidor cifra e guarda com a chave de serviço.
import { cifrar, mascara } from './cifra.ts';
import { PERFIS } from '../integracoes/perfis.ts';
import type { Cofre, Provedor } from './cofre.ts';

export interface DepsCofre {
  baseBanco: string;
  chaveAnon: string;
  chaveServico: string;
  chave: Buffer;
  cofre: Cofre;
  buscar?: typeof fetch;
}
type Resp = { status: number; corpo: Record<string, unknown> };
const resposta = (status: number, corpo: Record<string, unknown>): Resp => ({ status, corpo });

const ALIAS: Record<string, Provedor> = { mensagens: 'unipile', mensagens_webhook: 'unipile_webhook' };
const PROVEDORES: Provedor[] = ['apify', 'unipile', 'unipile_webhook', 'modelo_ia', 'integracao_app'];
const urlSegura = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  try {
    const u = new URL(v.trim());
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) return null;
    return u.toString().replace(/\/+$/, '');
  } catch { return null; }
};

/** Só entra a configuração que o fornecedor usa; o resto é descartado. null = pedido inválido. */
function limparConfig(provedor: Provedor, config: unknown): Record<string, string | number> | null {
  const c = (config && typeof config === 'object' ? config : {}) as Record<string, unknown>;
  if (provedor === 'unipile') {
    if (c.url === undefined || c.url === '') return {};
    const url = urlSegura(c.url);
    return url ? { url } : null;
  }
  if (provedor === 'modelo_ia') {
    // `api`: o "idioma" do provedor. OpenAI serve também para vários outros; Claude é o da Anthropic.
    const api = c.api === undefined || c.api === '' ? 'openai' : c.api;
    if (api !== 'openai' && api !== 'anthropic') return null;
    const modelo = typeof c.modelo === 'string' ? c.modelo.trim() : '';
    if (!modelo || modelo.length > 100) return null;
    const semEndereco = c.base_url === undefined || c.base_url === '';
    if (semEndereco && api === 'openai') return null; // OpenAI-compatível precisa do endereço; a Claude tem o padrão
    const url = semEndereco ? null : urlSegura(c.base_url);
    if (!semEndereco && !url) return null;
    const prioridade = c.prioridade === undefined || c.prioridade === '' ? 50 : Number(c.prioridade);
    if (!Number.isInteger(prioridade) || prioridade < 1 || prioridade > 99) return null;
    // Preço por 1 milhão de tokens (US$), só do superadmin: serve para calcular o custo real. Os dois ou nenhum.
    const preco = (v: unknown) => (v === undefined || v === '' ? undefined : Number(String(v).replace(',', '.')));
    const pe = preco(c.preco_entrada); const ps = preco(c.preco_saida);
    if ((pe === undefined) !== (ps === undefined)) return null;
    if (pe !== undefined && ps !== undefined && (!Number.isFinite(pe) || !Number.isFinite(ps) || pe < 0 || ps < 0)) return null;
    return { api, ...(url ? { base_url: url } : {}), modelo, prioridade, ...(pe !== undefined && ps !== undefined ? { preco_entrada: pe, preco_saida: ps } : {}) };
  }
  if (provedor === 'integracao_app') {
    // O ID do cliente não é segredo (aparece na tela de consentimento do fornecedor); o segredo vai só cifrado.
    const clientId = typeof c.client_id === 'string' ? c.client_id.trim() : '';
    if (!clientId || clientId.length > 200 || /[\s\u0000-\u001f]/.test(clientId)) return null;
    return { client_id: clientId };
  }
  return {};
}

async function conferirSuperadmin(d: DepsCofre, jwt: string): Promise<{ ok: true; quem: string } | { ok: false; r: Resp }> {
  if (!jwt) return { ok: false, r: resposta(401, { erro: 'nao_autorizado' }) };
  const buscar = d.buscar ?? fetch;
  let r: Response;
  try {
    r = await buscar(`${d.baseBanco.replace(/\/$/, '')}/rpc/cofre_conferir_superadmin`, {
      method: 'POST', headers: { apikey: d.chaveAnon, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' }, body: '{}'
    });
  } catch { return { ok: false, r: resposta(502, { erro: 'falha_no_banco' }) }; }
  if (r.status === 401) return { ok: false, r: resposta(401, { erro: 'nao_autorizado' }) };
  if (r.status === 403) return { ok: false, r: resposta(403, { erro: 'sem_permissao' }) };
  if (!r.ok) return { ok: false, r: resposta(502, { erro: 'falha_no_banco' }) };
  const quem = await r.json().catch(() => null);
  return typeof quem === 'string' ? { ok: true, quem } : { ok: false, r: resposta(502, { erro: 'falha_no_banco' }) };
}

export async function guardarSegredo(d: DepsCofre, jwt: string, corpo: unknown): Promise<Resp> {
  const c = (corpo && typeof corpo === 'object' ? corpo : {}) as Record<string, unknown>;
  // A tela chama o canal de mensagens por nomes neutros (o nome do fornecedor não aparece no front); aqui vira o do banco.
  const provedor = (ALIAS[c.provedor as string] ?? c.provedor) as Provedor;
  const rotulo = typeof c.rotulo === 'string' ? c.rotulo.trim() : '';
  const segredo = typeof c.segredo === 'string' ? c.segredo.trim() : '';
  // Antes de qualquer outra coisa: quem não é superadmin nem descobre o que é válido.
  const quem = await conferirSuperadmin(d, jwt);
  if (!quem.ok) return quem.r;
  if (!PROVEDORES.includes(provedor) || !rotulo || rotulo.length > 80) return resposta(400, { erro: 'pedido_invalido' });
  if (segredo.length < 8 || segredo.length > 2000 || /[\s\u0000-\u001f]/.test(segredo)) return resposta(400, { erro: 'segredo_invalido' });
  // O nome de um app de integração é o código da integração, e só vale para as que a Althius registra à mão.
  if (provedor === 'integracao_app' && PERFIS[rotulo]?.mcp?.registro !== 'app_registrado') return resposta(400, { erro: 'pedido_invalido' });
  const config = limparConfig(provedor, c.config);
  if (!config) return resposta(400, { erro: 'config_invalida' });

  const buscar = d.buscar ?? fetch;
  let r: Response;
  try {
    r = await buscar(`${d.baseBanco.replace(/\/$/, '')}/rpc/cofre_guardar`, {
      method: 'POST',
      headers: { apikey: d.chaveServico, Authorization: `Bearer ${d.chaveServico}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_provedor: provedor, p_rotulo: rotulo, p_cifrado: cifrar(segredo, d.chave), p_final: mascara(segredo), p_config: config, p_quem: quem.quem })
    });
  } catch { return resposta(502, { erro: 'falha_no_banco' }); }
  if (!r.ok) return resposta(r.status === 400 ? 400 : 502, { erro: r.status === 400 ? 'pedido_invalido' : 'falha_no_banco' });
  d.cofre.invalidar();
  return resposta(200, { ok: true, id: await r.json() });
}

/** Sonda leve de cada fornecedor. Unipile não tem: o endereço de teste não está confirmado e nada é inventado. */
async function sondar(p: Provedor, segredo: string, config: Record<string, unknown>, buscar: typeof fetch): Promise<{ ok: boolean; mensagem?: string; sem_teste?: boolean }> {
  let url: string;
  let cabecalhos: Record<string, string> = { Authorization: `Bearer ${segredo}` };
  if (p === 'apify') url = 'https://api.apify.com/v2/users/me';
  else if (p === 'modelo_ia' && config.api === 'anthropic') {
    url = `${(typeof config.base_url === 'string' && config.base_url ? config.base_url : 'https://api.anthropic.com/v1').replace(/\/+$/, '')}/models`;
    cabecalhos = { 'x-api-key': segredo, 'anthropic-version': '2023-06-01' };
  } else if (p === 'modelo_ia' && typeof config.base_url === 'string') url = `${config.base_url.replace(/\/+$/, '')}/models`;
  else return { ok: false, sem_teste: true, mensagem: 'Este fornecedor não tem teste automático. Ele é confirmado no primeiro uso.' };
  try {
    const r = await buscar(url, { headers: cabecalhos, signal: AbortSignal.timeout(10_000) });
    if (r.ok) return { ok: true };
    if (r.status === 401 || r.status === 403) return { ok: false, mensagem: 'Chave recusada pelo fornecedor.' };
    return { ok: false, mensagem: `O fornecedor respondeu com erro (${r.status}).` };
  } catch {
    return { ok: false, mensagem: 'Não foi possível falar com o fornecedor agora.' };
  }
}

export async function testarSegredo(d: DepsCofre, jwt: string, corpo: unknown): Promise<Resp> {
  const c = (corpo && typeof corpo === 'object' ? corpo : {}) as Record<string, unknown>;
  const quem = await conferirSuperadmin(d, jwt);
  if (!quem.ok) return quem.r;
  if (typeof c.id !== 'string' || !c.id) return resposta(400, { erro: 'pedido_invalido' });
  d.cofre.invalidar();
  for (const p of ['apify', 'modelo_ia', 'unipile', 'unipile_webhook', 'integracao_app'] as Provedor[]) {
    let itens;
    try { itens = await d.cofre.ler(p); } catch { return resposta(502, { erro: 'falha_no_banco' }); }
    const item = itens.find(i => i.id === c.id);
    if (!item) continue;
    const res = await sondar(p, item.segredo, item.config, d.buscar ?? fetch);
    if (!res.sem_teste) await d.cofre.marcarUso(item.id, res.ok ? null : res.mensagem);
    return resposta(200, { ...res });
  }
  return resposta(404, { erro: 'chave_nao_encontrada' });
}
