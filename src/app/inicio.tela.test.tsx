// Seam: <AlthiusApp /> (Tela de Início)
﻿// Seam: a tela de Início no modo real, de ponta a ponta com o Supabase local.
import { describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { bancoLocalNoAr, novoClienteLocal } from '../test/supabaseLocal';

async function entrarEIrParaHome(email: string, ws = 'evolut') {
  window.location.hash = '#/app/' + ws + '/home';
  render(<Raiz supabase={novoClienteLocal()} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  const nav = await screen.findByRole('navigation', { name: 'Navegação principal' }, { timeout: 8000 });
  await within(nav).findByRole('link', { name: /Início/ }, { timeout: 8000 });
}

describe.skipIf(!bancoLocalNoAr)('tela de Início (banco local)', () => {
  it('C-level vê créditos e operações do banco no Início', async () => {
    await entrarEIrParaHome('aline@evolut.com.br');
    // Saldo disponível real do banco (7.950)
    expect(await screen.findByText('7.950', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByText('Créditos disponíveis')).toBeInTheDocument();
    // Execuções ativas do banco (3)
    expect((await screen.findAllByText('3', {}, { timeout: 8000 })).length).toBeGreaterThan(0);
    // Título da tela
    expect(screen.getAllByText(/Evolut Trading/).length).toBeGreaterThan(0);
  });

  it('BDR vê somente suas 4 contas atribuídas no Início', async () => {
    await entrarEIrParaHome('lucas@evolut.com.br');
    // BDR tem o KPI de Contas qualificadas na Home, com valor 4
    expect(await screen.findByText('Contas qualificadas', {}, { timeout: 8000 })).toBeInTheDocument();
    expect((await screen.findAllByText('4', {}, { timeout: 8000 })).length).toBeGreaterThan(0);
  });
  const INVENTADOS = ['R$ 4,8 mi', '1.946', 'R$ 30.000', '188 contas', '27 estados', 'Douglas Quites', 'Serra Azul Têxtil · fit 96', 'Importação sem risco'];

  it('Evolut: mapa é do banco, sem período inventado e sem nada do protótipo', async () => {
    cleanup();
    await entrarEIrParaHome('aline@evolut.com.br');
    // 8 contas ativas em 6 estados (SP 3 + AM, MG, MT, PR, SC), sem filtro de "30/60 dias" que não existe no banco
    expect(await screen.findByText('8 contas com localização · 6 estados', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Período do mapa' })).not.toBeInTheDocument();
    for (const x of INVENTADOS) expect(screen.queryByText(x, { exact: false }), x).not.toBeInTheDocument();
  });

  it('workspace vazio (Grão Norte): "Sem dados ainda" onde não há fonte, zero onde há, e nada do protótipo', async () => {
    cleanup();
    await entrarEIrParaHome('eduardo@graonorte.com.br', 'grao');
    expect(await screen.findByText('0 contas com localização · 0 estados', {}, { timeout: 8000 })).toBeInTheDocument();
    expect((await screen.findAllByText('Sem dados ainda', {}, { timeout: 8000 })).length).toBeGreaterThanOrEqual(2);
    for (const x of INVENTADOS) expect(screen.queryByText(x, { exact: false }), x).not.toBeInTheDocument();
  });
});
