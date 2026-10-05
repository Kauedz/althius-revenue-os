// Seam: Pipeline e Tarefas no modo real, de ponta a ponta com o Supabase local (login → tela → ação → banco).
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { adminLocal, bancoLocalNoAr, novoClienteLocal } from '../test/supabaseLocal';

const WS = 'a0000000-0000-0000-0000-000000000001';
const PROTOTIPO = ['Norte Log Transportes', 'Outbound · Importadores', 'Vértice Indústria', 'Meridian Saúde'];

async function entrar(email: string, pagina: string, esperar: RegExp | string) {
  window.location.hash = `#/app/evolut/${pagina}`;
  render(<Raiz supabase={novoClienteLocal()} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  await screen.findAllByText(esperar, {}, { timeout: 8000 });
}

describe.skipIf(!bancoLocalNoAr)('Pipeline e Tarefas (banco local)', () => {
  const adm = adminLocal();
  afterEach(async () => {
    cleanup();
    await adm.from('opportunities').delete().eq('workspace_id', WS);
    await adm.from('pipelines').delete().eq('workspace_id', WS).not('name', 'like', '% (Geral)');
    await adm.from('tasks').delete().eq('workspace_id', WS).eq('source', 'manual');
  });

  it('Pipeline: mostra o quadro padrão do banco, sem nada do protótipo', async () => {
    await entrar('aline@evolut.com.br', 'pipeline', 'SLG (Geral)');
    for (const nome of PROTOTIPO) expect(screen.queryByText(nome, { exact: false })).not.toBeInTheDocument();
    expect(screen.getByText('1 de 5 quadros')).toBeInTheDocument();
  });

  it('Pipeline: o C-level cria um quadro e um negócio, e os dois ficam no banco', async () => {
    await entrar('aline@evolut.com.br', 'pipeline', 'SLG (Geral)');
    fireEvent.click(screen.getByRole('button', { name: 'Novo quadro' }));
    expect(await screen.findByText('2 de 5 quadros', {}, { timeout: 8000 })).toBeInTheDocument();
    const { data: quadros } = await adm.from('pipelines').select('name').eq('workspace_id', WS).eq('motion', 'slg');
    expect(quadros).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Novo negócio' }));
    const modal = await screen.findByRole('dialog', {}, { timeout: 8000 });
    fireEvent.change(within(modal).getAllByRole('combobox')[0], { target: { value: 'c0000000-0000-0000-0000-000000000001' } });
    fireEvent.change(within(modal).getByPlaceholderText('25000'), { target: { value: '45000' } });
    fireEvent.click(within(modal).getByRole('button', { name: 'Criar negócio' }));
    await waitFor(async () => {
      const { data } = await adm.from('opportunities').select('amount, stage_key, title').eq('workspace_id', WS);
      expect(data).toEqual([{ amount: 45000, stage_key: 'entrada', title: 'Serra Azul Têxtil' }]);
    }, { timeout: 8000 });
    expect(await screen.findByText('Serra Azul Têxtil', { exact: false }, { timeout: 8000 })).toBeInTheDocument();
  });

  it('Pipeline: BDR não tem o botão de criar quadro', async () => {
    await entrar('lucas@evolut.com.br', 'pipeline', 'SLG (Geral)');
    expect(screen.queryByRole('button', { name: 'Novo quadro' })).not.toBeInTheDocument();
  });

  it('Tarefas: BDR vê só as dele, sem as do protótipo, e cria uma tarefa para si no banco', async () => {
    await entrar('lucas@evolut.com.br', 'tasks', 'Nova tarefa');
    expect(screen.queryByText('Ligar para Aline Xavier')).not.toBeInTheDocument(); // linha do protótipo
    expect(screen.queryByText('Gatekeeper T2 · Metalúrgica Ipê')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nova tarefa' }));
    const modal = await screen.findByRole('dialog', {}, { timeout: 8000 });
    fireEvent.change(within(modal).getByPlaceholderText('Ex.: Ligar para Aline e confirmar a reunião'), { target: { value: 'Ligar para o decisor' } });
    // A lista de contas é a do workspace (banco), não a fixa do desenho
    const contas = within(modal).getAllByRole('combobox')[0] as HTMLSelectElement;
    expect(Array.from(contas.options).map(o => o.value)).toContain('c0000000-0000-0000-0000-000000000001');
    expect(Array.from(contas.options).map(o => o.value)).not.toContain('a1');
    fireEvent.change(contas, { target: { value: 'c0000000-0000-0000-0000-000000000001' } });
    fireEvent.click(within(modal).getByRole('button', { name: 'Criar tarefa' }));
    await waitFor(async () => {
      const { data } = await adm.from('tasks').select('title, channel, assignee_member_id, status, account_id').eq('workspace_id', WS);
      expect(data).toEqual([{ title: 'Ligar para o decisor', channel: 'call', assignee_member_id: 'd0000000-0000-0000-0000-000000000004', status: 'pendente', account_id: 'c0000000-0000-0000-0000-000000000001' }]);
    }, { timeout: 8000 });
    expect(await screen.findByText('Ligar para o decisor', {}, { timeout: 8000 })).toBeInTheDocument();
  });

  it('Tarefas: concluir pela linha grava no banco', async () => {
    await adm.from('tasks').insert({ workspace_id: WS, title: 'Mandar proposta', channel: 'email', assignee_member_id: 'd0000000-0000-0000-0000-000000000004', due_at: new Date(Date.now() + 3600_000).toISOString(), source: 'manual' });
    await entrar('lucas@evolut.com.br', 'tasks', 'Mandar proposta');
    fireEvent.click(screen.getByText('Mandar proposta'));
    fireEvent.click(await screen.findByRole('button', { name: 'Concluir' }, { timeout: 8000 }));
    await waitFor(async () => {
      const { data } = await adm.from('tasks').select('status, completed_at').eq('title', 'Mandar proposta').single();
      expect(data?.status).toBe('concluida');
      expect(data?.completed_at).toBeTruthy();
    }, { timeout: 8000 });
  });

  it('Pipeline: mudar a etapa pelo negócio grava o histórico com quem mudou', async () => {
    const { data: quadro } = await adm.from('pipelines').select('id').eq('workspace_id', WS).eq('motion', 'slg').single();
    const { data: negocio } = await adm.from('opportunities').insert({ workspace_id: WS, pipeline_id: quadro!.id, account_id: 'c0000000-0000-0000-0000-000000000001', title: 'Serra Azul Têxtil', amount: 30000, owner_member_id: 'd0000000-0000-0000-0000-000000000004' }).select('id').single();
    await entrar('lucas@evolut.com.br', 'pipeline', 'Serra Azul Têxtil');
    fireEvent.click(screen.getAllByText('Serra Azul Têxtil')[0]);
    const modal = await screen.findByRole('dialog', {}, { timeout: 8000 });
    fireEvent.click(within(modal).getByRole('button', { name: 'Proposta' }));
    fireEvent.click(within(modal).getByRole('button', { name: 'Salvar' }));
    await waitFor(async () => {
      const { data } = await adm.from('opportunity_stage_history').select('from_stage_key, to_stage_key, moved_by_member_id').eq('opportunity_id', negocio!.id);
      expect(data).toEqual([{ from_stage_key: 'entrada', to_stage_key: 'proposta', moved_by_member_id: 'd0000000-0000-0000-0000-000000000004' }]);
    }, { timeout: 8000 });
  });
});
