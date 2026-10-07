// Quem usa o cofre: a Unipile (chave, endereço e segredo do webhook). O cofre vale mais que o `.env`; se o cofre não
// tem a chave ou está fora do ar, o `.env` continua valendo (assim nada para de funcionar na migração).
import { lerConfig, type ObterConfig } from '../unipile/config.ts';
import type { Cofre } from './cofre.ts';

export function configDoCofre(cofre: Cofre, env: Record<string, string | undefined> = process.env): ObterConfig {
  return async () => {
    const doEnv = lerConfig(env);
    try {
      const [chave] = await cofre.ler('unipile');
      if (!chave) return doEnv;
      const url = typeof chave.config.url === 'string' ? chave.config.url.trim().replace(/\/+$/, '') : '';
      return { apiKey: chave.segredo.trim(), url: url || doEnv.url, ...(doEnv.versao ? { versao: doEnv.versao } : {}) };
    } catch {
      return doEnv;
    }
  };
}

export function segredoDoWebhook(cofre: Cofre, env: Record<string, string | undefined> = process.env): () => Promise<string> {
  return async () => {
    try {
      const [s] = await cofre.ler('unipile_webhook');
      if (s) return s.segredo.trim();
    } catch { /* cai no .env */ }
    return (env.UNIPILE_WEBHOOK_SECRET ?? '').trim();
  };
}
