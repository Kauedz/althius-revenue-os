// Motor de cadência (worker). Desenho próprio: nada copiado do Twenty (AGPL), ADR 0038.
// Quem DECIDE (política Hermes, créditos, agente pausado, idempotência) é o banco (migration 0100).
// Este arquivo só repete o ciclo: buscar o que venceu -> preparar -> enviar -> concluir.
//
// Garantia: no máximo UM envio por inscrição+passo. Se o resultado do envio for incerto (rede caiu, 5xx),
// a execução fica "running" e NÃO se reenvia sozinho: vira alerta no log para uma pessoa conferir.

export type Canal = 'email' | 'whatsapp';
/** Respostas da Caixa (ADR 0069): além de e-mail e WhatsApp, LinkedIn e Instagram, sempre DENTRO da conversa que já existe. */
export type CanalResposta = Canal | 'linkedin' | 'instagram';

export interface Vencido { enrollment_id: string; step_number: number }

export type Preparo =
  | { action: 'send'; execution_id: string; channel: Canal; recipient: string; subject: string | null; body: string | null; unipile_account_id: string; idempotency_key: string }
  | { action: 'task_created'; task_id: string }
  | { action: 'blocked'; reason: string }
  | { action: 'skip'; reason: string }
  | { action: 'in_flight' };

export interface BancoCadencia {
  buscarVencidos(limite: number, incluirAuto: boolean): Promise<Vencido[]>;
  preparar(inscricaoId: string, passo: number): Promise<Preparo>;
  concluir(execucaoId: string, ok: boolean, mensagemId: string | null, erro: string | null, chatId: string | null): Promise<{ action: string }>;
}

export type ResultadoEnvio =
  | { ok: true; mensagemId: string | null; chatId: string | null }
  /** definitivo = o provedor recusou (4xx): nada foi enviado. Não definitivo = não sabemos se saiu. */
  | { ok: false; erro: string; definitivo: boolean };

export interface Mensageiro {
  enviar(p: { contaExterna: string; canal: CanalResposta; destinatario: string; assunto: string | null; texto: string; chaveIdempotencia: string; chatId?: string | null }): Promise<ResultadoEnvio>;
}

export interface Resumo { vistos: number; enviados: number; tarefas: number; bloqueados: number; falhas: number; incertos: number; erros: number }

export interface DepsCiclo {
  banco: BancoCadencia;
  /** null = sem provedor de envio configurado: o worker só cuida dos passos que viram tarefa */
  mensageiro: Mensageiro | null;
  limite?: number;
  /** linha de log (JSON). Nunca recebe destinatário nem texto da mensagem. */
  log?: (linha: Record<string, unknown>) => void;
}

export async function rodarCiclo(d: DepsCiclo): Promise<Resumo> {
  const log = d.log ?? (l => console.log(JSON.stringify(l)));
  const r: Resumo = { vistos: 0, enviados: 0, tarefas: 0, bloqueados: 0, falhas: 0, incertos: 0, erros: 0 };
  const vencidos = await d.banco.buscarVencidos(d.limite ?? 20, d.mensageiro !== null);
  r.vistos = vencidos.length;

  for (const v of vencidos) {
    try {
      const preparo = await d.banco.preparar(v.enrollment_id, v.step_number);
      if (preparo.action === 'task_created') { r.tarefas++; log({ nivel: 'info', msg: 'cadencia_tarefa', inscricao: v.enrollment_id, passo: v.step_number }); continue; }
      if (preparo.action === 'blocked') { r.bloqueados++; log({ nivel: 'info', msg: 'cadencia_bloqueada', inscricao: v.enrollment_id, passo: v.step_number, motivo: preparo.reason }); continue; }
      if (preparo.action !== 'send') continue;

      // Chegou aqui com créditos reservados e execução "running". Sem mensageiro isso não deveria acontecer (incluirAuto=false).
      if (!d.mensageiro) { r.erros++; log({ nivel: 'erro', msg: 'cadencia_sem_mensageiro', execucao: preparo.execution_id }); continue; }

      let envio: ResultadoEnvio;
      try {
        envio = await d.mensageiro.enviar({
          contaExterna: preparo.unipile_account_id, canal: preparo.channel, destinatario: preparo.recipient,
          assunto: preparo.subject, texto: preparo.body ?? '', chaveIdempotencia: preparo.idempotency_key
        });
      } catch (e) {
        envio = { ok: false, erro: e instanceof Error ? e.message : 'erro', definitivo: false };
      }

      if (envio.ok) {
        try {
          await d.banco.concluir(preparo.execution_id, true, envio.mensagemId, null, envio.chatId);
          r.enviados++;
          log({ nivel: 'info', msg: 'cadencia_enviada', execucao: preparo.execution_id });
        } catch (e) {
          // A mensagem SAIU, mas o registro falhou. Não reenviar: a execução fica "running" para conferência.
          r.erros++;
          log({ nivel: 'erro', msg: 'cadencia_enviada_sem_registro', execucao: preparo.execution_id, erro: e instanceof Error ? e.message : 'erro' });
        }
      } else if (envio.definitivo) {
        await d.banco.concluir(preparo.execution_id, false, null, envio.erro, null);
        r.falhas++;
        log({ nivel: 'aviso', msg: 'cadencia_envio_recusado', execucao: preparo.execution_id, erro: envio.erro });
      } else {
        r.incertos++;
        log({ nivel: 'erro', msg: 'cadencia_envio_incerto', execucao: preparo.execution_id, erro: envio.erro });
      }
    } catch (e) {
      r.erros++;
      log({ nivel: 'erro', msg: 'cadencia_falha_no_passo', inscricao: v.enrollment_id, passo: v.step_number, erro: e instanceof Error ? e.message : 'erro' });
    }
  }
  return r;
}
