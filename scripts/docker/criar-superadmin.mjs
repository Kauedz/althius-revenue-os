// Cria o PRIMEIRO superadmin de um servidor novo (ADR 0041).
// Uso, no servidor, uma única vez:  npm run criar-superadmin -- --email pessoa@empresa.com.br
//
// O que faz: cria o usuário no login (GoTrue) SEM senha, gera um link de definir senha,
// registra o superadmin (e o workspace interno) no banco, com auditoria, e mostra o link.
// O que NÃO faz: nunca define senha, nunca manda e-mail (ainda não há conector de e-mail:
// quem roda entrega o link por canal seguro) e se recusa a rodar se já existir superadmin ativo.
// Fala com o sistema pelo endereço público (SITE_URL) usando a chave de serviço do .env.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function lerArgumentos(argv) {
  const r = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    for (const nome of ['email', 'url']) {
      if (a === `--${nome}`) r[nome] = argv[++i];
      else if (a.startsWith(`--${nome}=`)) r[nome] = a.slice(nome.length + 3);
    }
  }
  return r;
}

function lerEnv(arquivo) {
  const r = {};
  if (!fs.existsSync(arquivo)) return r;
  for (const linha of fs.readFileSync(arquivo, 'utf8').split('\n')) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) r[m[1]] = m[2];
  }
  return r;
}

class ErroOperacao extends Error {}

export async function criarSuperadmin({ email, url, serviceKey, fetchImpl = fetch }) {
  const mail = String(email ?? '').trim().toLowerCase();
  if (!mail) throw new ErroOperacao('Informe o e-mail: npm run criar-superadmin -- --email pessoa@empresa.com.br');
  if (!EMAIL_VALIDO.test(mail)) throw new ErroOperacao(`E-mail inválido: "${mail}".`);
  const base = String(url ?? '').replace(/\/+$/, '');
  if (!base) throw new ErroOperacao('Faltou o endereço do sistema (SITE_URL no .env, ou --url).');
  if (!serviceKey) throw new ErroOperacao('Faltou a chave de serviço (SERVICE_ROLE_KEY no .env).');

  const cab = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Content-Type': 'application/json' };
  const chamar = async (metodo, caminho, corpo) => {
    const res = await fetchImpl(base + caminho, { method: metodo, headers: cab, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    let dados = null;
    try { dados = await res.json(); } catch { /* sem corpo */ }
    return { ok: res.ok, status: res.status, dados };
  };

  // 1. Recusa cedo se já existe superadmin ativo (o banco confere de novo no fim, sem corrida).
  const existentes = await chamar('GET', '/rest/v1/workspace_members?select=id&role=eq.superadmin&status=eq.active&limit=1');
  if (!existentes.ok) throw new ErroOperacao(`Não consegui consultar o banco (HTTP ${existentes.status}). O sistema está no ar em ${base}?`);
  if (Array.isArray(existentes.dados) && existentes.dados.length > 0) {
    throw new ErroOperacao('Já existe superadmin ativo. Esta operação só serve para o primeiro.');
  }

  // 2. Usuário no login, sem senha. Se já existia (rodada anterior interrompida), reaproveita sem apagar.
  let userId;
  let criouAgora = false;
  const novo = await chamar('POST', '/auth/v1/admin/users', { email: mail, email_confirm: true });
  if (novo.ok && novo.dados?.id) {
    userId = novo.dados.id;
    criouAgora = true;
  } else if (novo.status === 422) {
    const achado = await chamar('GET', `/rest/v1/profiles?select=id&email=eq.${encodeURIComponent(mail)}&limit=1`);
    userId = achado.ok && Array.isArray(achado.dados) ? achado.dados[0]?.id : undefined;
    if (!userId) throw new ErroOperacao('Esse e-mail já existe no login, mas não achei o perfil dele. Confira antes de repetir.');
  } else {
    throw new ErroOperacao(`Não consegui criar o usuário no login (HTTP ${novo.status}).`);
  }

  const desfazer = async () => {
    if (criouAgora) await chamar('DELETE', `/auth/v1/admin/users/${userId}`);
  };

  // 3. Link de definir senha (vale uma vez). Gerado ANTES de registrar o superadmin: se falhar, nada fica pela metade.
  const link = await chamar('POST', '/auth/v1/admin/generate_link', { type: 'recovery', email: mail, redirect_to: `${base}/definir-senha/` });
  const acao = link.dados?.action_link;
  if (!link.ok || !acao) {
    await desfazer();
    throw new ErroOperacao(`Não consegui gerar o link de definir senha (HTTP ${link.status}). Nada foi criado.`);
  }

  // 4. Registra o superadmin no banco (função de sistema; recusa se já existir um).
  const reg = await chamar('POST', '/rest/v1/rpc/bootstrap_superadmin', { p_user_id: userId });
  if (!reg.ok) {
    await desfazer();
    throw new ErroOperacao(reg.dados?.message || `O banco recusou (HTTP ${reg.status}).`);
  }

  return { email: mail, userId, link: acao };
}

async function principal() {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const env = { ...lerEnv(path.join(raiz, '.env')), ...process.env };
  const args = lerArgumentos(process.argv.slice(2));
  try {
    const r = await criarSuperadmin({ email: args.email, url: args.url || env.SITE_URL, serviceKey: env.SERVICE_ROLE_KEY });
    console.log(`\nSuperadmin criado: ${r.email}\n`);
    console.log('Link para definir a senha (vale uma vez e expira em 24 horas):\n');
    console.log(`  ${r.link}\n`);
    console.log('Nada foi enviado por e-mail (o conector de e-mail ainda não existe). Entregue o link por um canal seguro');
    console.log('e não o guarde. A pessoa abre o link, escolhe a senha e entra. Esta operação não roda de novo.\n');
  } catch (e) {
    console.error(`\nNão foi feito: ${e instanceof ErroOperacao ? e.message : 'erro inesperado. ' + e.message}\n`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) principal();
