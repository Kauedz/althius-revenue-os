import ReactDOM from 'react-dom/client';
// Ordem importa: os dados do protótipo publicam window.ALTHIUS_DATA / ALTHIUS_MOD antes da lógica montar.
import './v18/data.js';
import './v18/module.js';
import './v18/althius.css';
import { AlthiusLogic } from './v18/logic.generated.js';

// Sem StrictMode: a lógica do v18 é um componente de classe com timers e listeners
// próprios, escrito para montar uma única vez (como no runtime original).
ReactDOM.createRoot(document.getElementById('root')!).render(<AlthiusLogic />);
