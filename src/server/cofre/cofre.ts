// Leitor do cofre (ADR 0049): pede ao banco as chaves ativas (cifradas) com a chave de serviço, decifra com a chave
// mestra e guarda o resultado por 30s. Se o banco falhar, usa o que já tinha; sem nada, erro claro. Nunca inventa chave.
import { decifrar } from './cifra.ts';

export type Provedor = 'apify' | 'unipile' | 'unipile_webhook' | 'modelo_ia' | 'integracao_app';
export interface SegredoLido { id: string; rotulo: string; segredo: string; config: Record<string, unknown> }

export interface Cofre {
  ler(provedor: Provedor): Promise<SegredoLido[]>;
  /** anota o uso (e o erro, se houve) para a tela mostrar; falha aqui nunca derruba quem chamou */
  marcarUso(id: string, erro?: string | null): Promise<void>;
  /** esquece o que guardou em memória (a tela acabou de trocar uma chave) */
  invalidar(): void;
}

export interface OpcoesCofre {
  base: string;
  chaveServico: string;
  chave: Buffer;
  buscar?: typeof fetch;
  agora?: () => number;
  ttlMs?: number;
}

export function cofreViaApi(o: OpcoesCofre): Cofre {
  const buscar = o.buscar ?? fetch;
  const agora = o.agora ?? Date.now;
  const ttl = o.ttlMs ?? 30_000;
  const memoria = new Map<Provedor, { em: number; itens: SegredoLido[] }>();
  const chamar = (funcao: string, corpo: Record<string, unknown>) => buscar(`${o.base.replace(/\/$/, '')}/rpc/${funcao}`, {
    method: 'POST',
    headers: { apikey: o.chaveServico, Authorization: `Bearer ${o.chaveServico}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo)
  });

  return {
    async ler(provedor) {
      const guardado = memoria.get(provedor);
      if (guardado && agora() - guardado.em < ttl) return guardado.itens;
      let r: Response;
      try { r = await chamar('cofre_ler', { p_provedor: provedor }); } catch { r = new Response(null, { status: 599 }); }
      if (!r.ok) {
        if (guardado) return guardado.itens;
        throw new Error(`não foi possível ler o cofre (${provedor})`);
      }
      const linhas = (await r.json()) as Array<{ id: string; rotulo: string; cifrado: string; config: Record<string, unknown> }>;
      const itens: SegredoLido[] = [];
      for (const l of linhas) {
        try { itens.push({ id: l.id, rotulo: l.rotulo, segredo: decifrar(l.cifrado, o.chave), config: l.config ?? {} }); } catch { /* chave que não decifra é pulada */ }
      }
      memoria.set(provedor, { em: agora(), itens });
      return itens;
    },
    async marcarUso(id, erro) {
      try { await chamar('cofre_marcar_uso', { p_id: id, p_erro: erro ?? null }); } catch { /* anotação é opcional */ }
    },
    invalidar() { memoria.clear(); }
  };
}
