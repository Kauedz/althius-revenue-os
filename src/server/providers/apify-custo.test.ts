import { describe, expect, it } from 'vitest';
import { custoDaExecucaoLida } from './apify-custo.ts';

// Casos do protótipo (AppAlthius, signal-scan/custo-da-execucao.test.ts), conferidos em execução real de 01/10/2026:
// a Apify fecha a conta da execução alguns segundos depois de ela terminar.
const evento = (preco: number) => ({ eventPriceUsd: preco });
const porEvento = (eventos: Record<string, number>, contagens: Record<string, number>, uso: number | null) => ({
  usageTotalUsd: uso,
  chargedEventCounts: contagens,
  pricingInfo: { pricingModel: 'PAY_PER_EVENT', pricingPerEvent: { actorChargeEvents: Object.fromEntries(Object.entries(eventos).map(([k, v]) => [k, evento(v)])) } }
});

describe('custo real da execução na Apify (só o superadmin vê)', () => {
  it('actor que não cobra por evento: vale o total da plataforma', () => {
    expect(custoDaExecucaoLida({ usageTotalUsd: 0.0123, pricingInfo: { pricingModel: 'FREE' } })).toBe(0.0123);
  });
  it('por evento, com a conta já fechada: vale o total da Apify', () => {
    expect(custoDaExecucaoLida(porEvento({ profile: 0.004 }, { profile: 1 }, 0.004))).toBe(0.004);
  });
  it('por evento, com a conta ainda aberta: vale a soma dos eventos (o maior dos dois)', () => {
    expect(custoDaExecucaoLida(porEvento({ profile: 0.004, 'apify-actor-start': 0.00005 }, { profile: 3, 'apify-actor-start': 1 }, 0))).toBe(0.01205);
  });
  it('preço da faixa Free quando o evento tem preço por faixa', () => {
    const run = { usageTotalUsd: 0, chargedEventCounts: { item: 10 }, pricingInfo: { pricingModel: 'PAY_PER_EVENT', pricingPerEvent: { actorChargeEvents: { item: { eventTieredPricingUsd: { FREE: { tieredEventPriceUsd: 0.002 } } } } } } };
    expect(custoDaExecucaoLida(run)).toBe(0.02);
  });
  it('por evento sem nenhum evento cobrado ainda: custo desconhecido (nulo), nunca um valor menor que o real', () => {
    expect(custoDaExecucaoLida(porEvento({ profile: 0.004 }, {}, 0))).toBeNull();
  });
  it('evento sem preço conhecido e sem total da Apify: nulo', () => {
    expect(custoDaExecucaoLida({ usageTotalUsd: 0, chargedEventCounts: { x: 2 }, pricingInfo: { pricingModel: 'PAY_PER_EVENT', pricingPerEvent: { actorChargeEvents: {} } } })).toBeNull();
  });
  it('lixo ou execução ausente: nulo', () => {
    expect(custoDaExecucaoLida(null)).toBeNull();
    expect(custoDaExecucaoLida('x')).toBeNull();
  });
});
