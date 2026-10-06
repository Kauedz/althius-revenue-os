// Casca HTTP do gateway: lê o corpo (limite de 4 MB), repassa ao gateway e escreve a resposta. Só rede interna do Docker.
import { createServer, type Server } from 'node:http';
import type { criarGateway } from './gateway.ts';

export function criarServidorGateway(g: ReturnType<typeof criarGateway>, limiteBytes = 4_000_000): Server {
  return createServer((req, res) => {
    const [caminho] = (req.url ?? '').split('?');
    const responder = (status: number, tipo: string, corpo: string) => { res.writeHead(status, { 'Content-Type': tipo }); res.end(corpo); };
    if (caminho === '/saude') return responder(200, 'application/json', '{"ok":true}');
    const partes: Buffer[] = [];
    let tamanho = 0;
    let estourou = false;
    req.on('data', (p: Buffer) => {
      tamanho += p.length;
      if (estourou) return;
      if (tamanho > limiteBytes) { estourou = true; partes.length = 0; responder(413, 'application/json', '{"error":{"message":"Pedido grande demais.","type":"pedido_invalido"}}'); return; }
      partes.push(p);
    });
    req.on('end', () => {
      if (estourou) return;
      g.tratar({ metodo: req.method ?? 'GET', caminho, autorizacao: req.headers.authorization, corpo: Buffer.concat(partes).toString('utf8') })
        .then(r => responder(r.status, r.tipo, r.corpo), () => responder(500, 'application/json', '{"error":{"message":"Falha interna do gateway.","type":"interno"}}'));
    });
  });
}
