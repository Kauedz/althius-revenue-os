// Seam: tela de Canais no modo real, de ponta a ponta com o Supabase local (login → canal → enviar → chamar agente).
import { afterAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { adminLocal, bancoLocalNoAr, novoClienteLocal } from '../test/supabaseLocal';

const MARCA = 'teste-tela-' + Date.now().toString(36);

async function abrirCanal(email: string, slug: string, esperar: string) {
  window.location.hash = '#/app/evolut/channels/' + slug;
  render(<Raiz supabase={novoClienteLocal()} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  await screen.findAllByText(esperar, {}, { timeout: 8000 });
}

describe.skipIf(!bancoLocalNoAr)('Canais (banco local)', () => {
  afterAll(async () => {
    const admin = adminLocal();
    await admin.from('chat_messages').delete().like('content', '%' + MARCA + '%');
    await admin.from('chat_messages').delete().eq('sender_type', 'system').like('content', 'Pedido enviado para %');
    await admin.from('executions').delete().like('title', '%' + MARCA + '%');
  });

  it('mostra as mensagens do banco, sem as do protótipo', async () => {
    await abrirCanal('lucas@evolut.com.br', 'sinais-de-compra', 'Perfeito. Sobe para a cadência T1 hoje à tarde.');
    expect(screen.queryByText('E-mail corporativo da Aline validado. Telefone institucional no dossiê.')).not.toBeInTheDocument();
  });

  it('chamar o agente vira pedido de verdade, sem resposta inventada, e a mensagem continua depois de entrar de novo', async () => {
    cleanup();
    await abrirCanal('lucas@evolut.com.br', 'sinais-de-compra', 'Perfeito. Sobe para a cadência T1 hoje à tarde.');
    const caixa = screen.getByPlaceholderText(/Mensagem em # sinais-de-compra/);
    fireEvent.change(caixa, { target: { value: '@Zoe resume a Serra Azul ' + MARCA } });
    fireEvent.keyDown(caixa, { key: 'Enter' });
    expect(await screen.findByText('Pedido enviado para Zoe. A resposta chega aqui quando terminar.', {}, { timeout: 8000 })).toBeInTheDocument();
    await new Promise(ok => setTimeout(ok, 1800));
    expect(screen.queryByText('Recebido. Levanto isso agora e respondo aqui com as fontes.')).not.toBeInTheDocument();
    cleanup();
    await abrirCanal('lucas@evolut.com.br', 'sinais-de-compra', '@Zoe resume a Serra Azul ' + MARCA);
  });
  it('mencionar um agente que NÃO é o primeiro do canal chama exatamente ele (@Neo em #geral vai para o revops)', async () => {
    cleanup();
    // #geral tem os quatro agentes. A C-level menciona o último: antes da correção o app procurava o nome antigo
    // ("@Agente de RevOps"), não achava e chamava o primeiro agente do canal (o comercial).
    await abrirCanal('aline@evolut.com.br', 'geral', 'Semana de foco em importadores do Sudeste. Qualquer dúvida sobre o ICP, me chamem aqui.');
    const caixa = screen.getByPlaceholderText(/Mensagem em # geral/);
    fireEvent.change(caixa, { target: { value: '@Neo fecha o relatório do ciclo ' + MARCA } });
    fireEvent.keyDown(caixa, { key: 'Enter' });
    expect(await screen.findByText('Pedido enviado para Neo. A resposta chega aqui quando terminar.', {}, { timeout: 8000 })).toBeInTheDocument();
    const { data, error } = await adminLocal().from('executions').select('agent_code').like('title', '%fecha o relatório do ciclo ' + MARCA + '%');
    expect(error).toBeNull();
    expect(data).toEqual([{ agent_code: 'revops' }]);
  });
});
