// Sinal posts_decisor: posts recentes do decisor (e de outros contatos do comitê) no LinkedIn, para personalizar a copy.
// Ator `harvestapi/linkedin-profile-posts` (US$ 0,002 por post), conferido em 06/10/2026
// (docs/sinais/atores-por-sinal.md). Reações e comentários ficam desligados (são cobrados à parte).
// Só dado profissional público: texto do post, link, data e contagem de curtidas. Nunca atribui um post a quem não é
// contato da conta.
import type { AdaptadorApify, ContaDoPedido, ContextoDaColeta, EventoDeSinal, Frequencia } from './tipos.ts';
import { acharContato, dataCurta, dataIso, dentroDaJanela, evento, identificadorDoItem, objeto, primeiroTexto, recortar, semRepetidos, texto } from './comum.ts';

const ATOR = 'harvestapi/linkedin-profile-posts';
const MAX_CONTATOS = 3;
const POSTS_POR_CONTATO = 3;
const JANELA: Record<Frequencia, string> = { diario: '24h', semanal: 'week', mensal: 'month' };

const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export const adaptadorDePosts: AdaptadorApify = {
  entrada(ator: string, conta: ContaDoPedido, ctx: ContextoDaColeta) {
    if (ator !== ATOR) throw new Error(`O ator ${ator} não faz parte do sinal de posts do decisor.`);
    const urls = (conta.contatos ?? []).map(c => c.linkedinUrl).filter(Boolean).slice(0, MAX_CONTATOS);
    if (!urls.length) throw new Error('Conta sem contato com LinkedIn para acompanhar.');
    return { targetUrls: urls, maxPosts: POSTS_POR_CONTATO, postedLimit: JANELA[ctx.frequencia], includeReposts: false };
  },

  eventos(_ator: string, itens: unknown[], conta: ContaDoPedido, ctx: ContextoDaColeta): EventoDeSinal[] {
    const saida: EventoDeSinal[] = [];
    const contatos = conta.contatos ?? [];
    for (const bruto of itens) {
      const item = objeto(bruto);
      const autor = objeto(item.author);
      const contato = acharContato(contatos, identificadorDoItem(autor));
      const postId = texto(item.id);
      const conteudo = texto(item.content);
      const quando = dataIso(objeto(item.postedAt).date);
      if (!contato || !postId || !conteudo || !quando || !dentroDaJanela(quando, ctx.agora, ctx.frequencia)) continue;
      const eng = objeto(item.engagement);
      const link = primeiroTexto(item, 'linkedinUrl');
      saida.push(evento({
        chave: `post|${contato.id}|${postId}`,
        texto: `${contato.nome} publicou no LinkedIn: ${recortar(conteudo, 200)}`,
        evidencia: `Post de ${contato.nome} em ${dataCurta(quando)} (LinkedIn): ${recortar(conteudo, 1200)} ${link} — ${numero(eng.likes)} curtidas, ${numero(eng.comments)} comentários.`.trim(),
        fonte: 'LinkedIn',
        quando
      }));
    }
    return semRepetidos(saida);
  }
};
