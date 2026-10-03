// Seam: Configurações → Minha conta no modo real, de ponta a ponta com o Supabase local.
import { afterAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { salvarMinhaConta } from './servicos/conta';
import { bancoLocalNoAr, entrarComoLocal, novoClienteLocal } from '../test/supabaseLocal';

async function entrarEmConfiguracoes(email: string) {
  window.location.hash = '#/app/evolut/settings';
  render(<Raiz supabase={novoClienteLocal()} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  await screen.findByRole('button', { name: 'Salvar alterações' }, { timeout: 8000 });
}

describe.skipIf(!bancoLocalNoAr)('Configurações → Minha conta (banco local)', () => {
  afterAll(async () => {
    await salvarMinhaConta(await entrarComoLocal('lucas@evolut.com.br'), { nome: 'Lucas Teixeira', cargo: '', fone: '' });
  });

  it('cargo e telefone salvos continuam lá depois de entrar de novo', async () => {
    await entrarEmConfiguracoes('lucas@evolut.com.br');
    fireEvent.change(screen.getByLabelText('Cargo'), { target: { value: 'BDR Sênior' } });
    fireEvent.change(screen.getByPlaceholderText('(11) 90000-0000'), { target: { value: '(11) 95555-1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByText('Dados salvos.', {}, { timeout: 8000 })).toBeInTheDocument();

    cleanup();
    await entrarEmConfiguracoes('lucas@evolut.com.br');
    expect(await screen.findByDisplayValue('BDR Sênior', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByDisplayValue('(11) 95555-1234')).toBeInTheDocument();
  });

  it('cargo não aparece como o papel do sistema quando a pessoa não preencheu', async () => {
    cleanup();
    await salvarMinhaConta(await entrarComoLocal('lucas@evolut.com.br'), { nome: 'Lucas Teixeira', cargo: '', fone: '' });
    await entrarEmConfiguracoes('lucas@evolut.com.br');
    expect((screen.getByLabelText('Cargo') as HTMLInputElement).value).toBe('');
  });

  it('não mostra verificação em duas etapas enquanto ela não existe de verdade', async () => {
    cleanup();
    await entrarEmConfiguracoes('lucas@evolut.com.br');
    expect(screen.queryByRole('switch', { name: 'Verificação em duas etapas' })).not.toBeInTheDocument();
  });
});
