// Ponto de entrada do contêiner `aprendizado` (docker-compose.yml). Só Node, sem dependências.
// Roda o motor do aprendizado compartilhado a cada APRENDIZADO_INTERVALO_HORAS (padrão 6). Nunca duas rodadas juntas.
// O log só traz números (clientes, padrões, sugestões); nunca texto, nome ou id de cliente.
import { rodarAprendizado } from './ciclo.ts';

const base = process.env.BANCO_URL ?? '';
const chave = process.env.SERVICE_ROLE_KEY ?? '';
if (!base || !chave) {
  console.error(JSON.stringify({ nivel: 'erro', msg: 'faltam BANCO_URL e SERVICE_ROLE_KEY' }));
  process.exit(1);
}
const horas = Math.max(1, Number(process.env.APRENDIZADO_INTERVALO_HORAS ?? 6));
let rodando = false;

async function ciclo() {
  if (rodando) return;
  rodando = true;
  try {
    const r = await rodarAprendizado({ base, chaveServico: chave, kMin: Number(process.env.APRENDIZADO_K_MIN) || undefined, enviosMin: Number(process.env.APRENDIZADO_ENVIOS_MIN) || undefined });
    console.log(JSON.stringify(r.ok ? { nivel: 'info', msg: 'aprendizado_ciclo', ...r, ok: undefined } : { nivel: 'erro', msg: 'aprendizado_ciclo_falhou', erro: r.erro }));
  } finally {
    rodando = false;
  }
}

console.log(JSON.stringify({ nivel: 'info', msg: 'aprendizado no ar', intervalo_h: horas }));
const timer = setInterval(ciclo, horas * 3600_000);
void ciclo();
for (const sinal of ['SIGTERM', 'SIGINT'] as const) process.on(sinal, () => { clearInterval(timer); process.exit(0); });
