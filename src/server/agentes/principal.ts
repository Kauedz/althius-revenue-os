// Ponto de entrada do contêiner `agentes` (docker-compose.yml). Só Node, sem dependências.
// A cada poucos segundos: recolhe lotes parados, pega os prontos dos agentes que TÊM executor registrado e entrega ao
// Hermes Agent do cliente. Sem executor registrado, nada é respondido (os pedidos esperam na fila: nunca resposta de mentira).
import { bancoHarnessViaApi, rodarCicloHarness } from './harness.ts';
import { executorHermes } from './hermes.ts';
import { registroDeExecutores } from './hosts.ts';
import { playbookViaApi } from './playbook.ts';

const base = process.env.BANCO_URL ?? '';
const chave = process.env.SERVICE_ROLE_KEY ?? '';
if (!base || !chave) {
  console.error(JSON.stringify({ nivel: 'erro', msg: 'faltam BANCO_URL e SERVICE_ROLE_KEY' }));
  process.exit(1);
}
const log = (l: Record<string, unknown>) => console.log(JSON.stringify(l));
const arquivo = process.env.AGENTES_EXECUTORES_ARQUIVO ?? '/config/agentes-executores.json';
const intervalo = Math.max(1, Number(process.env.AGENTES_INTERVALO_SEGUNDOS ?? 3)) * 1000;
const simultaneos = Math.max(1, Number(process.env.AGENTES_SIMULTANEOS ?? 8));

const registro = registroDeExecutores(arquivo, msg => log({ nivel: 'aviso', msg: 'agentes_executores', detalhe: msg }));
const banco = bancoHarnessViaApi(base, chave);
const executor = executorHermes({ resolver: registro.resolver, playbook: playbookViaApi(base, chave) });

// Vários ciclos podem andar juntos (um agente demorando não trava os outros); o banco garante um lote por agente.
let emAndamento = 0;
let encerrando = false;
async function ciclo() {
  if (encerrando || emAndamento >= simultaneos) return;
  emAndamento++;
  try {
    const r = await rodarCicloHarness({ banco, executor, executoresRegistrados: registro.registrados, log });
    if (r.recolhidos || r.lotes) log({ nivel: 'info', msg: 'agentes_ciclo', ...r });
  } catch (e) {
    log({ nivel: 'erro', msg: 'agentes_ciclo_falhou', erro: e instanceof Error ? e.message.slice(0, 200) : 'erro' });
  } finally {
    emAndamento--;
  }
}

log({ nivel: 'info', msg: 'agentes no ar', intervalo_s: intervalo / 1000, executores: registro.registrados().length });
const timer = setInterval(ciclo, intervalo);
void ciclo();
for (const sinal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sinal, () => {
    encerrando = true;
    clearInterval(timer);
    const espera = setInterval(() => { if (emAndamento === 0) process.exit(0); }, 200);
    espera.unref?.();
  });
}
