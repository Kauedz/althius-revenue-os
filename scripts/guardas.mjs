// Travas de qualidade que rodam antes de todo commit (.githooks/pre-commit) e em `npm run verificar`.
// Servem para qualquer IA ou pessoa que mexa no projeto: Claude, Codex, Antigravity, Grok etc.
// Cada trava explica o que quebrou e como corrigir. Rode à mão: `npm run guardas`.
import { execSync, spawnSync } from 'node:child_process';

const git = cmd => execSync('git ' + cmd, { encoding: 'utf8' }).trim();
const falhas = [];

// Arquivos que estão indo para o commit (adicionados, copiados, modificados, renomeados, removidos)
const preparados = git('diff --cached --name-status').split('\n').filter(Boolean).map(l => {
  const [status, ...caminhos] = l.split('\t');
  return { status: status[0], caminho: caminhos[caminhos.length - 1], original: caminhos[0] };
});

// 1. Migrations já commitadas não mudam: correção sempre em migration nova.
for (const a of preparados) {
  if (!a.original.startsWith('supabase/migrations/')) continue;
  const jaExistia = spawnSync('git', ['cat-file', '-e', 'HEAD:' + a.original]).status === 0;
  if (jaExistia && a.status !== 'A') {
    falhas.push(`Migration já commitada foi alterada/removida: ${a.original}\n    Crie uma migration nova (próximo número) com a correção.`);
  }
}

// 2. Arquivos gerados do front só mudam pelo conversor.
const r = spawnSync('node', ['scripts/v18/convert.mjs', '--verificar'], { encoding: 'utf8' });
if (r.status !== 0) falhas.push((r.stderr || r.stdout).trim());

// 3. Regras de produto e segurança no conteúdo que vai para o commit.
const textoPreparado = caminho =>
  spawnSync('git', ['show', ':' + caminho], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout || '';
const SEGREDOS = [
  [/sb_secret_[A-Za-z0-9_-]{10,}/, 'chave secreta do Supabase (sb_secret_...)'],
  [/sk-(proj-|or-v1-)?[A-Za-z0-9_-]{20,}/, 'chave de API (OpenAI/OpenRouter)'],
  [/apify_api_[A-Za-z0-9]{20,}/, 'token do Apify'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'chave privada']
];
// Chave service_role padrão do Supabase LOCAL (pública, emissor supabase-demo): só nos helpers de teste.
// (trecho montado em partes para a própria trava não se bloquear)
const SERVICE_ROLE_LOCAL = ['InNlcnZpY2Vfcm9sZSIs', 'ImV4cCI6MTk4MzgxMjk5Nn0'].join('');
for (const a of preparados) {
  if (a.status === 'D') continue;
  const c = a.caminho;
  if (!/\.(ts|tsx|js|mjs|sql|json|md|env|toml|ya?ml)$|^\.env/.test(c) || c === 'package-lock.json') continue;
  const texto = textoPreparado(c);
  for (const [re, nome] of SEGREDOS) {
    if (re.test(texto)) falhas.push(`${c}: parece conter ${nome}. Segredos ficam só no .env (fora do git) ou no cofre do servidor.`);
  }
  if (texto.includes(SERVICE_ROLE_LOCAL) && !c.startsWith('src/test/')) {
    falhas.push(`${c}: chave service_role fora dos helpers de teste. O front nunca usa service_role.`);
  }
  if (/^\.env(\.(local|production|staging))?$/.test(c)) {
    falhas.push(`${c}: arquivo de ambiente real não vai para o git (use .env.example como modelo).`);
  }
  // Créditos: o cliente nunca vê dólar (ADR 0021). Vale para as telas (src/app e src/v18 gerado).
  if ((c.startsWith('src/app/') || c.startsWith('src/v18/')) && !c.includes('.test.') && c !== 'src/v18/data.js' && c !== 'src/v18/module.js') {
    const comentario = l => /^\s*(\/\/|\*|\/\*|--)/.test(l);
    const linhas = texto.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /US\$/.test(l) && !comentario(l) && !/superadmin|exec\.cost|custo real/i.test(l));
    for (const [n] of linhas.slice(0, 3)) falhas.push(`${c}:${n}: menciona dólar numa tela. O cliente só vê créditos (ADR 0021).`);
  }
}

if (falhas.length) {
  console.error('\n✖ Travas do projeto bloquearam o commit:\n');
  for (const f of falhas) console.error('  • ' + f + '\n');
  console.error('Leia AGENTS.md. Corrija e tente de novo.\n');
  process.exit(1);
}
console.log('✓ Travas do projeto ok.');
