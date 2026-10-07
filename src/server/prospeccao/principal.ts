// Ponto de entrada do contêiner `prospeccao` (docker-compose.yml). Só Node, sem dependências.
// A cada PROSP_INTERVALO_MINUTOS (padrão 2) pede ao banco as buscas que uma pessoa pediu (ou o C-level aprovou), roda a
// fonte na Apify com o teto do pedido e entrega as empresas como candidatas. Nunca duas rodadas juntas.
// O log só traz números; nunca nome de empresa, parâmetro de busca, id de cliente nem chave.
import { cofreDoAmbiente } from '../cofre/ambiente.ts';
import { criarPoolApify } from '../providers/apify-pool.ts';
import { rodarProspeccao } from './ciclo.ts';

const base = process.env.BANCO_URL ?? '';
const chave = process.env.SERVICE_ROLE_KEY ?? '';
if (!base || !chave) {
  console.error(JSON.stringify({ nivel: 'erro', msg: 'faltam BANCO_URL e SERVICE_ROLE_KEY' }));
  process.exit(1);
}
const minutos = Math.max(1, Number(process.env.PROSP_INTERVALO_MINUTOS ?? 2));
const limite = Math.max(1, Number(process.env.PROSP_BUSCAS_POR_RODADA ?? 5));
const prazoSeg = Math.max(60, Number(process.env.PROSP_PRAZO_SEGUNDOS ?? 300));

const pool = criarPoolApify({ cofre: cofreDoAmbiente() });
let rodando = false;

async function ciclo() {
  if (rodando) return;
  rodando = true;
  try {
    const r = await rodarProspeccao({ base, chaveServico: chave, pool, limite, prazoSeg });
    console.log(JSON.stringify(r.ok ? { nivel: 'info', msg: 'prospeccao_ciclo', ...r, ok: undefined } : { nivel: 'erro', msg: 'prospeccao_ciclo_falhou', erro: r.erro }));
  } catch {
    console.log(JSON.stringify({ nivel: 'erro', msg: 'prospeccao_ciclo_falhou', erro: 'erro inesperado' }));
  } finally {
    rodando = false;
  }
}

console.log(JSON.stringify({ nivel: 'info', msg: 'prospeccao no ar', intervalo_min: minutos, buscas_por_rodada: limite, prazo_seg: prazoSeg }));
const timer = setInterval(ciclo, minutos * 60_000);
void ciclo();
for (const sinal of ['SIGTERM', 'SIGINT'] as const) process.on(sinal, () => { clearInterval(timer); process.exit(0); });
