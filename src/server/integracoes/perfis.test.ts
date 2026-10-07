// @vitest-environment node
// Os perfis precisam cobrir EXATAMENTE os conectores do catálogo da tela (sem esquecer nenhum nem inventar um), e todo
// conector que ainda não conecta precisa dizer por quê (nunca um "Em breve" mudo).
// O catálogo da tela é o do design JÁ AJUSTADO pelas regras de produto (src/v18/module.js): o Nan enxugou a lista em
// 06/10/2026 (ADR 0063): ficam só os que conectam hoje, mais os que ele quer ter (RD Station, Google Agenda, Meta Ads).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PERFIS } from './perfis.ts';

const idsDoCatalogo = (): string[] => {
  const linha = readFileSync('src/v18/module.js', 'utf8').split('\n').find(l => l.startsWith('window.ALTHIUS_CONECTORES'))!;
  return (JSON.parse(linha.replace(/^window\.ALTHIUS_CONECTORES\s*=\s*/, '').replace(/;\s*$/, '')) as { lista: Array<{ id: string }> }).lista.map(c => c.id);
};

const COMBINADOS = [
  'hubspot', 'pipedrive', 'rdstation', 'whatsapp', 'instagram', 'gmail', 'gcal', 'outlook', 'granola', 'otter', 'notion', 'confluence',
  'apollo', 'linkedin', 'calendly', 'meta'
];

describe('perfis do catálogo de conectores', () => {
  it('o catálogo tem só os conectores combinados com o Nan (os que conectam hoje + RD Station, Google Agenda e Meta Ads)', () => {
    expect(idsDoCatalogo().sort()).toEqual([...COMBINADOS].sort());
  });

  it('o que não existe de verdade e não foi pedido saiu do catálogo e dos perfis', () => {
    for (const id of ['slack', 'zoom', 'gsheets', 'gdrive', 'meet', 'gads', 'liads', 'gsc', 'ga4', 'eventbrite', 'salesforce', 'dynamics', 'zoho', 'teams', 'm365', 'sharepoint', 'clay', 'gong', 'fireflies', 'fathom', 'tldv']) {
      expect(idsDoCatalogo(), id).not.toContain(id);
      expect(PERFIS[id], id).toBeUndefined();
    }
  });

  it('os três CRMs principais, o Google Agenda e o Meta Ads estão no catálogo; Meta Ads e RD Station ficam "Em breve" com o motivo', () => {
    for (const id of ['hubspot', 'pipedrive', 'rdstation', 'gcal', 'meta']) expect(PERFIS[id], id).toBeDefined();
    expect(PERFIS.hubspot.situacao).toBe('disponivel');
    expect(PERFIS.pipedrive.situacao).toBe('disponivel');
    expect(PERFIS.rdstation.situacao).toBe('em_breve');
    expect(PERFIS.meta.situacao).toBe('em_breve');
    expect(PERFIS.meta.motivo).toMatch(/campanha/i);
  });

  it('cobrem exatamente os conectores que a tela mostra', () => {
    expect(Object.keys(PERFIS).sort()).toEqual(idsDoCatalogo().sort());
  });

  it('todo "Em breve" explica o motivo', () => {
    for (const p of Object.values(PERFIS).filter(x => x.situacao === 'em_breve')) expect(p.motivo?.length, p.id).toBeGreaterThan(20);
  });

  it('todo disponível sabe como conectar: servidor MCP oficial ou conta de mensagem pela Unipile', () => {
    for (const p of Object.values(PERFIS).filter(x => x.situacao === 'disponivel')) {
      expect(Boolean(p.mcp) !== (p.via === 'mensagens'), p.id).toBe(true);
      if (p.mcp) expect(p.mcp.url.startsWith('https://'), p.id).toBe(true);
    }
  });

  it('o motivo nunca cita valor em dólar nem nome do fornecedor de mensagens', () => {
    for (const p of Object.values(PERFIS)) expect(`${p.nome} ${p.motivo ?? ''}`, p.id).not.toMatch(/US\$|d[óo]lar|unipile/i);
  });

  it('os "Em breve" que ficam dizem o porquê (RD Station por cliente, Google Agenda pela conta Google, Meta Ads)', () => {
    expect(PERFIS.rdstation.motivo).toMatch(/URL|token/i);
    expect(PERFIS.gcal.motivo).toMatch(/Google/i);
    expect(PERFIS.meta.motivo).toMatch(/Meta|login/i);
  });
});
