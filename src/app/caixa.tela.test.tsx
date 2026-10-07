// Seam: Caixa de entrada no modo real (ADR 0068), em formato de conversa, de ponta a ponta com o Supabase local:
// uma conversa por empresa (todas as pessoas dela), canal em cada mensagem, responder escolhendo pessoa e canal pelo
// caminho de envio que já existe, privacidade e "só quem está no CRM" mantidos; no celular, uma tela por vez.
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { adminLocal, bancoLocalNoAr, novoClienteLocal } from '../test/supabaseLocal';

const WS = 'a0000000-0000-0000-0000-000000000001';
const CONVERSA_ALINE = 'c5000000-0000-0000-0000-000000000001';
const MARCA = 'TELA-CAIXA-' + Date.now().toString(36);

async function entrarNaCaixa(email: string) {
  window.location.hash = '#/app/evolut/inbox';
  render(<Raiz supabase={novoClienteLocal()} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  const nav = await screen.findByRole('navigation', { name: 'Empresas' }, { timeout: 8000 });
  await within(nav).findByText('Serra Azul Têxtil', {}, { timeout: 8000 }); // os dados do banco chegaram
  return nav;
}

describe.skipIf(!bancoLocalNoAr)('Caixa de entrada em conversa (banco local)', () => {
  const larguraOriginal = window.innerWidth;
  afterEach(() => { cleanup(); Object.defineProperty(window, 'innerWidth', { value: larguraOriginal, configurable: true }); });
  afterAll(async () => {
    const admin = adminLocal();
    await admin.from('conversations').update({ unread: true }).eq('id', CONVERSA_ALINE);
    await admin.from('executions').delete().eq('title', 'Sugerir resposta para Aline Xavier');
    // Resposta de teste: devolve a reserva pelo caminho normal e apaga.
    const { data } = await admin.from('inbox_replies').select('id, execution_id, estado').eq('workspace_id', WS).like('texto', '%' + MARCA + '%');
    for (const r of data || []) {
      if (r.estado === 'reservada') await admin.from('inbox_replies').update({ estado: 'enviando' }).eq('id', r.id);
      await admin.rpc('inbox_reply_finish', { p_id: r.id, p_ok: false, p_external_message_id: null, p_error: 'teste', p_external_chat_id: null });
      await admin.from('notifications').delete().eq('type', 'resposta_falhou');
      await admin.from('inbox_replies').delete().eq('id', r.id);
      // Reserva e devolução deixaram lançamentos no extrato: saem junto (outros testes contam o extrato da Evolut).
      await admin.from('credit_transactions').delete().like('idempotency_key', 'resposta:' + r.id + '%');
      if (r.execution_id) await admin.from('executions').delete().eq('id', r.execution_id);
    }
  });

  it('BDR: uma conversa por empresa com as mensagens de todas as pessoas e o canal; nada do protótipo nem de outro BDR', async () => {
    const lista = await entrarNaCaixa('lucas@evolut.com.br');
    expect(within(lista).getByText('Serra Azul Têxtil')).toBeInTheDocument();
    expect(within(lista).queryByText('Delta Saúde')).not.toBeInTheDocument(); // conversa da Bruna
    expect(screen.queryByText('Pode me mandar a proposta com os prazos?')).not.toBeInTheDocument(); // só existia no protótipo
    expect(screen.getByText('Só entra quem está no CRM')).toBeInTheDocument();
    fireEvent.click(within(lista).getByText('Serra Azul Têxtil'));
    const log = await screen.findByRole('log', { name: 'Mensagens de Serra Azul Têxtil' }, { timeout: 8000 });
    expect(within(log).getByText('Tenho interesse, mas só no mês que vem.')).toBeInTheDocument();
    expect(within(log).getByText('Vamos marcar 20 minutos na quinta?')).toBeInTheDocument();
    expect(within(log).getByText('Aline Xavier · LinkedIn')).toBeInTheDocument();
    expect(within(log).getByText('Jonas Ribeiro · E-mail')).toBeInTheDocument();
    expect(within(log).getAllByText('Adiar').length).toBeGreaterThan(0); // intenção como etiqueta
  });

  it('responder: escolhe a pessoa e o canal; LinkedIn explica que ainda não envia; e-mail vai para a fila de envio', async () => {
    const lista = await entrarNaCaixa('lucas@evolut.com.br');
    fireEvent.click(within(lista).getByText('Serra Azul Têxtil'));
    const destino = await screen.findByLabelText('Responder para', {}, { timeout: 8000 });
    fireEvent.change(destino, { target: { value: CONVERSA_ALINE } });
    expect(await screen.findByText(/Responder pelo LinkedIn ainda não é possível por aqui/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar resposta' })).toBeDisabled();
    fireEvent.change(destino, { target: { value: 'c5000000-0000-0000-0000-000000000003' } });
    fireEvent.change(screen.getByLabelText('Sua resposta'), { target: { value: 'Combinado, Jonas. ' + MARCA } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar resposta' }));
    expect(await screen.findByText(/Resposta na fila de envio/, {}, { timeout: 8000 })).toBeInTheDocument();
    await waitFor(async () => {
      const { data } = await adminLocal().from('inbox_replies').select('estado, conversation_id').eq('workspace_id', WS).like('texto', '%' + MARCA + '%');
      expect(data).toEqual([{ estado: 'reservada', conversation_id: 'c5000000-0000-0000-0000-000000000003' }]);
    }, { timeout: 8000 });
  });

  it('a resposta automática continua: "Sugerir resposta" ainda vai para a Lia', async () => {
    const lista = await entrarNaCaixa('lucas@evolut.com.br');
    fireEvent.click(within(lista).getByText('Serra Azul Têxtil'));
    fireEvent.change(await screen.findByLabelText('Responder para', {}, { timeout: 8000 }), { target: { value: CONVERSA_ALINE } });
    fireEvent.click(screen.getByRole('button', { name: 'Sugerir resposta' }));
    expect(await screen.findByText(/Pedido enviado para Lia/, {}, { timeout: 8000 })).toBeInTheDocument();
  });

  it('C-level lê todas, mas não responde pela conta do BDR', async () => {
    const lista = await entrarNaCaixa('aline@evolut.com.br');
    expect(within(lista).getByText('Delta Saúde')).toBeInTheDocument();
    fireEvent.click(within(lista).getByText('Serra Azul Têxtil'));
    fireEvent.change(await screen.findByLabelText('Responder para', {}, { timeout: 8000 }), { target: { value: 'c5000000-0000-0000-0000-000000000003' } });
    expect(await screen.findByText(/Só quem conectou esta conta responde por ela/, {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar resposta' })).toBeDisabled();
  });

  it('no celular, uma tela por vez: a lista, depois a conversa com "Voltar"', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    const lista = await entrarNaCaixa('lucas@evolut.com.br');
    expect(screen.queryByRole('log')).not.toBeInTheDocument();
    fireEvent.click(within(lista).getByText('Serra Azul Têxtil'));
    expect(await screen.findByRole('log', { name: 'Mensagens de Serra Azul Têxtil' }, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Empresas' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Voltar para a lista' }));
    expect(await screen.findByRole('navigation', { name: 'Empresas' })).toBeInTheDocument();
  });
});
