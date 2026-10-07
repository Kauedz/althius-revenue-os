// Envio real de e-mail, WhatsApp, LinkedIn e Instagram pelo canal de mensagens (Unipile). Só roda com chave configurada:
// sem chave NÃO existe "envio simulado de sucesso".
//
// Duas versões da API (ADR 0069), escolhidas pela config (`versaoDaApi`):
//   v2 — Conferido no protótipo do dono (e-mail já enviando em conta real): POST /v2/{conta}/emails/send com
//        { to: [{ email }], subject, plain_text, custom_headers } e resposta { id, message_id }.
//        NÃO CONFIRMADO (WhatsApp ainda não foi testado lá): POST /v2/{conta}/chats/send com { users_ids, text } e o formato
//        do número `<dígitos>@s.whatsapp.net`. O nome do campo fica na constante abaixo, para corrigir em uma linha.
//        LinkedIn e Instagram: POST /v2/{conta}/chats/{chat}/messages/send com { text } (documentação; sem teste em conta real).
//   v1 — Conforme a documentação v1 (sem teste em conta real): e-mail em POST /api/v1/emails (JSON com account_id, to, subject,
//        body, custom_headers e Idempotency-Key em UUID); WhatsApp em POST /api/v1/chats (multipart: account_id, attendees_ids,
//        text); LinkedIn e Instagram em POST /api/v1/chats/{chat}/messages (multipart: account_id, text).
// Suposição de formato: número do contato só com dígitos; com 10 ou 11 dígitos entende-se número brasileiro e entra o 55.
// Limitação: número estrangeiro de 10 ou 11 dígitos (ex.: EUA) seria tratado como brasileiro; só pelos dígitos não dá para distinguir.
import { createHash } from 'node:crypto';
import { baseDaApi, versaoDaApi, type ObterConfig } from '../unipile/config.ts';
import type { Mensageiro, ResultadoEnvio } from './motor.ts';

/** não confirmado: o guia de migração da Unipile v2 diz `users_ids`; um exemplo mostra `user_ids`. */
export const CAMPO_USUARIOS_DO_CHAT = 'users_ids';

const texto = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

export function whatsappId(numero: string): string {
  const digitos = numero.replace(/\D/g, '');
  const completo = digitos.length === 10 || digitos.length === 11 ? '55' + digitos : digitos;
  return `${completo}@s.whatsapp.net`;
}

/** A v1 exige a chave de idempotência do e-mail em formato UUID: a nossa vira um UUID estável (mesma chave, mesmo UUID). */
export function uuidDaChave(chave: string): string {
  const h = createHash('sha1').update(chave).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const html = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r?\n/g, '<br>');

export function mensageiroViaApi(obterConfig: ObterConfig, buscar: typeof fetch = fetch): Mensageiro {
  const chamar = async (caminho: string, corpo: Record<string, unknown> | FormData, extras: Record<string, string> = {}): Promise<ResultadoEnvio> => {
    // A chave é lida AGORA: trocar a chave vale no próximo envio, sem reiniciar nada.
    const cfg = await obterConfig();
    if (!cfg.apiKey) return { ok: false, erro: 'sem chave do canal de mensagens', definitivo: true };
    const prefixo = versaoDaApi(cfg) === 'v1' ? '/api/v1' : '/v2';
    const ehForm = typeof FormData !== 'undefined' && corpo instanceof FormData;
    let r: Response;
    try {
      r = await buscar(`${baseDaApi(cfg)}${prefixo}${caminho}`, {
        method: 'POST',
        // Com FormData o fetch põe o Content-Type (com o limite do multipart) sozinho.
        headers: { 'X-API-KEY': cfg.apiKey, Accept: 'application/json', ...(ehForm ? {} : { 'Content-Type': 'application/json' }), ...extras },
        body: ehForm ? (corpo as FormData) : JSON.stringify(corpo)
      });
    } catch (e) {
      return { ok: false, erro: e instanceof Error ? e.message : 'rede', definitivo: false };
    }
    if (r.ok) {
      const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      return { ok: true, mensagemId: texto(d.message_id) ?? texto(d.provider_id) ?? texto(d.tracking_id) ?? texto(d.id), chatId: texto(d.chat_id) ?? texto(d.thread_id) };
    }
    // 4xx: o provedor recusou, nada saiu. 5xx e o resto: não sabemos.
    return { ok: false, erro: `HTTP ${r.status}`, definitivo: r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429 };
  };
  const form = (campos: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(campos)) f.append(k, v); return f; };

  return {
    enviar: async p => {
      const cfg = await obterConfig();
      const v1 = versaoDaApi(cfg) === 'v1';
      const conta = `/${encodeURIComponent(p.contaExterna)}`;
      if (p.canal === 'email') {
        // Cabeçalho próprio liga o e-mail enviado ao envio no nosso banco (o eco volta pelo webhook).
        if (v1) {
          return chamar('/emails', {
            account_id: p.contaExterna, to: [{ identifier: p.destinatario }], subject: p.assunto ?? '', body: html(p.texto),
            custom_headers: [{ name: 'X-Althius-Envio', value: p.chaveIdempotencia }]
          }, { 'Idempotency-Key': uuidDaChave(p.chaveIdempotencia) });
        }
        return chamar(`${conta}/emails/send`, {
          to: [{ email: p.destinatario }], subject: p.assunto ?? '', plain_text: p.texto,
          custom_headers: [{ name: 'X-Althius-Envio', value: p.chaveIdempotencia }]
        });
      }
      // LinkedIn e Instagram (ADR 0069): responde dentro do chat que já existe, sem criar conversa nova (sem convite nem InMail).
      if (p.canal === 'linkedin' || p.canal === 'instagram') {
        if (!p.chatId) return { ok: false, erro: 'conversa sem chat no canal', definitivo: true };
        if (v1) return chamar(`/chats/${encodeURIComponent(p.chatId)}/messages`, form({ account_id: p.contaExterna, text: p.texto }));
        return chamar(`${conta}/chats/${encodeURIComponent(p.chatId)}/messages/send`, { text: p.texto });
      }
      if (v1) return chamar('/chats', form({ account_id: p.contaExterna, attendees_ids: whatsappId(p.destinatario), text: p.texto }));
      return chamar(`${conta}/chats/send`, { [CAMPO_USUARIOS_DO_CHAT]: [whatsappId(p.destinatario)], text: p.texto });
    }
  };
}
