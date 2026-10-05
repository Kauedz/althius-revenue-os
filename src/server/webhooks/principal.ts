// Ponto de entrada do contêiner `webhooks` (docker-compose.yml). Só Node, sem dependências.
import { bancoViaApi } from './banco.ts';
import { criarServidor } from './servidor.ts';
import type { DepsConexoes } from './conexoes.ts';
import { configDoAmbiente } from '../unipile/config.ts';

const segredo = process.env.UNIPILE_WEBHOOK_SECRET ?? '';
const base = process.env.BANCO_URL ?? '';
const chave = process.env.SERVICE_ROLE_KEY ?? '';
if (!base || !chave) {
  console.error(JSON.stringify({ nivel: 'erro', msg: 'faltam BANCO_URL e SERVICE_ROLE_KEY' }));
  process.exit(1);
}
if (!segredo) {
  console.warn(JSON.stringify({ nivel: 'aviso', msg: 'UNIPILE_WEBHOOK_SECRET vazio: todo webhook será recusado (401) até configurar' }));
}

// Conexão de contas: precisa da chave do canal, do endereço público e da chave pública do banco. A chave é relida a
// cada pedido (configDoAmbiente), então trocar UNIPILE_API_KEY vale sem mudar o código.
const siteUrl = process.env.SITE_URL ?? '';
const chaveAnon = process.env.ANON_KEY ?? '';
const obterConfig = configDoAmbiente();
const conexoes: DepsConexoes | undefined = siteUrl && chaveAnon
  ? { siteUrl, obterConfig, baseBanco: base, chaveAnon }
  : undefined;
if (!conexoes || !obterConfig().apiKey) {
  console.warn(JSON.stringify({ nivel: 'aviso', msg: 'conexão de contas desligada: faltam SITE_URL, ANON_KEY ou UNIPILE_API_KEY (a tela mostra "indisponível")' }));
}

const { servidor } = criarServidor({ segredo, banco: bancoViaApi(base, chave), conexoes });
const porta = Number(process.env.PORT ?? 3100);
servidor.listen(porta, '0.0.0.0', () => console.log(JSON.stringify({ nivel: 'info', msg: 'webhooks no ar', porta })));
for (const sinal of ['SIGTERM', 'SIGINT'] as const) process.on(sinal, () => servidor.close(() => process.exit(0)));
