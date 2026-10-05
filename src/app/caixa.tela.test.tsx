// Seam: Caixa de entrada no modo real, de ponta a ponta com o Supabase local (login → lista → abrir → ação).
import { afterAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { adminLocal, bancoLocalNoAr, novoClienteLocal } from '../test/supabaseLocal';

const CONVERSA_ALINE = 'c5000000-0000-0000-0000-000000000001';

async function entrarNaCaixa(email: string) {
  window.location.hash = '#/app/evolut/inbox';
  render(<Raiz supabase={novoClienteLocal()} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  await screen.findByText('Tenho interesse, mas só no mês que vem.', {}, { timeout: 8000 });
}

describe.skipIf(!bancoLocalNoAr)('Caixa de entrada (banco local)', () => {
  afterAll(async () => {
    const admin = adminLocal();
    await admin.from('conversations').update({ unread: true }).eq('id', CONVERSA_ALINE);
    await admin.from('executions').delete().eq('title', 'Sugerir resposta para Aline Xavier');
  });

  it('BDR vê só as próprias conversas, sem as do protótipo nem as de outro BDR', async () => {
    await entrarNaCaixa('lucas@evolut.com.br');
    expect(screen.queryByText('Pode me mandar a proposta com os prazos?')).not.toBeInTheDocument(); // só existia no protótipo
    expect(screen.queryByText('Já trabalhamos com uma trading.')).not.toBeInTheDocument(); // conversa da Bruna
    expect(screen.getByText('Recebi. Me liga amanhã depois das 10h?')).toBeInTheDocument();
  });

  it('pedir sugestão de resposta avisa que foi para a Lia', async () => {
    cleanup();
    await entrarNaCaixa('lucas@evolut.com.br');
    fireEvent.click(screen.getByText('Tenho interesse, mas só no mês que vem.'));
    fireEvent.click(await screen.findByRole('button', { name: 'Sugerir resposta' }));
    expect(await screen.findByText(/Pedido enviado para Lia/, {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.queryByText(/rascunhou uma resposta/)).not.toBeInTheDocument();
  });

  it('não mostra "Criar tarefa" enquanto Tarefas não estiver ligada nesta caixa', async () => {
    cleanup();
    await entrarNaCaixa('lucas@evolut.com.br');
    fireEvent.click(screen.getByText('Tenho interesse, mas só no mês que vem.'));
    const painel = (await screen.findByRole('button', { name: 'Sugerir resposta' })).parentElement!;
    expect(within(painel).queryByRole('button', { name: 'Criar tarefa' })).not.toBeInTheDocument();
  });
});
