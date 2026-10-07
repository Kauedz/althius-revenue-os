// Ponto de entrada do contêiner `cadencia` (docker-compose.yml). Só Node, sem dependências.
// Repete o ciclo do motor a cada CADENCIA_INTERVALO_SEGUNDOS (60). Nunca dois ciclos ao mesmo tempo.
import { bancoCadenciaViaApi, bancoRespostasViaApi } from './banco.ts';
import { rodarRespostas } from './respostas.ts';
import { mensageiroViaApi } from './envio.ts';
import { rodarCiclo } from './motor.ts';
import { bancoSincroniaViaApi, ponteViaApi, sincronizarContas } from '../conexoes/sincronizar.ts';
import { configDoAmbiente } from '../unipile/config.ts';
import type { ObterConfig } from '../unipile/config.ts';
import { cofreDoAmbiente } from '../cofre/ambiente.ts';
import { configDoCofre } from '../cofre/consumidores.ts';

const base = process.env.BANCO_URL ?? '';
const chave = process.env.SERVICE_ROLE_KEY ?? '';
if (!base || !chave) {
  console.error(JSON.stringify({ nivel: 'erro', msg: 'faltam BANCO_URL e SERVICE_ROLE_KEY' }));
  process.exit(1);
}
// A chave é lida a cada ciclo: do cofre (tela do superadmin) e, sem ela lá, do `.env`. Sem chave nenhuma, o envio
// automático fica parado e só passos que viram tarefa rodam.
const cofre = cofreDoAmbiente();
const obterConfig: ObterConfig = cofre ? configDoCofre(cofre) : configDoAmbiente();
const mensageiroEnvio = mensageiroViaApi(obterConfig);

const banco = bancoCadenciaViaApi(base, chave);
const bancoRespostas = bancoRespostasViaApi(base, chave);
// Sincronia das contas com a ponte (ADR 0070): acha a conta recém-conectada e mantém o estado (conectada, reconectar).
const bancoSincronia = bancoSincroniaViaApi(base, chave);
const ponte = ponteViaApi(obterConfig);
const intervalo = Math.max(10, Number(process.env.CADENCIA_INTERVALO_SEGUNDOS ?? 60)) * 1000;
let rodando = false;
let avisouSemChave = false;
let encerrando = false;

async function ciclo() {
  if (rodando || encerrando) return;
  rodando = true;
  try {
    const mensageiro = (await obterConfig()).apiKey ? mensageiroEnvio : null;
    if (!mensageiro && !avisouSemChave) { avisouSemChave = true; console.warn(JSON.stringify({ nivel: 'aviso', msg: 'sem chave da Unipile (cofre ou .env): envio automático parado' })); }
    if (mensageiro) avisouSemChave = false;
    const r = await rodarCiclo({ banco, mensageiro });
    if (r.vistos > 0) console.log(JSON.stringify({ nivel: 'info', msg: 'cadencia_ciclo', ...r }));
    // Respostas escritas na Caixa de entrada (ADR 0068) saem pelo mesmo envio.
    const rr = await rodarRespostas({ banco: bancoRespostas, mensageiro });
    if (rr.vistas > 0) console.log(JSON.stringify({ nivel: 'info', msg: 'caixa_respostas', ...rr }));
    // Sem chave não há com quem sincronizar. Falha da ponte não derruba o ciclo de envio: o próximo tenta de novo.
    if (mensageiro) {
      try { await sincronizarContas({ banco: bancoSincronia, ponte }); } catch (e) {
        console.warn(JSON.stringify({ nivel: 'aviso', msg: 'sincronia_das_contas_falhou', erro: e instanceof Error ? e.message : 'erro' }));
      }
    }
  } catch (e) {
    console.error(JSON.stringify({ nivel: 'erro', msg: 'cadencia_ciclo_falhou', erro: e instanceof Error ? e.message : 'erro' }));
  } finally {
    rodando = false;
  }
}

console.log(JSON.stringify({ nivel: 'info', msg: 'cadencia no ar', intervalo_s: intervalo / 1000, cofre: cofre !== null }));
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
