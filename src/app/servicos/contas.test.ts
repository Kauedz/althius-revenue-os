// @vitest-environment node
// Seam: serviço de Contas e leads (lista de contas no formato da tela v18, com responsáveis e comitê).
import { describe, expect, it } from 'vitest';
import { listarContas } from './contas';
import { bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const GRAO_NORTE = 'b0000000-0000-0000-0000-000000000001';

describe('listarContas (unitário / mapeamento)', () => {
  function mockSupabase(tabelas: Record<string, { data?: any; error?: any }>) {
    return {
      from: (tabela: string) => {
        const resp = tabelas[tabela] || { data: [], error: null };
        const chain: any = {
          select: () => chain,
          eq: () => chain,
          in: () => chain,
          order: () => chain,
          then: (resolve: any) => Promise.resolve(resp).then(resolve)
        };
        return chain;
      }
    } as any;
  }

  it('mapeia os campos da conta, dono, cidade e decisor do comitê', async () => {
    const cliente = mockSupabase({
      accounts: {
        data: [
          {
            id: 'c1',
            name: 'Acme Corp',
            domain: 'acme.com',
            logo_url: 'https://acme.com/logo.png',
            segment: 'Software',
            fit: 92,
            temperature: 3,
            last_signal_text: 'Nova rodada Série B',
            owner_member_id: 'm1',
            city: 'Campinas',
            state_uf: 'SP',
            status: 'ativa'
          }
        ],
        error: null
      },
      workspace_members: {
        data: [{ id: 'm1', user_id: 'u1' }],
        error: null
      },
      profiles: {
        data: [{ id: 'u1', name: 'Carlos Gestor' }],
        error: null
      },
      contacts: {
        data: [
          {
            id: 'ct1',
            account_id: 'c1',
            name: 'Mariana Lima',
            job_title: 'CTO',
            buying_role: 'decisor',
            photo_url: 'mariana.jpg',
            linkedin_status: 'conectado'
          }
        ],
        error: null
      },
      contact_channels: {
        data: [
          { contact_id: 'ct1', type: 'email', value: 'mariana@acme.com', position: 1 },
          { contact_id: 'ct1', type: 'phone', value: '(19) 99999-0000', position: 2 }
        ],
        error: null
      }
    });

    const contas = await listarContas(cliente, 'ws-1');
    expect(contas).toHaveLength(1);
    expect(contas[0]).toEqual({
      id: 'c1',
      nome: 'Acme Corp',
      segmento: 'Software',
      fit: 92,
      temperatura: 3,
      sinal: 'Nova rodada Série B',
      dono: 'Carlos Gestor',
      cidade: 'Campinas, SP',
      decisor: 'Mariana Lima',
      dominio: 'acme.com',
      logoUrl: 'https://acme.com/logo.png',
      comite: [
        {
          id: 'ct1',
          nome: 'Mariana Lima',
          cargo: 'CTO',
          papel: 'decisor',
          foto: 'mariana.jpg',
          linkedin: 'https://www.linkedin.com/search/results/people/?keywords=Mariana%20Lima',
          emails: ['mariana@acme.com'],
          fones: ['(19) 99999-0000']
        }
      ]
    });
  });

  it('quando não há decisor mapeado, mostra "A mapear"', async () => {
    const cliente = mockSupabase({
      accounts: {
        data: [
          {
            id: 'c2',
            name: 'Beta Labs',
            segment: null,
            fit: null,
            temperature: null,
            last_signal_text: null,
            owner_member_id: null,
            city: null,
            state_uf: null,
            status: 'ativa'
          }
        ],
        error: null
      },
      workspace_members: { data: [], error: null },
      profiles: { data: [], error: null },
      contacts: {
        data: [
          {
            id: 'ct2',
            account_id: 'c2',
            name: 'Felipe Dev',
            job_title: 'Engenheiro',
            buying_role: 'influenciador'
          }
        ],
        error: null
      },
      contact_channels: { data: [], error: null }
    });

    const [conta] = await listarContas(cliente, 'ws-1');
    expect(conta.decisor).toBe('A mapear');
    expect(conta.dono).toBe('Alguém do time');
    expect(conta.cidade).toBe('—');
    expect(conta.segmento).toBe('—');
    expect(conta.sinal).toBe('—');
    expect(conta.fit).toBe(0);
    expect(conta.temperatura).toBe(1);
  });

  it('trata falha ao consultar tabela accounts', async () => {
    const cliente = mockSupabase({
      accounts: { data: null, error: { message: 'tabela indisponível' } }
    });
    await expect(listarContas(cliente, 'ws-1')).rejects.toThrow('Não foi possível carregar as contas e leads.');
  });

  it('trata falha ao consultar contatos', async () => {
    const cliente = mockSupabase({
      accounts: { data: [{ id: 'c1' }], error: null },
      workspace_members: { data: [], error: null },
      profiles: { data: [], error: null },
      contacts: { data: null, error: { message: 'falha de rede' } }
    });
    await expect(listarContas(cliente, 'ws-1')).rejects.toThrow('Não foi possível carregar os contatos das contas.');
  });

  it('trata falha ao consultar canais de contatos', async () => {
    const cliente = mockSupabase({
      accounts: { data: [{ id: 'c1' }], error: null },
      workspace_members: { data: [], error: null },
      profiles: { data: [], error: null },
      contacts: { data: [{ id: 'ct1', account_id: 'c1' }], error: null },
      contact_channels: { data: null, error: { message: 'falha canais' } }
    });
    await expect(listarContas(cliente, 'ws-1')).rejects.toThrow('Não foi possível carregar os canais dos contatos.');
  });

  it('falha ao buscar o responsável vira erro, não "Alguém do time"', async () => {
    const semMembros = mockSupabase({
      accounts: { data: [{ id: 'c1', owner_member_id: 'm1' }], error: null },
      workspace_members: { data: null, error: { message: 'falha membros' } }
    });
    await expect(listarContas(semMembros, 'ws-1')).rejects.toThrow('Não foi possível carregar os responsáveis pelas contas.');
    const semPerfis = mockSupabase({
      accounts: { data: [{ id: 'c1', owner_member_id: 'm1' }], error: null },
      workspace_members: { data: [{ id: 'm1', user_id: 'u1' }], error: null },
      profiles: { data: null, error: { message: 'falha perfis' } }
    });
    await expect(listarContas(semPerfis, 'ws-1')).rejects.toThrow('Não foi possível carregar os responsáveis pelas contas.');
  });
});

describe.skipIf(!bancoLocalNoAr)('Contas e leads (banco local)', () => {
  it('C-level lista as contas no formato exato da tela do v18', async () => {
    const contas = await listarContas(await entrarComoLocal('aline@evolut.com.br'), EVOLUT);
    expect(contas.length).toBeGreaterThanOrEqual(8);

    const serraAzul = contas.find(c => c.nome === 'Serra Azul Têxtil');
    expect(serraAzul).toBeDefined();
    expect(serraAzul).toMatchObject({
      nome: 'Serra Azul Têxtil',
      segmento: 'Têxtil',
      fit: 96,
      temperatura: 3,
      sinal: 'Vaga aberta · Gerente de Importação',
      dono: 'Lucas Teixeira',
      cidade: 'São Paulo, SP',
      decisor: 'Aline Xavier'
    });

    // Confere se o comitê foi carregado com cargos e contatos
    expect(serraAzul?.comite).toBeDefined();
    expect(serraAzul?.comite?.length).toBe(3);
    expect(serraAzul?.comite?.[0]).toMatchObject({
      nome: 'Aline Xavier',
      cargo: 'Diretora de Supply Chain',
      papel: 'decisor',
      emails: ['aline.xavier@serraazul.com.br'],
      fones: ['(11) 90000-0001']
    });
  });

  it('conta sem decisor no comitê mostra "A mapear"', async () => {
    const contas = await listarContas(await entrarComoLocal('aline@evolut.com.br'), EVOLUT);
    const ipe = contas.find(c => c.nome === 'Metalúrgica Ipê');
    expect(ipe).toBeDefined();
    expect(ipe?.decisor).toBe('A mapear');

    const rioClaro = contas.find(c => c.nome === 'Rio Claro Cosméticos');
    expect(rioClaro).toBeDefined();
    expect(rioClaro?.decisor).toBe('A mapear');
    expect(rioClaro?.comite).toEqual([]);
  });

  it('isolamento de workspace: outro workspace não vê as contas da Evolut', async () => {
    const eduardo = await entrarComoLocal('eduardo@graonorte.com.br');
    const contasGrao = await listarContas(eduardo, GRAO_NORTE);
    // As contas da Evolut (ex: Serra Azul Têxtil) não podem estar no workspace Grão Norte
    expect(contasGrao.map(c => c.nome)).not.toContain('Serra Azul Têxtil');
  });

  it('BDR lê as contas do seu workspace', async () => {
    const contas = await listarContas(await entrarComoLocal('lucas@evolut.com.br'), EVOLUT);
    expect(contas.length).toBeGreaterThanOrEqual(8);
    expect(contas.map(c => c.nome)).toContain('Serra Azul Têxtil');
  });
});

