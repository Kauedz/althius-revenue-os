// Envio real de e-mail e WhatsApp pelo provedor de mensagens. Só roda com chave configurada: sem chave NÃO existe
// "envio simulado de sucesso" (o provedor antigo em providers/ devolvia sucesso falso; este não).
//
// NÃO VERIFICADO na documentação oficial (site bloqueado ao escrever): rotas, campos e formato do identificador do
// WhatsApp abaixo vêm do roteiro do projeto e de memória. Confira com uma conta de teste antes de usar com cliente.
// Suposição de formato: número do contato só com dígitos; com 10 ou 11 dígitos entende-se número brasileiro e entra o 55.
// Limitação: número estrangeiro de 10 ou 11 dígitos (ex.: EUA) seria tratado como brasileiro; só pelos dígitos não dá para distinguir.
import type { Mensageiro, ResultadoEnvio } from './motor.ts';

export interface ConfigEnvio { dsn: string; apiKey: string }

const texto = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

export function whatsappId(numero: string): string {
  const digitos = numero.replace(/\D/g, '');
  const completo = digitos.length === 10 || digitos.length === 11 ? '55' + digitos : digitos;
  return `${completo}@s.whatsapp.net`;
}

export function mensageiroViaApi(cfg: ConfigEnvio, buscar: typeof fetch = fetch): Mensageiro {
  const base = cfg.dsn.replace(/\/$/, '');
  const chamar = async (caminho: string, corpo: Record<string, unknown>): Promise<ResultadoEnvio> => {
    let r: Response;
    try {
      r = await buscar(`${base}${caminho}`, {
        method: 'POST',
        headers: { 'X-API-KEY': cfg.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(corpo)
      });
    } catch (e) {
      return { ok: false, erro: e instanceof Error ? e.message : 'rede', definitivo: false };
    }
    if (r.ok) {
      const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      return { ok: true, mensagemId: texto(d.message_id) ?? texto(d.tracking_id) ?? texto(d.id), chatId: texto(d.chat_id) ?? texto(d.thread_id) };
    }
    // 4xx: o provedor recusou, nada saiu. 5xx e o resto: não sabemos.
    return { ok: false, erro: `HTTP ${r.status}`, definitivo: r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429 };
  };
  return {
    enviar: p => {
      if (p.canal === 'email') {
        return chamar('/api/v1/emails', { account_id: p.contaExterna, to: [{ identifier: p.destinatario }], subject: p.assunto ?? '', body: p.texto });
      }
      return chamar('/api/v1/chats', { account_id: p.contaExterna, attendees_ids: [whatsappId(p.destinatario)], text: p.texto });
    }
  };
}
