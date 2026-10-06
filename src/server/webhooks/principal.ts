// Ponto de entrada do contêiner `webhooks` (docker-compose.yml). Só Node, sem dependências.
import { bancoViaApi } from './banco.ts';
import { criarServidor } from './servidor.ts';
import { iniciarConexao as iniciarContaDeMensagem, type DepsConexoes } from './conexoes.ts';
import { configDoAmbiente } from '../unipile/config.ts';
import type { ObterConfig } from '../unipile/config.ts';
import { cofreDoAmbiente } from '../cofre/ambiente.ts';
import { configDoCofre, segredoDoWebhook } from '../cofre/consumidores.ts';
import { chaveMestra } from '../cofre/cifra.ts';
import type { DepsCofre } from '../cofre/rotas.ts';
import { bancoIntegracoes } from '../integracoes/banco.ts';
import { desconectar, ferramentas, iniciarConexao, retirar, retornoDoConsentimento, type DepsIntegracoes } from '../integracoes/rotas.ts';
import { chamarDoAgente, ferramentasDoAgente, proporDoAgente } from '../integracoes/agente.ts';
import { executarAcoesAprovadas } from '../integracoes/acoes.ts';
import type { RotasIntegracoes } from './servidor.ts';
import { criarPoolApify } from '../providers/apify-pool.ts';
import { testarFonteDoAgente } from '../sinais/agente.ts';

const base = process.env.BANCO_URL ?? '';
const chave = process.env.SERVICE_ROLE_KEY ?? '';
if (!base || !chave) {
  console.error(JSON.stringify({ nivel: 'erro', msg: 'faltam BANCO_URL e SERVICE_ROLE_KEY' }));
  process.exit(1);
}
// Chaves: do cofre (tela do superadmin, ADR 0049) e, sem ela lá, do `.env`. Relidas a cada pedido.
const cofre = cofreDoAmbiente();
const segredo = cofre ? segredoDoWebhook(cofre) : async () => (process.env.UNIPILE_WEBHOOK_SECRET ?? '').trim();
if (!cofre && !process.env.UNIPILE_WEBHOOK_SECRET) {
  console.warn(JSON.stringify({ nivel: 'aviso', msg: 'sem segredo do webhook (cofre ou UNIPILE_WEBHOOK_SECRET): todo webhook será recusado (401) até configurar' }));
}

// Conexão de contas: precisa da chave do canal, do endereço público e da chave pública do banco. A chave é relida a
// cada pedido (configDoAmbiente), então trocar UNIPILE_API_KEY vale sem mudar o código.
const siteUrl = process.env.SITE_URL ?? '';
const chaveAnon = process.env.ANON_KEY ?? '';
const obterConfig: ObterConfig = cofre ? configDoCofre(cofre) : configDoAmbiente();
const conexoes: DepsConexoes | undefined = siteUrl && chaveAnon
  ? { siteUrl, obterConfig, baseBanco: base, chaveAnon }
  : undefined;
if (!conexoes) {
  console.warn(JSON.stringify({ nivel: 'aviso', msg: 'conexão de contas desligada: faltam SITE_URL ou ANON_KEY' }));
}

// Rotas da tela do superadmin para cadastrar chaves: precisam do cofre ligado e da chave pública do banco.
const rotasCofre: DepsCofre | undefined = cofre && chaveAnon
  ? { baseBanco: base, chaveAnon, chaveServico: chave, chave: chaveMestra(), cofre }
  : undefined;

// Integrações do catálogo (ADR 0056): os tokens são cifrados com a chave mestra do cofre, então sem ela ficam desligadas.
const depsIntegracoes: DepsIntegracoes | undefined = siteUrl && chaveAnon && (process.env.COFRE_CHAVE_MESTRA ?? '').trim()
  ? { banco: bancoIntegracoes({ base, chaveAnon, chaveServico: chave }), chave: chaveMestra(), siteUrl, cofre: cofre ?? undefined, log: linha => console.log(JSON.stringify(linha)), canais: conexoes ? (jwt, corpo) => iniciarContaDeMensagem(conexoes, jwt, corpo) : undefined }
  : undefined;
if (!depsIntegracoes) {
  console.warn(JSON.stringify({ nivel: 'aviso', msg: 'integrações desligadas: faltam SITE_URL, ANON_KEY ou COFRE_CHAVE_MESTRA' }));
}
const integracoes: RotasIntegracoes | undefined = depsIntegracoes && {
  iniciar: (jwt, corpo) => iniciarConexao(depsIntegracoes, jwt, corpo),
  ferramentas: (jwt, corpo) => ferramentas(depsIntegracoes, jwt, corpo),
  desconectar: (jwt, corpo) => desconectar(depsIntegracoes, jwt, corpo),
  retirar: (jwt, corpo) => retirar(depsIntegracoes, jwt, corpo),
  agenteFerramentas: (token, corpo) => ferramentasDoAgente(depsIntegracoes, token, corpo),
  agentePropor: (token, corpo) => proporDoAgente(depsIntegracoes, token, corpo),
  agenteChamar: (token, corpo) => chamarDoAgente(depsIntegracoes, token, corpo),
  retorno: query => retornoDoConsentimento(depsIntegracoes, query)
};

// Ações que os agentes propuseram nos apps e uma pessoa APROVOU (ADR 0058): rodam aqui, uma vez cada, com o acesso de quem pediu.
if (depsIntegracoes) {
  let rodando = false;
  const ciclo = setInterval(async () => {
    if (rodando) return;
    rodando = true;
    try {
      const n = await executarAcoesAprovadas(depsIntegracoes);
      if (n) console.log(JSON.stringify({ nivel: 'info', msg: 'acoes_de_agente_executadas', total: n }));
    } catch {
      console.log(JSON.stringify({ nivel: 'erro', msg: 'acoes_de_agente_falhou' }));
    } finally {
      rodando = false;
    }
  }, 5_000);
  ciclo.unref?.();
}

// O agente testa fontes de sinal (ADR 0060) com as chaves da Apify do cofre (ou APIFY_TOKEN_* do .env), sempre com teto.
const poolApify = criarPoolApify({ cofre });
const sinaisDoAgente = { testar: (token: string, corpo: unknown) => testarFonteDoAgente({ base, chaveServico: chave, pool: poolApify }, token, corpo) };

const { servidor } = criarServidor({ segredo, banco: bancoViaApi(base, chave), conexoes, cofre: rotasCofre, integracoes, sinaisDoAgente });
const porta = Number(process.env.PORT ?? 3100);
servidor.listen(porta, '0.0.0.0', () => console.log(JSON.stringify({ nivel: 'info', msg: 'webhooks no ar', porta })));
for (const sinal of ['SIGTERM', 'SIGINT'] as const) process.on(sinal, () => servidor.close(() => process.exit(0)));
