// `npm run docker:chave-unipile` — troca a chave de API do canal de mensagens (Unipile) no `.env` e recria só os
// contêineres que a usam (webhooks e cadencia). Não mexe em banco, login nem dados.
//   npm run docker:chave-unipile              (pergunta a chave; nada aparece no histórico do terminal)
//   npm run docker:chave-unipile -- NOVA_CHAVE
// A chave nunca é impressa.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const NOME_DA_VARIAVEL = 'UNIPILE_API_KEY';

/** Troca (ou acrescenta) a linha da variável no texto do .env, sem mexer nas outras. */
export function trocarNoEnv(texto, nome, valor) {
  if (/[\r\n]/.test(valor)) throw new Error('A chave não pode ter quebra de linha.');
  const linha = `${nome}=${valor}`;
  const linhas = texto.split('\n');
  const i = linhas.findIndex(l => l.startsWith(`${nome}=`));
  if (i >= 0) linhas[i] = linha;
  else {
    if (linhas.length && linhas[linhas.length - 1] === '') linhas.splice(linhas.length - 1, 0, linha);
    else linhas.push(linha);
  }
  return linhas.join('\n');
}

async function principal() {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const arquivo = path.join(raiz, '.env');
  if (!existsSync(arquivo)) {
    console.error('Não achei o .env. Rode antes: npm run docker:env');
    process.exit(1);
  }
  let chave = (process.argv[2] ?? '').trim();
  if (!chave) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    chave = (await rl.question('Cole a nova chave de API da Unipile e tecle Enter: ')).trim();
    rl.close();
  }
  if (!chave) {
    console.error('Nenhuma chave informada. Nada foi alterado.');
    process.exit(1);
  }
  writeFileSync(arquivo, trocarNoEnv(readFileSync(arquivo, 'utf8'), NOME_DA_VARIAVEL, chave));
  console.log('Chave gravada no .env. Recriando webhooks e cadencia...');
  const r = spawnSync('docker', ['compose', 'up', '-d', '--force-recreate', 'webhooks', 'cadencia'], { cwd: raiz, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error('A chave foi gravada, mas não consegui reiniciar. Rode: npm run docker:subir');
    process.exit(r.status ?? 1);
  }
  console.log('Pronto: a nova chave já está valendo.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) principal();
