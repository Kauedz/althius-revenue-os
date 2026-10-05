// Seam: Copiloto no modo real, de ponta a ponta com o Supabase local: o pedido vira execução na fila,
// sem plano nem resultado simulados; envio duplo não duplica; pedido acima do teto vai para Aprovações.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { adminLocal, bancoLocalNoAr, novoClienteLocal } from '../test/supabaseLocal';

const MARCA = Date.now().toString(36);
const PEDIDO = 'Gerar lista de importadores do Sul ' + MARCA;
const PEDIDO_CARO = 'Pedido acima do teto ' + MARCA;
const WS = 'a0000000-0000-0000-0000-000000000001';

async function abrirCopiloto() {
  window.location.hash = '#/app/evolut/home';
  render(<Raiz supabase={novoClienteLocal()} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: 'lucas@evolut.com.br' } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  fireEvent.click((await screen.findAllByRole('button', { name: /Copiloto/ }, { timeout: 8000 }))[0]);
  return screen.findByPlaceholderText('O que você precisa?');
}

describe.skipIf(!bancoLocalNoAr)('Copiloto (banco local)', () => {
  let configOriginal: Record<string, unknown> | null = null;

  beforeAll(async () => {
    const { data } = await adminLocal().from('workspace_settings').select('credit_mode, approval_threshold').eq('workspace_id', WS).single();
    configOriginal = data;
  });

  afterAll(async () => {
    if (configOriginal) await adminLocal().from('workspace_settings').update(configOriginal).eq('workspace_id', WS);
    const admin = adminLocal();
    const { data: aprovacoes } = await admin.from('approvals').select('id').like('title', 'Copiloto: ' + PEDIDO_CARO + '%');
    const ids = (aprovacoes || []).map(a => a.id);
    if (ids.length) {
      await admin.from('notifications').delete().in('entity_id', ids);
      await admin.from('approvals').delete().in('id', ids);
    }
    await admin.from('executions').delete().like('title', 'Copiloto: ' + MARCA + '%');
    await admin.from('executions').delete().like('title', 'Copiloto: ' + PEDIDO + '%');
  });

  it('pedido vira execução de verdade, sem encenar, e Enter duas vezes não duplica', async () => {
    const caixa = await abrirCopiloto();
    expect(screen.queryByText("Lista do Sudeste para a cadência T1–T7")).not.toBeInTheDocument(); // conversa de exemplo do protótipo
    fireEvent.change(caixa, { target: { value: PEDIDO } });
    fireEvent.keyDown(caixa, { key: 'Enter' });
    fireEvent.keyDown(caixa, { key: 'Enter' });
    expect(await screen.findByText(/Pedido registrado na fila/, {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByText(/ainda aguarda processamento/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprovar e executar' })).not.toBeInTheDocument();
    await waitFor(async () => {
      const { data } = await adminLocal().from('executions').select('execution_type').like('title', 'Copiloto: ' + PEDIDO + '%');
      expect(data).toEqual([{ execution_type: 'Pedido ao Copiloto' }]);
    });
  });

  it('pedido acima do teto vai para Aprovações e não aparece como falha', async () => {
    await adminLocal().from('workspace_settings').update({ credit_mode: 'approval', approval_threshold: 0 }).eq('workspace_id', WS);
    const caixa = await abrirCopiloto();
    fireEvent.change(caixa, { target: { value: PEDIDO_CARO } });
    fireEvent.keyDown(caixa, { key: 'Enter' });
    expect(await screen.findByText(/Pedido enviado para Aprovações/, {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.queryByText('Pedido não enviado')).not.toBeInTheDocument();
    const { data } = await adminLocal().from('approvals').select('status').like('title', 'Copiloto: ' + PEDIDO_CARO + '%');
    expect(data).toEqual([{ status: 'pendente' }]);
  });
});
