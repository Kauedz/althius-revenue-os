// Ponto de entrada do contêiner `gateway` (docker-compose.yml). Só Node, sem dependências. Rede interna: nenhuma porta
// publicada. Precisa do cofre ligado (COFRE_CHAVE_MESTRA): é de lá que vêm as chaves dos modelos de IA.
import { cofreDoAmbiente } from '../cofre/ambiente.ts';
import { criarGateway } from './gateway.ts';
import { criarServidorGateway } from './servidor.ts';

const base = process.env.BANCO_URL ?? '';
const chave = process.env.SERVICE_ROLE_KEY ?? '';
const cofre = cofreDoAmbiente();
if (!base || !chave || !cofre) {
  console.error(JSON.stringify({ nivel: 'erro', msg: 'o gateway precisa de BANCO_URL, SERVICE_ROLE_KEY e COFRE_CHAVE_MESTRA' }));
  process.exit(1);
}
const servidor = criarServidorGateway(criarGateway({ baseBanco: base, chaveServico: chave, cofre }));
const porta = Number(process.env.PORT ?? 3300);
servidor.listen(porta, '0.0.0.0', () => console.log(JSON.stringify({ nivel: 'info', msg: 'gateway do modelo no ar', porta })));
for (const sinal of ['SIGTERM', 'SIGINT'] as const) process.on(sinal, () => servidor.close(() => process.exit(0)));
