// Ponto de entrada do contêiner `sinais` (docker-compose.yml). Só Node, sem dependências.
// A cada SINAIS_INTERVALO_MINUTOS (padrão 30) pede ao banco as contas que precisam de coleta e busca os sinais fora.
// Nunca duas rodadas juntas. O log só traz números (pedidos, concluídos, falhas, acontecimentos); nunca nome, texto,
// id de cliente nem chave. Sem nenhuma chave da Apify, a rodada falha com mensagem clara (nada é simulado).
import { cofreDoAmbiente } from '../cofre/ambiente.ts';
import { criarPoolApify } from '../providers/apify-pool.ts';
import { rodarSinais } from './ciclo.ts';

const base = process.env.BANCO_URL ?? '';
const chave = process.env.SERVICE_ROLE_KEY ?? '';
if (!base || !chave) {
  console.error(JSON.stringify({ nivel: 'erro', msg: 'faltam BANCO_URL e SERVICE_ROLE_KEY' }));
  process.exit(1);
}
const minutos = Math.max(1, Number(process.env.SINAIS_INTERVALO_MINUTOS ?? 30));
const limite = Math.max(1, Number(process.env.SINAIS_PEDIDOS_POR_RODADA ?? 20));
// A conta grátis da Apify aceita 5 execuções ao mesmo tempo; o padrão deixa folga.
const concorrencia = Math.max(1, Number(process.env.SINAIS_CONCORRENCIA ?? 3));
const pool = criarPoolApify({ cofre: cofreDoAmbiente() });
let rodando = false;

async function ciclo() {
  if (rodando) return;
  rodando = true;
  try {
    const r = await rodarSinais({ base, chaveServico: chave, pool, limite, concorrencia });
    console.log(JSON.stringify(r.ok ? { nivel: 'info', msg: 'sinais_ciclo', ...r, ok: undefined } : { nivel: 'erro', msg: 'sinais_ciclo_falhou', erro: r.erro }));
  } catch {
    console.log(JSON.stringify({ nivel: 'erro', msg: 'sinais_ciclo_falhou', erro: 'erro inesperado' }));
  } finally {
    rodando = false;
  }
}

console.log(JSON.stringify({ nivel: 'info', msg: 'sinais no ar', intervalo_min: minutos, pedidos_por_rodada: limite, concorrencia }));
const timer = setInterval(ciclo, minutos * 60_000);
void ciclo();
for (const sinal of ['SIGTERM', 'SIGINT'] as const) process.on(sinal, () => { clearInterval(timer); process.exit(0); });
