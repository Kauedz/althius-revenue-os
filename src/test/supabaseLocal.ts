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

/** Cliente já logado como um usuário do seed (senha de demonstração). */
export async function entrarComoLocal(email: string) {
  const cliente = novoClienteLocal();
  const { error } = await cliente.auth.signInWithPassword({ email, password: 'althius-demo' });
  if (error) throw error;
  return cliente;
}
