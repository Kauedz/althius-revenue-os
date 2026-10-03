// Seam: a tela de Aprovações no modo real, de ponta a ponta com o Supabase local.
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  await screen.findByRole('heading', { name: 'Aprovações' }, { timeout: 8000 });
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
});
