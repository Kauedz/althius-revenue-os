// Seam: a tela inteira no modo real (login -> app), falando com o Supabase local de verdade.
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz, mensagemDeLogin } from './Raiz';

import { bancoLocalNoAr as bancoNoAr, novoClienteLocal as novoCliente } from '../test/supabaseLocal';

async function entrar(email: string, senha: string) {
  render(<Raiz supabase={novoCliente()} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: senha } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
}

describe('mensagens de login', () => {
  it('traduz credencial inválida', () => {
    expect(mensagemDeLogin({ message: 'Invalid login credentials' })).toBe('E-mail ou senha incorretos.');
  });
  it('erro desconhecido vira mensagem genérica, sem detalhe técnico', () => {
    expect(mensagemDeLogin({ message: 'boom 500' })).toBe('Não foi possível entrar agora. Tente de novo em instantes.');
  });
});

describe.skipIf(!bancoNoAr)('modo real (banco local)', () => {
  it('senha errada mostra o aviso e continua no login', async () => {
    await entrar('lucas@evolut.com.br', 'errada');
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
  });

  it('BDR entra e vê o app com o próprio nome, sem estratégia e sem troca de papel', async () => {
    await entrar('lucas@evolut.com.br', 'althius-demo');
    const nav = await screen.findByRole('navigation', { name: 'Navegação principal' }, { timeout: 8000 });
    await within(nav).findByRole('link', { name: /Início/ }, { timeout: 8000 });
    expect(within(nav).queryByRole('link', { name: /Estratégia/ })).not.toBeInTheDocument();
    expect(window.location.hash).toBe('#/app/evolut/home');

    fireEvent.click(screen.getByRole('button', { name: 'Perfil e papel' }));
    const perfil = await screen.findByRole('dialog', { name: 'Perfil' });
    expect(perfil).toHaveTextContent('Lucas Teixeira');
    expect(perfil).toHaveTextContent('lucas@evolut.com.br');
    expect(perfil).toHaveTextContent('BDR/SDR');
    expect(perfil).not.toHaveTextContent('Modo demonstração');
  });

  it('Sair volta ao login e apaga do navegador a foto e o histórico de quem saiu', async () => {
    await entrar('lucas@evolut.com.br', 'althius-demo');
    const nav = await screen.findByRole('navigation', { name: 'Navegação principal' }, { timeout: 8000 });
    await within(nav).findByRole('link', { name: /Início/ }, { timeout: 8000 });
    localStorage.setItem('althius-foto', 'data:image/png;base64,AAAA');
    localStorage.setItem('althius-cop-hist', '[]');
    localStorage.setItem('althius-tema', 'escuro');

    fireEvent.click(screen.getByRole('button', { name: 'Perfil e papel' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Perfil' })).getByRole('button', { name: 'Sair' }));

    expect(await screen.findByRole('heading', { name: 'Acesse sua conta Althius' }, { timeout: 8000 })).toBeInTheDocument();
    expect(localStorage.getItem('althius-foto')).toBeNull();
    expect(localStorage.getItem('althius-cop-hist')).toBeNull();
    expect(localStorage.getItem('althius-tema')).toBe('escuro'); // preferência do aparelho fica
  });

  it('estrategista vê só os 2 workspaces em que foi colocada', async () => {
    await entrar('camila@althius.com.br', 'althius-demo');
    const rail = await screen.findByRole('navigation', { name: 'Workspaces' }, { timeout: 8000 });
    await waitFor(() => expect(within(rail).getByRole('link', { name: 'Grão Norte Alimentos' })).toBeInTheDocument(), { timeout: 8000 });
    expect(within(rail).getByRole('link', { name: 'Evolut Trading' })).toBeInTheDocument();
    expect(within(rail).queryByRole('link', { name: 'Vértice Indústria' })).not.toBeInTheDocument();
  });
});
