// Ponto de partida do servidor MCP da Althius, executado pelo perfil do Hermes Agent via stdio:
//   node src/server/mcp/principal.ts
// Ambiente (vem do perfil do agente, um por workspace × agente):
//   ALTHIUS_SUPABASE_URL, ALTHIUS_SUPABASE_CHAVE_PUBLICA (chave pública/anon), ALTHIUS_AGENTE_TOKEN.
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { criarServidorAlthius } from './althius.ts';
import { ferramentasDoAgente } from './ferramentas.ts';
import { registrarNoStderr } from './execucao.ts';

export interface ConfiguracaoMcp {
  url: string;
  chavePublica: string;
  token: string;
}

function papelDaChave(chave: string): string | null {
  try {
    return JSON.parse(Buffer.from(chave.split('.')[1] || '', 'base64url').toString('utf8')).role ?? null;
  } catch {
    return null;
  }
}

export function lerConfiguracao(ambiente: Record<string, string | undefined>): ConfiguracaoMcp {
  const exigir = (nome: string) => {
    const valor = (ambiente[nome] || '').trim();
    if (!valor) throw new Error(`Falta ${nome} no ambiente do perfil do agente.`);
    return valor;
  };
  const url = exigir('ALTHIUS_SUPABASE_URL');
  const chavePublica = exigir('ALTHIUS_SUPABASE_CHAVE_PUBLICA');
  const token = exigir('ALTHIUS_AGENTE_TOKEN');
  if (chavePublica.startsWith('sb_secret') || papelDaChave(chavePublica) === 'service_role') {
    throw new Error('Recusado: isto é a chave de sistema. O agente usa só a chave pública e o próprio token.');
  }
  if (!token.startsWith('alt_agente_')) throw new Error('ALTHIUS_AGENTE_TOKEN precisa começar com alt_agente_.');
  return { url, chavePublica, token };
}

/** true quando este arquivo é o programa executado (compara caminhos reais: atalhos de pasta não enganam). */
export function executadoDiretamente(urlDoModulo: string, argumento: string | undefined): boolean {
  if (!argumento) return false;
  try {
    return realpathSync(fileURLToPath(urlDoModulo)) === realpathSync(argumento);
  } catch {
    return false;
  }
}

if (executadoDiretamente(import.meta.url, process.argv[1])) {
  try {
    const config = lerConfiguracao(process.env);
    const cliente = createClient(config.url, config.chavePublica, { auth: { persistSession: false, autoRefreshToken: false } });
    const ferramentas = ferramentasDoAgente(cliente, config.token, { url: (process.env.ALTHIUS_INTEGRACOES_URL ?? '').trim() || undefined });
    // Um evento por chamada de ferramenta no stderr (só nomes e números; o Hermes guarda no log do perfil). ADR 0061.
    serveStdio(() => criarServidorAlthius(ferramentas, { registrar: registrarNoStderr }));
  } catch (e) {
    // stdout é do protocolo MCP: avisos vão para stderr.
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
