// Servidor HTTP do webhook da Unipile. Só recebe, confere a assinatura do corpo, responde 200 e processa em seguida.
import { createServer, type Server } from 'node:http';
import { iniciarConexao, type DepsConexoes } from './conexoes.ts';
import { guardarSegredo, testarSegredo, type DepsCofre } from '../cofre/rotas.ts';
import { assinaturaValida, CABECALHO_ASSINATURA, interpretar, processar, type Banco, type EventoUnipile } from './unipile.ts';

/** As rotas das integrações do catálogo (ADR 0056); o servidor só despacha, as funções ficam em `integracoes/rotas.ts`. */
export interface RotasIntegracoes {
  iniciar(jwt: string, corpo: unknown): Promise<{ status: number; corpo: Record<string, unknown> }>;
  ferramentas(jwt: string, corpo: unknown): Promise<{ status: number; corpo: Record<string, unknown> }>;
  desconectar(jwt: string, corpo: unknown): Promise<{ status: number; corpo: Record<string, unknown> }>;
  retirar(jwt: string, corpo: unknown): Promise<{ status: number; corpo: Record<string, unknown> }>;
  retorno(query: { code?: string; state?: string; error?: string }): Promise<{ status: 302; destino: string }>;
}

export interface OpcoesServidor {
  /** segredo do endpoint de webhook (a própria Unipile o gera); assina cada aviso */
  segredo: string | (() => string | Promise<string>);
  banco: Banco;
  /** Linha de log (JSON). Nunca recebe remetente nem texto de mensagem. */
  log?: (linha: Record<string, unknown>) => void;
  limiteBytes?: number;
  tentativas?: number;
  esperaMs?: number;
  /** Liga a rota de conexão de contas (PR 05). Sem isto, /conexoes/link responde 503. */
  conexoes?: DepsConexoes;
  /** Liga as rotas do cofre de chaves (ADR 0049). Sem isto, /cofre/* responde 503. */
  cofre?: DepsCofre;
  /** Liga as rotas das integrações (ADR 0056). Sem isto, /integracoes/* responde 503. */
  integracoes?: RotasIntegracoes;
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
    // Retorno do consentimento do app: um redirecionamento do navegador (GET, sem login). A prova é o `state` de uso único.
    if (url === '/integracoes/retorno') {
      if (req.method !== 'GET') return responder(405, { erro: 'metodo_nao_permitido' });
      if (!o.integracoes) return responder(503, { erro: 'integracoes_indisponiveis' });
      const q = new URL(req.url ?? '', 'http://interno').searchParams;
      o.integracoes.retorno({ code: q.get('code') ?? undefined, state: q.get('state') ?? undefined, error: q.get('error') ?? undefined }).then(
        r => { res.writeHead(302, { Location: r.destino, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }); res.end(); },
        () => responder(502, { erro: 'falha_nas_integracoes' })
      );
      return;
    }
    const ehWebhook = url === '/webhooks/unipile';
    const ehLink = url === '/conexoes/link';
    const ehCofre = url === '/cofre/guardar' || url === '/cofre/testar';
    const ehIntegracao = ['/integracoes/iniciar', '/integracoes/ferramentas', '/integracoes/desconectar', '/integracoes/retirar'].includes(url);
    if (!ehWebhook && !ehLink && !ehCofre && !ehIntegracao) return responder(404, { erro: 'nao_encontrado' });
    if (req.method !== 'POST') return responder(405, { erro: 'metodo_nao_permitido' });

    // A prova do link de conexão é o login da pessoa, conferido ANTES de ler o corpo. A do webhook é a assinatura do
    // corpo bruto: só dá para conferir depois de ler (o limite de tamanho protege a memória).
    let jwt = '';
    if (ehLink || ehCofre || ehIntegracao) {
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
      const seguir = () => {
        let payload: unknown;
        try { payload = JSON.parse(bruto); } catch { return responder(400, { erro: 'json_invalido' }); }
        if (ehCofre) {
          if (!o.cofre) return responder(503, { erro: 'cofre_indisponivel' });
          const rota = url === '/cofre/guardar' ? guardarSegredo : testarSegredo;
          rota(o.cofre, jwt, payload).then(r => responder(r.status, r.corpo), () => responder(502, { erro: 'falha_no_cofre' }));
          return;
        }
        if (ehIntegracao) {
          if (!o.integracoes) return responder(503, { erro: 'integracoes_indisponiveis' });
          const rota = o.integracoes[url.slice('/integracoes/'.length) as 'iniciar' | 'ferramentas' | 'desconectar' | 'retirar'];
          rota(jwt, payload).then(r => responder(r.status, r.corpo), () => responder(502, { erro: 'falha_nas_integracoes' }));
          return;
        }
        if (ehLink) {
          if (!o.conexoes) return responder(503, { erro: 'conexao_indisponivel' });
          iniciarConexao(o.conexoes, jwt, payload).then(r => responder(r.status, r.corpo), () => responder(502, { erro: 'falha_ao_gerar_link' }));
          return;
        }
        // 200 já: a Unipile não espera o banco (e não reenvia por lentidão nossa).
        responder(200, { ok: true });
        const trabalho = tratar(interpretar(payload)).finally(() => pendentes.delete(trabalho));
        pendentes.add(trabalho);
      };
      if (!ehWebhook) return seguir();
      // O segredo do webhook pode vir do cofre: relido a cada aviso (trocar na tela vale na hora).
      Promise.resolve(typeof o.segredo === 'function' ? o.segredo() : o.segredo).then(
        segredo => { if (!assinaturaValida(bruto, req.headers[CABECALHO_ASSINATURA], segredo)) return responder(401, { erro: 'nao_autorizado' }); seguir(); },
        () => responder(401, { erro: 'nao_autorizado' })
      );
    });
  });

  return { servidor, ocioso: async () => { while (pendentes.size) await Promise.allSettled([...pendentes]); } };
}
