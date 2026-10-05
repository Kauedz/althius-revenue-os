// Servidor HTTP do webhook da Unipile. Só recebe, confere a assinatura do corpo, responde 200 e processa em seguida.
import { createServer, type Server } from 'node:http';
import { iniciarConexao, type DepsConexoes } from './conexoes.ts';
import { assinaturaValida, CABECALHO_ASSINATURA, interpretar, processar, type Banco, type EventoUnipile } from './unipile.ts';

export interface OpcoesServidor {
  /** segredo do endpoint de webhook (a própria Unipile o gera); assina cada aviso */
  segredo: string;
  banco: Banco;
  /** Linha de log (JSON). Nunca recebe remetente nem texto de mensagem. */
  log?: (linha: Record<string, unknown>) => void;
  limiteBytes?: number;
  tentativas?: number;
  esperaMs?: number;
  /** Liga a rota de conexão de contas (PR 05). Sem isto, /conexoes/link responde 503. */
  conexoes?: DepsConexoes;
}

export function criarServidor(o: OpcoesServidor): { servidor: Server; ocioso: () => Promise<void> } {
  const log = o.log ?? (l => console.log(JSON.stringify(l)));
  const limite = o.limiteBytes ?? 1_000_000;
  const tentativas = o.tentativas ?? 3;
  const espera = o.esperaMs ?? 500;
  const pendentes = new Set<Promise<void>>();

  async function tratar(evento: EventoUnipile): Promise<void> {
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
    const [url] = (req.url ?? '').split('?');

    if (url === '/saude') return responder(200, { ok: true });
    const ehWebhook = url === '/webhooks/unipile';
    const ehLink = url === '/conexoes/link';
    if (!ehWebhook && !ehLink) return responder(404, { erro: 'nao_encontrado' });
    if (req.method !== 'POST') return responder(405, { erro: 'metodo_nao_permitido' });

    // A prova do link de conexão é o login da pessoa, conferido ANTES de ler o corpo. A do webhook é a assinatura do
    // corpo bruto: só dá para conferir depois de ler (o limite de tamanho protege a memória).
    let jwt = '';
    if (ehLink) {
      const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
      jwt = m?.[1] ?? '';
      if (!jwt) { req.resume(); return responder(401, { erro: 'nao_autorizado' }); }
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
      const bruto = Buffer.concat(partes).toString('utf8');
      if (ehWebhook && !assinaturaValida(bruto, req.headers[CABECALHO_ASSINATURA], o.segredo)) return responder(401, { erro: 'nao_autorizado' });
      let payload: unknown;
      try { payload = JSON.parse(bruto); } catch { return responder(400, { erro: 'json_invalido' }); }
      if (ehLink) {
        if (!o.conexoes) return responder(503, { erro: 'conexao_indisponivel' });
        iniciarConexao(o.conexoes, jwt, payload).then(r => responder(r.status, r.corpo), () => responder(502, { erro: 'falha_ao_gerar_link' }));
        return;
      }
      // 200 já: a Unipile não espera o banco (e não reenvia por lentidão nossa).
      responder(200, { ok: true });
      const trabalho = tratar(interpretar(payload)).finally(() => pendentes.delete(trabalho));
      pendentes.add(trabalho);
    });
  });

  return { servidor, ocioso: async () => { while (pendentes.size) await Promise.allSettled([...pendentes]); } };
}
