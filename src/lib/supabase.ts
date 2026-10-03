import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Sem configuração não há como falar com o banco: falha cedo e com mensagem clara,
// em vez de usar uma chave inventada que só daria erro mais adiante.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Configuração ausente: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja .env.development).');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
