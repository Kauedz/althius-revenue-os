// Equipe no front v18: ações reais, erros e isolamento durante troca de workspace.
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { AlthiusApp } from './AlthiusApp';
import { carregarContexto } from './contexto';
import { montarDados } from './dados';
import * as equipeServico from './servicos/equipe';
import { adminLocal, entrarComoLocal } from '../test/supabaseLocal';
import { EVOLUT_EQUIPE as EVOLUT, GRAO_EQUIPE as GRAO, isolarEquipe, membroEquipe as m } from '../test/isolarEquipe';

const demo = { data: window.ALTHIUS_DATA!, caps: window.ALTHIUS_CAPS };
async function abrirEquipe(email = 'aline@evolut.com.br') {
  const c = await entrarComoLocal(email);
  const dados = montarDados(await carregarContexto(c), demo.data, demo.caps);
  window.ALTHIUS_DATA = dados;
  window.ALTHIUS_CAPS = dados.CAPS;
  window.location.hash = '#/app/evolut/settings';
  const ref = createRef<AlthiusApp>();
  render(<AlthiusApp ref={ref} dados={dados} supabase={c} aoSair={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: /Workspace e membros/ }));
  await screen.findByRole('heading', { name: 'Workspace e membros' });
  return { c, app: ref };
}
afterEach(() => vi.restoreAllMocks());

describe('Equipe e convites na tela (banco local)', () => {
  isolarEquipe();
  it('registra convite no banco e mostra envio pendente, sem afirmar e-mail enviado', async () => {
    await abrirEquipe();
    const input = await screen.findByLabelText('E-mail do convidado');
    fireEvent.change(input, { target: { value: 'equipe-teste-tela@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar convite' }));
    await screen.findByText(/Convite registrado · envio de e-mail pendente/, {}, { timeout: 5000 });
    const { data, error } = await adminLocal().from('workspace_invites').select('email, workspace_id, delivery_status').eq('email', 'equipe-teste-tela@example.test');
    expect(error).toBeNull();
    expect(data).toMatchObject([{ email: 'equipe-teste-tela@example.test', workspace_id: EVOLUT, delivery_status: 'pending' }]);
    expect(screen.queryByText(/Convite enviado/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Papel de Aline Xavier')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar convite para equipe-teste-tela@example.test' }));
    const dialogo = await screen.findByRole('alertdialog', { name: 'Cancelar convite?' });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar convite' }));
    await waitFor(() => expect(screen.queryByText(/Convite registrado · envio de e-mail pendente/)).not.toBeInTheDocument());
    const cancelado = await adminLocal().from('workspace_invites').select('status').eq('email', 'equipe-teste-tela@example.test').single();
    expect(cancelado.data?.status).toBe('canceled');
  });
  it('muda papel de outro membro e a tela reflete a gravação', async () => {
    await abrirEquipe();
    fireEvent.change(await screen.findByLabelText('Papel de Lucas Teixeira'), { target: { value: 'cliente' } });
    await waitFor(async () => {
      const r = await adminLocal().from('workspace_members').select('role').eq('id', m(4)).single();
      expect(r.error).toBeNull();
      expect(r.data?.role).toBe('clevel');
    });
    await waitFor(() => expect(screen.getByLabelText('Papel de Lucas Teixeira')).toHaveValue('cliente'));
  });
  it('suspende membro, preservando seu registro e revogando o acesso', async () => {
    await abrirEquipe();
    fireEvent.click(await screen.findByRole('button', { name: 'Suspender Mateus Maia' }));
    const dialogo = await screen.findByRole('alertdialog', { name: 'Suspender Mateus Maia?' });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Suspender' }));
    await waitFor(async () => expect((await adminLocal().from('workspace_members').select('status').eq('id', m(5)).single()).data?.status).toBe('suspended'));
    await screen.findByText(/Evolut Trading · suspenso/, {}, { timeout: 5000 });
    const r = await adminLocal().from('workspace_members').select('status').eq('id', m(5)).single();
    expect(r.data?.status).toBe('suspended');
    expect((await equipeServico.listarEquipe(await entrarComoLocal('mateus@evolut.com.br'), EVOLUT)).membros).toEqual([]);
  });
  it('troca para Grão Norte e protege seu único C-level', async () => {
    const listar = vi.spyOn(equipeServico, 'listarEquipe');
    await abrirEquipe('camila@althius.com.br');
    await waitFor(() => expect(listar).toHaveBeenCalledWith(expect.anything(), EVOLUT));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Workspace' })).getByRole('radio', { name: 'Grão Norte Alimentos' }));
    await waitFor(() => expect(listar).toHaveBeenCalledWith(expect.anything(), GRAO));
    await screen.findAllByText('Eduardo Lins');
    expect(screen.queryByLabelText('Papel de Eduardo Lins')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suspender Eduardo Lins' })).not.toBeInTheDocument();
    expect(screen.queryByText('Lucas Teixeira')).not.toBeInTheDocument();
  });
  it('erro de leitura deixa lista vazia e permite Tentar de novo', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(equipeServico, 'listarEquipe').mockRejectedValueOnce(new Error('Sem conexão para carregar a equipe.'));
    await abrirEquipe();
    const dialogo = await screen.findByRole('alertdialog', { name: 'Equipe não carregada' });
    expect(dialogo).toHaveTextContent('Sem conexão');
    expect(screen.queryByText('Lucas Teixeira')).not.toBeInTheDocument();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Tentar de novo' }));
    await screen.findByLabelText('Papel de Lucas Teixeira');
  });
  it('falha ao mudar papel mantém o banco e permite repetir a mesma ação', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const mudar = vi.spyOn(equipeServico, 'mudarPapelEquipe').mockRejectedValueOnce(new Error('Não foi possível atualizar o papel. Tentar de novo.'));
    await abrirEquipe();
    fireEvent.change(await screen.findByLabelText('Papel de Lucas Teixeira'), { target: { value: 'cliente' } });
    const dialogo = await screen.findByRole('alertdialog', { name: 'Alteração da equipe não registrada' });
    expect(dialogo).toHaveTextContent('Não foi possível atualizar o papel');
    expect((await adminLocal().from('workspace_members').select('role').eq('id', m(4)).single()).data?.role).toBe('bdr');
    expect(screen.getByLabelText('Papel de Lucas Teixeira')).toHaveValue('bdr');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(screen.getByLabelText('Papel de Lucas Teixeira')).toHaveValue('cliente'));
    expect(mudar).toHaveBeenCalledTimes(2);
  });
  it('falha atrasada de gravação não abre aviso após sair de Equipe', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let terminar!: () => void;
    const atrasado = new Promise<void>(ok => { terminar = ok; });
    const mudar = vi.spyOn(equipeServico, 'mudarPapelEquipe').mockImplementation(async () => {
      await atrasado;
      throw new Error('Falha atrasada ao mudar papel.');
    });
    await abrirEquipe();
    fireEvent.change(await screen.findByLabelText('Papel de Lucas Teixeira'), { target: { value: 'cliente' } });
    await waitFor(() => expect(mudar).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /Minha conta/ }));
    await screen.findByRole('heading', { name: 'Minha conta' });
    await act(async () => { terminar(); });
    expect(screen.queryByRole('alertdialog', { name: 'Alteração da equipe não registrada' })).not.toBeInTheDocument();
  });
  it('resposta atrasada da Evolut não aparece após trocar para Grão Norte', async () => {
    const original = equipeServico.listarEquipe;
    const evolut = await original(await entrarComoLocal('camila@althius.com.br'), EVOLUT);
    let resolver!: (valor: equipeServico.Equipe) => void;
    const atrasado = new Promise<equipeServico.Equipe>(ok => { resolver = ok; });
    const listar = vi.spyOn(equipeServico, 'listarEquipe').mockImplementation((c, w) => w === EVOLUT ? atrasado : original(c, w));
    await abrirEquipe('camila@althius.com.br');
    await waitFor(() => expect(listar).toHaveBeenCalledWith(expect.anything(), EVOLUT));
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Workspace' })).getByRole('radio', { name: 'Grão Norte Alimentos' }));
    await screen.findAllByText('Eduardo Lins');
    await act(async () => { resolver(evolut); });
    expect(screen.queryByText('Lucas Teixeira')).not.toBeInTheDocument();
    expect(screen.getAllByText('Eduardo Lins').length).toBeGreaterThan(0);
  });
});
