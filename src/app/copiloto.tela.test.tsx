// Seam: Copiloto no modo real, de ponta a ponta com o Supabase local: o pedido vira execução na fila,
// sem plano nem resultado simulados.
import { afterAll, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { adminLocal, bancoLocalNoAr, novoClienteLocal } from '../test/supabaseLocal';

const PEDIDO = 'Gerar lista de importadores do Sul ' + Date.now().toString(36);

describe.skipIf(!bancoLocalNoAr)('Copiloto (banco local)', () => {
  afterAll(async () => {
    await adminLocal().from('executions').delete().like('title', 'Copiloto: ' + PEDIDO + '%');
  });

  it('pedido vira execução de verdade e o copiloto não encena plano nem resultado', async () => {
    window.location.hash = '#/app/evolut/home';
    render(<Raiz supabase={novoClienteLocal()} />);
    fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: 'lucas@evolut.com.br' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.click((await screen.findAllByRole('button', { name: /Copiloto/ }, { timeout: 8000 }))[0]);
    const caixa = await screen.findByPlaceholderText('O que você precisa?');
    expect(screen.queryByText("Lista do Sudeste para a cadência T1–T7")).not.toBeInTheDocument(); // conversa de exemplo do protótipo
    fireEvent.change(caixa, { target: { value: PEDIDO } });
    fireEvent.keyDown(caixa, { key: 'Enter' });
    expect(await screen.findByText(/Pedido enviado ao Copiloto/, {}, { timeout: 8000 })).toBeInTheDocument();
    await new Promise(ok => setTimeout(ok, 1500));
    expect(screen.queryByRole('button', { name: 'Aprovar e executar' })).not.toBeInTheDocument();
    const { data } = await adminLocal().from('executions').select('execution_type').like('title', 'Copiloto: ' + PEDIDO + '%');
    expect(data).toEqual([{ execution_type: 'Pedido ao Copiloto' }]);
  });
});
