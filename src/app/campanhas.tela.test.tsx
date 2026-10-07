// Seam: Campanhas e Cadências no modo real, de ponta a ponta com o Supabase local (login → tela → formulário → banco).
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { adminLocal, bancoLocalNoAr, novoClienteLocal } from '../test/supabaseLocal';

const WS = 'a0000000-0000-0000-0000-000000000001';
const PROTOTIPO = ['Importação sem risco · Q4', 'Evento Intermodal', 'Remarketing de visitantes', 'Guia de conta e ordem', 'Importadores T1–T7', 'Gatekeeper T1–T5', 'R$ 30.000'];

async function entrar(email: string, pagina: string, esperar: string) {
  window.location.hash = `#/app/evolut/${pagina}`;
  render(<Raiz supabase={novoClienteLocal()} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  await screen.findAllByText(esperar, {}, { timeout: 8000 });
}

describe.skipIf(!bancoLocalNoAr)('Campanhas e Cadências (banco local)', () => {
  const adm = adminLocal();
  afterEach(async () => {
    cleanup();
    const { data: ap } = await adm.from('approvals').select('id').eq('workspace_id', WS).eq('payload_json->>acao', 'verba_campanha');
    const ids = (ap ?? []).map(a => a.id);
    if (ids.length) {
      await adm.from('notifications').delete().in('entity_id', ids);
      await adm.from('approvals').delete().in('id', ids);
    }
    await adm.from('campaigns').delete().eq('workspace_id', WS);
    await adm.from('cadences').delete().eq('workspace_id', WS);
  });

  it('Campanhas é uma lista simples (ADR 0064): sem os seis cartões de canal; o Meta Ads aparece como "em breve"', async () => {
    await entrar('camila@althius.com.br', 'campaigns', 'Nova campanha');
    expect(screen.queryByText('O que o agente faz')).not.toBeInTheDocument();
    expect(screen.queryByText(/cuida de todos os canais/)).not.toBeInTheDocument();
    expect(screen.queryByText(/conectores ativos/)).not.toBeInTheDocument();
    for (const bruto of ['liads', 'gads', 'ga4', 'gdrive', 'eventbrite', 'gsc']) expect(screen.queryByText(bruto, { exact: true }), bruto).not.toBeInTheDocument();
    expect(screen.getByText(/Meta Ads: em breve/)).toBeInTheDocument();
  });

  it('Campanhas: sem nada do protótipo; a estrategista cria a campanha e a verba vira pedido ao C-level', async () => {
    await entrar('camila@althius.com.br', 'campaigns', 'Nova campanha');
    for (const nome of PROTOTIPO) expect(screen.queryByText(nome, { exact: false }), nome).not.toBeInTheDocument();
    expect(screen.queryByText(/US\$/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Nova campanha' }));
    const form = await screen.findByRole('region', { name: 'Nova campanha' }, { timeout: 8000 });
    fireEvent.change(within(form).getByLabelText('Nome da campanha'), { target: { value: 'Black Friday' } });
    fireEvent.change(within(form).getByLabelText('Canal'), { target: { value: 'Meta Ads' } });
    fireEvent.change(within(form).getByLabelText('Verba de mídia (R$)'), { target: { value: '4.000' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Criar campanha' }));

    await waitFor(async () => {
      const { data } = await adm.from('campaigns').select('name, channel_type, status, budget_brl').eq('workspace_id', WS);
      expect(data).toEqual([{ name: 'Black Friday', channel_type: 'meta_ads', status: 'rascunho', budget_brl: 0 }]);
      const { data: ap } = await adm.from('approvals').select('category, approval_type, status, payload_json').eq('workspace_id', WS).eq('payload_json->>acao', 'verba_campanha');
      expect(ap).toHaveLength(1);
      expect(ap![0]).toMatchObject({ category: 'gasto', status: 'pendente', payload_json: expect.objectContaining({ para: 4000 }) });
    }, { timeout: 8000 });
    expect(await screen.findByText(/pedido de verba foi para o C-level/, {}, { timeout: 8000 })).toBeInTheDocument();
    expect(await screen.findByText('Black Friday', {}, { timeout: 8000 })).toBeInTheDocument();
  });

  it('Campanhas: BDR não tem o botão de criar campanha', async () => {
    await entrar('lucas@evolut.com.br', 'campaigns', 'Campanhas');
    expect(screen.queryByRole('button', { name: 'Nova campanha' })).not.toBeInTheDocument();
  });

  it('Cadências: sem nada do protótipo; a estrategista cria a cadência e adiciona um passo', async () => {
    await entrar('camila@althius.com.br', 'cadences', 'Nova cadência');
    for (const nome of PROTOTIPO) expect(screen.queryByText(nome, { exact: false }), nome).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Cadência por conta' })).not.toBeInTheDocument(); // plano padrão do desenho

    fireEvent.click(screen.getByRole('button', { name: 'Nova cadência' }));
    const form = await screen.findByRole('region', { name: 'Nova cadência' }, { timeout: 8000 });
    fireEvent.change(within(form).getByLabelText('Nome da cadência'), { target: { value: 'Importadores SP' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Criar cadência' }));
    await waitFor(async () => {
      const { data } = await adm.from('cadences').select('name, status').eq('workspace_id', WS);
      expect(data).toEqual([{ name: 'Importadores SP', status: 'ativa' }]);
    }, { timeout: 8000 });

    fireEvent.click(await screen.findByText('Importadores SP', {}, { timeout: 8000 }));
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar passo' }, { timeout: 8000 }));
    const passo = await screen.findByRole('region', { name: 'Novo passo em "Importadores SP"' }, { timeout: 8000 });
    fireEvent.change(within(passo).getByLabelText('Canal'), { target: { value: 'E-mail' } });
    fireEvent.change(within(passo).getByLabelText('Como sai'), { target: { value: 'Automático' } });
    fireEvent.change(within(passo).getByLabelText('Assunto (e-mail)'), { target: { value: 'Oi' } });
    fireEvent.change(within(passo).getByLabelText('Texto ou roteiro'), { target: { value: 'Primeira mensagem' } });
    fireEvent.click(within(passo).getByRole('button', { name: 'Adicionar passo' }));
    await waitFor(async () => {
      const { data } = await adm.from('cadence_steps').select('step_number, channel, execution_mode, subject, body, delay_days').eq('workspace_id', WS);
      expect(data).toEqual([{ step_number: 1, channel: 'email', execution_mode: 'auto', subject: 'Oi', body: 'Primeira mensagem', delay_days: 0 }]);
    }, { timeout: 8000 });
  });

  it('Cadências: passo automático em canal que não pode mostra o erro do banco no formulário', async () => {
    const { data: c } = await adm.from('cadences').insert({ workspace_id: WS, name: 'Teste de erro', status: 'ativa' }).select('id').single();
    expect(c).toBeTruthy();
    await entrar('camila@althius.com.br', 'cadences', 'Teste de erro');
    fireEvent.click(screen.getAllByText('Teste de erro')[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar passo' }, { timeout: 8000 }));
    const passo = await screen.findByRole('region', { name: 'Novo passo em "Teste de erro"' }, { timeout: 8000 });
    fireEvent.change(within(passo).getByLabelText('Canal'), { target: { value: 'LinkedIn' } });
    fireEvent.change(within(passo).getByLabelText('Como sai'), { target: { value: 'Automático' } });
    fireEvent.change(within(passo).getByLabelText('Texto ou roteiro'), { target: { value: 'x' } });
    fireEvent.click(within(passo).getByRole('button', { name: 'Adicionar passo' }));
    expect(await within(passo).findByRole('alert', {}, { timeout: 8000 })).toHaveTextContent('Só e-mail e WhatsApp podem ser automáticos.');
  });

  it('Cadências: o texto do passo mostra as variáveis e recusa variável que não existe', async () => {
    await adm.from('cadences').insert({ workspace_id: WS, name: 'Com variáveis', status: 'ativa' });
    await entrar('camila@althius.com.br', 'cadences', 'Com variáveis');
    fireEvent.click(screen.getAllByText('Com variáveis')[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar passo' }, { timeout: 8000 }));
    const passo = await screen.findByRole('region', { name: 'Novo passo em "Com variáveis"' }, { timeout: 8000 });
    const texto = within(passo).getByLabelText('Texto ou roteiro') as HTMLTextAreaElement;
    expect(texto.placeholder).toContain('{{primeiro_nome}}');
    expect(texto.placeholder).toContain('{{empresa}}');
    fireEvent.change(texto, { target: { value: 'Oi {{apelido}}' } });
    fireEvent.click(within(passo).getByRole('button', { name: 'Adicionar passo' }));
    expect(await within(passo).findByRole('alert', {}, { timeout: 8000 })).toHaveTextContent('Variável que não existe: {{apelido}}');
    fireEvent.change(texto, { target: { value: 'Oi {{primeiro_nome}}, vi a {{empresa}}' } });
    fireEvent.click(within(passo).getByRole('button', { name: 'Adicionar passo' }));
    await waitFor(async () => {
      const { data } = await adm.from('cadence_steps').select('body').eq('workspace_id', WS);
      expect(data).toEqual([{ body: 'Oi {{primeiro_nome}}, vi a {{empresa}}' }]);
    }, { timeout: 8000 });
  });
});
