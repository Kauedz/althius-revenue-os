// Envio real de e-mail e WhatsApp pelo canal de mensagens (Unipile v2). Só roda com chave configurada: sem chave NÃO
// existe "envio simulado de sucesso".
//
// Conferido no protótipo do dono (e-mail já enviando em conta real): POST /v2/{conta}/emails/send com
// { to: [{ email }], subject, plain_text, custom_headers } e resposta { id, message_id }.
// NÃO CONFIRMADO (WhatsApp ainda não foi testado lá): POST /v2/{conta}/chats/send com { users_ids, text } e o formato
// do número `<dígitos>@s.whatsapp.net`. O nome do campo fica na constante abaixo, para corrigir em uma linha.
// Suposição de formato: número do contato só com dígitos; com 10 ou 11 dígitos entende-se número brasileiro e entra o 55.
// Limitação: número estrangeiro de 10 ou 11 dígitos (ex.: EUA) seria tratado como brasileiro; só pelos dígitos não dá para distinguir.
import type { ObterConfig } from '../unipile/config.ts';
import type { Mensageiro, ResultadoEnvio } from './motor.ts';

/** não confirmado: o guia de migração da Unipile v2 diz `users_ids`; um exemplo mostra `user_ids`. */
export const CAMPO_USUARIOS_DO_CHAT = 'users_ids';

const texto = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

export function whatsappId(numero: string): string {
  const digitos = numero.replace(/\D/g, '');
  const completo = digitos.length === 10 || digitos.length === 11 ? '55' + digitos : digitos;
  return `${completo}@s.whatsapp.net`;
}

export function mensageiroViaApi(obterConfig: ObterConfig, buscar: typeof fetch = fetch): Mensageiro {
  const chamar = async (caminho: string, corpo: Record<string, unknown>): Promise<ResultadoEnvio> => {
    // A chave é lida AGORA: trocar a chave vale no próximo envio, sem reiniciar nada.
    const cfg = await obterConfig();
    if (!cfg.apiKey) return { ok: false, erro: 'sem chave do canal de mensagens', definitivo: true };
    let r: Response;
    try {
      r = await buscar(`${cfg.url}${caminho}`, {
        method: 'POST',
        headers: { 'X-API-KEY': cfg.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(corpo)
      });
    } catch (e) {
      return { ok: false, erro: e instanceof Error ? e.message : 'rede', definitivo: false };
    }
    if (r.ok) {
      const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      return { ok: true, mensagemId: texto(d.message_id) ?? texto(d.id), chatId: texto(d.chat_id) ?? texto(d.thread_id) };
    }
    // 4xx: o provedor recusou, nada saiu. 5xx e o resto: não sabemos.
    return { ok: false, erro: `HTTP ${r.status}`, definitivo: r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429 };
  };
  const conta = (p: { contaExterna: string }) => `/v2/${encodeURIComponent(p.contaExterna)}`;
  return {
    enviar: p => {
      if (p.canal === 'email') {
        // Cabeçalho próprio liga o e-mail enviado ao envio no nosso banco (o eco volta pelo webhook).
        return chamar(`${conta(p)}/emails/send`, {
          to: [{ email: p.destinatario }], subject: p.assunto ?? '', plain_text: p.texto,
          custom_headers: [{ name: 'X-Althius-Envio', value: p.chaveIdempotencia }]
        });
      }
      return chamar(`${conta(p)}/chats/send`, { [CAMPO_USUARIOS_DO_CHAT]: [whatsappId(p.destinatario)], text: p.texto });
    }
  };
}
