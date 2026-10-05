// Ponte entre o receptor e o Postgres, pela API do banco (PostgREST) com a chave de serviço.
// A chave de serviço só existe dentro do contêiner; o front nunca a vê (AGENTS.md, regra 3).
import type { Banco, ResultadoIngestao } from './unipile.ts';

export function bancoViaApi(base: string, chaveServico: string, buscar: typeof fetch = fetch): Banco {
  const chamar = async <T>(funcao: string, args: Record<string, unknown>): Promise<T> => {
    const r = await buscar(`${base.replace(/\/$/, '')}/rpc/${funcao}`, {
      method: 'POST',
      headers: { apikey: chaveServico, Authorization: `Bearer ${chaveServico}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
    if (!r.ok) {
      const erro = (await r.json().catch(() => ({}))) as { code?: string };
      // 23505 = mensagem igual chegou ao mesmo tempo por dois caminhos: a outra venceu, é replay.
      if (erro.code === '23505') return { action: 'persisted', idempotent_replay: true } as T;
      throw new Error(`banco recusou ${funcao}: HTTP ${r.status}${erro.code ? ` (${erro.code})` : ''}`);
    }
    return (await r.json()) as T;
  };
  return {
    ingerirMensagem: p => chamar<ResultadoIngestao>('unipile_ingest_message', {
      p_unipile_account_id: p.conta, p_channel: p.canal, p_sender_identifier: p.remetente,
      p_external_chat_id: p.chat, p_external_message_id: p.mensagemId, p_text: p.texto, p_is_group: false, p_intent: 'neutra'
    }),
    definirStatus: (conta, status) => chamar('unipile_set_account_status', { p_unipile_account_id: conta, p_status: status }),
    concluirConexao: (pedidoId, conta) => chamar('unipile_complete_connection', { p_request_id: pedidoId, p_unipile_account_id: conta, p_display_name: null }),
    novaRelacao: (conta, id) => chamar('unipile_handle_new_relation', { p_unipile_account_id: conta, p_linkedin_identifier: id })
  };
}
