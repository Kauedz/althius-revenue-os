// Rotas das integrações (ADR 0056), chamadas pela tela com o login da pessoa (quem confere "pode conectar" é o banco) e
// pelo retorno do consentimento do app (um redirecionamento do navegador, sem login: a prova é o `state` de uso único).
// Token e segredo só existem aqui, cifrados com a chave mestra do cofre; nunca saem em resposta, endereço ou log.
import { randomBytes } from 'node:crypto';
import { cifrar, decifrar } from '../cofre/cifra.ts';
import type { Cofre } from '../cofre/cofre.ts';
import type { BancoIntegracoes } from './banco.ts';
import { desafioPkce, descobrirServidorDeAutorizacao, ErroDeOAuth, registrarClienteDinamico, renovarToken, trocarCodigo, urlDeConsentimento, autenticacaoDoCliente, type ClienteOAuth, type DescobertaDoServidor } from './oauth.ts';
import { listarFerramentasMcp } from './mcp-cliente.ts';
import { identificarConta } from './identificacao.ts';
import { PERFIS, type PerfilDeIntegracao } from './perfis.ts';
import { ErroDeProvedor } from './tipos.ts';

export interface DepsIntegracoes {
  banco: BancoIntegracoes;
  /** chave mestra do cofre (cifra os tokens e o verificador PKCE) */
  chave: Buffer;
  /** endereço público do site, sem barra no fim (https://app.althius.com.br) */
  siteUrl: string;
  buscar?: typeof fetch;
  agora?: () => number;
  /** O cofre de chaves: onde mora o app que a Althius registra nos fornecedores sem registro automático (ex.: HubSpot). */
  cofre?: Cofre;
  /** Linha de log (JSON). Só nomes e números: nunca token, segredo nem valor de campo. */
  log?: (linha: Record<string, unknown>) => void;
  /** A conexão de contas de mensagem da Unipile (`webhooks/conexoes.ts`): é ela que atende os cartões `via: 'mensagens'`. */
  canais?: (jwt: string, corpo: Record<string, unknown>) => Promise<Resp>;
  /** texto aleatório seguro para URL, com o tamanho pedido (padrão: do sistema) */
  aleatorio?: (tamanho: number) => string;
}
export interface Resp { status: number; corpo: Record<string, unknown> }
export interface RespRedirecionamento { status: 302; destino: string }

const TTL_TENTATIVA_SEG = 600;
const MARGEM_RENOVACAO_MS = 60_000;
const resposta = (status: number, corpo: Record<string, unknown>): Resp => ({ status, corpo });
const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const sorteio = (d: DepsIntegracoes, tamanho: number): string => d.aleatorio ? d.aleatorio(tamanho) : randomBytes(Math.ceil(tamanho * 0.75) + 1).toString('base64url').slice(0, tamanho);
const retornoUrl = (d: DepsIntegracoes) => `${d.siteUrl.replace(/\/$/, '')}/integracoes/retorno`;
/** Endereço de volta para a página de Integrações, com o resultado da conexão. */
// O resultado vai ANTES do `#`: o roteador da tela lê o `#`, e a tela mostra o aviso e limpa o endereço.
const volta = (d: DepsIntegracoes, params: Record<string, string>) => `${d.siteUrl.replace(/\/$/, '')}/?${new URLSearchParams(params)}#/integrations`;

function perfilDisponivel(id: string): { ok: true; perfil: PerfilDeIntegracao } | { ok: false; r: Resp } {
  const perfil = PERFIS[id];
  if (!perfil) return { ok: false, r: resposta(404, { erro: 'integracao_desconhecida' }) };
  if (perfil.situacao !== 'disponivel' || (!perfil.mcp && perfil.via !== 'mensagens')) return { ok: false, r: resposta(409, { erro: 'em_breve', motivo: perfil.motivo ?? 'Ainda não está disponível.' }) };
  return { ok: true, perfil };
}

async function descobrir(d: DepsIntegracoes, perfil: PerfilDeIntegracao): Promise<DescobertaDoServidor> {
  const m = perfil.mcp!;
  return descobrirServidorDeAutorizacao({ urlMcp: m.url, autorizacao: m.autorizacao, token: m.token, fetch: d.buscar });
}

type ClienteResolvido = { ok: true; cliente: ClienteOAuth } | { ok: false; motivo: 'nao_configurada' | 'indisponivel' | 'recusado' };

/** O app que a Althius registrou no fornecedor (ID do cliente na configuração, segredo cifrado), lido do cofre. */
async function appDoCofre(d: DepsIntegracoes, integracao: string): Promise<ClienteOAuth | null> {
  if (!d.cofre) return null;
  try {
    const app = (await d.cofre.ler('integracao_app')).find(s => s.rotulo === integracao);
    const clientId = typeof app?.config?.client_id === 'string' ? app.config.client_id.trim() : '';
    if (!app || !clientId || !app.segredo) return null;
    return { clientId, clientSecret: app.segredo, autenticacao: autenticacaoDoCliente(app.segredo) };
  } catch { return null; }
}

/** O cliente OAuth que vale para este conector: o app do cofre (registro à mão) ou o registrado automaticamente e guardado. */
async function clienteDoPerfil(d: DepsIntegracoes, perfil: PerfilDeIntegracao, issuer: string, urlDeRetorno: string): Promise<ClienteOAuth | null> {
  if (perfil.mcp?.registro === 'app_registrado') return appDoCofre(d, perfil.id);
  const guardado = await d.banco.clienteLer(perfil.id, issuer, urlDeRetorno);
  if (!guardado) return null;
  const segredo = guardado.segredoCifrado ? decifrar(guardado.segredoCifrado, d.chave) : null;
  return { clientId: guardado.clientId, clientSecret: segredo, autenticacao: autenticacaoDoCliente(segredo) };
}

/** O cliente para uma conexão nova: o do cofre, o já guardado ou, no registro automático, um novo registrado agora (guardado cifrado). */
async function resolverCliente(d: DepsIntegracoes, perfil: PerfilDeIntegracao, descoberta: DescobertaDoServidor, urlDeRetorno: string): Promise<ClienteResolvido> {
  const m = perfil.mcp!;
  const existente = await clienteDoPerfil(d, perfil, descoberta.issuer, urlDeRetorno);
  if (existente) return { ok: true, cliente: existente };
  if (m.registro !== 'automatico' || !descoberta.registration_endpoint) return { ok: false, motivo: 'nao_configurada' };
  try {
    const novo = await registrarClienteDinamico({
      endpointDeRegistro: descoberta.registration_endpoint, urlDeRetorno, nomeDoCliente: 'Althius',
      metodosDeAutenticacao: descoberta.token_endpoint_auth_methods_supported, escopo: m.escopos?.join(' '), fetch: d.buscar
    });
    // Se outro registro chegou primeiro, o dele vale (registrar de novo deixaria órfãs as autorizações anteriores).
    const ficou = await d.banco.clienteSalvar(perfil.id, descoberta.issuer, urlDeRetorno, novo.clientId, novo.clientSecret ? cifrar(novo.clientSecret, d.chave) : null);
    const segredo = ficou.segredoCifrado ? decifrar(ficou.segredoCifrado, d.chave) : null;
    return { ok: true, cliente: { clientId: ficou.clientId, clientSecret: segredo, autenticacao: autenticacaoDoCliente(segredo) } };
  } catch (e) {
    if (e instanceof ErroDeOAuth) return { ok: false, motivo: e.tipo === 'indisponivel' ? 'indisponivel' : 'recusado' };
    throw e;
  }
}

function corpoDe(c: unknown): { workspaceId: string; integracao: string } {
  const o = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
  return { workspaceId: texto(o.workspaceId), integracao: texto(o.integracao) };
}

const ehCanal = (integracao: string) => PERFIS[integracao]?.via === 'mensagens';
const recusaDeCanal = () => resposta(409, { erro: 'canal_de_mensagens', mensagem: 'Este canal é uma conta de mensagem: conecte e gerencie pela Caixa de entrada.' });

/** Passo 1: devolve o endereço de consentimento do app. A tentativa fica guardada (uso único, 10 minutos). */
export async function iniciarConexao(d: DepsIntegracoes, jwt: string, corpo: unknown): Promise<Resp> {
  if (!jwt) return resposta(401, { erro: 'nao_autorizado' });
  const { workspaceId, integracao } = corpoDe(corpo);
  if (!workspaceId || !integracao) return resposta(400, { erro: 'pedido_invalido' });
  const p = perfilDisponivel(integracao);
  if (!p.ok) return p.r;
  const perfil = p.perfil;
  if (perfil.via === 'mensagens') {
    // Canais de mensagem: o mesmo cartão do catálogo, mas quem conecta é a Unipile (assistente hospedado). A permissão é a da
    // Caixa de entrada e quem a confere é o banco, dentro da conexão da Unipile (não a de "integrações").
    const membroId = texto((corpo as Record<string, unknown>).membroId);
    if (!membroId) return resposta(400, { erro: 'pedido_invalido' });
    if (!d.canais) return resposta(503, { erro: 'canais_indisponiveis' });
    return d.canais(jwt, { workspace_id: workspaceId, member_id: membroId, provider: perfil.canal });
  }
  const conf = await d.banco.conferir(jwt, workspaceId);
  if (!conf.ok) return resposta(conf.status, { erro: conf.status === 401 ? 'nao_autorizado' : conf.status === 403 ? 'sem_permissao' : 'falha_no_banco' });
  const urlDeRetorno = retornoUrl(d);
  // App registrado à mão: sem ele no cofre não há o que pedir ao fornecedor (e nenhuma chamada de rede é feita).
  if (perfil.mcp!.registro === 'app_registrado' && !(await appDoCofre(d, perfil.id))) {
    return resposta(503, { erro: 'nao_configurada', mensagem: 'Esta integração ainda precisa ser configurada pela Althius.' });
  }
  try {
    const descoberta = await descobrir(d, perfil);
    const c = await resolverCliente(d, perfil, descoberta, urlDeRetorno);
    if (!c.ok) {
      if (c.motivo === 'nao_configurada') return resposta(503, { erro: 'nao_configurada', mensagem: 'Esta integração ainda precisa ser configurada pela Althius.' });
      return resposta(502, { erro: c.motivo === 'indisponivel' ? 'indisponivel' : 'registro_recusado' });
    }
    const verificador = sorteio(d, 64);
    const state = sorteio(d, 32);
    await d.banco.tentativaAbrir({
      membroId: conf.membroId, workspaceId, integracao, state, verifierCifrado: cifrar(verificador, d.chave), redirectUri: urlDeRetorno,
      clientId: c.cliente.clientId, issuer: descoberta.issuer, ttlSegundos: TTL_TENTATIVA_SEG
    });
    const url = urlDeConsentimento({
      endpointDeAutorizacao: descoberta.authorization_endpoint, clientId: c.cliente.clientId, urlDeRetorno, state,
      desafio: await desafioPkce(verificador), escopo: perfil.mcp!.escopos?.join(' '), recurso: perfil.mcp!.enviarRecurso ? descoberta.resource : undefined
    });
    return resposta(200, { url });
  } catch (e) {
    return resposta(502, { erro: e instanceof ErroDeOAuth && e.tipo === 'protocolo' ? 'servidor_incompativel' : 'indisponivel' });
  }
}

/** Passo 2: o app devolveu o navegador. O `state` é a prova; vale uma vez, no prazo, para quem ainda participa do workspace. */
export async function retornoDoConsentimento(d: DepsIntegracoes, query: { code?: string; state?: string; error?: string }): Promise<RespRedirecionamento> {
  const erro = (motivo: string, integracao?: string): RespRedirecionamento => ({ status: 302, destino: volta(d, { conexao: 'erro', ...(integracao ? { integracao } : {}), motivo }) });
  const state = texto(query.state);
  if (!state) return erro('invalida');
  const t = await d.banco.tentativaConsumir(state);
  if (!t.ok) return erro(t.motivo);
  if (query.error) return erro('recusada', t.integracao);
  const code = texto(query.code);
  if (!code) return erro('invalida', t.integracao);
  const perfil = PERFIS[t.integracao];
  if (!perfil || perfil.situacao !== 'disponivel' || !perfil.mcp) return erro('invalida', t.integracao);
  try {
    const descoberta = await descobrir(d, perfil);
    // O cliente precisa ser o MESMO que abriu a tentativa (se o app do cofre foi trocado no meio, a autorização não vale).
    const cliente = await clienteDoPerfil(d, perfil, t.issuer, t.redirectUri);
    if (!cliente || cliente.clientId !== t.clientId) return erro('erro', t.integracao);
    const tokens = await trocarCodigo({
      tokenEndpoint: descoberta.token_endpoint, cliente,
      codigo: code, urlDeRetorno: t.redirectUri, verificador: decifrar(t.verifierCifrado, d.chave), recurso: perfil.mcp.enviarRecurso ? descoberta.resource : undefined, fetch: d.buscar
    });
    const agora = (d.agora ?? Date.now)();
    const quem = await identificarConta(perfil.identificacao, tokens.accessToken, {
      fetch: d.buscar, respostaDoToken: tokens.bruto,
      mcp: { url: perfil.mcp.url, cabecalhos: { Authorization: `Bearer ${tokens.accessToken}` }, fetch: d.buscar }
    });
    const portal = quem.ok ? quem.portal : null;
    // O portal é regra de negócio (dois CRMs nunca se misturam): sem saber o portal, esta integração NÃO conecta.
    if (perfil.portalFixo && portal === null) {
      d.log?.({ nivel: 'aviso', msg: 'integracao_portal_nao_identificado', integracao: t.integracao, campos_do_token: Object.keys(tokens.bruto).sort() });
      return erro('portal_nao_identificado', t.integracao);
    }
    const r = await d.banco.acessoSalvar({
      workspaceId: t.workspaceId, membroId: t.membroId, integracao: t.integracao,
      conta: (quem.ok ? quem.conta : null) ?? 'Conta conectada', portal,
      accessCifrado: cifrar(tokens.accessToken, d.chave), refreshCifrado: tokens.refreshToken ? cifrar(tokens.refreshToken, d.chave) : null,
      expiraEm: tokens.expiraEm ? new Date(agora + tokens.expiraEm * 1000).toISOString() : null, clientId: cliente.clientId, issuer: t.issuer, escopo: tokens.escopo
    });
    if (!r.ok) return erro(r.motivo, t.integracao);
    return { status: 302, destino: volta(d, { conexao: 'ok', integracao: t.integracao }) };
  } catch (e) {
    if (e instanceof ErroDeOAuth) return erro(e.tipo === 'recusado' ? 'recusada' : e.tipo === 'indisponivel' ? 'indisponivel' : 'erro', t.integracao);
    return erro('erro', t.integracao);
  }
}

type Acesso = { ok: true; token: string } | { ok: false; r: Resp };

/** O token válido DESTA pessoa: renova quando está para vencer. Quem não conectou ou foi revogado precisa reconectar. */
async function tokenDaPessoa(d: DepsIntegracoes, perfil: PerfilDeIntegracao, workspaceId: string, membroId: string): Promise<Acesso> {
  const precisaReconectar = (motivo: 'sem_acesso' | 'revogado') => ({ ok: false as const, r: resposta(409, { erro: 'precisa_reconectar', motivo }) });
  const a = await d.banco.acessoLer(workspaceId, membroId, perfil.id);
  if (!a) return precisaReconectar('sem_acesso');
  if (a.estado === 'precisa_reconectar') return precisaReconectar('revogado');
  const agora = (d.agora ?? Date.now)();
  const vence = a.expiraEm ? Date.parse(a.expiraEm) : null;
  if (vence !== null && vence - agora < MARGEM_RENOVACAO_MS) {
    if (!a.refreshCifrado) {
      await d.banco.acessoMarcar(workspaceId, membroId, perfil.id, 'precisa_reconectar');
      return precisaReconectar('revogado');
    }
    try {
      const descoberta = await descobrir(d, perfil);
      const cliente = await clienteDoPerfil(d, perfil, a.issuer, retornoUrl(d));
      if (!cliente || cliente.clientId !== a.clientId) {
        await d.banco.acessoMarcar(workspaceId, membroId, perfil.id, 'precisa_reconectar');
        return precisaReconectar('revogado');
      }
      const novo = await renovarToken({
        tokenEndpoint: descoberta.token_endpoint, cliente,
        refreshToken: decifrar(a.refreshCifrado, d.chave), recurso: perfil.mcp!.enviarRecurso ? descoberta.resource : undefined, fetch: d.buscar
      });
      await d.banco.acessoRenovar({
        workspaceId, membroId, integracao: perfil.id, accessCifrado: cifrar(novo.accessToken, d.chave),
        refreshCifrado: novo.refreshToken ? cifrar(novo.refreshToken, d.chave) : null, expiraEm: novo.expiraEm ? new Date(agora + novo.expiraEm * 1000).toISOString() : null
      });
      return { ok: true, token: novo.accessToken };
    } catch (e) {
      if (e instanceof ErroDeOAuth && e.tipo === 'recusado') {
        await d.banco.acessoMarcar(workspaceId, membroId, perfil.id, 'precisa_reconectar');
        return precisaReconectar('revogado');
      }
      return { ok: false, r: resposta(502, { erro: 'indisponivel' }) };
    }
  }
  return { ok: true, token: decifrar(a.accessCifrado, d.chave) };
}

/** Lista o que a integração oferece (o que os agentes poderão fazer), com o acesso da própria pessoa. */
export async function ferramentas(d: DepsIntegracoes, jwt: string, corpo: unknown): Promise<Resp> {
  if (!jwt) return resposta(401, { erro: 'nao_autorizado' });
  const { workspaceId, integracao } = corpoDe(corpo);
  if (!workspaceId || !integracao) return resposta(400, { erro: 'pedido_invalido' });
  if (ehCanal(integracao)) return recusaDeCanal();
  const conf = await d.banco.conferir(jwt, workspaceId);
  if (!conf.ok) return resposta(conf.status, { erro: conf.status === 401 ? 'nao_autorizado' : conf.status === 403 ? 'sem_permissao' : 'falha_no_banco' });
  const p = perfilDisponivel(integracao);
  if (!p.ok) return p.r;
  const t = await tokenDaPessoa(d, p.perfil, workspaceId, conf.membroId);
  if (!t.ok) return t.r;
  try {
    const lista = await listarFerramentasMcp({ url: p.perfil.mcp!.url, cabecalhos: { Authorization: `Bearer ${t.token}` }, fetch: d.buscar });
    return resposta(200, { ferramentas: lista.map(f => ({ nome: f.name, descricao: f.description ?? '', escreve: f.annotations?.readOnlyHint !== true })) });
  } catch (e) {
    if (e instanceof ErroDeProvedor && e.tipo === 'nao_autorizado') {
      await d.banco.acessoMarcar(workspaceId, conf.membroId, integracao, 'precisa_reconectar');
      return resposta(409, { erro: 'precisa_reconectar', motivo: 'revogado' });
    }
    return resposta(502, { erro: 'indisponivel' });
  }
}

/** Tira SÓ o acesso da própria pessoa (não mexe no dos outros nem nos dados já trazidos). */
export async function desconectar(d: DepsIntegracoes, jwt: string, corpo: unknown): Promise<Resp> {
  if (!jwt) return resposta(401, { erro: 'nao_autorizado' });
  const { workspaceId, integracao } = corpoDe(corpo);
  if (!workspaceId || !integracao) return resposta(400, { erro: 'pedido_invalido' });
  if (ehCanal(integracao)) return recusaDeCanal();
  const conf = await d.banco.conferir(jwt, workspaceId);
  if (!conf.ok) return resposta(conf.status, { erro: conf.status === 401 ? 'nao_autorizado' : conf.status === 403 ? 'sem_permissao' : 'falha_no_banco' });
  try { await d.banco.desconectar(workspaceId, conf.membroId, integracao); } catch { return resposta(502, { erro: 'falha_no_banco' }); }
  return resposta(200, { ok: true });
}

/** Retira a integração do workspace: apaga os acessos de todos e NÃO apaga conta, contato nem vínculo. */
export async function retirar(d: DepsIntegracoes, jwt: string, corpo: unknown): Promise<Resp> {
  if (!jwt) return resposta(401, { erro: 'nao_autorizado' });
  const { workspaceId, integracao } = corpoDe(corpo);
  if (!workspaceId || !integracao) return resposta(400, { erro: 'pedido_invalido' });
  if (ehCanal(integracao)) return recusaDeCanal();
  const conf = await d.banco.conferir(jwt, workspaceId);
  if (!conf.ok) return resposta(conf.status, { erro: conf.status === 401 ? 'nao_autorizado' : conf.status === 403 ? 'sem_permissao' : 'falha_no_banco' });
  try { await d.banco.retirar(workspaceId, conf.membroId, integracao); } catch { return resposta(403, { erro: 'sem_permissao' }); }
  return resposta(200, { ok: true });
}
