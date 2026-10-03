// Seam: <AlthiusApp /> (Notificações por membro e marcação como lida)
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { bancoLocalNoAr, novoClienteLocal } from '../test/supabaseLocal';
import { isolarNotificacoes } from '../test/isolarNotificacoes';

const NOTIFS_EVOLUT = [
  'fa000000-0000-0000-0000-000000000001',
  'fa000000-0000-0000-0000-000000000002',
  'fa000000-0000-0000-0000-000000000003'
];

async function entrar(email: string) {
  window.location.hash = '#/app/evolut/home';
  render(<Raiz supabase={novoClienteLocal()} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  const nav = await screen.findByRole('navigation', { name: 'Navegação principal' }, { timeout: 8000 });
  await within(nav).findByRole('link', { name: /Início/ }, { timeout: 8000 });
}

describe.skipIf(!bancoLocalNoAr)('tela de Notificações (banco local)', () => {
  isolarNotificacoes(NOTIFS_EVOLUT);

  it('Aline (C-level) visualiza suas notificações do banco e marca como lidas', async () => {
    await entrar('aline@evolut.com.br');

    const btnNotif = await screen.findByRole('button', { name: 'Notificações' }, { timeout: 8000 });
    fireEvent.click(btnNotif);

    // Dialog de notificações abre com os dados de Aline
    expect(await screen.findByText('Aprovação pendente: E-mails T1', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByText('Créditos consumidos')).toBeInTheDocument();

    // Botão de marcar como lidas presente enquanto houver não lidas
    const btnMarcar = screen.getByRole('button', { name: 'Marcar como lidas' });
    fireEvent.click(btnMarcar);

    // Após clicar, atualiza o resumo para Tudo lido
    await waitFor(() => {
      expect(screen.getByText('Tudo lido')).toBeInTheDocument();
    });
  });

  it('Lucas (BDR) vê exclusivamente sua notificação e não as de Aline', async () => {
    await entrar('lucas@evolut.com.br');

    const btnNotif = await screen.findByRole('button', { name: 'Notificações' }, { timeout: 8000 });
    fireEvent.click(btnNotif);

    // Lucas vê sua notificação
    expect(await screen.findByText('Novo lead atribuído', {}, { timeout: 8000 })).toBeInTheDocument();

    // Lucas NÃO vê as notificações de Aline
    expect(screen.queryByText('Aprovação pendente: E-mails T1')).toBeNull();
  });
});