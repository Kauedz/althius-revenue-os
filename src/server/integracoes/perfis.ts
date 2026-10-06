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

export interface PerfilDeIntegracao {
  id: string;
  nome: string;
  situacao: 'disponivel' | 'em_breve';
  /** Por que ainda é "Em breve" (texto para a pessoa). */
  motivo?: string;
  /** O primeiro acesso fixa o portal do workspace (ex.: o portal do HubSpot). */
  portalFixo: boolean;
  /** `mcp` (padrão): OAuth no servidor MCP oficial. `unipile`: conta de mensagem conectada pelo assistente hospedado da Unipile (o mesmo canal da Caixa de entrada, sem outro conector). */
  via?: 'mcp' | 'unipile';
  /** Só `via: 'unipile'`: o provedor da conta de mensagem. */
  canal?: CanalUnipile;
  mcp?: PerfilMcp;
  /** Onde achar a conta e o portal na resposta do endpoint de token (caminhos alternativos; vale o primeiro que existir). */
  identificacao?: { portal?: string[]; conta?: string[] };
}

const CONFIRMAR = 'O servidor oficial existe e aceita conexão automática, mas falta conferir com uma conexão real antes de liberar.';
const PROVAVEL = 'O servidor oficial é provável, mas ainda falta confirmar como ele aceita a conexão.';
const APP_DO_FORNECEDOR = 'Exige um app da Althius registrado no fornecedor (e, no Google, a verificação do app). Em preparação.';
const POR_CLIENTE = 'Cada cliente precisa criar um app ou uma URL na própria conta. Exige um guia próprio, ainda em desenho.';
const SEM_SERVIDOR = 'O fornecedor não oferece um servidor oficial para terceiros conectarem.';

const emBreve = (id: string, nome: string, motivo: string): PerfilDeIntegracao => ({ id, nome, situacao: 'em_breve', motivo, portalFixo: false });
// Canais de mensagem: o cartão do catálogo conecta pela Unipile (a conta é da PESSOA; a permissão é a da Caixa, `inbox.connect`).
const canal = (id: string, nome: string, canal: CanalUnipile): PerfilDeIntegracao => ({ id, nome, situacao: 'disponivel', via: 'unipile', canal, portalFixo: false });

export const PERFIS: Record<string, PerfilDeIntegracao> = Object.fromEntries([
  {
    id: 'notion', nome: 'Notion', situacao: 'disponivel', portalFixo: false,
    mcp: { url: 'https://mcp.notion.com/mcp', registro: 'automatico', enviarRecurso: true },
    // não confirmado: os campos exatos da resposta do token do Notion MCP; se nenhum bater, a conta aparece só como "Conta conectada".
    identificacao: { portal: ['workspace_id'], conta: ['workspace_name', 'owner.user.person.email', 'owner.user.name'] }
  } satisfies PerfilDeIntegracao,
  emBreve('hubspot', 'HubSpot', 'Precisa do app do HubSpot (MCP Auth App) cadastrado pela Althius. Em preparação.'),
  emBreve('apollo', 'Apollo.io', CONFIRMAR),
  emBreve('pipedrive', 'Pipedrive', CONFIRMAR),
  emBreve('granola', 'Granola', CONFIRMAR),
  emBreve('confluence', 'Confluence', CONFIRMAR),
  emBreve('clay', 'Clay', PROVAVEL),
  emBreve('calendly', 'Calendly', PROVAVEL),
  emBreve('otter', 'Otter.ai', PROVAVEL),
  emBreve('tldv', 'tl;dv', PROVAVEL),
  emBreve('gong', 'Gong', 'O servidor da Gong está em preview fechado, só para alguns clientes.'),
  emBreve('fireflies', 'Fireflies.ai', 'Só conecta por chave da própria conta, sem login oficial para terceiros.'),
  emBreve('fathom', 'Fathom', 'Não há servidor oficial confirmado.'),
  emBreve('slack', 'Slack', APP_DO_FORNECEDOR),
  emBreve('zoom', 'Zoom', APP_DO_FORNECEDOR),
  emBreve('gsheets', 'Google Sheets', APP_DO_FORNECEDOR),
  emBreve('gcal', 'Google Calendar', APP_DO_FORNECEDOR),
  emBreve('gdrive', 'Google Drive', APP_DO_FORNECEDOR),
  emBreve('meet', 'Google Meet', APP_DO_FORNECEDOR),
  emBreve('meta', 'Meta Ads', APP_DO_FORNECEDOR),
  emBreve('salesforce', 'Salesforce', POR_CLIENTE),
  emBreve('dynamics', 'Dynamics 365 Sales', POR_CLIENTE),
  emBreve('zoho', 'Zoho CRM', POR_CLIENTE),
  emBreve('rdstation', 'RD Station CRM', POR_CLIENTE),
  emBreve('teams', 'Microsoft Teams', POR_CLIENTE),
  emBreve('sharepoint', 'SharePoint', POR_CLIENTE),
  emBreve('m365', 'Microsoft 365', POR_CLIENTE),
  canal('whatsapp', 'WhatsApp Business', 'whatsapp'),
  canal('gmail', 'Gmail', 'google'),
  canal('outlook', 'Outlook', 'microsoft'),
  canal('instagram', 'Instagram', 'instagram'),
  canal('linkedin', 'LinkedIn Sales Navigator', 'linkedin'),
  emBreve('liads', 'LinkedIn Ads', SEM_SERVIDOR),
  emBreve('gads', 'Google Ads', SEM_SERVIDOR),
  emBreve('gsc', 'Google Search Console', SEM_SERVIDOR),
  emBreve('ga4', 'Google Analytics 4', SEM_SERVIDOR),
  emBreve('eventbrite', 'Eventbrite', SEM_SERVIDOR)
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
