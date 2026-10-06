// Conversar com os agentes no computador do dono (ticket 01 dos agentes conectados).
//   npm run agentes:local -- preparar   → cria tokens, perfis e o Hermes (Docker) com o modelo pelo login do Codex
//   npm run agentes:local -- rodar      → liga o ciclo que entrega as mensagens dos canais ao Hermes
// Precisa do Docker Desktop aberto e do banco local ligado (npx supabase start). Veja docs/agentes/conversar-local.md.
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { lerArgumentos, provisionar } from './provisionar-hermes.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** Workspace e responsável da demonstração local (supabase/seed.sql): Evolut e a C-level Aline. */
export const WORKSPACE_PADRAO = 'a0000000-0000-0000-0000-000000000001';
export const RESPONSAVEL_PADRAO = 'd0000000-0000-0000-0000-000000000003';
export const MODELO_PADRAO = 'gpt-6-luna';

export function ambienteDoSupabase(saida) {
  const v = nome => new RegExp(`^${nome}="?([^"\r\n]*)"?`, 'm').exec(saida ?? '')?.[1]?.trim() || '';
  const api = v('API_URL'); const anon = v('ANON_KEY'); const servico = v('SERVICE_ROLE_KEY');
  if (!api || !anon || !servico) throw new Error('O banco local não está ligado. Abra o Docker Desktop e rode: npx supabase start');
  return { api, anon, servico };
}

export function opcoesDeProvisionamento(amb, { modelo, workspace, responsavel, slug } = {}) {
  return {
    modo: 'local', 'modelo-oauth': modelo ?? MODELO_PADRAO, workspace: workspace ?? WORKSPACE_PADRAO, responsavel: responsavel ?? RESPONSAVEL_PADRAO, slug: slug ?? 'evolut',
    urlBanco: `${amb.api}/rest/v1`, chavePublica: amb.anon, chaveServico: amb.servico
  };
}

/** O compose do modo local fica em docker/, mas os caminhos dele são da raiz: sem --project-directory o Docker monta pastas vazias. */
export const argumentosDoComposeLocal = resto => ['compose', '--project-directory', '.', '-f', 'docker/agentes-hermes.local.compose.yml', ...resto];

export function ambienteDoCiclo(amb, pasta = raiz) {
  return { BANCO_URL: `${amb.api}/rest/v1`, SERVICE_ROLE_KEY: amb.servico, AGENTES_EXECUTORES_ARQUIVO: path.join(pasta, 'docker', 'agentes-executores.local.json') };
}

function lerAmbiente() {
  const r = spawnSync('npx', ['supabase', 'status', '-o', 'env'], { cwd: raiz, encoding: 'utf8', shell: true });
  return ambienteDoSupabase(r.stdout);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [acao, ...resto] = process.argv.slice(2);
    const a = lerArgumentos(resto);
    const amb = lerAmbiente();
    if (acao === 'preparar') {
      await provisionar(opcoesDeProvisionamento(amb, a));
      const r = spawnSync('docker', argumentosDoComposeLocal(['up', '-d']), { cwd: raiz, stdio: 'inherit' });
      if (r.status !== 0) throw new Error('O Docker não subiu o Hermes. O Docker Desktop está aberto?');
      console.log('\nHermes no ar. Falta entrar no Codex (uma vez): docker exec -it hermes-' + (a.slug ?? 'evolut') + ' hermes auth add openai-codex');
    } else if (acao === 'rodar') {
      const filho = spawn(process.execPath, ['src/server/agentes/principal.ts'], { cwd: raiz, stdio: 'inherit', env: { ...process.env, ...ambienteDoCiclo(amb) } });
      filho.on('exit', c => process.exit(c ?? 0));
    } else {
      throw new Error('Use: npm run agentes:local -- preparar   ou   npm run agentes:local -- rodar');
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
