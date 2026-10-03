// Seam: <AlthiusApp /> (Tela de Início)
﻿// Seam: a tela de Início no modo real, de ponta a ponta com o Supabase local.
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { bancoLocalNoAr, novoClienteLocal } from '../test/supabaseLocal';

async function entrarEIrParaHome(email: string) {
  window.location.hash = '#/app/evolut/home';
  render(<Raiz supabase={novoClienteLocal()} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  const nav = await screen.findByRole('navigation', { name: 'Navegação principal' }, { timeout: 8000 });
  await within(nav).findByRole('link', { name: /Início/ }, { timeout: 8000 });
}

describe.skipIf(!bancoLocalNoAr)('tela de Início (banco local)', () => {
  it('C-level vê créditos e operações do banco no Início', async () => {
    await entrarEIrParaHome('aline@evolut.com.br');
    // Saldo disponível real do banco (7.950)
    expect(await screen.findByText('7.950', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByText('Créditos disponíveis')).toBeInTheDocument();
    // Execuções ativas do banco (3)
    expect((await screen.findAllByText('3', {}, { timeout: 8000 })).length).toBeGreaterThan(0);
    // Título da tela
    expect(screen.getAllByText(/Evolut Trading/).length).toBeGreaterThan(0);
  });

  it('BDR vê somente suas 4 contas atribuídas no Início', async () => {
    await entrarEIrParaHome('lucas@evolut.com.br');
    // BDR tem o KPI de Contas qualificadas na Home, com valor 4
    expect(await screen.findByText('Contas qualificadas', {}, { timeout: 8000 })).toBeInTheDocument();
    expect((await screen.findAllByText('4', {}, { timeout: 8000 })).length).toBeGreaterThan(0);
  });
});