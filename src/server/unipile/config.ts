// A Unipile é só um canal: tudo o que depende dela (endereço e chave) passa por aqui.
// A chave é lida a cada uso (função `obterConfig`), nunca guardada dentro dos serviços. Assim trocar a chave é mudar
// UM valor (UNIPILE_API_KEY no `.env`; veja `npm run docker:chave-unipile`) e, no futuro, mudar a origem dela
// (tela do superadmin: cofre, ADR 0049) sem mexer no envio, na conexão nem no webhook.
//
// Duas versões da API (ADR 0069): a v2 (https://api.unipile.com, caminhos /v2/...) e a v1 (cada cliente tem um endereço
// próprio, como https://api68.unipile.com:19840, caminhos /api/v1/...). O código fala com as duas; a versão vem de
// UNIPILE_API_VERSION (v1 ou v2) ou, sem ela, do endereço: terminar em /api/v1 ou ter o formato apiNN.unipile.com é v1.
export const URL_PADRAO_UNIPILE = 'https://api.unipile.com';

export type VersaoUnipile = 'v1' | 'v2';

export interface ConfigUnipile {
  /** chave da API; vazia = canal desligado (nunca se simula envio) */
  apiKey: string;
  /** endereço da API, sem barra no fim (e sem /api/v1: isso é da versão) */
  url: string;
  /** força a versão; sem isso vale a deduzida do endereço */
  versao?: VersaoUnipile;
}

export type ObterConfig = () => ConfigUnipile | Promise<ConfigUnipile>;

const semBarra = (u: string) => u.trim().replace(/\/+$/, '');
const limpa = (u: string) => semBarra(u).replace(/\/api\/v1$/i, '');

/** A versão da API: a forçada, senão a que o endereço indica (v2 por padrão). */
export function versaoDaApi(cfg: ConfigUnipile): VersaoUnipile {
  if (cfg.versao === 'v1' || cfg.versao === 'v2') return cfg.versao;
  const u = semBarra(cfg.url);
  if (/\/api\/v1$/i.test(u) || /^https?:\/\/api\d+\.unipile\.com(:\d+)?$/i.test(u)) return 'v1';
  return 'v2';
}

/** Endereço-base da API sem o prefixo de versão (ele é acrescentado por quem chama). */
export const baseDaApi = (cfg: ConfigUnipile): string => limpa(cfg.url);

export function lerConfig(env: Record<string, string | undefined> = process.env): ConfigUnipile {
  const v = (env.UNIPILE_API_VERSION ?? '').trim().toLowerCase();
  return {
    apiKey: (env.UNIPILE_API_KEY ?? '').trim(),
    url: limpa((env.UNIPILE_API_URL ?? '').trim() || URL_PADRAO_UNIPILE),
    ...(v === 'v1' || v === 'v2' ? { versao: v as VersaoUnipile } : {})
  };
}

/** Config que relê o ambiente a cada chamada (e aceita um `env` falso nos testes). */
export const configDoAmbiente = (env: Record<string, string | undefined> = process.env): (() => ConfigUnipile) => () => lerConfig(env);
