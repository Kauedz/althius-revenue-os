// @vitest-environment node
// Seam: serviço de aprendizados e playbook dos agentes (listarSugestoes, decidirAprendizado,
// lerPlaybooks, publicarPlaybook) contra o banco local. Aprendizado não é tela própria: aparece no Playbook do agente.
import { afterAll, describe, expect, it } from 'vitest';
import { decidirAprendizado, lerPlaybooks, listarSugestoes, publicarPlaybook } from './aprendizados';
import { adminLocal, bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const CAMILA = 'd0000000-0000-0000-0000-000000000002';
const ALINE = 'd0000000-0000-0000-0000-000000000003';
const SUG_MARKETING = '1e000000-0000-0000-0000-0000000000a2';

describe.skipIf(!bancoLocalNoAr)('Aprendizados e playbook (banco local)', () => {
  const admin = adminLocal();
  afterAll(async () => {
    // Devolve o seed: decisão e publicação são de uso único pela tela.
    await admin.from('learning_entries').update({ status: 'sugerida', decided_by_member_id: null, decided_at: null }).eq('id', SUG_MARKETING);
    await admin.from('agent_playbooks').delete().eq('workspace_id', EVOLUT).eq('agent_id', 'copy').neq('version', '2.1');
    await admin.from('agent_playbooks').update({ is_published: true }).eq('workspace_id', EVOLUT).eq('agent_id', 'copy').eq('version', '2.1');
  });

  it('sugestões pendentes vêm agrupadas por agente, com a mudança proposta e a origem', async () => {
    const sugestoes = await listarSugestoes(await entrarComoLocal('aline@evolut.com.br'), EVOLUT);
    expect(sugestoes.marketing).toEqual([{
      id: SUG_MARKETING, aprendizado: 'LinkedIn teve CPL 38% menor que Meta para Supply Chain.',
      mudanca: 'Adicionar em Regras: priorizar LinkedIn Ads para a persona Supply Chain.', origem: 'Aprendido com 4 semanas de campanha'
    }]);
    expect(sugestoes.copy).toHaveLength(2);
  });

  it('C-level recebe o motivo; estrategista descarta e a sugestão sai da lista', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    expect(await decidirAprendizado(aline, EVOLUT, ALINE, SUG_MARKETING, 'descartada')).toEqual({ ok: false, mensagem: 'Seu papel não aplica aprendizados.' });
    const camila = await entrarComoLocal('camila@althius.com.br');
    expect(await decidirAprendizado(camila, EVOLUT, CAMILA, SUG_MARKETING, 'descartada')).toEqual({ ok: true });
    expect((await listarSugestoes(camila, EVOLUT)).marketing || []).toEqual([]);
  });

  it('playbook publicado de cada agente vem do banco; publicar cria a versão seguinte', async () => {
    const camila = await entrarComoLocal('camila@althius.com.br');
    const antes = await lerPlaybooks(camila, EVOLUT);
    expect(antes.copy.startsWith('# Missão')).toBe(true);
    expect(await publicarPlaybook(camila, EVOLUT, CAMILA, 'copy', antes.copy + '\n- Citar a vaga na primeira linha.')).toEqual({ ok: true, versao: '2.2' });
    expect((await lerPlaybooks(camila, EVOLUT)).copy).toContain('Citar a vaga na primeira linha.');
  });

  it('C-level não publica playbook', async () => {
    expect(await publicarPlaybook(await entrarComoLocal('aline@evolut.com.br'), EVOLUT, ALINE, 'copy', '# x'))
      .toEqual({ ok: false, mensagem: 'Seu papel não publica playbook.' });
  });

  it('Grão Norte não vê sugestões nem playbooks da Evolut', async () => {
    const eduardo = await entrarComoLocal('eduardo@graonorte.com.br');
    expect(await listarSugestoes(eduardo, EVOLUT)).toEqual({});
    expect(await lerPlaybooks(eduardo, EVOLUT)).toEqual({});
  });
});
