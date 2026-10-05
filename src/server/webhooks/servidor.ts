// Servidor HTTP do webhook da Unipile. Só recebe, confere o segredo, responde 200 e processa em seguida.
import { createServer, type Server } from 'node:http';
import { autenticado, CABECALHO_AUTH, interpretar, processar, type Banco } from './unipile.ts';

export interface OpcoesServidor {
  segredo: string;
  banco: Banco;
  /** Linha de log (JSON). Nunca recebe remetente nem texto de mensagem. */
  log?: (linha: Record<string, unknown>) => void;
  limiteBytes?: number;
  tentativas?: number;
  esperaMs?: number;
}

export function criarServidor(o: OpcoesServidor): { servidor: Server; ocioso: () => Promise<void> } {
  const log = o.log ?? (l => console.log(JSON.stringify(l)));
  const limite = o.limiteBytes ?? 1_000_000;
  const tentativas = o.tentativas ?? 3;
  const espera = o.esperaMs ?? 500;
  const pendentes = new Set<Promise<void>>();

  async function tratar(payload: unknown): Promise<void> {
    const evento = interpretar(payload);
    for (let n = 1; n <= tentativas; n++) {
      try {
        const r = await processar(evento, o.banco);
        log({ nivel: 'info', msg: 'webhook_unipile', ...r });
        return;
      } catch (e) {
        const ultima = n === tentativas;
        log({ nivel: ultima ? 'erro' : 'aviso', msg: ultima ? 'webhook_unipile_perdido' : 'webhook_unipile_tentando_de_novo', tipo: evento.tipo, tentativa: n, erro: e instanceof Error ? e.message : 'erro' });
        if (!ultima) await new Promise(r => setTimeout(r, espera * 2 ** (n - 1)));
      }
    }
  }

  const servidor = createServer((req, res) => {
    const responder = (status: number, corpo: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(corpo));
    };
    const url = (req.url ?? '').split('?')[0];

    if (url === '/saude') return responder(200, { ok: true });
    if (url !== '/webhooks/unipile') return responder(404, { erro: 'nao_encontrado' });
    if (req.method !== 'POST') return responder(405, { erro: 'metodo_nao_permitido' });
    // Segredo antes de ler o corpo: quem não sabe o segredo não gasta memória nossa.
    if (!autenticado(req.headers[CABECALHO_AUTH], o.segredo)) {
      req.resume();
      return responder(401, { erro: 'nao_autorizado' });
    }

    const partes: Buffer[] = [];
    let tamanho = 0;
    let estourou = false;
    req.on('data', (parte: Buffer) => {
      tamanho += parte.length;
      if (estourou) return;
      if (tamanho > limite) { estourou = true; partes.length = 0; return responder(413, { erro: 'corpo_grande_demais' }); }
      partes.push(parte);
    });
    req.on('end', () => {
      if (estourou) return;
      let payload: unknown;
      try { payload = JSON.parse(Buffer.concat(partes).toString('utf8')); } catch { return responder(400, { erro: 'json_invalido' }); }
      // 200 já: a Unipile não espera o banco (e não reenvia por lentidão nossa).
      responder(200, { ok: true });
      const trabalho = tratar(payload).finally(() => pendentes.delete(trabalho));
      pendentes.add(trabalho);
    });
  });

  return { servidor, ocioso: async () => { while (pendentes.size) await Promise.allSettled([...pendentes]); } };
}
