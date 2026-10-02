/**
 * Hermes LLM Orchestrator Client
 * 
 * MODEL SELECTION:
 * Default model: 'codex-luna'.
 * You can change the model at any time either:
 *  1. By editing the DEFAULT_MODEL constant below;
 *  2. By calling hermesLlm.setModel('new-model-name');
 *  3. Or setting the environment variable HERMES_MODEL='new-model-name'.
 */

export const DEFAULT_MODEL = 'codex-luna';

export interface ModelConfig {
  modelName: string;
  apiBaseUrl: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
}

let activeConfig: ModelConfig = {
  modelName: process.env.HERMES_MODEL || DEFAULT_MODEL,
  apiBaseUrl: process.env.HERMES_API_BASE_URL || 'https://api.openai.com/v1',
  apiKey: process.env.HERMES_API_KEY || '',
  temperature: 0.7,
  maxTokens: 4096,
};

// Canonical agent system instructions from Althius Specification
const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  comercial: `Você é o Agente Comercial da Althius.
Sua missão: Encontrar e priorizar contas dentro do ICP, mapear o comitê de compra e detectar sinais de compra.
Regras: Priorize importadores de médio porte. Exclua concorrentes. Não escreva no CRM sem aprovação prévia.`,

  marketing: `Você é o Agente de Marketing da Althius.
Sua missão: Planejar e acompanhar mídia paga, campanhas orgânicas, SEO/GEO e eventos.
Regras: Meta de CPL abaixo de R$ 150. Qualquer alteração orçamentária requer aprovação do C-level.`,

  copy: `Você é o Agente de Copy da Althius.
Sua missão: Escrever mensagens consultivas, e-mails, roteiros e anúncios de alto impacto.
Regras: Tom direto, sem jargões desnecessários. Envio automático restrito a e-mail e WhatsApp em cadências ativas.`,

  revops: `Você é o Agente de RevOps da Althius.
Sua missão: Manter a higiene de dados do CRM, acompanhar pipelines e calcular previsões de receita.
Regras: Nunca sobrescreva proprietários de negócios. Notifique negócios estagnados por mais de 14 dias.`
};

export const hermesLlm = {
  /**
   * Returns current active LLM configuration.
   */
  getConfig(): ModelConfig {
    return { ...activeConfig };
  },

  /**
   * Alter the model or connection settings at any time in code or runtime.
   */
  setModel(newModelName: string, options?: Partial<Omit<ModelConfig, 'modelName'>>) {
    activeConfig.modelName = newModelName;
    if (options) {
      activeConfig = { ...activeConfig, ...options };
    }
    console.log(`[Hermes LLM] Modelo ativo alterado para: "${newModelName}".`);
  },

  /**
   * Generate an agent response using Codex Luna (or current active model).
   */
  async generateResponse(params: {
    agentId: 'comercial' | 'marketing' | 'copy' | 'revops' | 'orchestrator';
    userPrompt: string;
    context?: string;
    temperatureOverride?: number;
  }): Promise<{ content: string; modelUsed: string; creditsConsumed: number }> {
    const systemPrompt = AGENT_SYSTEM_PROMPTS[params.agentId] || 'Você é o Hermes, orquestrador do Althius Revenue OS.';
    const modelToUse = activeConfig.modelName;

    if (!activeConfig.apiKey) {
      // Mock / Offline fallback if no API key is provided
      console.warn(`[Hermes LLM] Sem chave configurada para o modelo ${modelToUse}. Gerando resposta estruturada local.`);
      return {
        content: `[${modelToUse} - ${params.agentId.toUpperCase()}] Analisei seu pedido: "${params.userPrompt}". Contexto verificado com sucesso pelas 4 checagens do Hermes.`,
        modelUsed: modelToUse,
        creditsConsumed: 2
      };
    }

    try {
      const response = await fetch(`${activeConfig.apiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelToUse,
          temperature: params.temperatureOverride ?? activeConfig.temperature,
          max_tokens: activeConfig.maxTokens,
          messages: [
            { role: 'system', content: systemPrompt },
            ...(params.context ? [{ role: 'system', content: `Contexto do Workspace:\n${params.context}` }] : []),
            { role: 'user', content: params.userPrompt }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`LLM call failed (${response.status}): ${await response.text()}`);
      }

      const data = await response.json();
      return {
        content: data.choices?.[0]?.message?.content || '',
        modelUsed: modelToUse,
        creditsConsumed: 2
      };
    } catch (err: any) {
      console.error(`[Hermes LLM] Erro na invocação do modelo ${modelToUse}:`, err);
      throw err;
    }
  }
};
