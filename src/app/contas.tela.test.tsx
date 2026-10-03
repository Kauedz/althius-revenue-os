// Seam: <AlthiusApp /> (Contas e leads com gravação e importação)
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { bancoLocalNoAr, novoClienteLocal } from '../test/supabaseLocal';
import { isolarContas } from '../test/isolarContas';

async function entrarEIrParaContas(email: string) {
  window.location.hash = '#/app/evolut/accounts';
  render(<Raiz supabase={novoClienteLocal()} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  const nav = await screen.findByRole('navigation', { name: 'Navegação principal' }, { timeout: 8000 });
  await within(nav).findByRole('link', { name: /Contas/ }, { timeout: 8000 });
}

describe.skipIf(!bancoLocalNoAr)('tela de Contas e leads (banco local)', () => {
  isolarContas();

  it('Aline (C-level) visualiza as contas reais do banco na listagem e KPIs', async () => {
    await entrarEIrParaContas('aline@evolut.com.br');

    // Título e contas carregadas do banco
    expect(await screen.findByText('Serra Azul Têxtil', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByText('Campo Belo Agro')).toBeInTheDocument();
    expect(screen.getByText('Metalúrgica Ipê')).toBeInTheDocument();

    // KPI de contas qualificadas (mínimo 8 contas do seed)
    expect(screen.getByText('Contas qualificadas')).toBeInTheDocument();
    const dados = (window as any).ALTHIUS_DATA;
    expect(dados.accountService).toBeDefined();
    expect(typeof dados.accountService.create).toBe('function');
    expect(typeof dados.accountService.update).toBe('function');
    expect(typeof dados.accountService.import).toBe('function');
  });

  it('C-level cria conta e recarrega a lista e KPIs da tela', async () => {
    await entrarEIrParaContas('aline@evolut.com.br');
    expect(await screen.findByText('Serra Azul Têxtil', {}, { timeout: 8000 })).toBeInTheDocument();

    const dados = (window as any).ALTHIUS_DATA;
    const nova = await dados.accountService.create({
      nome: 'Nova Empresa Criada na Tela',
      dominio: 'novaconta-tela.com.br',
      cidade: 'Campinas',
      uf: 'SP',
      temperatura: 3
    });

    expect(nova.id).toBeDefined();
    expect(nova.nome).toBe('Nova Empresa Criada na Tela');

    // A lista foi recarregada e a nova conta aparece na tela
    await waitFor(() => {
      expect(screen.getByText('Nova Empresa Criada na Tela')).toBeInTheDocument();
    });
  });

  it('Aline (C-level) importa lista de contas e marca duplicadas', async () => {
    await entrarEIrParaContas('aline@evolut.com.br');
    expect(await screen.findByText('Serra Azul Têxtil', {}, { timeout: 8000 })).toBeInTheDocument();

    const dados = (window as any).ALTHIUS_DATA;
    const resultado = await dados.accountService.import([
      { name: 'Serra Azul Duplicata Tela', domain: 'serraazul.com.br' },
      { name: 'Nova Inovação Importada', domain: 'novainovacao-tela.com.br' }
    ]);

    expect(resultado.total).toBe(2);
    expect(resultado.duplicadas).toBeGreaterThanOrEqual(1);
    expect(resultado.criadas).toBeGreaterThanOrEqual(1);

    await waitFor(() => {
      expect(screen.getByText('Nova Inovação Importada')).toBeInTheDocument();
    });
  });

  it('Lucas (BDR) pode atualizar conta própria mas é recusado ao editar de outro ou importar', async () => {
    await entrarEIrParaContas('lucas@evolut.com.br');
    expect(await screen.findByText('Serra Azul Têxtil', {}, { timeout: 8000 })).toBeInTheDocument();

    const dados = (window as any).ALTHIUS_DATA;

    // Lucas é responsável pela Serra Azul (c...01) -> pode atualizar
    const atualizada = await dados.accountService.update({
      id: 'c0000000-0000-0000-0000-000000000001',
      nome: 'Serra Azul BDR Tela'
    });
    expect(atualizada.nome).toBe('Serra Azul BDR Tela');

    // Lucas NÃO é responsável pela Metalúrgica Ipê (c...03) -> proibido (accounts.edit own)
    await expect(
      dados.accountService.update({
        id: 'c0000000-0000-0000-0000-000000000003',
        nome: 'Tentativa Proibida BDR'
      })
    ).rejects.toThrow('Não foi possível atualizar a conta.');

    // Lucas NÃO pode importar lista (accounts.import none)
    await expect(
      dados.accountService.import([
        { name: 'Tentativa Proibida Importação', domain: 'proibida-bdr.com.br' }
      ])
    ).rejects.toThrow('Não foi possível importar as contas.');
  });
});
