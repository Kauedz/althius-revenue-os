// Gera o .env do Docker com segredos novos e aleatórios (nunca vai para o git).
// Uso: node scripts/docker/gerar-env.mjs [--demo] [--site=https://app.seudominio.com.br]
//   --demo  liga a carga de dados de demonstração (usuários com senha pública). SÓ para desenvolvimento.
// Não sobrescreve um .env que já exista: apague o arquivo na mão se quiser gerar de novo.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const destino = path.join(RAIZ, '.env');
const args = process.argv.slice(2);
const demo = args.includes('--demo');
const siteArg = args.find(a => a.startsWith('--site='));
const site = siteArg ? siteArg.slice('--site='.length).replace(/\/+$/, '') : 'http://localhost';

if (fs.existsSync(destino)) {
  console.error('Já existe um .env aqui. Não vou sobrescrever (ele guarda as senhas do banco). Apague o arquivo se quiser recomeçar.');
  process.exit(1);
}

const aleatorio = bytes => crypto.randomBytes(bytes).toString('base64url');
const base64url = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
function assinar(payload, segredo) {
  const corpo = `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(payload)}`;
  return `${corpo}.${crypto.createHmac('sha256', segredo).update(corpo).digest('base64url')}`;
}

const jwtSecret = aleatorio(48);
const agora = Math.floor(Date.now() / 1000);
const dezAnos = agora + 10 * 365 * 24 * 3600;
const anon = assinar({ iss: 'althius', role: 'anon', iat: agora, exp: dezAnos }, jwtSecret);
const service = assinar({ iss: 'althius', role: 'service_role', iat: agora, exp: dezAnos }, jwtSecret);

const linhas = [
  '# Gerado por scripts/docker/gerar-env.mjs. NUNCA commite este arquivo.',
  '# Quem tem este arquivo tem as chaves do banco: guarde no cofre do servidor e faça cópia segura.',
  '',
  '# Endereço público do sistema (o único que fica aberto). Em produção, use https://seu-dominio.',
  `SITE_URL=${site}`,
  '# Porta HTTP/HTTPS publicadas no servidor.',
  'WEB_HTTP_PORT=80',
  'WEB_HTTPS_PORT=443',
  '',
  `POSTGRES_PASSWORD=${aleatorio(24)}`,
  `JWT_SECRET=${jwtSecret}`,
  `ANON_KEY=${anon}`,
  `SERVICE_ROLE_KEY=${service}`,
  `REDIS_PASSWORD=${aleatorio(24)}`,
  '# Segredo do webhook da Unipile: vai no cabeçalho "Unipile-Auth" ao cadastrar o webhook na Unipile.',
  `UNIPILE_WEBHOOK_SECRET=${aleatorio(32)}`,
  '# Conta no provedor de mensagens (painel deles): endereço da sua conta e chave de API. Sem eles, "Conectar" avisa que está indisponível.',
  'UNIPILE_DSN=',
  'UNIPILE_API_KEY=',
  '',
  '# true = carrega os dados de demonstração (usuários com senha pública "althius-demo").',
  '# Em produção TEM que ser false.',
  `SEMEAR_DEMO=${demo ? 'true' : 'false'}`,
  '# true = a pessoa confirma o e-mail antes de entrar. Sem conector de e-mail ainda, mantenha true.',
  'AUTOCONFIRMAR_EMAIL=true',
  '',
];
fs.writeFileSync(destino, linhas.join('\n'), { mode: 0o600 });
console.log(`.env criado (${demo ? 'COM dados de demonstração' : 'sem dados de demonstração'}). Site: ${site}`);
