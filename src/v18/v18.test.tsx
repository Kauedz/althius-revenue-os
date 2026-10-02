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

  it('BDR não vê Estratégia nem Aprovações no menu', async () => {
    abrir('#/app/evolut/home', 'bdr');
    const nav = within(navPrincipal());
    await nav.findByRole('link', { name: /Início/ });
    expect(nav.queryByRole('link', { name: /Estratégia/ })).not.toBeInTheDocument();
    expect(nav.queryByRole('link', { name: /Aprovações/ })).not.toBeInTheDocument();
  });
});
