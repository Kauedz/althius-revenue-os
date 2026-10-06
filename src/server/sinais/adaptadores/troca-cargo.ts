// Sinal troca_cargo: o decisor (ou outro contato do comitê) mudou de empresa ou de cargo. Ator
// `harvestapi/linkedin-profile-scraper` (US$ 0,004 por perfil, sem e-mail), conferido em 06/10/2026
// (docs/sinais/atores-por-sinal.md). O ator não guarda a leitura anterior: o banco guarda o retrato de cada contato
// (cargo e empresa atuais) e este adaptador compara. A PRIMEIRA leitura só grava o retrato: nunca inventa mudança.
// Perfil sem cargo atual declarado não prova que a pessoa saiu: nada é concluído e o retrato anterior fica.
import type { AdaptadorApify, ContaDoPedido, ContextoDaColeta, ContatoDoPedido, EventoDeSinal, Retrato } from './tipos.ts';
import { acharContato, dataCurta, evento, identificadorDoItem, nomeDaEmpresa, normalizar, objeto, perfilDoLinkedin, texto } from './comum.ts';

const ATOR = 'harvestapi/linkedin-profile-scraper';
const MAX_PERFIS = 5;
// O nome do modo inclui o preço (o ator o troca de vez em quando); validado em execução real em 06/10/2026.
const MODO = 'Profile details no email ($4 per 1k)';

interface Atual { empresa: string; empresaId: string; cargo: string; desde: string }

function leituraAtual(item: Record<string, unknown>): Atual | null {
  const lista = Array.isArray(item.currentPosition) ? item.currentPosition : [];
  const p = objeto(lista[0]);
  const empresa = texto(p.companyName);
  const cargo = texto(p.position);
  if (!empresa && !cargo) return null;
  return { empresa, empresaId: texto(p.companyId), cargo, desde: texto(objeto(p.startDate).text) };
}

const contatoDoItem = (item: Record<string, unknown>, contatos: ContatoDoPedido[]): ContatoDoPedido | undefined =>
  acharContato(contatos, identificadorDoItem(item));

function mudouDeEmpresa(antes: Record<string, unknown>, agora: Atual): boolean {
  const idAntes = texto(antes.empresaId);
  if (idAntes && agora.empresaId) return idAntes !== agora.empresaId;
  const nomeAntes = nomeDaEmpresa(antes.empresa);
  return nomeAntes.length > 0 && nomeAntes !== nomeDaEmpresa(agora.empresa);
}

export const adaptadorDeTrocaDeCargo: AdaptadorApify = {
  entrada(ator: string, conta: ContaDoPedido, _ctx: ContextoDaColeta) {
    if (ator !== ATOR) throw new Error(`O ator ${ator} não faz parte do sinal de troca de cargo.`);
    const urls = (conta.contatos ?? []).map(c => c.linkedinUrl).filter(Boolean).slice(0, MAX_PERFIS);
    if (!urls.length) throw new Error('Conta sem contato com LinkedIn para acompanhar.');
    return { profileScraperMode: MODO, queries: urls };
  },

  eventos(_ator: string, itens: unknown[], conta: ContaDoPedido, ctx: ContextoDaColeta): EventoDeSinal[] {
    const saida: EventoDeSinal[] = [];
    const contatos = conta.contatos ?? [];
    for (const bruto of itens) {
      const item = objeto(bruto);
      const contato = contatoDoItem(item, contatos);
      const atual = contato ? leituraAtual(item) : null;
      if (!contato || !atual || !contato.snapshot) continue; // sem retrato anterior: só baseline (ver `retratos`)
      const antes = contato.snapshot;
      const quando = new Date(ctx.agora).toISOString();
      const perfil = `https://www.linkedin.com/in/${perfilDoLinkedin(contato.linkedinUrl)}`;
      const anterior = `${texto(antes.cargo) || 'cargo não informado'} em ${texto(antes.empresa) || 'empresa não informada'}`;
      if (mudouDeEmpresa(antes, atual)) {
        saida.push(evento({
          chave: `troca|${contato.id}|empresa|${nomeDaEmpresa(atual.empresa)}`,
          texto: `${contato.nome} mudou de empresa: de ${texto(antes.empresa)} para ${atual.empresa}${atual.cargo ? ` (${atual.cargo})` : ''}`,
          evidencia: `${contato.nome}: antes ${anterior}; agora ${atual.cargo || 'cargo não informado'} em ${atual.empresa}${atual.desde ? ` desde ${atual.desde}` : ''}. Visto em ${dataCurta(quando)} (LinkedIn). ${perfil}`,
          fonte: 'LinkedIn', quando
        }));
      } else if (atual.cargo && normalizar(atual.cargo) !== normalizar(antes.cargo)) {
        saida.push(evento({
          chave: `troca|${contato.id}|cargo|${normalizar(atual.cargo)}`,
          texto: `${contato.nome} mudou de cargo em ${atual.empresa}: de ${texto(antes.cargo)} para ${atual.cargo}`,
          evidencia: `${contato.nome}: antes ${anterior}; agora ${atual.cargo} em ${atual.empresa}${atual.desde ? ` desde ${atual.desde}` : ''}. Visto em ${dataCurta(quando)} (LinkedIn). ${perfil}`,
          fonte: 'LinkedIn', quando
        }));
      }
    }
    return saida;
  },

  retratos(_ator: string, itens: unknown[], conta: ContaDoPedido): Retrato[] {
    const saida: Retrato[] = [];
    for (const bruto of itens) {
      const item = objeto(bruto);
      const contato = contatoDoItem(item, conta.contatos ?? []);
      const atual = contato ? leituraAtual(item) : null;
      if (contato && atual) saida.push({ chave: contato.id, dados: { empresa: atual.empresa, empresaId: atual.empresaId, cargo: atual.cargo, desde: atual.desde } });
    }
    return saida;
  }
};
