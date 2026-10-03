// Seam: aba Playbook do agente no modo real (sugestões dos agentes + publicação), de ponta a ponta com o Supabase local.
import { afterAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '../v18/data.js';
import '../v18/module.js';
import { Raiz } from './Raiz';
import { adminLocal, bancoLocalNoAr, novoClienteLocal } from '../test/supabaseLocal';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const SUG_VAGA = '1e000000-0000-0000-0000-0000000000a3';
const SUG_SAUDE = '1e000000-0000-0000-0000-0000000000a4';

async function abrirPlaybookDoCopy(email: string) {
  window.location.hash = '#/app/evolut/agents/copy';
  render(<Raiz supabase={novoClienteLocal()} />);
  fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  fireEvent.click(await screen.findByRole('tab', { name: 'Playbook' }, { timeout: 8000 }));
}

describe.skipIf(!bancoLocalNoAr)('aba Playbook do agente (banco local)', () => {
  afterAll(async () => {
    const admin = adminLocal();
    await admin.from('learning_entries').update({ status: 'sugerida', decided_by_member_id: null, decided_at: null }).in('id', [SUG_VAGA, SUG_SAUDE]);
    await admin.from('agent_playbooks').delete().eq('workspace_id', EVOLUT).eq('agent_id', 'copy').neq('version', '2.1');
    await admin.from('agent_playbooks').update({ is_published: true }).eq('workspace_id', EVOLUT).eq('agent_id', 'copy').eq('version', '2.1');
  });

  it('estrategista aplica uma sugestão, descarta outra, publica, e tudo continua depois de entrar de novo', async () => {
    await abrirPlaybookDoCopy('camila@althius.com.br');
    expect(await screen.findByText('Abrir pela vaga aberta dobrou a taxa de resposta.')).toBeInTheDocument();
    const aplicar = screen.getAllByRole('button', { name: 'Aplicar no playbook' })[0];
    fireEvent.click(aplicar);
    fireEvent.click(screen.getAllByRole('button', { name: 'Descartar' }).at(-1)!);
    fireEvent.click(await screen.findByRole('button', { name: /Publicar v2\.2/ }));
    expect(await screen.findByText(/Playbook v2\.2 publicado/, {}, { timeout: 8000 })).toBeInTheDocument();

    cleanup();
    await abrirPlaybookDoCopy('camila@althius.com.br');
    expect((await screen.findByDisplayValue(/citar o cargo na primeira linha/i, {}, { timeout: 8000 }))).toBeInTheDocument();
    expect(screen.queryByText('Abrir pela vaga aberta dobrou a taxa de resposta.')).not.toBeInTheDocument();
    expect(screen.queryByText('A objeção "já trabalho com trading" aparece em saúde.')).not.toBeInTheDocument();
  });
});
