// Receptor de webhook da Unipile v2: a parte pura (sem rede, sem banco), fácil de testar.
//
// CONFERIDO no protótipo do dono (rodando com e-mail em conta real): assinatura `unipile-signature: t=<s>,v0=<hex>`
// (HMAC-SHA256 de "<t>.<corpo>" com o segredo que a própria Unipile gera ao criar o endpoint de webhook), envelope
// { id, type, account_id, payload }, eventos de conta (account.add / account.reconnect com `payload.state`,
// account.status.*, account.initial_sync.completed, account.remove) e e-mail (email.new com `payload.email`).
// NÃO CONFIRMADO (WhatsApp e LinkedIn ainda não foram testados lá): `message.new` e o evento de nova relação; os nomes
// dos campos ficam na leitura abaixo, e se a Unipile mandar nomes diferentes só `interpretar` muda.
//
// Regras de privacidade (migration 0014): quem não é contato do CRM é descartado sem gravar nada.
// Por isso este arquivo NUNCA registra em log o remetente nem o texto de uma mensagem.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const CABECALHO_ASSINATURA = 'unipile-signature';
const JANELA_MS = 5 * 60 * 1000;

export type Canal = 'whatsapp' | 'linkedin' | 'instagram' | 'email';
export type StatusConexao = 'connected' | 'attention' | 'disconnected';

export type EventoUnipile =
  | { tipo: 'mensagem'; conta: string; canal: Canal; remetentes: string[]; chat: string; mensagemId: string; texto: string }
  | { tipo: 'status'; conta: string; status: StatusConexao }
  | { tipo: 'relacao'; conta: string; identificadores: string[] }
  | { tipo: 'conexao'; pedidoId: string; conta: string }
  | { tipo: 'ignorar'; motivo: string };

export interface ResultadoIngestao { action: string; reason?: string; idempotent_replay?: boolean }

/** Tudo o que o receptor precisa do banco. Em produção é a API do Postgres; nos testes, uma versão falsa. */
export interface Banco {
  ingerirMensagem(p: { conta: string; canal: Canal; remetente: string; chat: string; mensagemId: string; texto: string }): Promise<ResultadoIngestao>;
  definirStatus(conta: string, status: StatusConexao): Promise<{ action: string }>;
  novaRelacao(conta: string, identificador: string): Promise<{ action: string }>;
  /** Conclui um pedido de conexão de conta (PR 05). O dono da conta vem do pedido, nunca do aviso. */
  concluirConexao(pedidoId: string, conta: string): Promise<{ action: string; reason?: string }>;
}

/** O hex que a Unipile põe em `v0`: HMAC-SHA256("<t>.<corpo>") com o segredo do endpoint. */
export const assinarCorpo = (corpoBruto: string, t: string, segredo: string): string => createHmac('sha256', segredo).update(`${t}.${corpoBruto}`).digest('hex');

/**
 * Confere a assinatura sobre o corpo BRUTO (antes de qualquer JSON.parse), em tempo constante e dentro de 5 minutos
 * (repetir um aviso antigo não vale). Sem segredo configurado, recusa tudo.
 */
export function assinaturaValida(corpoBruto: string, cabecalho: string | string[] | undefined, segredo: string, agoraMs = Date.now()): boolean {
  if (!segredo || typeof cabecalho !== 'string') return false;
  const partes = new Map<string, string>();
  for (const parte of cabecalho.split(',')) {
    const i = parte.indexOf('=');
    if (i > 0) partes.set(parte.slice(0, i).trim(), parte.slice(i + 1).trim());
  }
  const t = partes.get('t');
  const v0 = partes.get('v0');
  if (!t || !v0 || !/^\d+$/.test(t)) return false;
  if (Math.abs(agoraMs - Number(t) * 1000) > JANELA_MS) return false;
  const esperada = Buffer.from(assinarCorpo(corpoBruto, t, segredo));
  const recebida = Buffer.from(v0);
  return esperada.length === recebida.length && timingSafeEqual(esperada, recebida);
}

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const lista = (...v: unknown[]): string[] => v.map(texto).filter(Boolean);
const verdadeiro = (v: unknown): boolean => v === true || v === 1 || v === '1' || v === 'true';
const LIMITE_TEXTO = 20_000;
const SEM_TEXTO = '[mensagem sem texto]';
const objeto = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CANAL_POR_PROVEDOR: Record<string, Canal> = { whatsapp: 'whatsapp', linkedin: 'linkedin', instagram: 'instagram' };

// O banco só guarda 3 estados. Eventos passageiros não mudam nada.
const STATUS_POR_EVENTO: Record<string, StatusConexao> = {
  'account.initial_sync.completed': 'connected',
  'account.status.running': 'connected',
  'account.status.disconnected': 'attention',
  'account.status.errored': 'attention',
  'account.remove': 'disconnected'
};

const semTags = (html: string) => html.replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

/** Um evento do envelope v2 ({ id, type, account_id, payload }) vira uma ação nossa. Nunca estoura. */
export function interpretar(evento: unknown): EventoUnipile {
  const e = objeto(evento);
  if (!e) return { tipo: 'ignorar', motivo: 'payload_invalido' };
  const tipo = texto(e.type);
  const conta = texto(e.account_id);
  if (!tipo || !conta) return { tipo: 'ignorar', motivo: 'payload_incompleto' };
  const payload = objeto(e.payload) ?? {};

  if (tipo === 'account.add' || tipo === 'account.reconnect') {
    const pedidoId = texto(payload.state);
    return UUID.test(pedidoId) ? { tipo: 'conexao', pedidoId, conta } : { tipo: 'ignorar', motivo: 'conexao_sem_pedido' };
  }

  const status = STATUS_POR_EVENTO[tipo];
  if (status) return { tipo: 'status', conta, status };
  if (tipo.startsWith('account.')) return { tipo: 'ignorar', motivo: 'status_sem_efeito' };

  if (tipo === 'relation.new' || tipo === 'new_relation') {
    const identificadores = lista(payload.public_identifier, payload.profile_url, payload.provider_id, payload.user_id,
      payload.user_public_identifier, payload.user_profile_url, payload.user_provider_id);
    return identificadores.length ? { tipo: 'relacao', conta, identificadores } : { tipo: 'ignorar', motivo: 'payload_incompleto' };
  }

  if (tipo === 'email.new') {
    // O payload traz o Email dentro de `email` (alguns envelopes trazem o Email direto no payload).
    const email = objeto(payload.email) ?? (typeof payload.id === 'string' ? payload : null);
    if (!email) return { tipo: 'ignorar', motivo: 'payload_incompleto' };
    const emailId = texto(email.id);
    const de = Array.isArray(email.from) ? objeto(email.from[0]) : objeto(email.from);
    const remetente = texto(de?.email);
    if (!emailId || !remetente) return { tipo: 'ignorar', motivo: 'payload_incompleto' };
    // E-mail que o próprio titular enviou (eco do nosso envio) não é resposta de contato.
    const titular = texto(e.account_name).toLowerCase();
    if (titular && remetente.toLowerCase() === titular) return { tipo: 'ignorar', motivo: 'mensagem_propria' };
    const assunto = texto(email.subject);
    const corpo = texto(email.plain_text) || texto(email.body_plain) || semTags(texto(email.body)) || texto(email.snippet);
    const junto = [assunto, corpo].filter(Boolean).join('\n\n').slice(0, LIMITE_TEXTO) || SEM_TEXTO;
    // O id do e-mail só é único dentro da conta: prefixar evita colisão entre clientes (a coluna é única no banco inteiro).
    return { tipo: 'mensagem', conta, canal: 'email', remetentes: [remetente], chat: texto(email.thread_id) || emailId, mensagemId: `${conta}:${emailId}`, texto: junto };
  }
  if (tipo === 'email.new.bounce') return { tipo: 'ignorar', motivo: 'email_devolvido_nao_tratado' };

  if (tipo === 'message.new') {
    const canal = CANAL_POR_PROVEDOR[(texto(e.account_provider) || texto(payload.account_provider)).toLowerCase()];
    if (!canal) return { tipo: 'ignorar', motivo: 'canal_nao_suportado' };
    // Mensagem enviada pela própria pessoa (do celular, por exemplo) não é resposta de contato.
    if (verdadeiro(payload.is_sender)) return { tipo: 'ignorar', motivo: 'mensagem_propria' };
    if (verdadeiro(payload.is_event) || verdadeiro(payload.deleted)) return { tipo: 'ignorar', motivo: 'evento_sem_texto' };
    // Grupo nunca entra. Mais de 2 participantes também conta como grupo (na dúvida, descarta).
    const participantes = Array.isArray(payload.attendees) ? payload.attendees.length : 0;
    if (verdadeiro(payload.is_group) || participantes > 2) return { tipo: 'ignorar', motivo: 'grupo' };
    // No LinkedIn o CRM guarda o identificador público; nos demais, o id do provedor (telefone, @usuário).
    const remetentes = canal === 'linkedin'
      ? lista(payload.sender_public_identifier, payload.sender_profile_url, payload.sender_id, payload.sender_provider_id)
      : lista(payload.sender_id, payload.sender_provider_id);
    const mensagemId = texto(payload.id) || texto(payload.message_id);
    const chat = texto(payload.chat_id) || texto(payload.chat_provider_id);
    if (!remetentes.length || !mensagemId || !chat) return { tipo: 'ignorar', motivo: 'payload_incompleto' };
    const corpo = (texto(payload.text) || texto(payload.body)).slice(0, LIMITE_TEXTO) || SEM_TEXTO;
    return { tipo: 'mensagem', conta, canal, remetentes, chat, mensagemId: `${conta}:${mensagemId}`, texto: corpo };
  }

  return { tipo: 'ignorar', motivo: 'evento_desconhecido' };
}

/** Executa o evento no banco. Devolve só um resumo sem dado pessoal, próprio para log. */
export async function processar(evento: EventoUnipile, banco: Banco): Promise<{ tipo: string; resultado: string }> {
  switch (evento.tipo) {
    case 'ignorar':
      return { tipo: 'ignorar', resultado: evento.motivo };
    case 'status': {
      const r = await banco.definirStatus(evento.conta, evento.status);
      return { tipo: 'status', resultado: r.action };
    }
    case 'relacao': {
      let ultimo = 'ignored';
      for (const id of evento.identificadores) {
        const r = await banco.novaRelacao(evento.conta, id);
        ultimo = r.action;
        if (r.action === 'connected') break;
      }
      return { tipo: 'relacao', resultado: ultimo };
    }
    case 'conexao': {
      const r = await banco.concluirConexao(evento.pedidoId, evento.conta);
      return { tipo: 'conexao', resultado: r.reason ?? r.action };
    }
    case 'mensagem': {
      let ultimo = 'discarded';
      for (const remetente of evento.remetentes) {
        const r = await banco.ingerirMensagem({ conta: evento.conta, canal: evento.canal, remetente, chat: evento.chat, mensagemId: evento.mensagemId, texto: evento.texto });
        ultimo = r.reason ?? (r.idempotent_replay ? 'replay' : r.action);
        // Só tenta o próximo identificador quando o problema foi "não é do CRM".
        if (r.action === 'persisted' || r.reason !== 'non_crm_contact_privacy_filter') break;
      }
      return { tipo: 'mensagem', resultado: ultimo };
    }
  }
}
