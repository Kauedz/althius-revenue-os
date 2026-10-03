// Seam: a tela de Contas e leads no modo real, de ponta a ponta com o Supabase local.
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { bancoLocalNoAr, novoClienteLocal } from '../test/supabaseLocal';

async function entrarEIrPara(email: string, rota: string) {
  render(<Raiz supabase={novoClienteLocal()} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  const nav = await screen.findByRole('navigation', { name: 'Navegação principal' }, { timeout: 8000 });
  await within(nav).findByRole('link', { name: /Início/ }, { timeout: 8000 });
  window.location.hash = rota;
  await screen.findByRole('heading', { name: 'Contas e leads' }, { timeout: 8000 });
}

describe.skipIf(!bancoLocalNoAr)('tela de Contas e leads (banco local)', () => {
  it('C-level vê a lista de contas e leads do banco na tela', async () => {
    await entrarEIrPara('aline@evolut.com.br', '#/app/evolut/accounts');
    expect((await screen.findAllByText('Serra Azul Têxtil', {}, { timeout: 8000 })).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Campo Belo Agro').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Têxtil').length).toBeGreaterThan(0);
  });
});
