// Papéis dos 4 agentes (decisão do Nan, 07/10/2026; ADR 0067, fatia 5): Zoe prospecta (a única), Jax cuida da estratégia,
// do ICP e da mídia, Lia escreve copy e cadências, Neo cuida de RevOps (métricas e relatórios). O texto da tela não
// promete o que a plataforma não faz.
import { describe, expect, it } from 'vitest';
import '../v18/data.js';

type Agente = { id: string; funcao: string; objetivo: string; escopo: string; integracoes: Array<{ cap: string; fornecedor: string; modo: string }> };
const agentes = (): Agente[] => (window as any).ALTHIUS_DATA.AGENTS;
const ag = (id: string) => agentes().find(a => a.id === id)!;

describe('papéis dos agentes', () => {
  it('Zoe é a prospectora, e a única que prospecta', () => {
    expect(ag('comercial').funcao).toBe('Prospecção · empresas, pessoas e comitê');
    expect(ag('comercial').objetivo).toMatch(/única que prospecta/);
    expect(ag('comercial').escopo).toMatch(/diz o custo antes/i);
    for (const id of ['marketing', 'copy', 'revops']) expect(`${ag(id).funcao} ${ag(id).objetivo} ${ag(id).escopo}`, id).not.toMatch(/prospect/i);
  });

  it('Jax cuida da estratégia, do ICP e da mídia paga', () => {
    expect(ag('marketing').funcao).toBe('Estratégia · ICP e mídia paga');
    expect(ag('marketing').objetivo).toMatch(/ICP/);
  });

  it('Lia escreve copy e cadências; Neo cuida de métricas e relatórios', () => {
    expect(ag('copy').funcao).toBe('Copy · mensagens e cadências');
    expect(ag('revops').funcao).toBe('RevOps · métricas e relatórios');
  });

  it('nada de integração que não existe: sem Apollo; Meta Ads ainda em breve', () => {
    expect(JSON.stringify(agentes())).not.toMatch(/Apollo/);
    expect(ag('marketing').integracoes.find(i => i.fornecedor === 'Meta Ads')?.modo).toBe('Em breve');
    expect(ag('comercial').integracoes.map(i => i.fornecedor)).toContain('Google Maps');
  });
});
