// Onde mora o executor (Hermes Agent) de cada agente de cada cliente. Um arquivo JSON, relido quando muda: acrescentar
// um cliente não exige reiniciar o serviço. A chave de cada executor fica SÓ neste arquivo (nunca no banco, no front
// nem em log). Formato:
//   { "executores": { "<workspace-uuid>/<agente>": { "url": "http://hermes-evolut:8642/p/comercial", "chave": "...", "modelo": "comercial" } } }
// `url` é o endereço do servidor de API do Hermes SEM o /v1 (com o prefixo /p/<perfil> quando um gateway serve vários perfis).
import { readFileSync, statSync } from 'node:fs';

export const AGENTES = ['comercial', 'marketing', 'copy', 'revops'] as const;
export type CodigoAgente = (typeof AGENTES)[number];

export interface ExecutorRegistrado { url: string; chave: string; modelo: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function lerExecutores(texto: string, avisar: (msg: string) => void = () => {}): Map<string, ExecutorRegistrado> {
  const saida = new Map<string, ExecutorRegistrado>();
  let bruto: unknown;
  try { bruto = JSON.parse(texto); } catch { avisar('arquivo de executores não é JSON válido'); return saida; }
  const lista = (bruto && typeof bruto === 'object' ? (bruto as { executores?: unknown }).executores : null);
  if (!lista || typeof lista !== 'object' || Array.isArray(lista)) { avisar('arquivo de executores sem o campo "executores"'); return saida; }
  for (const [chave, v] of Object.entries(lista as Record<string, unknown>)) {
    const [ws, agente, resto] = chave.split('/');
    const e = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
    if (resto !== undefined || !UUID.test(ws ?? '') || !(AGENTES as readonly string[]).includes(agente ?? '')) { avisar(`executor ignorado: chave "${chave}" fora do formato <workspace>/<agente>`); continue; }
    if (typeof e.url !== 'string' || !/^https?:\/\/[^\s]+$/.test(e.url)) { avisar(`executor ignorado (${ws}/${agente}): url inválida`); continue; }
    if (typeof e.chave !== 'string' || !e.chave.trim()) { avisar(`executor ignorado (${ws}/${agente}): sem chave`); continue; }
    saida.set(`${ws.toLowerCase()}/${agente}`, {
      url: e.url.replace(/\/+$/, '').replace(/\/v1$/, ''),
      chave: e.chave.trim(),
      modelo: typeof e.modelo === 'string' && e.modelo.trim() ? e.modelo.trim() : 'hermes-agent'
    });
  }
  return saida;
}

/** Registro que relê o arquivo só quando ele muda (data de modificação). Arquivo ausente = nenhum executor. */
export function registroDeExecutores(caminho: string, avisar: (msg: string) => void = () => {}) {
  let mtime = -1;
  let atual = new Map<string, ExecutorRegistrado>();
  const carregar = () => {
    try {
      const m = statSync(caminho).mtimeMs;
      if (m !== mtime) { mtime = m; atual = lerExecutores(readFileSync(caminho, 'utf8'), avisar); }
    } catch {
      if (mtime !== 0) { mtime = 0; atual = new Map(); avisar('arquivo de executores não encontrado: nenhum agente responde'); }
    }
    return atual;
  };
  return {
    /** os "workspace/agente" que têm executor agora (vai para o banco como lista de quem pode ser pego) */
    registrados: () => [...carregar().keys()],
    resolver: (workspaceId: string, agente: string) => carregar().get(`${workspaceId.toLowerCase()}/${agente}`) ?? null
  };
}
