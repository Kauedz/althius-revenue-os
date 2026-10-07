// Os perfis de conexão: um por conector do catálogo, como DADOS. Dizem onde fica o servidor MCP oficial, como o cliente
// OAuth é obtido e como a conta e o portal são identificados. Um conector sem perfil "disponivel" aparece "Em breve"
// com o MOTIVO (nunca finge conectar; ADR 0054). A pesquisa de cada um está em docs/integracoes/servidores-mcp.md.
// Para liberar um conector: dar a ele um perfil `disponivel` com `mcp` e passar no teste com o servidor falso e numa
// conexão real (um PR por conector).

export interface PerfilMcp {
  url: string;
  /** `automatico`: a Althius se registra sozinha no servidor (RFC 7591). `app_registrado`: o app é criado à mão no fornecedor. */
  registro: 'automatico' | 'app_registrado';
  escopos?: string[];
  /** Endereços explícitos, quando o servidor não publica o metadado de autorização. */
  autorizacao?: string;
  token?: string;
  /** Manda o parâmetro `resource` (RFC 8707) no consentimento e na troca, como o MCP pede. */
  enviarRecurso: boolean;
}

export type CanalUnipile = 'whatsapp' | 'google' | 'microsoft' | 'instagram' | 'linkedin';

/** Uma chamada HTTP que descobre a conta e o portal com o token recém-obtido. `{credencial}` vira o token (codificado no endereço). */
export interface RequisicaoDeIdentificacao {
  metodo: 'GET' | 'POST';
  url: string;
  cabecalhos?: Record<string, string>;
  /** Caminhos alternativos no JSON da resposta; vale o primeiro que existir. */
  portal?: string[];
  conta?: string[];
}

/** Como descobrir a conta do app (o cartão mostra "Conta: ...") e o portal (o primeiro acesso o fixa no workspace). */
export interface Identificacao {
  /** Campos da própria resposta do endpoint de token. */
  daRespostaDoToken?: { portal?: string[]; conta?: string[] };
  /** Chamadas à API do app, tentadas em ordem; a primeira que responde 2xx com o dado vale. */
  requisicoes?: RequisicaoDeIdentificacao[];
  /** Por último, uma ferramenta do servidor MCP (o resultado é lido como JSON). */
  porFerramentaMcp?: { ferramenta: string; argumentos?: Record<string, unknown>; portal?: string[]; conta?: string[] };
}

export interface PerfilDeIntegracao {
  id: string;
  nome: string;
  situacao: 'disponivel' | 'em_breve';
  /** Por que ainda é "Em breve" (texto para a pessoa). */
  motivo?: string;
  /** O primeiro acesso fixa o portal do workspace (ex.: o portal do HubSpot). */
  portalFixo: boolean;
  /** `mcp` (padrão): OAuth no servidor MCP oficial. `mensagens`: conta de mensagem conectada pelo assistente hospedado da Unipile (o mesmo canal da Caixa de entrada, sem outro conector). */
  via?: 'mcp' | 'mensagens';
  /** Só `via: 'mensagens'`: o provedor da conta de mensagem. */
  canal?: CanalUnipile;
  mcp?: PerfilMcp;
  identificacao?: Identificacao;
}


const emBreve = (id: string, nome: string, motivo: string): PerfilDeIntegracao => ({ id, nome, situacao: 'em_breve', motivo, portalFixo: false });
// Canais de mensagem: o cartão do catálogo conecta pela Unipile (a conta é da PESSOA; a permissão é a da Caixa, `inbox.connect`).
const canal = (id: string, nome: string, canal: CanalUnipile): PerfilDeIntegracao => ({ id, nome, situacao: 'disponivel', via: 'mensagens', canal, portalFixo: false });

export const PERFIS: Record<string, PerfilDeIntegracao> = Object.fromEntries([
  {
    id: 'notion', nome: 'Notion', situacao: 'disponivel', portalFixo: false,
    mcp: { url: 'https://mcp.notion.com/mcp', registro: 'automatico', enviarRecurso: true },
    // não confirmado: os campos exatos da resposta do token do Notion MCP; se nenhum bater, a conta aparece só como "Conta conectada".
    identificacao: { daRespostaDoToken: { portal: ['workspace_id'], conta: ['workspace_name', 'owner.user.person.email', 'owner.user.name'] } }
  } satisfies PerfilDeIntegracao,
  {
    id: 'hubspot', nome: 'HubSpot', situacao: 'disponivel', portalFixo: true,
    // O HubSpot não aceita registro automático: o app (MCP Auth App) é da Althius e fica no cofre (tipo "app de integração").
    // Endereços de autorização e de token vêm do metadado que o próprio servidor publica (lido em 06/10/2026:
    // /oauth/authorize/user e /oauth/v3/token, PKCE S256, segredo no corpo).
    mcp: { url: 'https://mcp.hubspot.com', registro: 'app_registrado', enviarRecurso: true },
    // não confirmado: onde o portal vem. Tenta a resposta do token, a consulta ao token e, por último, a ferramenta get_user_details.
    // Sem portal o HubSpot NÃO conecta (a regra "dois CRMs nunca se misturam" não é opcional).
    identificacao: {
      daRespostaDoToken: { portal: ['hub_id', 'portal_id'], conta: ['user', 'hub_domain'] },
      requisicoes: [{ metodo: 'GET', url: 'https://api.hubapi.com/oauth/v1/access-tokens/{credencial}', portal: ['hub_id'], conta: ['user'] }],
      porFerramentaMcp: { ferramenta: 'get_user_details', portal: ['hub_id', 'hubId', 'portalId', 'portal_id', 'portal.id'], conta: ['email', 'user', 'userEmail', 'user.email'] }
    }
  } satisfies PerfilDeIntegracao,
  // Registro automático (RFC 7591) verificado em 06/10/2026: a Althius conecta sem cadastrar app no fornecedor.
  { id: 'apollo', nome: 'Apollo.io', situacao: 'disponivel', portalFixo: false, mcp: { url: 'https://mcp.apollo.io/mcp', registro: 'automatico', enviarRecurso: true } } satisfies PerfilDeIntegracao,
  { id: 'pipedrive', nome: 'Pipedrive', situacao: 'disponivel', portalFixo: false, mcp: { url: 'https://mcp.pipedrive.ai/mcp', registro: 'automatico', enviarRecurso: true } } satisfies PerfilDeIntegracao,
  { id: 'granola', nome: 'Granola', situacao: 'disponivel', portalFixo: false, mcp: { url: 'https://mcp.granola.ai/mcp', registro: 'automatico', enviarRecurso: true } } satisfies PerfilDeIntegracao,
  { id: 'confluence', nome: 'Confluence', situacao: 'disponivel', portalFixo: false, mcp: { url: 'https://mcp.atlassian.com/v1/mcp', registro: 'automatico', enviarRecurso: true } } satisfies PerfilDeIntegracao,
  // Registro automático (RFC 7591) lido no metadado público em 06/10/2026 (Calendly e Otter: S256).
  { id: 'calendly', nome: 'Calendly', situacao: 'disponivel', portalFixo: false, mcp: { url: 'https://mcp.calendly.com/mcp', registro: 'automatico', enviarRecurso: true } } satisfies PerfilDeIntegracao,
  { id: 'otter', nome: 'Otter.ai', situacao: 'disponivel', portalFixo: false, mcp: { url: 'https://mcp.otter.ai/mcp', registro: 'automatico', enviarRecurso: true } } satisfies PerfilDeIntegracao,
  emBreve('gcal', 'Google Calendar', 'Vai usar a conta Google já conectada pelo canal de mensagens (a agenda do Google). Falta construir e testar.'),
  emBreve('meta', 'Meta Ads', 'A conexão oficial da Meta aceita login direto, mas ainda falta construir a criação e a ativação de campanhas, sempre com a aprovação do C-level (verba é gasto).'),
  emBreve('rdstation', 'RD Station CRM', 'A RD Station tem servidor oficial, mas cada cliente gera a própria URL e o token no catálogo MCP deles. Em avaliação.'),
  canal('whatsapp', 'WhatsApp Business', 'whatsapp'),
  canal('gmail', 'Gmail', 'google'),
  canal('outlook', 'Outlook', 'microsoft'),
  canal('instagram', 'Instagram', 'instagram'),
  canal('linkedin', 'LinkedIn Sales Navigator', 'linkedin'),
].map(p => [p.id, p]));

/** Lê um valor de um objeto JSON por um caminho com pontos (`owner.user.name`); nulo se não houver. */
export function valorNoCaminho(objeto: unknown, caminho: string): string | null {
  let atual: unknown = objeto;
  for (const parte of caminho.split('.')) {
    if (atual === null || typeof atual !== 'object') return null;
    atual = (atual as Record<string, unknown>)[parte];
  }
  if (typeof atual === 'string' && atual.trim() !== '') return atual.trim();
  if (typeof atual === 'number' && Number.isFinite(atual)) return String(atual);
  return null;
}

/** O primeiro valor não vazio entre vários caminhos alternativos. */
export function primeiroValor(objeto: unknown, caminhos: readonly string[] | undefined): string | null {
  for (const caminho of caminhos ?? []) {
    const valor = valorNoCaminho(objeto, caminho);
    if (valor !== null) return valor;
  }
  return null;
}
