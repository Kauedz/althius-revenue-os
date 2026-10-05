import ReactDOM from 'react-dom/client';
// Ordem importa: os dados do protótipo publicam window.ALTHIUS_DATA / ALTHIUS_MOD antes da lógica montar.
import './v18/data.js';
import './v18/module.js';
import './v18/althius.css';
import './app/avatares-agentes.css';

// "demo": protótipo v18 com dados fictícios e troca de papel pelo avatar (não precisa de banco).
// "real" (padrão): login e dados do banco.
const modo = import.meta.env.VITE_ALTHIUS_MODO === 'demo' ? 'demo' : 'real';
const raiz = ReactDOM.createRoot(document.getElementById('root')!);

// Sem StrictMode: a lógica do v18 é um componente de classe com timers e listeners
// próprios, escrito para montar uma única vez (como no runtime original).
if (modo === 'demo') {
  import('./v18/logic.generated.js').then(({ AlthiusLogic }) => raiz.render(<AlthiusLogic />));
} else {
  // O cliente do banco só é carregado no modo real (ele exige a configuração do Supabase).
  Promise.all([import('./app/Raiz'), import('./lib/supabase')])
    .then(([{ Raiz }, { supabase }]) => raiz.render(<Raiz supabase={supabase} />))
    .catch(falha => {
      console.error(falha);
      document.getElementById('root')!.textContent = 'Não foi possível iniciar a Althius: ' + (falha instanceof Error ? falha.message : String(falha));
    });
}
