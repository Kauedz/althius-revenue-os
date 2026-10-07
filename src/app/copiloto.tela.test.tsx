// Seam: Copiloto no modo real (ADR 0068), de ponta a ponta com o Supabase local: a pergunta entra na conversa privada,
// a resposta (gravada aqui no lugar do serviço `copiloto`) aparece sozinha, o encaminhamento abre a conversa com o agente
// e a falha diz a verdade. Nada de plano encenado, execução na fila ou crédito gasto.
import { afterAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { adminLocal, bancoLocalNoAr, novoClienteLocal } from '../test/supabaseLocal';

const MARCA = Date.now().toString(36);
const PERGUNTA = 'Ache clínicas em Campinas ' + MARCA;
const WS = 'a0000000-0000-0000-0000-000000000001';

async function abrirCopiloto(email = 'lucas@evolut.com.br') {
  window.location.hash = '#/app/evolut/home';
  render(<Raiz supabase={novoClienteLocal()} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  fireEvent.click((await screen.findAllByRole('button', { name: /Copiloto/ }, { timeout: 8000 }))[0]);
  return screen.findByPlaceholderText('O que você precisa?');
}

async function responderComoServico(pergunta: string, resposta: { texto?: string; encaminhar?: string; falha?: string }) {
  const admin = adminLocal();
  let id = '';
  await waitFor(async () => {
    const { data } = await admin.from('copilot_messages').select('id').eq('workspace_id', WS).eq('texto', pergunta).single();
    expect(data).toBeTruthy();
    id = data!.id;
  }, { timeout: 8000 });
  await admin.from('copilot_messages').update({ estado: 'processando' }).eq('id', id);
  if (resposta.falha) await admin.rpc('copilot_fail', { p_id: id, p_motivo: resposta.falha });
  else await admin.rpc('copilot_answer', { p_id: id, p_texto: resposta.texto, p_encaminhar: resposta.encaminhar ?? null });
}

describe.skipIf(!bancoLocalNoAr)('Copiloto (banco local)', () => {
  afterAll(async () => { await adminLocal().from('copilot_messages').delete().eq('workspace_id', WS).like('texto', '%' + MARCA + '%'); });

  it('pergunta, vê "respondendo", a resposta chega sozinha e o encaminhamento abre a conversa com a Zoe; nada vira execução', async () => {
    const execAntes = (await adminLocal().from('executions').select('id', { count: 'exact', head: true }).eq('workspace_id', WS)).count;
    const caixa = await abrirCopiloto();
    expect(screen.queryByText('Encontre empresas do setor têxtil com sinais de expansão.')).not.toBeInTheDocument(); // exemplo do protótipo
    expect(screen.getByText(/não é um dos agentes/)).toBeInTheDocument();
    fireEvent.change(caixa, { target: { value: PERGUNTA } });
    fireEvent.keyDown(caixa, { key: 'Enter' });
    fireEvent.keyDown(caixa, { key: 'Enter' });
    expect(await screen.findByText(PERGUNTA, {}, { timeout: 8000 })).toBeInTheDocument();
    expect(await screen.findByText('O Copiloto está respondendo…', {}, { timeout: 8000 })).toBeInTheDocument();

    await responderComoServico(PERGUNTA, { texto: 'Buscar empresas novas é com a Zoe ' + MARCA + '. Ela diz o custo antes.', encaminhar: 'comercial' });
    expect(await screen.findByText('Buscar empresas novas é com a Zoe ' + MARCA + '. Ela diz o custo antes.', {}, { timeout: 10000 })).toBeInTheDocument();
    const { data } = await adminLocal().from('copilot_messages').select('id').eq('workspace_id', WS).eq('texto', PERGUNTA);
    expect(data).toHaveLength(1); // Enter duas vezes não duplicou
    expect((await adminLocal().from('executions').select('id', { count: 'exact', head: true }).eq('workspace_id', WS)).count).toBe(execAntes);

    fireEvent.click(screen.getByRole('button', { name: 'Abrir conversa com Zoe' }));
    await waitFor(() => expect(window.location.hash).toBe('#/app/evolut/agents/comercial'));
  });

  it('sem modelo, a resposta diz a verdade', async () => {
    cleanup();
    const caixa = await abrirCopiloto();
    fireEvent.change(caixa, { target: { value: 'Quantas contas? ' + MARCA } });
    fireEvent.keyDown(caixa, { key: 'Enter' });
    await responderComoServico('Quantas contas? ' + MARCA, { falha: 'o modelo de IA não está configurado' });
    expect(await screen.findByText('Não consegui responder agora: o modelo de IA não está configurado.', {}, { timeout: 10000 })).toBeInTheDocument();
  });

  it('a conversa é privada: a C-level não vê o que o BDR perguntou', async () => {
    cleanup();
    await abrirCopiloto('aline@evolut.com.br');
    await new Promise(r => setTimeout(r, 1500));
    expect(screen.queryByText(PERGUNTA)).not.toBeInTheDocument();
  });
});
