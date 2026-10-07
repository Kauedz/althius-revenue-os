// Respostas escritas na Caixa de entrada (ADR 0068). Saem pelo MESMO caminho do envio da cadência: o banco já conferiu
// a política e reservou os créditos (inbox_reply); aqui se pega (inbox_reply_claim), envia pelo mesmo mensageiro e
// conclui (inbox_reply_finish). Mesma garantia do motor: no máximo um envio por resposta; se o resultado for incerto,
// não se reenvia nem se conclui: fica "enviando" para uma pessoa conferir. O log nunca leva destinatário nem texto.
import type { CanalResposta, Mensageiro } from './motor.ts';

export interface RespostaParaEnviar {
  id: string;
  execution_id: string;
  channel: CanalResposta;
  recipient: string;
  /** id do chat que já existe na Unipile (LinkedIn e Instagram respondem dentro dele) */
  chat_id?: string | null;
  subject: string | null;
  body: string;
  unipile_account_id: string;
  idempotency_key: string;
}

export interface BancoRespostas {
  pegar(limite: number): Promise<RespostaParaEnviar[]>;
  concluir(id: string, ok: boolean, mensagemId: string | null, erro: string | null, chatId: string | null): Promise<{ acao: string }>;
}

export interface ResumoRespostas { vistas: number; enviadas: number; falhas: number; incertas: number }

export async function rodarRespostas(d: { banco: BancoRespostas; mensageiro: Mensageiro | null; limite?: number; log?: (l: Record<string, unknown>) => void }): Promise<ResumoRespostas> {
  const log = d.log ?? (l => console.log(JSON.stringify(l)));
  const r: ResumoRespostas = { vistas: 0, enviadas: 0, falhas: 0, incertas: 0 };
  // Sem chave do canal de mensagens, as respostas esperam reservadas (nada de envio simulado).
  if (!d.mensageiro) return r;
  const fila = await d.banco.pegar(d.limite ?? 20);
  r.vistas = fila.length;
  for (const x of fila) {
    let envio;
    try {
      envio = await d.mensageiro.enviar({
        contaExterna: x.unipile_account_id, canal: x.channel, destinatario: x.recipient, assunto: x.subject, texto: x.body, chaveIdempotencia: x.idempotency_key, chatId: x.chat_id ?? null
      });
    } catch (e) {
      envio = { ok: false as const, erro: e instanceof Error ? e.message : 'erro', definitivo: false };
    }
    if (envio.ok) {
      try {
        await d.banco.concluir(x.id, true, envio.mensagemId, null, envio.chatId);
        r.enviadas++;
      } catch (e) {
        r.incertas++;
        log({ nivel: 'erro', msg: 'resposta_enviada_sem_registro', resposta: x.id, erro: e instanceof Error ? e.message : 'erro' });
      }
      continue;
    }
    if (envio.definitivo) {
      await d.banco.concluir(x.id, false, null, envio.erro, null).catch(() => undefined);
      r.falhas++;
      log({ nivel: 'aviso', msg: 'resposta_recusada', resposta: x.id, erro: envio.erro });
      continue;
    }
    r.incertas++;
    log({ nivel: 'erro', msg: 'resposta_incerta_conferir', resposta: x.id, execucao: x.execution_id, erro: envio.erro });
  }
  return r;
}
