// Supabase local (npx supabase start) para os testes de integração.
// A chave é a chave pública padrão de toda instalação local (emissor "supabase-demo").
import { createClient } from '@supabase/supabase-js';

export const URL_LOCAL = 'http://127.0.0.1:54321';
export const ANON_LOCAL =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

/** true se o Supabase local estiver no ar; sem ele, os testes de integração são pulados com aviso. */
export const bancoLocalNoAr = await fetch(URL_LOCAL + '/auth/v1/health', { headers: { apikey: ANON_LOCAL } })
  .then(r => r.ok, () => false);
if (!bancoLocalNoAr) console.warn('[testes] Supabase local fora do ar: rode `npx supabase start`. Testes de integração pulados.');

export const novoClienteLocal = () =>
  createClient(URL_LOCAL, ANON_LOCAL, { auth: { persistSession: false, autoRefreshToken: false } });

/**
 * Cliente que atrasa só a LEITURA do perfil da pessoa (o select com job_title), para os testes
 * enxergarem de forma determinística a tela de Configurações enquanto o perfil ainda não chegou.
 */
export const novoClienteComPerfilLento = (atrasoMs: number) =>
  createClient(URL_LOCAL, ANON_LOCAL, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (entrada, init) => {
        const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
        const ehLeituraDoPerfil = (init?.method ?? 'GET') === 'GET' && url.includes('/rest/v1/profiles') && url.includes('job_title');
        if (ehLeituraDoPerfil) await new Promise(r => setTimeout(r, atrasoMs));
        return fetch(entrada, init);
      }
    }
  });

/** Chave service_role padrão do Supabase local: só para os testes arrumarem o estado do banco. */
export const SERVICE_LOCAL =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
export const adminLocal = () =>
  createClient(URL_LOCAL, SERVICE_LOCAL, { auth: { persistSession: false, autoRefreshToken: false } });

/** Cliente já logado como um usuário do seed (senha de demonstração). */
export async function entrarComoLocal(email: string) {
  const cliente = novoClienteLocal();
  const { error } = await cliente.auth.signInWithPassword({ email, password: 'althius-demo' });
  if (error) throw error;
  return cliente;
}

/**
 * Cliente falso para testes de tela sem banco: toda consulta devolve lista vazia sem erro.
 * Encadeia qualquer método (from, select, eq, order...) e pode ser aguardado com await.
 */
export function clienteVazio(): any {
  const resposta = { data: [], error: null };
  const cadeia: any = new Proxy(function () {}, {
    get: (_alvo, prop) => (prop === 'then' ? (ok: (v: unknown) => unknown) => Promise.resolve(resposta).then(ok) : cadeia),
    apply: () => cadeia
  });
  return cadeia;
}
