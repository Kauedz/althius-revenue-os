// Seam: Prospecção no modo real (ADR 0067), de ponta a ponta com o Supabase local (login → tela → banco).
// As candidatas vêm de uma busca gravada direto no banco (a Apify nunca é chamada em teste).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { adminLocal, bancoLocalNoAr, novoClienteLocal } from '../test/supabaseLocal';

const WS = 'a0000000-0000-0000-0000-000000000001';
const BUSCA = 'c8388888-0000-0000-0000-000000000001';
const SITES = ['tela-prosp-um.test', 'tela-prosp-dois.test', 'tela-prosp-tres.test'];

async function entrar(email: string, esperar: string) {
  window.location.hash = '#/app/evolut/prospecting';
  render(<Raiz supabase={novoClienteLocal()} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  await screen.findAllByText(esperar, {}, { timeout: 8000 });
}

describe.skipIf(!bancoLocalNoAr)('Prospecção (banco local)', () => {
  const adm = adminLocal();
  const limpar = async () => {
    await adm.from('prospect_searches').delete().eq('id', BUSCA);
    await adm.from('accounts').delete().eq('workspace_id', WS).in('domain', SITES);
  };
  beforeEach(async () => {
    await limpar();
    const s = await adm.from('prospect_searches').insert({ id: BUSCA, workspace_id: WS, agent_code: 'comercial', source_code: 'google_maps',
      titulo: 'Google Maps: TELA-PROSP · Campinas', parametros: { busca: 'TELA-PROSP', local: 'Campinas' }, max_empresas: 10, creditos_estimados: 10,
      estado: 'concluida', creditos_cobrados: 3, encontradas: 3, repetidas: 1 });
    expect(s.error).toBeNull();
    const c = await adm.from('prospect_candidates').insert([
      { workspace_id: WS, search_id: BUSCA, chave: 'tela-prosp:1', nome: 'TELA-PROSP Um', dominio: SITES[0], cidade: 'Campinas', uf: 'SP', categoria: 'Dentista', fonte: 'Google Maps' },
      { workspace_id: WS, search_id: BUSCA, chave: 'tela-prosp:2', nome: 'TELA-PROSP Dois', cidade: 'Campinas', uf: 'SP', fonte: 'Google Maps' },
      { workspace_id: WS, search_id: BUSCA, chave: 'tela-prosp:3', nome: 'TELA-PROSP Três', dominio: SITES[2], fonte: 'Google Maps' }
    ]);
    expect(c.error).toBeNull();
  });
  afterEach(async () => { cleanup(); await limpar(); });

  it('mostra as candidatas e o estado da busca; nada do protótipo, nada em dólar', async () => {
    await entrar('camila@althius.com.br', 'TELA-PROSP Um');
    expect(screen.getByText('TELA-PROSP Dois')).toBeInTheDocument();
    expect(screen.getAllByText('Sem site').length).toBeGreaterThan(0);
    expect(screen.getByText(/Google Maps: TELA-PROSP · Campinas: concluída, 3 novas, 1 repetida, 3 créditos/)).toBeInTheDocument();
    for (const t of ['Importadores do Sudeste', 'feira Intermodal', '1.946']) expect(screen.queryByText(t, { exact: false }), t).not.toBeInTheDocument();
    expect(screen.queryByText(/US\$/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pedir à Zoe' })).toBeInTheDocument();
  });

  it('incluir com site vira conta; sem site pede o site; excluir marca como excluída', async () => {
    await entrar('camila@althius.com.br', 'TELA-PROSP Um');
    fireEvent.click(screen.getByText('TELA-PROSP Um'));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'TELA-PROSP Um' }, { timeout: 8000 })).getByRole('button', { name: 'Incluir' }));
    expect(await screen.findByText(/Conta criada/, {}, { timeout: 8000 })).toBeInTheDocument();
    await waitFor(async () => {
      const { data } = await adm.from('accounts').select('name, city').eq('workspace_id', WS).eq('domain', SITES[0]);
      expect(data).toEqual([{ name: 'TELA-PROSP Um', city: 'Campinas' }]);
    }, { timeout: 8000 });

    fireEvent.click(await screen.findByText('TELA-PROSP Dois', {}, { timeout: 8000 }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'TELA-PROSP Dois' }, { timeout: 8000 })).getByRole('button', { name: 'Incluir' }));
    fireEvent.change(await screen.findByLabelText('Site da empresa', {}, { timeout: 8000 }), { target: { value: 'https://www.tela-prosp-dois.test/' } });
    expect(screen.getByText('Site de TELA-PROSP Dois')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Incluir como conta' }));
    await waitFor(async () => {
      const { data } = await adm.from('accounts').select('name').eq('workspace_id', WS).eq('domain', SITES[1]);
      expect(data).toEqual([{ name: 'TELA-PROSP Dois' }]);
    }, { timeout: 8000 });

    fireEvent.click(await screen.findByText('TELA-PROSP Três', {}, { timeout: 8000 }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'TELA-PROSP Três' }, { timeout: 8000 })).getByRole('button', { name: 'Excluir' }));
    // Excluir pede confirmação: o crédito da busca não volta.
    expect(await screen.findByText(/O crédito da busca já foi gasto e não volta/, {}, { timeout: 8000 })).toBeInTheDocument();
    const confirmar = screen.getAllByRole('button', { name: 'Excluir' });
    fireEvent.click(confirmar[confirmar.length - 1]);
    await waitFor(async () => {
      const { data } = await adm.from('prospect_candidates').select('estado').eq('chave', 'tela-prosp:3');
      expect(data).toEqual([{ estado: 'excluida' }]);
    }, { timeout: 8000 });
  });

  it('"Incluir todas com site" inclui de uma vez as que têm site', async () => {
    await entrar('aline@evolut.com.br', 'TELA-PROSP Um');
    fireEvent.click(screen.getByRole('button', { name: 'Incluir todas com site' }));
    await waitFor(async () => {
      const { data } = await adm.from('prospect_candidates').select('chave, estado').eq('search_id', BUSCA).order('chave');
      expect(data).toEqual([{ chave: 'tela-prosp:1', estado: 'incluida' }, { chave: 'tela-prosp:2', estado: 'candidata' }, { chave: 'tela-prosp:3', estado: 'incluida' }]);
    }, { timeout: 8000 });
  });

  it('BDR vê as candidatas mas não inclui nem exclui', async () => {
    await entrar('lucas@evolut.com.br', 'TELA-PROSP Um');
    expect(screen.queryByRole('button', { name: 'Incluir todas com site' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('TELA-PROSP Um'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Incluir' })).not.toBeInTheDocument());
  });
});
