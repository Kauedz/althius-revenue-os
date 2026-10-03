// Seam: tela de Canais no modo real, de ponta a ponta com o Supabase local (login → canal → enviar → chamar agente).
import { afterAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { adminLocal, bancoLocalNoAr, novoClienteLocal } from '../test/supabaseLocal';

const MARCA = 'teste-tela-' + Date.now().toString(36);

async function abrirCanal(email: string, slug: string, esperar: string) {
  window.location.hash = '#/app/evolut/channels/' + slug;
  render(<Raiz supabase={novoClienteLocal()} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  await screen.findAllByText(esperar, {}, { timeout: 8000 });
}

describe.skipIf(!bancoLocalNoAr)('Canais (banco local)', () => {
  afterAll(async () => {
    const admin = adminLocal();
    await admin.from('chat_messages').delete().like('content', '%' + MARCA + '%');
    await admin.from('chat_messages').delete().eq('sender_type', 'system').like('content', 'Pedido enviado ao Agente Comercial%');
    await admin.from('executions').delete().like('title', '%' + MARCA + '%');
  });

  it('mostra as mensagens do banco, sem as do protótipo', async () => {
    await abrirCanal('lucas@evolut.com.br', 'sinais-de-compra', 'Perfeito. Sobe para a cadência T1 hoje à tarde.');
    expect(screen.queryByText('E-mail corporativo da Aline validado. Telefone institucional no dossiê.')).not.toBeInTheDocument();
  });

  it('chamar o agente vira pedido de verdade, sem resposta inventada, e a mensagem continua depois de entrar de novo', async () => {
    cleanup();
    await abrirCanal('lucas@evolut.com.br', 'sinais-de-compra', 'Perfeito. Sobe para a cadência T1 hoje à tarde.');
    const caixa = screen.getByPlaceholderText(/Mensagem em # sinais-de-compra/);
    fireEvent.change(caixa, { target: { value: '@Agente Comercial resume a Serra Azul ' + MARCA } });
    fireEvent.keyDown(caixa, { key: 'Enter' });
    expect(await screen.findByText('Pedido enviado ao Agente Comercial. A resposta chega aqui quando ele terminar.', {}, { timeout: 8000 })).toBeInTheDocument();
    await new Promise(ok => setTimeout(ok, 1800));
    expect(screen.queryByText('Recebido. Levanto isso agora e respondo aqui com as fontes.')).not.toBeInTheDocument();
    cleanup();
    await abrirCanal('lucas@evolut.com.br', 'sinais-de-compra', '@Agente Comercial resume a Serra Azul ' + MARCA);
  });
});
