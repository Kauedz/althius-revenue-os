// Servidor MCP da Althius: o único caminho do Hermes Agent até os dados (ADR 0024).
// Não recebe workspace em nenhuma ferramenta; o token do agente decide tudo no banco.
import { McpServer, fromJsonSchema, type CallToolResult } from '@modelcontextprotocol/server';
import type { FerramentasAgente, NegocioAgente, PedidoInscricao, PedidoMoverNegocio, PedidoNegocio, PedidoProposta, PedidoTarefa, TarefaAgente } from './ferramentas';

const nada = fromJsonSchema<Record<string, never>>({ type: 'object', properties: {}, additionalProperties: false });

const pedidoProposta = fromJsonSchema<PedidoProposta>({
  type: 'object',
  properties: {
    contato_id: { type: 'string', description: 'id do contato, como veio em buscar_contatos' },
    campo: { type: 'string', enum: ['cargo'], description: 'campo a alterar (por enquanto só "cargo")' },
    valor: { type: 'string', description: 'novo valor proposto' },
    motivo: { type: 'string', description: 'por que a mudança faz sentido, em uma frase' }
  },
  required: ['contato_id', 'campo', 'valor', 'motivo'],
  additionalProperties: false
});

const filtroTarefas = fromJsonSchema<{ status?: TarefaAgente['status'] }>({
  type: 'object',
  properties: { status: { type: 'string', enum: ['pendente', 'em_andamento', 'concluida'], description: 'só as tarefas neste status (sem isto, todas)' } },
  additionalProperties: false
});

const pedidoTarefa = fromJsonSchema<PedidoTarefa>({
  type: 'object',
  properties: {
    titulo: { type: 'string', description: 'o que precisa ser feito, em uma frase (até 200 caracteres)' },
    responsavel_id: { type: 'string', description: 'id do membro responsável, como veio em listar_membros' },
    contato_id: { type: 'string', description: 'id do contato ligado à tarefa (opcional), como veio em buscar_contatos' },
    prazo_dias: { type: 'integer', minimum: 0, maximum: 90, description: 'em quantos dias a tarefa vence (padrão 0 = hoje)' },
    observacao: { type: 'string', description: 'detalhe extra para quem vai fazer (opcional)' },
    motivo: { type: 'string', description: 'por que esta tarefa faz sentido, em uma frase' }
  },
  required: ['titulo', 'responsavel_id', 'motivo'],
  additionalProperties: false
});

const pedidoInscricao = fromJsonSchema<PedidoInscricao>({
  type: 'object',
  properties: {
    cadencia_id: { type: 'string', description: 'id da cadência, como veio em listar_cadencias' },
    contato_id: { type: 'string', description: 'id do contato, como veio em buscar_contatos' },
    motivo: { type: 'string', description: 'por que este contato deve entrar nesta cadência, em uma frase' }
  },
  required: ['cadencia_id', 'contato_id', 'motivo'],
  additionalProperties: false
});

const filtroNegocios = fromJsonSchema<{ status?: NegocioAgente['status'] }>({
  type: 'object',
  properties: { status: { type: 'string', enum: ['ativa', 'ganho', 'perdido', 'arquivada'], description: 'só os negócios neste status (padrão: ativa)' } },
  additionalProperties: false
});

const pedidoNegocio = fromJsonSchema<PedidoNegocio>({
  type: 'object',
  properties: {
    quadro_id: { type: 'string', description: 'id do quadro, como veio em listar_quadros' },
    conta_id: { type: 'string', description: 'id da conta, como veio em listar_contas' },
    responsavel_id: { type: 'string', description: 'id do membro responsável, como veio em listar_membros' },
    valor_reais: { type: 'number', minimum: 0, description: 'valor do negócio em reais' },
    etapa: { type: 'string', description: 'etapa inicial, uma das etapas do quadro, exceto ganho (padrão: entrada)' },
    fecha_em: { type: 'string', description: 'data prevista de fechamento, AAAA-MM-DD (opcional)' },
    motivo: { type: 'string', description: 'por que este negócio faz sentido, em uma frase' }
  },
  required: ['quadro_id', 'conta_id', 'responsavel_id', 'valor_reais', 'motivo'],
  additionalProperties: false
});

const pedidoMoverNegocio = fromJsonSchema<PedidoMoverNegocio>({
  type: 'object',
  properties: {
    negocio_id: { type: 'string', description: 'id do negócio, como veio em listar_negocios' },
    etapa: { type: 'string', description: 'etapa de destino, uma das etapas do quadro do negócio' },
    motivo: { type: 'string', description: 'por que o negócio mudou de etapa, em uma frase' }
  },
  required: ['negocio_id', 'etapa', 'motivo'],
  additionalProperties: false
});

const falha = (mensagem: string): CallToolResult => ({ content: [{ type: 'text', text: mensagem }], isError: true });
const mensagemDe = (e: unknown) => (e instanceof Error ? e.message : 'Falha inesperada na Althius.');

export function criarServidorAlthius(ferramentas: FerramentasAgente): McpServer {
  const servidor = new McpServer({ name: 'althius', version: '1.0.0' }, { capabilities: { tools: {} } });

  servidor.registerTool('buscar_contatos', {
    description: 'Lista os contatos (com cargo e empresa) do cliente deste agente. Só leitura.',
    inputSchema: nada,
    annotations: { readOnlyHint: true }
  }, async () => {
    try {
      // Só texto: o Hermes repassa ao modelo tudo o que vier, e a lista em dobro estoura o limite do modelo.
      const contatos = await ferramentas.buscarContatos();
      return { content: [{ type: 'text', text: JSON.stringify(contatos) }] };
    } catch (e) {
      return falha(mensagemDe(e));
    }
  });

  servidor.registerTool('propor_atualizacao', {
    description: 'Propõe mudar um campo de um contato. NÃO altera nada: vira uma aprovação para uma pessoa decidir.',
    inputSchema: pedidoProposta,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
  }, async (pedido: PedidoProposta) => {
    try {
      const r = await ferramentas.proporAtualizacao(pedido);
      if (!r.ok) return falha(r.erro);
      return {
        content: [{ type: 'text', text: 'Proposta registrada e aguardando aprovação de uma pessoa. Nada foi alterado ainda.' }],
        structuredContent: r
      };
    } catch (e) {
      return falha(mensagemDe(e));
    }
  });

  // Leituras: devolvem só texto (o Hermes repassa tudo ao modelo).
  const leitura = (nome: string, descricao: string, inputSchema: any, ler: (a: any) => Promise<unknown>) =>
    servidor.registerTool(nome, { description: descricao, inputSchema, annotations: { readOnlyHint: true } }, async (a: any): Promise<CallToolResult> => {
      try {
        return { content: [{ type: 'text', text: JSON.stringify(await ler(a)) }] };
      } catch (e) {
        return falha(mensagemDe(e));
      }
    });
  leitura('listar_membros', 'Lista os membros ativos do cliente (id, papel e cargo). Use para escolher o responsável de uma tarefa. Só leitura.', nada, () => ferramentas.listarMembros());
  leitura('listar_tarefas', 'Lista as tarefas do cliente (até 200, por prazo). Só leitura.', filtroTarefas, a => ferramentas.listarTarefas(a?.status));
  leitura('listar_cadencias', 'Lista as cadências ativas do cliente, com número de passos e créditos que cada contato pode gastar. Só leitura.', nada, () => ferramentas.listarCadencias());

  leitura('listar_contas', 'Lista as contas (empresas) do cliente, com id, domínio e responsável (até 500). Só leitura.', nada, () => ferramentas.listarContas());
  leitura('listar_quadros', 'Lista os quadros do pipeline do cliente, com as etapas de cada um. Só leitura.', nada, () => ferramentas.listarQuadros());
  leitura('listar_negocios', 'Lista os negócios do pipeline (até 200, mais novos primeiro), com etapa, valor em reais e chance. Só leitura.', filtroNegocios, a => ferramentas.listarNegocios(a?.status));

  // Propostas: nunca alteram nada. Viram aprovação; gasto só o C-level aprova.
  const proposta = (nome: string, descricao: string, inputSchema: any, propor: (a: any) => Promise<import('./ferramentas').ResultadoProposta>, aviso: string) =>
    servidor.registerTool(nome, { description: descricao, inputSchema, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true } }, async (a: any): Promise<CallToolResult> => {
      try {
        const r = await propor(a);
        if (!r.ok) return falha(r.erro);
        return { content: [{ type: 'text', text: aviso }], structuredContent: r };
      } catch (e) {
        return falha(mensagemDe(e));
      }
    });
  proposta('propor_tarefa', 'Propõe criar uma tarefa para um membro. NÃO cria nada: vira uma aprovação para uma pessoa decidir.', pedidoTarefa,
    a => ferramentas.proporTarefa(a), 'Proposta de tarefa registrada e aguardando aprovação de uma pessoa. Nenhuma tarefa foi criada ainda.');
  proposta('propor_inscricao_cadencia', 'Propõe inscrever um contato numa cadência. NÃO inscreve ninguém: vira uma aprovação. Cadência com envio automático gasta créditos, e só o C-level aprova gasto.', pedidoInscricao,
    a => ferramentas.proporInscricao(a), 'Proposta de inscrição registrada e aguardando aprovação de uma pessoa. Ninguém foi inscrito ainda.');

  proposta('propor_negocio', 'Propõe criar um negócio no pipeline. NÃO cria nada: vira uma aprovação para uma pessoa decidir.', pedidoNegocio,
    a => ferramentas.proporNegocio(a), 'Proposta de negócio registrada e aguardando aprovação de uma pessoa. Nenhum negócio foi criado ainda.');
  proposta('propor_mover_negocio', 'Propõe mudar um negócio de etapa. NÃO move nada: vira uma aprovação para uma pessoa decidir.', pedidoMoverNegocio,
    a => ferramentas.proporMoverNegocio(a), 'Proposta de mudança de etapa registrada e aguardando aprovação de uma pessoa. O negócio não mudou ainda.');

  return servidor;
}
