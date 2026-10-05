// Seam: conectar a própria conta na Caixa de entrada, no modo real, com o Supabase local. O backend de conexão é falso.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { AlthiusApp } from './AlthiusApp';
import { adminLocal, bancoLocalNoAr, novoClienteLocal } from '../test/supabaseLocal';

async function entrarNaCaixa(email: string) {
  window.location.hash = '#/app/evolut/inbox';
  render(<Raiz supabase={novoClienteLocal()} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  await screen.findByText('Recebi. Me liga amanhã depois das 10h?', {}, { timeout: 8000 });
}

const cartao = (nome: string) => screen.getAllByText(nome).map(e => e.closest('.ix-card') as HTMLElement).find(Boolean)!;

describe.skipIf(!bancoLocalNoAr)('Conexão de contas na Caixa de entrada (banco local)', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await adminLocal().from('messaging_accounts').update({ status: 'connected' }).eq('id', 'ca500000-0000-0000-0000-000000000003');
  });

  it('Conectar Instagram pede o link ao backend com a conta do próprio BDR e abre a janela segura', async () => {
    const abrir = vi.spyOn(AlthiusApp.prototype, 'abrirJanelaDeConexao').mockImplementation(() => {});
    const original = globalThis.fetch;
    const pedidos: Array<{ corpo: any; auth: string }> = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (alvo: any, init?: RequestInit) => {
      if (String(alvo) === '/conexoes/link') {
        pedidos.push({ corpo: JSON.parse(init!.body as string), auth: (init!.headers as Record<string, string>).Authorization });
        return new Response(JSON.stringify({ url: 'https://conectar.exemplo.test/ig' }), { status: 200 });
      }
      return original(alvo, init);
    });
    await entrarNaCaixa('lucas@evolut.com.br');
    expect(within(cartao('Instagram')).getByText('Não conectado')).toBeInTheDocument();
    fireEvent.click(within(cartao('Instagram')).getByRole('button', { name: 'Conectar' }));
    await waitFor(() => expect(abrir).toHaveBeenCalledWith('https://conectar.exemplo.test/ig'), { timeout: 8000 });
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].corpo).toMatchObject({ workspace_id: 'a0000000-0000-0000-0000-000000000001', member_id: 'd0000000-0000-0000-0000-000000000004', provider: 'instagram' });
    expect(pedidos[0].auth).toMatch(/^Bearer .+/);
    // Nenhum QR simulado nem nome do provedor externo na tela
    expect(screen.queryByText('Já escaneei')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/unipile/i);
  });

  it('backend de conexão indisponível: aviso claro, nada de conta falsa conectada', async () => {
    const abrir = vi.spyOn(AlthiusApp.prototype, 'abrirJanelaDeConexao').mockImplementation(() => {});
    const original = globalThis.fetch;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (alvo: any, init?: RequestInit) =>
      String(alvo) === '/conexoes/link' ? new Response('{}', { status: 503 }) : original(alvo, init));
    cleanup();
    await entrarNaCaixa('lucas@evolut.com.br');
    fireEvent.click(within(cartao('Instagram')).getByRole('button', { name: 'Conectar' }));
    expect(await screen.findByText(/ainda não está disponível neste ambiente/, {}, { timeout: 8000 })).toBeInTheDocument();
    expect(abrir).not.toHaveBeenCalled();
    expect(within(cartao('Instagram')).getByText('Não conectado')).toBeInTheDocument();
  });

  it('Desconectar o próprio WhatsApp grava no banco', async () => {
    cleanup();
    await entrarNaCaixa('lucas@evolut.com.br');
    // As conexões chegam do banco um instante depois da lista
    fireEvent.click(await within(cartao('WhatsApp')).findByRole('button', { name: 'Desconectar' }, { timeout: 8000 }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Desconectar' }));
    await waitFor(async () => {
      const { data } = await adminLocal().from('messaging_accounts').select('status').eq('id', 'ca500000-0000-0000-0000-000000000003').single();
      expect(data?.status).toBe('disconnected');
    }, { timeout: 8000 });
    expect(await screen.findByText('Conta desconectada.', {}, { timeout: 8000 })).toBeInTheDocument();
  });
});
