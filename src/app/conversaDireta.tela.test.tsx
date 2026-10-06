// Seam: a aba Conversa de um agente no modo real (banco local). Conversa direta e privada: a pessoa escreve, o agente "pensa"
// e responde (aqui a resposta do agente é gravada pelo teste, no lugar do Hermes), e só ela vê a conversa.
// Atenção: com o ciclo real dos agentes ligado (npm run agentes:local -- rodar) o agente de verdade responde primeiro:
// desligue o ciclo ao rodar este teste.
import { afterAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { adminLocal, bancoLocalNoAr, novoClienteLocal } from '../test/supabaseLocal';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const PERGUNTA = 'CANÁRIO-CONVERSA-7741: quais contas devo priorizar?';
const RESPOSTA = 'Resposta da Zoe CANÁRIO-9902';

async function entrarNaConversa(email: string, agente = 'comercial') {
  window.location.hash = `#/app/evolut/agents/${agente}`;
  render(<Raiz supabase={novoClienteLocal()} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  fireEvent.click(await screen.findByRole('tab', { name: 'Conversa' }, { timeout: 8000 }));
  await screen.findByLabelText('Mensagem', {}, { timeout: 8000 });
}

describe.skipIf(!bancoLocalNoAr)('Conversa direta com o agente (banco local)', () => {
  afterAll(async () => {
    const admin = adminLocal();
    const { data } = await admin.from('chat_channels').select('id').eq('workspace_id', EVOLUT).eq('kind', 'direto').like('description', '%CANÁRIO-CONVERSA-7741%');
    const ids = (data || []).map(c => c.id as string);
    if (ids.length) {
      await admin.from('agent_channel_queue').delete().in('channel_id', ids);
      await admin.from('agent_channel_runs').delete().in('channel_id', ids);
      // O pedido ao agente também abre uma execução (fila de Execuções): sem apagar, as telas de Execuções e Início contam uma a mais.
      await admin.from('executions').delete().eq('workspace_id', EVOLUT).in('metadata_json->>channel_id', ids);
      await admin.from('chat_channels').delete().in('id', ids);
    }
  });

  it('o protótipo some: nada de conversas, "plano" nem resposta fixa inventados', async () => {
    await entrarNaConversa('aline@evolut.com.br');
    for (const falso of ['Prioridades de hoje', 'Revisão da lista Sudeste', 'Objeções de câmbio', 'Plano antes de ação sensível', 'Aprovar plano']) {
      expect(screen.queryByText(falso), falso).not.toBeInTheDocument();
    }
  });

  it('escreve para a Zoe, vê "pensando", recebe a resposta sozinho; a conversa vira uma thread com título da primeira mensagem', async () => {
    cleanup();
    await entrarNaConversa('aline@evolut.com.br');
    const caixa = screen.getByLabelText('Mensagem') as HTMLTextAreaElement;
    fireEvent.change(caixa, { target: { value: PERGUNTA } });
    fireEvent.keyDown(caixa, { key: 'Enter' });

    expect((await screen.findAllByText(PERGUNTA, {}, { timeout: 8000 })).length).toBeGreaterThan(0);
    expect(await screen.findByText('Gerando resposta', {}, { timeout: 8000 })).toBeInTheDocument(); // o agente está respondendo
    expect(await screen.findByText(PERGUNTA.slice(0, 39).trimEnd() + '…')).toBeInTheDocument(); // a thread, com o título da primeira mensagem

    // a resposta do agente (no lugar do Hermes) aparece sem recarregar a tela
    const admin = adminLocal();
    const { data: canal } = await admin.from('chat_channels').select('id').eq('workspace_id', EVOLUT).eq('kind', 'direto').like('description', 'CANÁRIO-CONVERSA-7741%').single();
    await admin.from('chat_messages').insert({ workspace_id: EVOLUT, channel_id: canal!.id, sender_type: 'agent', sender_agent_id: 'comercial', content: RESPOSTA });
    await admin.from('agent_channel_queue').update({ status: 'done' }).eq('channel_id', canal!.id);
    expect(await screen.findByText(RESPOSTA, {}, { timeout: 12000 })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Gerando resposta')).not.toBeInTheDocument(), { timeout: 8000 });
  });

  it('a conversa continua depois de recarregar e é PRIVADA: outra pessoa do cliente não a vê', async () => {
    cleanup();
    await entrarNaConversa('aline@evolut.com.br');
    expect(await screen.findByText(RESPOSTA, {}, { timeout: 12000 })).toBeInTheDocument();
    cleanup();
    await entrarNaConversa('camila@althius.com.br');
    await new Promise(r => setTimeout(r, 1500));
    expect(screen.queryByText(RESPOSTA)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('CANÁRIO-CONVERSA-7741');
  });

  it('a conversa direta não aparece na lista de Canais', async () => {
    cleanup();
    window.location.hash = '#/app/evolut/channels';
    render(<Raiz supabase={novoClienteLocal()} />);
    fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: 'aline@evolut.com.br' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findAllByText(/geral/i, {}, { timeout: 8000 });
    await new Promise(r => setTimeout(r, 1000));
    expect(document.body.textContent).not.toMatch(/dm-comercial/);
    expect(document.body.textContent).not.toContain('CANÁRIO-CONVERSA-7741');
  });
});
