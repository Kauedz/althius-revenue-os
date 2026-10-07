// Testes de fumaça do front v18 convertido para React.
// Seam: a tela renderizada (o que o usuário vê), sem olhar a implementação.
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import './data.js';
import './module.js';
import { AlthiusLogic } from './logic.generated.js';

function abrir(rota: string, papel: 'superadmin' | 'estrategista' | 'cliente' | 'bdr' = 'estrategista') {
  window.location.hash = rota;
  render(<AlthiusLogic papel={papel} />);
}

const navPrincipal = () => screen.getByRole('navigation', { name: 'Navegação principal' });

describe('front v18 em React', () => {
  it('abre o Início do workspace com os indicadores do ciclo', async () => {
    abrir('#/app/evolut/home');
    expect(await screen.findByText('Pipeline influenciado')).toBeInTheDocument();
    expect(screen.getAllByText('Evolut Trading').length).toBeGreaterThan(0);
  });

  it('navega pela rota até o Pipeline', async () => {
    abrir('#/app/evolut/pipeline');
    expect(await screen.findByRole('heading', { name: 'Pipeline', level: 1 })).toBeInTheDocument();
  });

  it('estrategista vê Estratégia e Aprovações no menu', async () => {
    abrir('#/app/evolut/home', 'estrategista');
    await screen.findByText('Pipeline influenciado');
    const nav = within(navPrincipal());
    expect(nav.getByRole('link', { name: /Estratégia/ })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: /Aprovações/ })).toBeInTheDocument();
  });

  it.each(['cliente', 'estrategista'] as const)('tela de Créditos não mostra dólar para %s', async papel => {
    abrir('#/app/evolut/credits', papel);
    await screen.findByText('Saldo do workspace');
    expect(document.body.textContent).not.toMatch(/US\$|dólar/i);
    expect(screen.getByText('R$ 529,00')).toBeInTheDocument();
  });

  it('BDR não vê Estratégia nem Aprovações no menu', async () => {
    abrir('#/app/evolut/home', 'bdr');
    const nav = within(navPrincipal());
    await nav.findByRole('link', { name: /Início/ });
    expect(nav.queryByRole('link', { name: /Estratégia/ })).not.toBeInTheDocument();
    expect(nav.queryByRole('link', { name: /Aprovações/ })).not.toBeInTheDocument();
  });
});

describe('catálogo enxuto (ADR 0063)', () => {
  it('nenhum agente cita permissão em app que saiu do catálogo (Google Ads, LinkedIn Ads, Google Sheets)', () => {
    const agentes = (window.ALTHIUS_DATA as unknown as { AGENTS: Array<{ integracoes: Array<{ fornecedor: string }> }> }).AGENTS;
    const citados = agentes.flatMap(a => a.integracoes.map(i => i.fornecedor));
    expect(citados.length).toBeGreaterThan(0);
    for (const nome of ['Google Ads', 'LinkedIn Ads', 'Google Sheets']) expect(citados, nome).not.toContain(nome);
    expect(citados).toContain('Meta Ads');
    expect(citados).toContain('HubSpot');
  });
});
