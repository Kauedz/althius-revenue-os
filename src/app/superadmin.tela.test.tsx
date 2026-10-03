// Seam: telas do Superadmin no modo real, de ponta a ponta com o Supabase local.
import { afterAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { adminLocal, bancoLocalNoAr, novoClienteLocal } from '../test/supabaseLocal';

// Endereço único por execução: cliente de teste é arquivado no fim (a auditoria é imutável, não dá para apagar).
const SLUG = 'cliente-tela-' + Date.now().toString(36);

async function entrar(email: string, rota: string, esperar: string) {
  window.location.hash = rota;
  render(<Raiz supabase={novoClienteLocal()} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  await screen.findAllByText(esperar, {}, { timeout: 8000 });
}

describe.skipIf(!bancoLocalNoAr)('Superadmin (banco local)', () => {
  afterAll(async () => {
    const admin = adminLocal();
    const { data } = await admin.from('workspaces').select('id').eq('slug', SLUG).maybeSingle();
    if (!data) return;
    await admin.from('agent_runtime_tokens').update({ revoked_at: new Date().toISOString() }).eq('workspace_id', data.id);
    await admin.from('workspaces').update({ status: 'archived' }).eq('id', data.id);
  });

  it('cria um cliente pelo formulário e gera as chaves dos agentes', async () => {
    await entrar('rafael@althius.com.br', '#/admin/workspaces', 'Evolut Trading');
    fireEvent.click(screen.getByRole('button', { name: 'Novo workspace' }));
    const form = await screen.findByRole('region', { name: 'Novo cliente' });
    fireEvent.change(within(form).getByLabelText('Nome do cliente'), { target: { value: 'Cliente Teste Tela' } });
    fireEvent.change(within(form).getByLabelText('Endereço curto'), { target: { value: SLUG } });
    fireEvent.change(within(form).getByLabelText('E-mail do C-level'), { target: { value: 'ceo@clientetela.com.br' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Criar cliente' }));
    fireEvent.click(await screen.findByText('Cliente Teste Tela', {}, { timeout: 8000 }));
    fireEvent.click(await screen.findByRole('button', { name: 'Gerar chaves dos agentes' }));
    const dialogo = await screen.findByRole('alertdialog', {}, { timeout: 8000 });
    expect(within(dialogo).getByText(/alt_agente_/)).toBeInTheDocument();
  });

  it('formulário mostra o erro do banco sem fechar', async () => {
    cleanup();
    await entrar('rafael@althius.com.br', '#/admin/workspaces', 'Evolut Trading');
    fireEvent.click(screen.getByRole('button', { name: 'Novo workspace' }));
    const form = await screen.findByRole('region', { name: 'Novo cliente' });
    fireEvent.change(within(form).getByLabelText('Nome do cliente'), { target: { value: 'Outro' } });
    fireEvent.change(within(form).getByLabelText('Endereço curto'), { target: { value: 'evolut' } });
    fireEvent.change(within(form).getByLabelText('E-mail do C-level'), { target: { value: 'a@b.com.br' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Criar cliente' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('Já existe um cliente com esse endereço.');
  });

  it('Saúde mostra as verificações reais', async () => {
    cleanup();
    await entrar('rafael@althius.com.br', '#/admin/health', 'Convites aguardando envio');
    expect(screen.getByText('Banco de dados')).toBeInTheDocument();
  });

  it('C-level não abre a área do Superadmin', async () => {
    cleanup();
    await entrar('aline@evolut.com.br', '#/admin/workspaces', 'Início');
    expect(screen.queryByText('Grão Norte Alimentos')).not.toBeInTheDocument();
  });
});
