// Seam: a tela de Aprovações no modo real, de ponta a ponta com o Supabase local.
import { describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { adminLocal, bancoLocalNoAr, novoClienteLocal } from '../test/supabaseLocal';
import { isolarAprovacoes } from '../test/isolarAprovacoes';

const COPY_SERRA_AZUL = 'ac000000-0000-0000-0000-000000000001';

async function entrarEIrPara(email: string, rota: string) {
  render(<Raiz supabase={novoClienteLocal()} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  const nav = await screen.findByRole('navigation', { name: 'Navegação principal' }, { timeout: 8000 });
  await within(nav).findByRole('link', { name: /Início/ }, { timeout: 8000 });
  window.location.hash = rota;
  // O título da primeira aprovação também aparece na Home; só siga após navegar.
  await screen.findAllByRole('heading', { name: 'Aprovações' }, { timeout: 8000 });
}

describe.skipIf(!bancoLocalNoAr)('tela de Aprovações (banco local)', () => {
  isolarAprovacoes([COPY_SERRA_AZUL]);

  it('C-level vê a fila do banco e aprova: a decisão fica gravada', async () => {
    await entrarEIrPara('aline@evolut.com.br', '#/app/evolut/approvals');
    expect((await screen.findAllByText('E-mails T1 — Serra Azul Têxtil', {}, { timeout: 8000 })).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Atualizar etapa de 78 negócios').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }));

    await waitFor(async () => {
      const { data } = await adminLocal().from('approvals').select('status').eq('id', COPY_SERRA_AZUL).single();
      expect(data?.status).toBe('aprovado');
    }, { timeout: 8000 });
  });

  it('ADR 0064: pedido de créditos à Althius não tem botão de decidir para o C-level; o superadmin decide', async () => {
    const adm = adminLocal();
    const payload = { creditos: 10000, para: 'althius' };
    const { data: criado, error } = await adm.from('approvals').insert({
      workspace_id: 'a0000000-0000-0000-0000-000000000001', category: 'gasto', approval_type: 'creditos', title: 'Pedido de 10000 créditos à Althius',
      description: 'A Althius confere o pedido e libera os créditos.', requested_by_member_id: 'd0000000-0000-0000-0000-000000000003', status: 'pendente',
      payload_json: payload, payload_hash: 'x', estimated_credits: 10000
    }).select('id').single();
    if (error) throw error;
    try {
      cleanup();
      await entrarEIrPara('aline@evolut.com.br', '#/app/evolut/approvals');
      fireEvent.click((await screen.findAllByText('Pedido de 10000 créditos à Althius', {}, { timeout: 8000 }))[0]);
      expect(await screen.findByText('Decisão da Althius')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Aprovar' })).not.toBeInTheDocument();
      cleanup();
      await entrarEIrPara('rafael@althius.com.br', '#/app/evolut/approvals');
      fireEvent.click((await screen.findAllByText('Pedido de 10000 créditos à Althius', {}, { timeout: 8000 }))[0]);
      expect(await screen.findByRole('button', { name: 'Aprovar' })).toBeInTheDocument();
    } finally {
      await adm.from('notifications').delete().eq('entity_id', criado!.id);
      await adm.from('approvals').delete().eq('id', criado!.id);
    }
  });
});
