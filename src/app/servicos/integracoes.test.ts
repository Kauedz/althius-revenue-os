// @vitest-environment node
// Seam: Integracoes lista so contas de mensagem que existem. Nao inventa HubSpot, Apify nem dolar.
import { describe, expect, it } from 'vitest';
import { SEM_DADOS, listarIntegracoes } from './integracoes';
import { bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const GRAO = 'b0000000-0000-0000-0000-000000000001';

function tabela(data: unknown, error: unknown = null) {
  const fim = Promise.resolve({ data, error });
  const cadeia: any = new Proxy(function () {}, {
    get: (_a, prop) => (prop === 'then' ? fim.then.bind(fim) : cadeia),
    apply: () => cadeia
  });
  return { from: () => cadeia } as any;
}

describe('listarIntegracoes (unitario)', () => {
  it('mostra a conta que existe e deixa o que o banco nao tem como Sem dados ainda', async () => {
    const tela = await listarIntegracoes(tabela([
      { id: '1', provider: 'google', display_name: '', status: 'connected' },
      { id: '2', provider: 'linkedin', display_name: 'Pessoa Real', status: 'attention' },
      { id: '3', provider: 'whatsapp', display_name: null, status: 'disconnected' }
    ]), 'ws');
    const texto = JSON.stringify(tela);
    expect(texto).not.toMatch(/HubSpot|Apify|Apollo|Meta Ads|Google Ads|Google Sheets|Hoje, 07:30|US\$|R\$/);
    expect(tela.linhas[0]).toEqual({ id: '1', cap: 'E-mail', fornecedor: SEM_DADOS, modo: SEM_DADOS, teste: SEM_DADOS, status: 'Conectada' });
    expect(tela.linhas[1]).toMatchObject({ cap: 'LinkedIn', fornecedor: 'Pessoa Real', status: 'Atenção', modo: SEM_DADOS, teste: SEM_DADOS });
    expect(tela.linhas[2]).toMatchObject({ cap: 'WhatsApp', fornecedor: SEM_DADOS, status: 'Desconectada' });
  });

  it('lista vazia nao inventa ferramenta conectada', async () => {
    const tela = await listarIntegracoes(tabela([]), 'ws');
    expect(tela.linhas).toEqual([]);
  });

  it('falha de rede vira erro claro', async () => {
    await expect(listarIntegracoes(tabela(null, { message: 'x' }), 'ws')).rejects.toThrow('Não foi possível carregar as integrações.');
  });
});

describe.skipIf(!bancoLocalNoAr)('Integracoes (banco local)', () => {
  it('Lucas ve as proprias contas; Aline e Grao Norte nao veem as da Evolut', async () => {
    const lucas = await entrarComoLocal('lucas@evolut.com.br');
    const dele = await listarIntegracoes(lucas, EVOLUT);
    const texto = JSON.stringify(dele);
    expect(texto).toContain('lucas@evolut.com.br');
    expect(texto).toContain('Lucas Teixeira');
    expect(texto).not.toMatch(/HubSpot|Apify|Apollo|Meta Ads|US\$|R\$/);
    expect(dele.linhas.find(l => l.fornecedor === 'lucas@evolut.com.br')).toMatchObject({ cap: 'E-mail', status: 'Conectada', teste: SEM_DADOS, modo: SEM_DADOS });

    const aline = await entrarComoLocal('aline@evolut.com.br');
    expect((await listarIntegracoes(aline, EVOLUT)).linhas).toEqual([]);

    const eduardo = await entrarComoLocal('eduardo@graonorte.com.br');
    const evolut = await listarIntegracoes(eduardo, EVOLUT);
    expect(JSON.stringify(evolut)).not.toContain('lucas@evolut.com.br');
    const grao = await listarIntegracoes(eduardo, GRAO);
    expect(JSON.stringify(grao)).not.toContain('lucas@evolut.com.br');
  });
});
