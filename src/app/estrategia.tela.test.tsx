// Seam: a tela de Estratégia no modo real, de ponta a ponta com o Supabase local (ADR 0064).
import { describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { bancoLocalNoAr, novoClienteLocal } from '../test/supabaseLocal';

const PROTOTIPO = ['3.420', 'Importadores de médio porte · Sudeste', 'Excluir tradings concorrentes', 'Indústrias do Nordeste', 'aprovado em 12 set'];

async function entrar(email: string, ws: string) {
  window.location.hash = `#/app/${ws}/strategy`;
  render(<Raiz supabase={novoClienteLocal()} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
}

describe.skipIf(!bancoLocalNoAr)('tela de Estratégia (banco local)', () => {
  it('workspace sem Playbook (Grão Norte): mostra o que existe e nada do protótipo, sem "Nova hipótese"', async () => {
    cleanup();
    await entrar('eduardo@graonorte.com.br', 'grao');
    expect(await screen.findByText('Playbooks publicados', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(await screen.findByText('CEO')).toBeInTheDocument();
    for (const x of PROTOTIPO) expect(screen.queryByText(x, { exact: false }), x).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nova hipótese' })).not.toBeInTheDocument();
  });

  it('Evolut: os Playbooks publicados dos 4 agentes aparecem com a versão real', async () => {
    cleanup();
    await entrar('aline@evolut.com.br', 'evolut');
    expect(await screen.findByText('Playbook · Zoe', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByText('v3.2')).toBeInTheDocument();
    for (const x of PROTOTIPO) expect(screen.queryByText(x, { exact: false }), x).not.toBeInTheDocument();
  });
});
