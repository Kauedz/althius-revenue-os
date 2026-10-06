// Seam: página de Integrações no modo real (banco local; o backend de conexão é falso). Os apps com servidor oficial e os
// canais de mensagem conectam de verdade; o resto fica "Em breve" COM o motivo. Nada aparece conectado sem estar.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { AlthiusApp } from './AlthiusApp';
import { adminLocal, bancoLocalNoAr, novoClienteLocal } from '../test/supabaseLocal';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const ALINE = 'd0000000-0000-0000-0000-000000000003'; // C-level da Evolut

async function entrar(email = 'aline@evolut.com.br') {
  window.location.hash = '#/app/evolut/integrations';
  render(<Raiz supabase={novoClienteLocal()} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  await screen.findByLabelText('Buscar conector', {}, { timeout: 8000 });
}
const cartao = (nome: string) => screen.getAllByText(nome).map(e => e.closest('.con-card') as HTMLElement).find(Boolean)!;

/** Backend de conexão falso: anota o que a tela pediu e devolve o que o teste mandar. */
function backendFalso(resposta: (caminho: string, corpo: any) => { status: number; corpo: unknown }) {
  const pedidos: Array<{ caminho: string; corpo: any; auth: string }> = [];
  const original = globalThis.fetch;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (alvo: any, init?: RequestInit) => {
    const caminho = String(alvo);
    if (!caminho.startsWith('/integracoes/') && caminho !== '/conexoes/link') return original(alvo, init);
    const corpo = JSON.parse(init!.body as string);
    pedidos.push({ caminho, corpo, auth: (init!.headers as Record<string, string>).Authorization });
    const r = resposta(caminho, corpo);
    return new Response(JSON.stringify(r.corpo), { status: r.status });
  });
  return pedidos;
}

const salvarAcessoDoNotion = (conta: string) => adminLocal().rpc('integration_access_save', {
  p_workspace_id: EVOLUT, p_member_id: ALINE, p_integration_id: 'notion', p_conta: conta, p_portal: null, p_access_cifrado: 'v1:x',
  p_refresh_cifrado: null, p_expira_em: null, p_client_id: 'c', p_issuer: 'https://e.test', p_escopo: null
});

describe.skipIf(!bancoLocalNoAr)('Integrações (modo real, banco local)', () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
    await adminLocal().rpc('integration_withdraw', { p_workspace_id: EVOLUT, p_member_id: ALINE, p_integration_id: 'notion' });
  });

  it('o que existe de verdade pode conectar; o resto fica "Em breve", desabilitado e com o motivo', async () => {
    cleanup();
    await entrar();
    // Disponíveis: o app com servidor oficial e os cinco canais de mensagem.
    for (const nome of ['Notion', 'Gmail', 'Outlook', 'WhatsApp Business', 'Instagram', 'LinkedIn Sales Navigator']) {
      expect(within(cartao(nome)).getByRole('button', { name: `Conectar ${nome}` }), nome).toBeEnabled();
    }
    // Em breve, com o motivo visível.
    expect(screen.getByRole('button', { name: 'HubSpot (em breve)' })).toBeDisabled();
    expect(within(cartao('HubSpot')).getByText(/app do HubSpot/)).toBeInTheDocument();
    expect(within(cartao('Slack')).getByText(/Marketplace/)).toBeInTheDocument();
    expect(within(cartao('Salesforce')).getByText(/cada cliente/i)).toBeInTheDocument();
    expect(within(cartao('Zoho CRM')).getByText(/API do Zoho/)).toBeInTheDocument();
    expect(screen.queryByText(/Em breve: estes conectores ainda não estão disponíveis/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/US\$|unipile/i);
  });

  it('Conectar um app pede o link ao backend com o login e o membro da pessoa e abre a janela do app', async () => {
    cleanup();
    const abrir = vi.spyOn(AlthiusApp.prototype, 'abrirJanelaDeConexao').mockImplementation(() => {});
    const pedidos = backendFalso(() => ({ status: 200, corpo: { url: 'https://mcp.notion.com/authorize?state=x' } }));
    await entrar();
    fireEvent.click(within(cartao('Notion')).getByRole('button', { name: 'Conectar Notion' }));
    await waitFor(() => expect(abrir).toHaveBeenCalledWith('https://mcp.notion.com/authorize?state=x'), { timeout: 8000 });
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].caminho).toBe('/integracoes/iniciar');
    expect(pedidos[0].corpo).toEqual({ workspaceId: EVOLUT, membroId: ALINE, integracao: 'notion' });
    expect(pedidos[0].auth).toMatch(/^Bearer .+/);
    expect(within(cartao('Notion')).queryByText(/^Conta:/)).not.toBeInTheDocument(); // só depois do retorno do app
  });

  it('Conectar o Gmail usa o MESMO caminho do catálogo (o backend repassa ao canal de mensagens)', async () => {
    cleanup();
    const abrir = vi.spyOn(AlthiusApp.prototype, 'abrirJanelaDeConexao').mockImplementation(() => {});
    const pedidos = backendFalso(() => ({ status: 200, corpo: { url: 'https://hospedado.exemplo.test/conectar' } }));
    await entrar();
    fireEvent.click(within(cartao('Gmail')).getByRole('button', { name: 'Conectar Gmail' }));
    await waitFor(() => expect(abrir).toHaveBeenCalledWith('https://hospedado.exemplo.test/conectar'), { timeout: 8000 });
    expect(pedidos[0].caminho).toBe('/integracoes/iniciar');
    expect(pedidos[0].corpo).toEqual({ workspaceId: EVOLUT, membroId: ALINE, integracao: 'gmail' });
  });

  it('o backend recusa ou está desligado: aviso claro e nada aparece conectado', async () => {
    cleanup();
    const abrir = vi.spyOn(AlthiusApp.prototype, 'abrirJanelaDeConexao').mockImplementation(() => {});
    backendFalso(() => ({ status: 503, corpo: { erro: 'integracoes_indisponiveis' } }));
    await entrar();
    fireEvent.click(within(cartao('Notion')).getByRole('button', { name: 'Conectar Notion' }));
    expect(await screen.findByText(/não está disponível neste ambiente/, {}, { timeout: 8000 })).toBeInTheDocument();
    expect(abrir).not.toHaveBeenCalled();
    expect(within(cartao('Notion')).queryByText(/^Conta:/)).not.toBeInTheDocument();
  });

  it('um app já conectado mostra a conta e "Gerenciar"; desconectar chama o backend e volta para "Conectar"', async () => {
    cleanup();
    await salvarAcessoDoNotion('Acme Ltda');
    const pedidos = backendFalso(caminho => {
      if (caminho === '/integracoes/desconectar') { void adminLocal().rpc('integration_disconnect', { p_workspace_id: EVOLUT, p_member_id: ALINE, p_integration_id: 'notion' }); return { status: 200, corpo: { ok: true } }; }
      return { status: 404, corpo: {} };
    });
    await entrar();
    const c = cartao('Notion');
    expect(await within(c).findByText('Conta: Acme Ltda', {}, { timeout: 8000 })).toBeInTheDocument();
    fireEvent.click(within(c).getByRole('button', { name: 'Gerenciar Notion' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Desconectar' }));
    await waitFor(() => expect(pedidos.map(p => p.caminho)).toContain('/integracoes/desconectar'), { timeout: 8000 });
    expect(pedidos.find(p => p.caminho === '/integracoes/desconectar')!.corpo).toEqual({ workspaceId: EVOLUT, integracao: 'notion' });
    expect(await within(cartao('Notion')).findByRole('button', { name: 'Conectar Notion' }, { timeout: 8000 })).toBeEnabled();
  });

  it('acesso revogado pelo app aparece como "Reconectar"', async () => {
    cleanup();
    await salvarAcessoDoNotion('Acme');
    await adminLocal().rpc('integration_access_mark', { p_workspace_id: EVOLUT, p_member_id: ALINE, p_integration_id: 'notion', p_estado: 'precisa_reconectar' });
    await entrar();
    expect(await within(cartao('Notion')).findByText(/Precisa reconectar/, {}, { timeout: 8000 })).toBeInTheDocument();
    expect(within(cartao('Notion')).getByRole('button', { name: 'Conectar Notion' })).toHaveTextContent('Reconectar');
  });

  it('quando o app devolve a pessoa, a tela diz o resultado e limpa o endereço', async () => {
    cleanup();
    window.history.replaceState(null, '', '/?conexao=ok&integracao=notion');
    await entrar();
    expect(await screen.findByText('Notion conectado', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(window.location.search).toBe('');
  });

  it('retorno com erro (ex.: a pessoa recusou) explica sem culpar o sistema', async () => {
    cleanup();
    window.history.replaceState(null, '', '/?conexao=erro&integracao=notion&motivo=recusada');
    await entrar();
    expect(await screen.findByText(/Você não autorizou a conexão/, {}, { timeout: 8000 })).toBeInTheDocument();
    expect(window.location.search).toBe('');
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
