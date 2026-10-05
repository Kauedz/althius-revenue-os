// Ponto de entrada do contêiner `cadencia` (docker-compose.yml). Só Node, sem dependências.
// Repete o ciclo do motor a cada CADENCIA_INTERVALO_SEGUNDOS (60). Nunca dois ciclos ao mesmo tempo.
import { bancoCadenciaViaApi } from './banco.ts';
import { mensageiroViaApi } from './envio.ts';
import { rodarCiclo } from './motor.ts';

const base = process.env.BANCO_URL ?? '';
const chave = process.env.SERVICE_ROLE_KEY ?? '';
if (!base || !chave) {
  console.error(JSON.stringify({ nivel: 'erro', msg: 'faltam BANCO_URL e SERVICE_ROLE_KEY' }));
  process.exit(1);
}
const dsn = process.env.UNIPILE_DSN ?? '';
const apiKey = process.env.UNIPILE_API_KEY ?? '';
const mensageiro = dsn && apiKey ? mensageiroViaApi({ dsn, apiKey }) : null;
if (!mensageiro) {
  console.warn(JSON.stringify({ nivel: 'aviso', msg: 'sem UNIPILE_DSN/UNIPILE_API_KEY: só passos que viram tarefa rodam; envio automático fica parado' }));
}

const banco = bancoCadenciaViaApi(base, chave);
const intervalo = Math.max(10, Number(process.env.CADENCIA_INTERVALO_SEGUNDOS ?? 60)) * 1000;
let rodando = false;
let encerrando = false;

async function ciclo() {
  if (rodando || encerrando) return;
  rodando = true;
  try {
    const r = await rodarCiclo({ banco, mensageiro });
    if (r.vistos > 0) console.log(JSON.stringify({ nivel: 'info', msg: 'cadencia_ciclo', ...r }));
  } catch (e) {
    console.error(JSON.stringify({ nivel: 'erro', msg: 'cadencia_ciclo_falhou', erro: e instanceof Error ? e.message : 'erro' }));
  } finally {
    rodando = false;
  }
}

console.log(JSON.stringify({ nivel: 'info', msg: 'cadencia no ar', intervalo_s: intervalo / 1000, envio_automatico: mensageiro !== null }));
const timer = setInterval(ciclo, intervalo);
void ciclo();
for (const sinal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sinal, () => {
    encerrando = true;
    clearInterval(timer);
    const espera = setInterval(() => { if (!rodando) process.exit(0); }, 200);
    espera.unref?.();
  });
}
