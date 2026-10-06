// `npm run agentes:provisionar -- --workspace <uuid> --responsavel <membro-uuid> --slug <nome-curto>`
// (opcional: --modelo-url <url> --modelo-nome <nome> para apontar para outro modelo; o padrão é o gateway da Althius;
//  ou --modelo-oauth <nome> para TESTAR sem custo pelo login do Codex/ChatGPT, sem gateway e sem chave: ADR 0051)
// Prepara o Hermes Agent de UM cliente (ADR 0048): cria os 4 tokens dos agentes (uma vez só), os 4 perfis (só o MCP da
// Althius, nenhuma ferramenta embutida), o perfil padrão fechado, o compose do cliente e a linha de cada agente no
// registro de executores. Rodar de novo não troca tokens nem chaves: só completa o que falta.
// Ambiente (do .env do projeto): SITE_URL, ANON_KEY, SERVICE_ROLE_KEY. A chave do modelo NÃO vai para o Hermes: o Hermes
// usa o token do próprio agente no gateway, e a chave real do provedor fica no cofre (tela do superadmin).
// Opcional: BANCO_API_URL (padrão SITE_URL/rest/v1).
import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AGENTES, HERMES_IMAGEM, envDoPerfil, envPadrao, mesclarExecutores, montarCompose, nomeDoServico, perfilDoAgente, perfilPadrao, slugValido, uuidValido } from './hermes-perfis.mjs';
import { empacotarMcp } from './empacotar-mcp.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** Como os contêineres chegam na API do banco: o ouvinte interno do Caddy (docker/Caddyfile), sem passar pela internet. */
export const URL_BANCO_INTERNA = 'http://web:8081';
/** O gateway do modelo (docker-compose.yml) na rede interna; o nome do modelo é lógico (o gateway escolhe o real). */
export const URL_GATEWAY = 'http://gateway:3300/v1';
export const NOME_GATEWAY = 'althius';
/** Modo local (--modo local): o computador do dono, com o Supabase CLI e sem o Docker completo. O Hermes (em contêiner) chega no banco pelo nome da máquina. */
export const URL_BANCO_LOCAL = 'http://host.docker.internal:54321';
export const URL_HERMES_LOCAL = 'http://127.0.0.1:8642';
/** O serviço de integrações (a ponte dos agentes com os apps): na rede do Docker, ou na máquina no modo local. Nunca pela internet. */
export const URL_INTEGRACOES_INTERNA = 'http://webhooks:3100';
export const URL_INTEGRACOES_LOCAL = 'http://host.docker.internal:3100';

export function lerArgumentos(argv) {
  const r = {};
  for (let i = 0; i < argv.length; i++) {
    const m = /^--([a-z-]+)$/.exec(argv[i]);
    if (!m) throw new Error(`Argumento desconhecido: ${argv[i]}`);
    r[m[1]] = argv[++i];
  }
  return r;
}

const aleatoria = prefixo => prefixo + randomBytes(24).toString('hex');
const lerSeExiste = a => (existsSync(a) ? readFileSync(a, 'utf8') : null);
const escrever = (a, texto) => { mkdirSync(path.dirname(a), { recursive: true }); writeFileSync(a, texto, { mode: 0o600 }); chmodSync(a, 0o600); };
const valorDe = (texto, chave) => new RegExp(`^${chave}=(.*)$`, 'm').exec(texto ?? '')?.[1]?.trim() || null;
const tokenDe = texto => /ALTHIUS_AGENTE_TOKEN:\s*"([^"]+)"/.exec(texto ?? '')?.[1] ?? null;

export async function provisionar(o, io = {}) {
  const buscar = io.buscar ?? fetch;
  const pasta = io.raiz ?? raiz;
  const log = io.log ?? console.log;
  const local = o.modo === 'local';
  if (o.modo !== undefined && !local) throw new Error('--modo só aceita "local" (o padrão é o Docker completo).');
  if (!uuidValido(o.workspace ?? '')) throw new Error('--workspace precisa ser o id (uuid) do workspace do cliente.');
  if (!uuidValido(o.responsavel ?? '')) throw new Error('--responsavel precisa ser o id (uuid) do membro que responde pelos agentes (estrategista, C-level ou superadmin).');
  if (!slugValido(o.slug ?? '')) throw new Error('--slug precisa ser um nome curto: letras minúsculas, números e hífen (ex.: evolut).');
  // Por padrão o modelo é o gateway da Althius (ADR 0050): a chave do provedor fica no cofre, nunca no Hermes.
  // Modo assinatura (--modelo-oauth <nome>): teste sem custo pelo login do Codex (ChatGPT), sem gateway e sem chave.
  const oauth = o['modelo-oauth'];
  if (oauth !== undefined && (!oauth || o['modelo-url'] !== undefined || o['modelo-nome'] !== undefined)) throw new Error('--modelo-oauth precisa do nome do modelo e não se mistura com --modelo-url nem --modelo-nome.');
  const modeloUrl = o['modelo-url'] ?? URL_GATEWAY;
  const modeloNome = oauth ?? o['modelo-nome'] ?? NOME_GATEWAY;
  if (oauth === undefined && !/^https?:\/\//.test(modeloUrl)) throw new Error('--modelo-url precisa ser um endereço http(s) (com /v1) compatível com OpenAI.');
  if (!modeloNome) throw new Error('--modelo-nome precisa ser o nome do modelo.');
  for (const v of ['urlBanco', 'chavePublica', 'chaveServico']) if (!o[v]) throw new Error(`Falta ${v} (veja o cabeçalho do script).`);

  const dados = path.join(pasta, 'docker', 'hermes', o.slug, 'data');
  const chaves = {};
  const criados = [];
  for (const agente of AGENTES) {
    const dir = path.join(dados, 'profiles', agente);
    const cfgAtual = lerSeExiste(path.join(dir, 'config.yaml'));
    const envAtual = lerSeExiste(path.join(dir, '.env'));
    let token = tokenDe(cfgAtual);
    let chaveApi = valorDe(envAtual, 'API_SERVER_KEY');
    if (!token) {
      const r = await buscar(`${o.urlBanco.replace(/\/$/, '')}/rpc/agent_runtime_token_create`, {
        method: 'POST',
        headers: { apikey: o.chaveServico, Authorization: `Bearer ${o.chaveServico}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_workspace_id: o.workspace, p_agent_code: agente, p_member_id: o.responsavel })
      });
      if (!r.ok) throw new Error(`O banco recusou criar o token do agente ${agente} (HTTP ${r.status}). O responsável precisa ser estrategista, C-level ou superadmin deste workspace.`);
      token = await r.json();
      if (typeof token !== 'string' || !token.startsWith('alt_agente_')) throw new Error(`Resposta inesperada ao criar o token do agente ${agente}.`);
      criados.push(agente);
    }
    chaveApi = chaveApi ?? aleatoria('alt_hermes_');
    escrever(path.join(dir, 'config.yaml'), perfilDoAgente({ urlBanco: local ? URL_BANCO_LOCAL : URL_BANCO_INTERNA, integracoesUrl: local ? URL_INTEGRACOES_LOCAL : URL_INTEGRACOES_INTERNA, chavePublica: o.chavePublica, token, modelo: oauth ? { nome: oauth, oauth: true } : { url: modeloUrl, nome: modeloNome } }));
    escrever(path.join(dir, '.env'), envDoPerfil({ chaveApi, chaveModelo: oauth ? '' : token }));
    chaves[agente] = chaveApi;
  }
  // Perfil padrão: fechado e com chave aleatória que ninguém recebe (só ele abre o ouvinte HTTP).
  const envPadraoAtual = lerSeExiste(path.join(dados, '.env'));
  escrever(path.join(dados, 'config.yaml'), perfilPadrao());
  escrever(path.join(dados, '.env'), envPadrao({ chaveAleatoria: valorDe(envPadraoAtual, 'API_SERVER_KEY') ?? aleatoria('alt_padrao_') }));

  (io.empacotar ?? empacotarMcp)();

  // Compose com todos os clientes provisionados (as pastas em docker/hermes/*/data).
  const base = path.join(pasta, 'docker', 'hermes');
  const slugs = readdirSync(base, { withFileTypes: true }).filter(d => d.isDirectory() && d.name !== 'mcp' && existsSync(path.join(base, d.name, 'data'))).map(d => d.name);
  if (local) writeFileSync(path.join(pasta, 'docker', 'agentes-hermes.local.compose.yml'), montarCompose([o.slug], HERMES_IMAGEM, { local: true }));
  else writeFileSync(path.join(pasta, 'docker', 'agentes-hermes.compose.yml'), montarCompose(slugs));

  const arqExec = path.join(pasta, 'docker', local ? 'agentes-executores.local.json' : 'agentes-executores.json');
  let atual = null;
  try { atual = JSON.parse(lerSeExiste(arqExec) ?? 'null'); } catch { throw new Error('docker/agentes-executores.json não é JSON válido. Corrija ou apague o arquivo e rode de novo.'); }
  escrever(arqExec, JSON.stringify(mesclarExecutores(atual, { workspaceId: o.workspace, slug: o.slug, chaves, urlBase: local ? URL_HERMES_LOCAL : undefined }), null, 2) + '\n');

  if (!io.semChown && !local) {
    const r = spawnSync('chown', ['-R', '10000:10000', dados], { encoding: 'utf8' });
    if (r.status !== 0) log('Aviso: não consegui dar a pasta ao usuário do contêiner (10000). Rode como root: chown -R 10000:10000 ' + dados);
  }
  log(`Hermes do cliente "${o.slug}" preparado. Tokens novos: ${criados.length ? criados.join(', ') : 'nenhum (já existiam)'}.`);
  if (local) log('Próximos passos (modo local): veja docs/agentes/conversar-local.md.');
  else log(`Próximos passos: 1) npm run docker:subir   2) teste: veja docker/LEIA-ME.md ("Agentes respondendo"). Serviço: ${nomeDoServico(o.slug)}.`);
  return { slugs, criados, chaves };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (existsSync(path.join(raiz, '.env'))) process.loadEnvFile(path.join(raiz, '.env'));
    const a = lerArgumentos(process.argv.slice(2));
    const site = (process.env.SITE_URL ?? '').replace(/\/$/, '');
    await provisionar({
      ...a,
      urlBanco: process.env.BANCO_API_URL || (site ? `${site}/rest/v1` : ''),
      chavePublica: process.env.ANON_KEY, chaveServico: process.env.SERVICE_ROLE_KEY
    });
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
