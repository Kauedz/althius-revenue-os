// Seam: Configurações → Minha conta ENQUANTO o perfil ainda não chegou do banco (modo real, Supabase local).
// Antes: o campo Cargo mostrava o papel do sistema ("BDR/SDR") e dava para salvar sem os dados reais carregados.
// Aqui a leitura do perfil é atrasada de propósito, então o resultado não depende da velocidade do computador.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { salvarMinhaConta } from './servicos/conta';
import { adminLocal, bancoLocalNoAr, entrarComoLocal, novoClienteComPerfilLento } from '../test/supabaseLocal';

const ATRASO_MS = 2000;

async function abrirConfiguracoesComPerfilLento(email: string) {
  window.location.hash = '#/app/evolut/settings';
  render(<Raiz supabase={novoClienteComPerfilLento(ATRASO_MS)} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  await screen.findByRole('button', { name: 'Salvar alterações' }, { timeout: 8000 });
}

describe.skipIf(!bancoLocalNoAr)('Configurações → Minha conta enquanto o perfil carrega (banco local)', () => {
  beforeAll(async () => {
    await salvarMinhaConta(await entrarComoLocal('lucas@evolut.com.br'), { nome: 'Lucas Teixeira', cargo: 'BDR Sênior', fone: '(11) 95555-1234' });
  });
  afterAll(async () => {
    await salvarMinhaConta(await entrarComoLocal('lucas@evolut.com.br'), { nome: 'Lucas Teixeira', cargo: '', fone: '' });
  });

  it('o campo Cargo não mostra o papel do sistema (BDR/SDR) enquanto o perfil não chegou', async () => {
    cleanup();
    await abrirConfiguracoesComPerfilLento('lucas@evolut.com.br');
    expect((screen.getByLabelText('Cargo') as HTMLInputElement).value).toBe('');
    // Quando o perfil chega, aparece o cargo de verdade.
    expect(await screen.findByDisplayValue('BDR Sênior', {}, { timeout: 8000 })).toBeInTheDocument();
  });

  it('salvar antes de o perfil chegar não apaga cargo e telefone que já estão no banco', async () => {
    cleanup();
    await abrirConfiguracoesComPerfilLento('lucas@evolut.com.br');
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Lucas T.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByText(/ainda estão carregando/, {}, { timeout: 4000 })).toBeInTheDocument();
    const { data, error } = await adminLocal().from('profiles').select('name, job_title, phone').eq('email', 'lucas@evolut.com.br').single();
    expect(error).toBeNull();
    expect(data).toEqual({ name: 'Lucas Teixeira', job_title: 'BDR Sênior', phone: '(11) 95555-1234' });
  });
});
