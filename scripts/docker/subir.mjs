// `npm run docker:subir`: garante o arquivo de executores e sobe o Docker, incluindo os contêineres do Hermes dos
// clientes quando existem (docker/agentes-hermes.compose.yml, gerado por `npm run agentes:provisionar`).
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { garantirExecutores } from './garantir-executores.mjs';
import { garantirCofre } from './garantir-cofre.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Argumentos do `docker compose`: o arquivo principal e, se existir, o dos Hermes dos clientes. */
export function argumentosDoCompose(existeHermes) {
  return ['compose', '-f', 'docker-compose.yml', ...(existeHermes ? ['-f', 'docker/agentes-hermes.compose.yml'] : []), 'up', '-d', '--build'];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (garantirExecutores(path.join(raiz, 'docker', 'agentes-executores.json'))) console.log('Criei docker/agentes-executores.json vazio (nenhum agente responde até você provisionar o Hermes de um cliente).');
  } catch (e) { console.error(e.message); process.exit(1); }
  if (garantirCofre(path.join(raiz, '.env'))) console.log('Criei a COFRE_CHAVE_MESTRA no .env. Faça cópia do .env: sem essa chave, as chaves cadastradas na tela não abrem.');
  const r = spawnSync('docker', argumentosDoCompose(existsSync(path.join(raiz, 'docker', 'agentes-hermes.compose.yml'))), { cwd: raiz, stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
