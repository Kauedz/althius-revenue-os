// Seam: aviso único e interruptor do aprendizado compartilhado (ADR 0052), de ponta a ponta com o Supabase local.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { adminLocal, bancoLocalNoAr, novoClienteLocal } from '../test/supabaseLocal';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';

async function entrar(email: string, rota: string, esperar: string | RegExp) {
  window.location.hash = rota;
  render(<Raiz supabase={novoClienteLocal()} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  await screen.findAllByText(esperar, {}, { timeout: 8000 });
}

describe.skipIf(!bancoLocalNoAr)('Aprendizado compartilhado (banco local)', () => {
  // Estado de partida: sem decisão e aviso por ver. A tabela só se mexe pela chave de serviço.
  const limpar = () => adminLocal().from('learning_consent').delete().eq('workspace_id', EVOLUT);
  beforeEach(async () => { cleanup(); await limpar(); });
  afterEach(async () => { await limpar(); });

  it('C-level vê o aviso uma vez; aceitar liga o interruptor e o aviso não volta', async () => {
    await entrar('aline@evolut.com.br', '#/app/evolut/home', /Olá|Início/);
    const aviso = await screen.findByRole('alertdialog', { name: 'Deixe seus agentes ainda mais espertos' }, { timeout: 8000 });
    expect(within(aviso).getByText(/ajudar a melhorar o aprendizado dos agentes/)).toBeInTheDocument();
    expect(within(aviso).getByText(/Nada que identifique sua empresa/)).toBeInTheDocument();
    expect(within(aviso).getByRole('button', { name: 'Agora não' })).toBeInTheDocument();
    fireEvent.click(within(aviso).getByRole('button', { name: 'Quero ajudar e melhorar' }));
    expect(await screen.findByRole('alertdialog', { name: 'Obrigado!' }, { timeout: 8000 })).toBeInTheDocument();

    cleanup();
    await entrar('aline@evolut.com.br', '#/app/evolut/settings', 'Salvar alterações');
    fireEvent.click(screen.getByRole('button', { name: /Aprendizado/ }));
    const interruptor = await screen.findByRole('switch', { name: 'Ajudar a melhorar o aprendizado dos agentes' });
    await screen.findByText(/Quando as contas compartilham/);
    expect(interruptor).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('alertdialog', { name: 'Deixe seus agentes ainda mais espertos' })).not.toBeInTheDocument(); // uma vez só
    fireEvent.click(interruptor);
    await screen.findByText('Compartilhamento desligado.', {}, { timeout: 8000 });
    expect(screen.getByRole('switch', { name: 'Ajudar a melhorar o aprendizado dos agentes' })).toHaveAttribute('aria-checked', 'false');
  });

  it('"Agora não": fica desligado e o aviso não volta; dá para ligar depois em Configurações', async () => {
    await entrar('aline@evolut.com.br', '#/app/evolut/home', /Olá|Início/);
    const aviso = await screen.findByRole('alertdialog', { name: 'Deixe seus agentes ainda mais espertos' }, { timeout: 8000 });
    fireEvent.click(within(aviso).getByRole('button', { name: 'Agora não' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    cleanup();
    await entrar('aline@evolut.com.br', '#/app/evolut/settings', 'Salvar alterações');
    expect(screen.queryByRole('alertdialog', { name: 'Deixe seus agentes ainda mais espertos' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Aprendizado/ }));
    const interruptor = await screen.findByRole('switch', { name: 'Ajudar a melhorar o aprendizado dos agentes' });
    expect(interruptor).toHaveAttribute('aria-checked', 'false');
    expect(interruptor).not.toBeDisabled();
  });

  it('estrategista vê o interruptor travado e nunca recebe o aviso; BDR nem tem a seção', async () => {
    await entrar('camila@althius.com.br', '#/app/evolut/settings', 'Salvar alterações');
    expect(screen.queryByRole('alertdialog', { name: 'Deixe seus agentes ainda mais espertos' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Aprendizado/ }));
    const interruptor = await screen.findByRole('switch', { name: 'Ajudar a melhorar o aprendizado dos agentes' });
    expect(interruptor).toBeDisabled();
    expect(await screen.findByText('Só o C-level do workspace decide.')).toBeInTheDocument();

    cleanup();
    await entrar('lucas@evolut.com.br', '#/app/evolut/settings', 'Salvar alterações');
    expect(screen.queryByRole('button', { name: /Aprendizado/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('alertdialog', { name: 'Deixe seus agentes ainda mais espertos' })).not.toBeInTheDocument();
  });
});
