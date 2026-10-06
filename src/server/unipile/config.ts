// A Unipile é só um canal: tudo o que depende dela (endereço e chave) passa por aqui.
// A chave é lida a cada uso (função `obterConfig`), nunca guardada dentro dos serviços. Assim trocar a chave é mudar
// UM valor (UNIPILE_API_KEY no `.env`; veja `npm run docker:chave-unipile`) e, no futuro, mudar a origem dela
// (tela do superadmin: cofre, ADR 0049) sem mexer no envio, na conexão nem no webhook.
export const URL_PADRAO_UNIPILE = 'https://api.unipile.com';

export interface ConfigUnipile {
  /** chave da API; vazia = canal desligado (nunca se simula envio) */
  apiKey: string;
  /** endereço da API, sem barra no fim */
  url: string;
}

export type ObterConfig = () => ConfigUnipile | Promise<ConfigUnipile>;

export function lerConfig(env: Record<string, string | undefined> = process.env): ConfigUnipile {
  return {
    apiKey: (env.UNIPILE_API_KEY ?? '').trim(),
    url: ((env.UNIPILE_API_URL ?? '').trim() || URL_PADRAO_UNIPILE).replace(/\/+$/, '')
  };
}

/** Config que relê o ambiente a cada chamada (e aceita um `env` falso nos testes). */
export const configDoAmbiente = (env: Record<string, string | undefined> = process.env): (() => ConfigUnipile) => () => lerConfig(env);
