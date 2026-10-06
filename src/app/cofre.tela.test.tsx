// Seam: tela de Fornecedores (cofre de chaves) do Superadmin, de ponta a ponta com o Supabase local.
// O backend de cofre é falso: cifra de mentira e grava pela chave de serviço, como o servidor real faria.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { adminLocal, bancoLocalNoAr, novoClienteLocal } from '../test/supabaseLocal';

const ROTULO = 'Apify teste tela ' + Date.now().toString(36);
const SEGREDO = 'apify_api_SEGREDO_NUNCA_NA_TELA_9876';

async function entrar(email: string, rota: string, esperar: string) {
  window.location.hash = rota;
  render(<Raiz supabase={novoClienteLocal()} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  await screen.findAllByText(esperar, {}, { timeout: 8000 });
}

describe.skipIf(!bancoLocalNoAr)('Chaves dos fornecedores (banco local)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('superadmin cadastra, testa, desativa e remove uma chave; a chave nunca volta para a tela', async () => {
    const original = globalThis.fetch;
    const pedidos: Array<{ rota: string; corpo: any; auth: string }> = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (alvo: any, init?: RequestInit) => {
      const rota = String(alvo);
      if (rota === '/cofre/guardar') {
        const corpo = JSON.parse(init!.body as string);
        pedidos.push({ rota, corpo, auth: (init!.headers as Record<string, string>).Authorization });
        const { error } = await adminLocal().rpc('cofre_guardar', { p_provedor: corpo.provedor, p_rotulo: corpo.rotulo, p_cifrado: 'v1:aaa:bbb:ccc', p_final: corpo.segredo.slice(-4), p_config: {} });
        return new Response(JSON.stringify({ ok: !error }), { status: error ? 500 : 200 });
      }
      if (rota === '/cofre/testar') {
        pedidos.push({ rota, corpo: JSON.parse(init!.body as string), auth: '' });
        return new Response(JSON.stringify({ ok: false, mensagem: 'Chave recusada pelo fornecedor.' }), { status: 200 });
      }
      return original(alvo, init);
    });

    await entrar('rafael@althius.com.br', '#/admin/providers', 'Fornecedores');
    fireEvent.click(screen.getByRole('button', { name: 'Nova chave' }));
    const form = await screen.findByRole('region', { name: 'Nova chave' });
    const campoChave = within(form).getByLabelText('Chave (não aparece de novo)') as HTMLInputElement;
    expect(campoChave.type).toBe('password'); // digitar não mostra a chave na tela
    fireEvent.change(within(form).getByLabelText('Nome da chave'), { target: { value: ROTULO } });
    fireEvent.change(campoChave, { target: { value: SEGREDO } });
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar no cofre' }));

    // aparece na lista só com a máscara
    const linha = await screen.findByText(ROTULO, {}, { timeout: 8000 });
    expect(linha).toBeInTheDocument();
    expect(document.body.textContent).toContain('…9876');
    expect(document.body.textContent).not.toContain('SEGREDO_NUNCA_NA_TELA');
    expect(pedidos[0].corpo).toMatchObject({ provedor: 'apify', rotulo: ROTULO, segredo: SEGREDO });
    expect(pedidos[0].auth).toMatch(/^Bearer .+/);

    // testar: mostra o veredito
    fireEvent.click(linha);
    fireEvent.click(await screen.findByRole('button', { name: 'Testar chave' }));
    const dialogo = await screen.findByRole('alertdialog', {}, { timeout: 8000 });
    expect(within(dialogo).getByText('Chave recusada pelo fornecedor.')).toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Entendi' }));

    // desativar
    fireEvent.click(screen.getByText(ROTULO));
    fireEvent.click(await screen.findByRole('button', { name: 'Ativar ou desativar' }));
    await waitFor(() => expect(screen.getAllByText('Inativo').length).toBeGreaterThan(0), { timeout: 8000 });

    // remover (pede confirmação)
    fireEvent.click(screen.getByText(ROTULO));
    fireEvent.click(await screen.findByRole('button', { name: 'Remover chave' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remover chave' }));
    await waitFor(() => expect(screen.queryByText(ROTULO)).not.toBeInTheDocument(), { timeout: 8000 });
  });

  it('formulário recusa chave curta sem chamar o servidor', async () => {
    cleanup();
    const espia = vi.spyOn(globalThis, 'fetch');
    await entrar('rafael@althius.com.br', '#/admin/providers', 'Fornecedores');
    espia.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Nova chave' }));
    const form = await screen.findByRole('region', { name: 'Nova chave' });
    fireEvent.change(within(form).getByLabelText('Nome da chave'), { target: { value: 'x' } });
    fireEvent.change(within(form).getByLabelText('Chave (não aparece de novo)'), { target: { value: 'curta' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar no cofre' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('Cole a chave inteira.');
    expect(espia.mock.calls.some(c => String(c[0]) === '/cofre/guardar')).toBe(false);
  });

  it('app de integração (HubSpot): exige o ID do cliente e o envia na configuração, sem repetir o segredo na tela', async () => {
    cleanup();
    const original = globalThis.fetch;
    const guardados: any[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (alvo: any, init?: RequestInit) => {
      if (String(alvo) === '/cofre/guardar') { guardados.push(JSON.parse(init!.body as string)); return new Response(JSON.stringify({ ok: true }), { status: 200 }); }
      return original(alvo, init);
    });
    await entrar('rafael@althius.com.br', '#/admin/providers', 'Fornecedores');
    fireEvent.click(screen.getByRole('button', { name: 'Nova chave' }));
    const form = await screen.findByRole('region', { name: 'Nova chave' });
    fireEvent.change(within(form).getByLabelText('Fornecedor'), { target: { value: 'integracao_app' } });
    fireEvent.change(within(form).getByLabelText('Nome da chave'), { target: { value: 'hubspot' } });
    fireEvent.change(within(form).getByLabelText('Chave (não aparece de novo)'), { target: { value: 'segredo-do-app-123456' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar no cofre' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('Cole o ID do cliente do app.');
    expect(guardados).toHaveLength(0);
    fireEvent.change(within(form).getByLabelText(/^ID do cliente/), { target: { value: '1b69203f-e24e-4bce-990e-c9471504ed73' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar no cofre' }));
    await waitFor(() => expect(guardados).toHaveLength(1));
    expect(guardados[0]).toMatchObject({ provedor: 'integracao_app', rotulo: 'hubspot', config: { client_id: '1b69203f-e24e-4bce-990e-c9471504ed73' } });
    expect(document.body.textContent).not.toContain('segredo-do-app-123456');
  });

  it('C-level não abre Fornecedores', async () => {
    cleanup();
    await entrar('aline@evolut.com.br', '#/admin/providers', 'Início');
    expect(screen.queryByRole('button', { name: 'Nova chave' })).not.toBeInTheDocument();
  });
});
