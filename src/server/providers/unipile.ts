/**
 * Unipile Provider Transport Client
 * 
 * ARCHITECTURAL RULE:
 * Unipile is strictly an ephemeral communication transport.
 * All CRM contacts, channels, conversations, and message history
 * reside 100% in our Supabase PostgreSQL database.
 * 
 * Keys can be rotated or replaced at any time without data loss.
 */

export interface UnipileConfig {
  dsn: string;
  apiKey: string;
  webhookSecret?: string;
}

// In-memory runtime configuration with fallback to environment variables
let currentConfig: UnipileConfig = {
  dsn: process.env.UNIPILE_DSN || 'https://api1.unipile.com:13262',
  apiKey: process.env.UNIPILE_API_KEY || '',
  webhookSecret: process.env.UNIPILE_WEBHOOK_SECRET || '',
};

export const unipileClient = {
  getConfig(): UnipileConfig {
    return { ...currentConfig };
  },

  /**
   * Easily update or swap Unipile keys at runtime.
   */
  updateKeys(newConfig: Partial<UnipileConfig>) {
    currentConfig = {
      ...currentConfig,
      ...newConfig,
    };
    console.log('[Unipile] Chaves de conexão atualizadas com sucesso. O banco de dados e os contatos permanecem intactos.');
  },

  /**
   * Sends an outbound message through Unipile's ephemeral gateway.
   */
  async sendMessage(params: {
    accountId: string;
    recipientIdentifier: string;
    channel: 'linkedin' | 'whatsapp' | 'instagram' | 'email';
    text: string;
    attachments?: Array<{ url: string; filename: string }>;
  }): Promise<{ success: boolean; externalMessageId?: string; error?: string }> {
    const { dsn, apiKey } = currentConfig;

    if (!apiKey) {
      console.warn('[Unipile] Nenhuma API Key configurada. Simulação em modo teste.');
      return {
        success: true,
        externalMessageId: `mock-msg-${Date.now()}`
      };
    }

    try {
      const response = await fetch(`${dsn}/api/v1/chats/messages`, {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_id: params.accountId,
          recipient: params.recipientIdentifier,
          text: params.text,
          channel: params.channel
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `Unipile HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      return { success: true, externalMessageId: data.id || data.message_id };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
};
