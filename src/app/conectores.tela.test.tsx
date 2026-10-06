// Seam: página de Integrações no modo real. Nenhum conector do catálogo conecta de verdade ainda: tudo "Em breve",
// nada marcado como conectado e nenhuma autorização simulada.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { bancoLocalNoAr, novoClienteLocal } from '../test/supabaseLocal';

async function entrar(email: string) {
  window.location.hash = '#/app/evolut/integrations';
  render(<Raiz supabase={novoClienteLocal()} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  await screen.findByLabelText('Buscar conector', {}, { timeout: 8000 });
}

describe.skipIf(!bancoLocalNoAr)('Integrações (modo real, banco local)', () => {
  it('todo conector aparece como "Em breve", desabilitado, e nenhum vem marcado como conectado', async () => {
    cleanup();
    await entrar('camila@althius.com.br');
    expect(screen.getByText(/Em breve: estes conectores ainda não estão disponíveis/)).toBeInTheDocument();
    expect(screen.getByText(/Caixa de entrada/)).toBeInTheDocument();
    const botoes = screen.getAllByRole('button', { name: /\(em breve\)$/ });
    expect(botoes.length).toBeGreaterThanOrEqual(30);
    for (const b of botoes) { expect(b).toBeDisabled(); expect(b).toHaveTextContent('Em breve'); }
    expect(screen.queryByText('Conectado')).not.toBeInTheDocument();
    expect(screen.queryByText('Reconectar')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Conectar / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Gerenciar / })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('camila@althius.com.br · '); // nada de conta de exemplo
  });

  it('clicar em um conector não abre a autorização simulada', async () => {
    cleanup();
    await entrar('camila@althius.com.br');
    const hubspot = screen.getByRole('button', { name: 'HubSpot (em breve)' });
    fireEvent.click(hubspot);
    expect(screen.queryByText(/Aguardando/)).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(hubspot.closest('.con-card') as HTMLElement).queryByText('Conectado')).not.toBeInTheDocument();
  });
});

describe.skipIf(!bancoLocalNoAr)('Sinais (modo real, banco local)', () => {
  it('avisa que a coleta automática ainda não está ligada', async () => {
    cleanup();
    window.location.hash = '#/app/evolut/signals';
    render(<Raiz supabase={novoClienteLocal()} />);
    fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: 'camila@althius.com.br' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect((await screen.findAllByText(/Coleta automática em breve/, {}, { timeout: 8000 })).length).toBeGreaterThan(0);
  });
});
