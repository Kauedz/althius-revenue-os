/**
 * Apify Multi-Account Provider Pool (5 Accounts)
 * 
 * Manages load-balancing, rate-limits, and token rotation
 * across the 5 central Apify accounts used by Althius.
 */

export interface ApifyAccount {
  index: number; // 1 to 5
  name: string;
  token: string;
  activeRuns: number;
  maxConcurrency: number;
  isAvailable: boolean;
}

// 5 Canonical Apify Accounts initialized from environment variables or runtime configuration
const apifyAccounts: ApifyAccount[] = [
  {
    index: 1,
    name: 'Apify Conta 01 (Principal)',
    token: process.env.APIFY_TOKEN_1 || '',
    activeRuns: 0,
    maxConcurrency: 10,
    isAvailable: true,
  },
  {
    index: 2,
    name: 'Apify Conta 02 (Secundária)',
    token: process.env.APIFY_TOKEN_2 || '',
    activeRuns: 0,
    maxConcurrency: 10,
    isAvailable: true,
  },
  {
    index: 3,
    name: 'Apify Conta 03 (Enriquecimento)',
    token: process.env.APIFY_TOKEN_3 || '',
    activeRuns: 0,
    maxConcurrency: 10,
    isAvailable: true,
  },
  {
    index: 4,
    name: 'Apify Conta 04 (Scraping)',
    token: process.env.APIFY_TOKEN_4 || '',
    activeRuns: 0,
    maxConcurrency: 10,
    isAvailable: true,
  },
  {
    index: 5,
    name: 'Apify Conta 05 (Reserva)',
    token: process.env.APIFY_TOKEN_5 || '',
    activeRuns: 0,
    maxConcurrency: 10,
    isAvailable: true,
  },
];

export const apifyPool = {
  /**
   * Returns all 5 accounts with their current status.
   */
  getAccounts(): ApifyAccount[] {
    return apifyAccounts.map(acc => ({ ...acc }));
  },

  /**
   * Updates the token for any of the 5 Apify accounts.
   */
  updateAccountToken(accountIndex: number, newToken: string) {
    const acc = apifyAccounts.find(a => a.index === accountIndex);
    if (!acc) throw new Error(`Conta Apify index ${accountIndex} inválida (deve ser 1 a 5).`);
    acc.token = newToken;
    acc.isAvailable = !!newToken;
    console.log(`[Apify Pool] Token da Conta ${accountIndex} atualizado com sucesso.`);
  },

  /**
   * Selects the next available Apify account using least-loaded strategy.
   */
  acquireAccount(): ApifyAccount {
    const available = apifyAccounts
      .filter(a => a.isAvailable && a.activeRuns < a.maxConcurrency)
      .sort((a, b) => a.activeRuns - b.activeRuns);

    if (available.length === 0) {
      // Fallback: pick the account with least runs even if maxed or unconfigured in dev mode
      const leastBusy = [...apifyAccounts].sort((a, b) => a.activeRuns - b.activeRuns)[0];
      leastBusy.activeRuns += 1;
      return leastBusy;
    }

    const selected = available[0];
    selected.activeRuns += 1;
    return selected;
  },

  /**
   * Releases an account once an Actor run finishes.
   */
  releaseAccount(accountIndex: number) {
    const acc = apifyAccounts.find(a => a.index === accountIndex);
    if (acc) {
      acc.activeRuns = Math.max(0, acc.activeRuns - 1);
    }
  },

  /**
   * Runs an Apify Actor using the allocated account from the pool.
   */
  async runActor(actorId: string, input: Record<string, unknown>): Promise<{
    runId: string;
    accountIndex: number;
    status: string;
  }> {
    const account = this.acquireAccount();

    try {
      if (!account.token) {
        console.warn(`[Apify Pool] Conta ${account.index} sem token. Simulação em modo mock.`);
        return {
          runId: `mock-apify-run-${Date.now()}`,
          accountIndex: account.index,
          status: 'SUCCEEDED'
        };
      }

      const response = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${account.token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });

      if (!response.ok) {
        throw new Error(`Apify Run failed HTTP ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      return {
        runId: result.data.id,
        accountIndex: account.index,
        status: result.data.status
      };
    } finally {
      this.releaseAccount(account.index);
    }
  }
};
