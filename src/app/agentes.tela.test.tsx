// Seam: a tela Agentes no modo real, de ponta a ponta com o Supabase local (login → lista → pausar).
import { afterAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { pausarAgente } from './servicos/agentes';
import { bancoLocalNoAr, entrarComoLocal, novoClienteLocal } from '../test/supabaseLocal';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const ALINE = 'd0000000-0000-0000-0000-000000000003';

async function entrarEmAgentes(email: string) {
  window.location.hash = '#/app/evolut/agents/comercial';
  render(<Raiz supabase={novoClienteLocal()} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  await screen.findAllByText('Agente Comercial', {}, { timeout: 8000 });
}

describe.skipIf(!bancoLocalNoAr)('tela Agentes (banco local)', () => {
  afterAll(async () => {
    await pausarAgente(await entrarComoLocal('aline@evolut.com.br'), EVOLUT, ALINE, 'comercial', false);
  });

  it('C-level pausa o Agente Comercial e a pausa continua depois de recarregar', async () => {
    await entrarEmAgentes('aline@evolut.com.br');
    fireEvent.click((await screen.findAllByRole('button', { name: 'Pausar' }))[0]);
    const dialogo = await screen.findByRole('alertdialog', { name: 'Pausar Agente Comercial?' });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Pausar agente' }));
    expect((await screen.findAllByRole('button', { name: 'Retomar' }, { timeout: 8000 })).length).toBeGreaterThan(0);

    cleanup();
    await entrarEmAgentes('aline@evolut.com.br');
    expect((await screen.findAllByRole('button', { name: 'Retomar' }, { timeout: 8000 })).length).toBeGreaterThan(0);
  });

  it('responsável e números vêm do banco, não do protótipo', async () => {
    cleanup();
    await entrarEmAgentes('aline@evolut.com.br');
    expect(screen.queryByText('280')).not.toBeInTheDocument(); // execCiclo fictício do protótipo
  });
});
