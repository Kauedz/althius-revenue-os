// Servidor MCP da Althius: o único caminho do Hermes Agent até os dados (ADR 0024).
// Não recebe workspace em nenhuma ferramenta; o token do agente decide tudo no banco.
import { McpServer, fromJsonSchema, type CallToolResult } from '@modelcontextprotocol/server';
import type { FerramentasAgente, PedidoProposta } from './ferramentas';

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

  return servidor;
}
