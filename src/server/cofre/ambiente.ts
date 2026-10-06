// Monta o cofre a partir das variáveis do contêiner. Sem COFRE_CHAVE_MESTRA o cofre fica desligado e tudo segue
// valendo pelo `.env` (assim dá para subir o sistema antes de cadastrar chave nenhuma).
import { chaveMestra } from './cifra.ts';
import { cofreViaApi, type Cofre } from './cofre.ts';

export function cofreDoAmbiente(env: Record<string, string | undefined> = process.env, aviso: (msg: string) => void = m => console.warn(JSON.stringify({ nivel: 'aviso', msg: m }))): Cofre | null {
  const base = env.BANCO_URL ?? '';
  const servico = env.SERVICE_ROLE_KEY ?? '';
  if (!base || !servico) return null;
  if (!(env.COFRE_CHAVE_MESTRA ?? '').trim()) { aviso('COFRE_CHAVE_MESTRA vazia: o cofre de chaves está desligado (valem as chaves do .env)'); return null; }
  try {
    return cofreViaApi({ base, chaveServico: servico, chave: chaveMestra(env) });
  } catch (e) {
    aviso(`cofre desligado: ${e instanceof Error ? e.message : 'chave mestra inválida'}`);
    return null;
  }
}
