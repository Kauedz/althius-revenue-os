// Conta de mensagem que cai: aviso em pop-up (ADR 0071). A ponte diz que a conta caiu (a sincronia grava "desconectada" ou
// "attention"), a pessoa dona entra e vê o pop-up, uma vez, com o caminho para reconectar. Quem não é dono não vê nada.
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { minhasContasComProblema, textoDoAvisoDeConexao } from './servicos/caixa';
import { adminLocal, bancoLocalNoAr, entrarComoLocal, novoClienteLocal } from '../test/supabaseLocal';

const WS = 'a0000000-0000-0000-0000-000000000001';
const CONTA_LUCAS_LINKEDIN = 'ca500000-0000-0000-0000-000000000002';

describe('texto do pop-up', () => {
  it('uma conta que pede nova autorização', () => {
    const t = textoDoAvisoDeConexao([{ provider: 'linkedin', status: 'attention', canal: 'LinkedIn' }]);
    expect(t.titulo).toBe('Conta desconectada');
    expect(t.texto).toContain('A conexão do seu LinkedIn pede uma nova autorização.');
    expect(t.texto).toContain('o histórico continuam guardados');
  });
  it('uma conta que foi desligada', () => {
    expect(textoDoAvisoDeConexao([{ provider: 'whatsapp', status: 'disconnected', canal: 'WhatsApp' }]).texto).toContain('A conexão do seu WhatsApp foi desconectada.');
  });
  it('várias contas: lista todas e usa o plural', () => {
    const t = textoDoAvisoDeConexao([
      { provider: 'linkedin', status: 'disconnected', canal: 'LinkedIn' }, { provider: 'whatsapp', status: 'attention', canal: 'WhatsApp' }, { provider: 'google', status: 'disconnected', canal: 'e-mail (Gmail)' }
    ]);
    expect(t.titulo).toBe('Contas desconectadas');
    expect(t.texto).toContain('LinkedIn, WhatsApp e e-mail (Gmail)');
    expect(t.texto).toContain('por elas');
  });
});

describe.skipIf(!bancoLocalNoAr)('conta desconectada (banco local)', () => {
  const adm = adminLocal();
  afterEach(() => cleanup());
  afterAll(async () => { await adm.from('messaging_accounts').update({ status: 'connected' }).eq('id', CONTA_LUCAS_LINKEDIN); });

  it('o serviço lista só as contas da própria pessoa que caíram', async () => {
    await adm.from('messaging_accounts').update({ status: 'connected' }).eq('id', CONTA_LUCAS_LINKEDIN);
    const lucas = await entrarComoLocal('lucas@evolut.com.br');
    expect(await minhasContasComProblema(lucas, WS)).toEqual([]);
    await adm.from('messaging_accounts').update({ status: 'disconnected' }).eq('id', CONTA_LUCAS_LINKEDIN);
    expect(await minhasContasComProblema(lucas, WS)).toEqual([{ provider: 'linkedin', status: 'disconnected', canal: 'LinkedIn' }]);
    // Outra pessoa não vê a conta do Lucas, nem o gestor.
    expect(await minhasContasComProblema(await entrarComoLocal('bruna@evolut.com.br'), WS)).toEqual([]);
    expect(await minhasContasComProblema(await entrarComoLocal('aline@evolut.com.br'), WS)).toEqual([]);
  });

  it('a dona entra e vê o pop-up com o caminho para reconectar; quem não é dona não vê', async () => {
    await adm.from('messaging_accounts').update({ status: 'disconnected' }).eq('id', CONTA_LUCAS_LINKEDIN);
    window.location.hash = '#/app/evolut/home';
    render(<Raiz supabase={novoClienteLocal()} />);
    fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: 'lucas@evolut.com.br' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Conta desconectada', {}, { timeout: 15000 })).toBeInTheDocument();
    expect(screen.getByText(/A conexão do seu LinkedIn foi desconectada/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reconectar agora' }));
    await waitFor(() => expect(window.location.hash).toBe('#/app/evolut/inbox'), { timeout: 5000 });
  });

  it('quem não é dono da conta (a gestora) entra e não vê pop-up', async () => {
    await adm.from('messaging_accounts').update({ status: 'disconnected' }).eq('id', CONTA_LUCAS_LINKEDIN);
    window.location.hash = '#/app/evolut/home';
    render(<Raiz supabase={novoClienteLocal()} />);
    fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: 'aline@evolut.com.br' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findAllByText('Evolut Trading', {}, { timeout: 15000 }); // entrou e os dados chegaram
    await new Promise(r => setTimeout(r, 2500)); // tempo de sobra para um pop-up aparecer, se fosse aparecer
    expect(screen.queryByText('Conta desconectada')).not.toBeInTheDocument();
  }, 30000);
});
