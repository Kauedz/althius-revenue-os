// Receptor de webhook da Unipile: a parte pura (sem rede, sem banco), fácil de testar.
//
// ATENÇÃO, NÃO VERIFICADO: o formato dos payloads abaixo veio de memória da documentação da Unipile,
// não da documentação oficial (o site estava bloqueado na rede onde isto foi escrito). Toda a leitura do
// payload está em `interpretar`. Se a Unipile mandar nomes diferentes, é SÓ esta função que muda.
// Confira com um webhook de teste real antes de ligar em produção.
//
// Regras de privacidade (migration 0014): quem não é contato do CRM é descartado sem gravar nada.
// Por isso este arquivo NUNCA registra em log o remetente nem o texto de uma mensagem.
import { createHash, timingSafeEqual } from 'node:crypto';

export const CABECALHO_AUTH = 'unipile-auth';

export type Canal = 'whatsapp' | 'linkedin' | 'instagram' | 'email';
export type StatusConexao = 'connected' | 'attention' | 'disconnected';

export type EventoUnipile =
  | { tipo: 'mensagem'; conta: string; canal: Canal; remetentes: string[]; chat: string; mensagemId: string; texto: string }
  | { tipo: 'status'; conta: string; status: StatusConexao }
  | { tipo: 'relacao'; conta: string; identificadores: string[] }
  | { tipo: 'ignorar'; motivo: string };

export interface ResultadoIngestao { action: string; reason?: string; idempotent_replay?: boolean }

/** Tudo o que o receptor precisa do banco. Em produção é a API do Postgres; nos testes, uma versão falsa. */
export interface Banco {
  ingerirMensagem(p: { conta: string; canal: Canal; remetente: string; chat: string; mensagemId: string; texto: string }): Promise<ResultadoIngestao>;
  definirStatus(conta: string, status: StatusConexao): Promise<{ action: string }>;
  novaRelacao(conta: string, identificador: string): Promise<{ action: string }>;
}

/** Compara o cabeçalho com o segredo em tempo constante. Sem segredo configurado, recusa tudo. */
export function autenticado(recebido: string | string[] | undefined, segredo: string): boolean {
  if (!segredo || typeof recebido !== 'string') return false;
  // Comparar os hashes (tamanho fixo) evita vazar o tamanho do segredo e o erro do timingSafeEqual.
  const a = createHash('sha256').update(recebido).digest();
  const b = createHash('sha256').update(segredo).digest();
  return timingSafeEqual(a, b);
}

const texto = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const lista = (...v: unknown[]): string[] => v.map(texto).filter(Boolean);
const verdadeiro = (v: unknown): boolean => v === true || v === 1 || v === '1' || v === 'true';
const LIMITE_TEXTO = 20_000;
const SEM_TEXTO = '[mensagem sem texto]';

const CANAL_POR_TIPO_DE_CONTA: Record<string, Canal> = {
  whatsapp: 'whatsapp', linkedin: 'linkedin', instagram: 'instagram',
  google: 'email', gmail: 'email', google_oauth: 'email', microsoft: 'email', outlook: 'email', mail: 'email', imap: 'email'
};

// O banco só guarda 3 estados. "CONNECTING" e afins são passageiros: não mudam nada.
const STATUS_POR_MENSAGEM: Record<string, StatusConexao | undefined> = {
  OK: 'connected', SYNC_SUCCESS: 'connected', RECONNECTED: 'connected', CREATION_SUCCESS: 'connected',
  CREDENTIALS: 'attention', ERROR: 'attention',
  STOPPED: 'disconnected', DELETED: 'disconnected'
};

const objeto = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

export function interpretar(payload: unknown): EventoUnipile {
  const p = objeto(payload);
  if (!p) return { tipo: 'ignorar', motivo: 'payload_invalido' };

  // Status da conta: pode vir embrulhado em AccountStatus.
  const st = objeto(p.AccountStatus) ?? (p.event === 'account_status' ? p : null);
  if (st) {
    const conta = texto(st.account_id);
    const status = STATUS_POR_MENSAGEM[texto(st.message).toUpperCase()];
    if (!conta) return { tipo: 'ignorar', motivo: 'payload_incompleto' };
    return status ? { tipo: 'status', conta, status } : { tipo: 'ignorar', motivo: 'status_sem_efeito' };
  }

  const conta = texto(p.account_id);
  if (!conta) return { tipo: 'ignorar', motivo: 'payload_incompleto' };

  if (p.event === 'new_relation') {
    const identificadores = lista(p.user_public_identifier, p.user_profile_url, p.user_provider_id);
    return identificadores.length ? { tipo: 'relacao', conta, identificadores } : { tipo: 'ignorar', motivo: 'payload_incompleto' };
  }

  if (p.event === 'message_received') {
    const canal = CANAL_POR_TIPO_DE_CONTA[texto(p.account_type).toLowerCase()];
    if (!canal || canal === 'email') return { tipo: 'ignorar', motivo: 'canal_nao_suportado' };
    // Mensagem enviada pela própria pessoa (do celular, por exemplo) não é resposta de contato.
    if (verdadeiro(p.is_sender)) return { tipo: 'ignorar', motivo: 'mensagem_propria' };
    // Grupo nunca entra. Mais de 2 participantes também conta como grupo (na dúvida, descarta).
    const participantes = Array.isArray(p.attendees) ? p.attendees.length : 0;
    if (verdadeiro(p.is_group) || participantes > 2) return { tipo: 'ignorar', motivo: 'grupo' };
    const s = objeto(p.sender) ?? {};
    // No LinkedIn o CRM guarda o identificador público; nos demais, o id do provedor (telefone, @usuário).
    const remetentes = canal === 'linkedin'
      ? lista(s.attendee_public_identifier, s.attendee_profile_url, s.attendee_provider_id)
      : lista(s.attendee_provider_id, s.attendee_public_identifier);
    const mensagemId = texto(p.message_id);
    const chat = texto(p.chat_id);
    if (!remetentes.length || !mensagemId || !chat) return { tipo: 'ignorar', motivo: 'payload_incompleto' };
    const corpo = texto(p.message).slice(0, LIMITE_TEXTO) || SEM_TEXTO;
    // O id da mensagem só é único dentro da conta: prefixar evita colisão entre clientes (a coluna é única no banco inteiro).
    return { tipo: 'mensagem', conta, canal, remetentes, chat, mensagemId: `${conta}:${mensagemId}`, texto: corpo };
  }

  if (p.event === 'mail_received') {
    // E-mail que não está na caixa de entrada (enviados, rascunhos, lixo) não é resposta.
    const pastas = Array.isArray(p.folders) ? p.folders.map(texto) : null;
    if (pastas && !pastas.includes('INBOX')) return { tipo: 'ignorar', motivo: 'email_fora_da_caixa_de_entrada' };
    const de = objeto(p.from_attendee) ?? {};
    const remetentes = lista(de.identifier);
    const emailId = texto(p.email_id);
    if (!remetentes.length || !emailId) return { tipo: 'ignorar', motivo: 'payload_incompleto' };
    const assunto = texto(p.subject);
    const corpo = texto(p.body_plain) || texto(p.body);
    const junto = [assunto, corpo].filter(Boolean).join('\n\n').slice(0, LIMITE_TEXTO) || SEM_TEXTO;
    return { tipo: 'mensagem', conta, canal: 'email', remetentes, chat: texto(p.thread_id) || emailId, mensagemId: `${conta}:${emailId}`, texto: junto };
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
