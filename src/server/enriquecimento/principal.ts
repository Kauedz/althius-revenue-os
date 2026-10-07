// Ponto de entrada do contêiner `enriquecimento` (docker-compose.yml). Só Node, sem dependências.
// A cada ENRIQ_INTERVALO_MINUTOS (padrão 5) pede ao banco as contas na fila de enriquecimento e busca os dados fora.
// Nunca duas rodadas juntas. O log só traz números; nunca nome, CNPJ, telefone, id de cliente nem chave.
// Telefone pessoal só com fonte configurada: ENRIQ_TELEFONE_ATOR (dono/ator na Apify) e ENRIQ_TELEFONE_ENTRADA (JSON com
// "{{linkedin_url}}" ou "{{linkedin_urls}}"). Sem isso, as pessoas entram sem telefone.
import { cofreDoAmbiente } from '../cofre/ambiente.ts';
import { criarPoolApify } from '../providers/apify-pool.ts';
import { rodarEnriquecimento } from './ciclo.ts';
import type { FonteDeTelefone } from './pessoas.ts';

const base = process.env.BANCO_URL ?? '';
const chave = process.env.SERVICE_ROLE_KEY ?? '';
if (!base || !chave) {
  console.error(JSON.stringify({ nivel: 'erro', msg: 'faltam BANCO_URL e SERVICE_ROLE_KEY' }));
  process.exit(1);
}
const minutos = Math.max(1, Number(process.env.ENRIQ_INTERVALO_MINUTOS ?? 5));
const limite = Math.max(1, Number(process.env.ENRIQ_PEDIDOS_POR_RODADA ?? 10));
const concorrencia = Math.max(1, Number(process.env.ENRIQ_CONCORRENCIA ?? 2));

function fonteDeTelefone(): FonteDeTelefone | null {
  const ator = (process.env.ENRIQ_TELEFONE_ATOR ?? '').trim();
  if (!ator) return null;
  try {
    const entrada = JSON.parse(process.env.ENRIQ_TELEFONE_ENTRADA ?? '') as unknown;
    if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) throw new Error();
    const max = Number(process.env.ENRIQ_TELEFONE_MAX_USD_POR_PESSOA ?? 0.01);
    return { ator, entrada: entrada as Record<string, unknown>, maxUsdPorPessoa: max > 0 ? max : 0.01 };
  } catch {
    console.error(JSON.stringify({ nivel: 'erro', msg: 'ENRIQ_TELEFONE_ENTRADA inválida: telefone desligado' }));
    return null;
  }
}

const pool = criarPoolApify({ cofre: cofreDoAmbiente() });
const telefone = fonteDeTelefone();
let rodando = false;

async function ciclo() {
  if (rodando) return;
  rodando = true;
  try {
    const r = await rodarEnriquecimento({ base, chaveServico: chave, pool, telefone, limite, concorrencia });
    console.log(JSON.stringify(r.ok ? { nivel: 'info', msg: 'enriquecimento_ciclo', ...r, ok: undefined } : { nivel: 'erro', msg: 'enriquecimento_ciclo_falhou', erro: r.erro }));
  } catch {
    console.log(JSON.stringify({ nivel: 'erro', msg: 'enriquecimento_ciclo_falhou', erro: 'erro inesperado' }));
  } finally {
    rodando = false;
  }
}

console.log(JSON.stringify({ nivel: 'info', msg: 'enriquecimento no ar', intervalo_min: minutos, pedidos_por_rodada: limite, concorrencia, telefone: !!telefone }));
const timer = setInterval(ciclo, minutos * 60_000);
void ciclo();
for (const sinal of ['SIGTERM', 'SIGINT'] as const) process.on(sinal, () => { clearInterval(timer); process.exit(0); });
