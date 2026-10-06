// Empacota o servidor MCP da Althius em UM arquivo (docker/hermes/mcp/mcp-althius.mjs), que os contêineres do Hermes
// rodam com o Node que já vem na imagem: sem instalar nada lá dentro. O arquivo é gerado (fora do git).
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DESTINO_MCP = path.join(raiz, 'docker', 'hermes', 'mcp', 'mcp-althius.mjs');

export function empacotarMcp() {
  mkdirSync(path.dirname(DESTINO_MCP), { recursive: true });
  const r = spawnSync(path.join(raiz, 'node_modules', '.bin', 'esbuild'), [
    path.join(raiz, 'src', 'server', 'mcp', 'principal.ts'),
    '--bundle', '--platform=node', '--target=node22', '--format=esm', '--log-level=warning',
    "--banner:js=import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
    `--outfile=${DESTINO_MCP}`
  ], { cwd: raiz, encoding: 'utf8' });
  if (r.status !== 0) throw new Error('Não consegui empacotar o MCP: ' + (r.stderr || r.error?.message || 'erro desconhecido'));
  return DESTINO_MCP;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log('MCP empacotado em', empacotarMcp()); } catch (e) { console.error(e.message); process.exit(1); }
}
