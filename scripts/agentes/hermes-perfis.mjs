// Peças puras do provisionamento do Hermes Agent por cliente (sem rede, sem disco): arquivos dos perfis, compose e
// registro de executores. Tudo conferido em execução real com o contêiner oficial (ADR 0048).
import { createHash } from 'node:crypto';

/** Imagem oficial do Hermes Agent, fixada por digest (v2026.9.24). Para atualizar: troque, rode o teste de ponta a ponta. */
export const HERMES_IMAGEM = 'nousresearch/hermes-agent@sha256:fca358f12efd65bfaaca05884166f15c0e2788375ca30d77061ac1ebc96452b7';
export const AGENTES = ['comercial', 'marketing', 'copy', 'revops'];
/** Ferramentas embutidas do Hermes desligadas em TODO perfil de cliente: o agente só enxerga as ferramentas da Althius. */
export const FERRAMENTAS_DESLIGADAS = ['terminal', 'file', 'web', 'browser', 'code_execution', 'vision', 'memory', 'delegation', 'cron', 'skills', 'image_gen', 'tts', 'todo', 'clarify', 'session_search'];
/** O Hermes escuta nesta porta (perfil padrão); os perfis dos agentes entram por /p/<perfil>/v1. */
export const PORTA_API = 8642;

const q = v => JSON.stringify(String(v)); // aspas de YAML (JSON é YAML válido)
const SLUG = /^[a-z0-9][a-z0-9-]{0,40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const slugValido = s => SLUG.test(s);
export const uuidValido = s => UUID.test(s);

const desligadas = () => [
  'platform_toolsets:', '  api_server: []',
  'agent:', `  disabled_toolsets: [${FERRAMENTAS_DESLIGADAS.join(', ')}]`
].join('\n');

/** Perfil de um agente: modelo, só o MCP da Althius, nenhuma ferramenta embutida. */
export function perfilDoAgente({ urlBanco, chavePublica, token, modelo }) {
  for (const [k, v] of Object.entries({ urlBanco, chavePublica, token })) if (!v) throw new Error(`perfilDoAgente: falta ${k}`);
  if (!modelo?.url || !modelo?.nome) throw new Error('perfilDoAgente: falta o modelo (url e nome)');
  return [
    'model:',
    `  default: ${q(modelo.nome)}`,
    '  provider: custom',
    `  base_url: ${q(modelo.url)}`,
    '  key_env: MODELO_CHAVE',
    desligadas(),
    'mcp_servers:',
    '  althius:',
    '    command: node',
    '    args: ["/opt/althius/mcp-althius.mjs"]',
    '    env:',
    `      ALTHIUS_SUPABASE_URL: ${q(urlBanco)}`,
    `      ALTHIUS_SUPABASE_CHAVE_PUBLICA: ${q(chavePublica)}`,
    `      ALTHIUS_AGENTE_TOKEN: ${q(token)}`,
    ''
  ].join('\n');
}

export function envDoPerfil({ chaveApi, chaveModelo }) {
  if (!chaveApi) throw new Error('envDoPerfil: falta a chave da API do perfil');
  return ['API_SERVER_ENABLED=true', `API_SERVER_KEY=${chaveApi}`, `MODELO_CHAVE=${chaveModelo ?? ''}`, ''].join('\n');
}

/** Perfil padrão (dono do ouvinte HTTP): fechado, sem ferramentas e com chave aleatória que ninguém recebe. */
export function perfilPadrao() { return desligadas() + '\n'; }
export function envPadrao({ chaveAleatoria }) {
  return ['API_SERVER_ENABLED=true', `API_SERVER_KEY=${chaveAleatoria}`, 'API_SERVER_HOST=0.0.0.0', `API_SERVER_PORT=${PORTA_API}`, ''].join('\n');
}

export const nomeDoServico = slug => `hermes-${slug}`;

/** Compose (arquivo gerado, fora do git) com um contêiner Hermes por cliente. Caminhos relativos à raiz do projeto. */
export function montarCompose(slugs, imagem = HERMES_IMAGEM) {
  if (!slugs.length) return 'services: {}\n';
  const linhas = ['# GERADO por scripts/agentes/provisionar-hermes.mjs. Não edite à mão (ADR 0048).', 'services:'];
  for (const slug of [...slugs].sort()) {
    if (!slugValido(slug)) throw new Error(`slug inválido: ${slug}`);
    linhas.push(
      `  ${nomeDoServico(slug)}:`,
      `    image: ${imagem}`,
      '    restart: unless-stopped',
      '    command: ["gateway", "run"]',
      '    environment:',
      '      HERMES_UID: "10000"',
      '      HERMES_GID: "10000"',
      '    volumes:',
      `      - ./docker/hermes/${slug}/data:/opt/data`,
      '      - ./docker/hermes/mcp:/opt/althius:ro',
      '    depends_on:',
      '      web:',
      '        condition: service_started',
      '    networks: [interna]',
      ''
    );
  }
  return linhas.join('\n');
}

/** Acrescenta (ou troca) as entradas do cliente no registro de executores, preservando os outros clientes. */
export function mesclarExecutores(existente, { workspaceId, slug, chaves }) {
  const base = existente && typeof existente === 'object' && existente.executores && typeof existente.executores === 'object' ? existente : { executores: {} };
  const executores = { ...base.executores };
  for (const agente of AGENTES) {
    if (!chaves[agente]) continue;
    executores[`${workspaceId.toLowerCase()}/${agente}`] = { url: `http://${nomeDoServico(slug)}:${PORTA_API}/p/${agente}`, chave: chaves[agente], modelo: agente };
  }
  return { ...base, executores };
}

export const hashCurto = t => createHash('sha256').update(t).digest('hex').slice(0, 8);
