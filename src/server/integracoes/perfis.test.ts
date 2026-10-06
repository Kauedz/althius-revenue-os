// @vitest-environment node
// Os perfis precisam cobrir EXATAMENTE os conectores do catálogo da tela (sem esquecer nenhum nem inventar um), e todo
// conector que ainda não conecta precisa dizer por quê (nunca um "Em breve" mudo).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PERFIS } from './perfis.ts';

const idsDoCatalogo = (): string[] => {
  const linha = readFileSync('althius-frontend-v18/fonte/module.js', 'utf8').split('\n').find(l => l.startsWith('window.ALTHIUS_CONECTORES'))!;
  return (JSON.parse(linha.replace(/^window\.ALTHIUS_CONECTORES\s*=\s*/, '').replace(/;\s*$/, '')) as { lista: Array<{ id: string }> }).lista.map(c => c.id);
};

describe('perfis do catálogo de conectores', () => {
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

  it('os apps que o fornecedor só deixa a Althius cadastrar, ou que são por cliente, dizem isso (Slack, Zoom, RD Station, Zoho)', () => {
    expect(PERFIS.slack.motivo).toMatch(/Marketplace|publicad/i);
    expect(PERFIS.zoom.motivo).toMatch(/app/i);
    expect(PERFIS.rdstation.motivo).toMatch(/URL|token/i);
    expect(PERFIS.zoho.motivo).toMatch(/login|API/i);
    expect(PERFIS.gcal.motivo).toMatch(/Google/i);
  });
});
