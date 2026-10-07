// Ponto de entrada do contêiner `copiloto` (docker-compose.yml). Só Node, sem dependências.
// A cada COPILOTO_INTERVALO_SEGUNDOS (padrão 3) pede ao banco as perguntas novas, chama o modelo de IA pelo gateway
// (mesmas chaves do cofre, ADR 0050) e grava a resposta. Sem cofre ou sem modelo cadastrado, cada pergunta recebe a
// resposta verdadeira ("não consegui responder agora: ..."). O log só traz números; nunca o texto das perguntas.
import { cofreDoAmbiente } from '../cofre/ambiente.ts';
import { criarGateway } from '../gateway/gateway.ts';
import { rodarCopiloto } from './ciclo.ts';
import { modeloViaGateway, type Modelo } from './modelo.ts';

const base = process.env.BANCO_URL ?? '';
const chave = process.env.SERVICE_ROLE_KEY ?? '';
if (!base || !chave) {
  console.error(JSON.stringify({ nivel: 'erro', msg: 'faltam BANCO_URL e SERVICE_ROLE_KEY' }));
  process.exit(1);
}
const segundos = Math.max(1, Number(process.env.COPILOTO_INTERVALO_SEGUNDOS ?? 3));
const cofre = cofreDoAmbiente();
const modelo: Modelo = cofre
  ? modeloViaGateway(criarGateway({ baseBanco: base, chaveServico: chave, cofre }))
  : async () => ({ ok: false, motivo: 'o modelo de IA não está configurado (falta o cofre de chaves no servidor)' });

let rodando = false;
async function ciclo() {
  if (rodando) return;
  rodando = true;
  try {
    const r = await rodarCopiloto({ base, chaveServico: chave, modelo });
    if (!r.ok) console.log(JSON.stringify({ nivel: 'erro', msg: 'copiloto_ciclo_falhou', erro: r.erro }));
    else if (r.perguntas) console.log(JSON.stringify({ nivel: 'info', msg: 'copiloto_ciclo', perguntas: r.perguntas, respondidas: r.respondidas, falhas: r.falhas }));
  } catch {
    console.log(JSON.stringify({ nivel: 'erro', msg: 'copiloto_ciclo_falhou', erro: 'erro inesperado' }));
  } finally {
    rodando = false;
  }
}

console.log(JSON.stringify({ nivel: 'info', msg: 'copiloto no ar', intervalo_s: segundos, cofre: !!cofre }));
const timer = setInterval(ciclo, segundos * 1000);
void ciclo();
for (const sinal of ['SIGTERM', 'SIGINT'] as const) process.on(sinal, () => { clearInterval(timer); process.exit(0); });
