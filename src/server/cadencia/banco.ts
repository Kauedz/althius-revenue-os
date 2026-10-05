// Ponte entre o motor e o Postgres, pela API do banco (PostgREST) com a chave de serviço (só existe no contêiner).
import type { BancoCadencia, Preparo, Vencido } from './motor.ts';

export function bancoCadenciaViaApi(base: string, chaveServico: string, buscar: typeof fetch = fetch): BancoCadencia {
  const chamar = async <T>(funcao: string, args: Record<string, unknown>): Promise<T> => {
    const r = await buscar(`${base.replace(/\/$/, '')}/rpc/${funcao}`, {
      method: 'POST',
      headers: { apikey: chaveServico, Authorization: `Bearer ${chaveServico}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
    if (!r.ok) throw new Error(`banco recusou ${funcao}: HTTP ${r.status}`);
    return (await r.json()) as T;
  };
  return {
    buscarVencidos: (limite, incluirAuto) => chamar<Vencido[]>('cadence_claim_due', { p_limit: limite, p_include_auto: incluirAuto }),
    preparar: (inscricaoId, passo) => chamar<Preparo>('cadence_prepare_step', { p_enrollment_id: inscricaoId, p_step_number: passo }),
    concluir: (execucaoId, ok, mensagemId, erro, chatId) => chamar('cadence_finish_step', {
      p_execution_id: execucaoId, p_ok: ok, p_external_message_id: mensagemId, p_error: erro, p_external_chat_id: chatId
    })
  };
}
