// @vitest-environment node
// Seam: src/app/servicos/contas.ts (listarContas, criarConta, editarConta, importarContas)
import { describe, expect, it } from 'vitest';
import {
  listarContas,
  criarConta,
  editarConta,
  importarContas
} from './contas';
import { bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';
import { isolarContas } from '../../test/isolarContas';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const GRAO_NORTE = 'b0000000-0000-0000-0000-000000000001';
const MEMBRO_ALINE = 'd0000000-0000-0000-0000-000000000003';
const MEMBRO_LUCAS = 'd0000000-0000-0000-0000-000000000004';

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

  it('o comitê sai em ordem fixa (decisor, campeão, influenciador; por nome), qualquer que seja a ordem em que o banco devolve', async () => {
    const pessoa = (id: string, name: string, buying_role: string) => ({ id, account_id: 'c1', name, job_title: 'Cargo', buying_role, photo_url: null, linkedin_status: 'sem_conexao' });
    const cliente = mockSupabase({
      accounts: { data: [{ id: 'c1', name: 'Acme', domain: 'acme.com', logo_url: null, segment: 'x', fit: 50, temperature: 1, last_signal_text: null, owner_member_id: null, city: 'SP', state_uf: 'SP', status: 'ativa' }], error: null },
      contacts: { data: [pessoa('3', 'Zélia', 'influenciador'), pessoa('2', 'Bruno', 'campeao'), pessoa('4', 'Ana', 'influenciador'), pessoa('1', 'Carla', 'decisor')], error: null },
      contact_channels: { data: [], error: null }
    });
    const contas = await listarContas(cliente, 'ws');
    expect(contas[0].comite?.map(p => p.nome)).toEqual(['Carla', 'Bruno', 'Ana', 'Zélia']);
    expect(contas[0].decisor).toBe('Carla');
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
  isolarContas();

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
    expect(contasGrao.map(c => c.nome)).not.toContain('Serra Azul Têxtil');
  });

  it('BDR lê as contas do seu workspace', async () => {
    const contas = await listarContas(await entrarComoLocal('lucas@evolut.com.br'), EVOLUT);
    expect(contas.length).toBeGreaterThanOrEqual(8);
    expect(contas.map(c => c.nome)).toContain('Serra Azul Têxtil');
  });

  it('Aline (C-level) cria nova conta com sucesso', async () => {
    const cliente = await entrarComoLocal('aline@evolut.com.br');
    const conta = await criarConta(cliente, EVOLUT, MEMBRO_ALINE, {
      nome: 'Empresa Teste Vitest',
      dominio: 'empresatestevitest.com.br',
      uf: 'MG',
      cidade: 'Uberlândia',
      temperatura: 2,
      donoMembroId: MEMBRO_LUCAS
    });

    expect(conta).toBeDefined();
    expect(conta.nome).toBe('Empresa Teste Vitest');
    expect(conta.dominio).toBe('empresatestevitest.com.br');
  });

  it('Lucas (BDR) edita conta em que é o responsável', async () => {
    const cliente = await entrarComoLocal('lucas@evolut.com.br');
    // Serra Azul c...01 tem Lucas como dono
    const conta = await editarConta(cliente, MEMBRO_LUCAS, {
      id: 'c0000000-0000-0000-0000-000000000001',
      nome: 'Serra Azul Têxtil Atualizada',
      dominio: 'serraazul.com.br',
      uf: 'MG',
      cidade: 'Belo Horizonte',
      temperatura: 3
    });

    expect(conta.nome).toBe('Serra Azul Têxtil Atualizada');
  });

  it('Lucas (BDR) é recusado ao tentar editar conta alheia (Metalúrgica Ipê)', async () => {
    const cliente = await entrarComoLocal('lucas@evolut.com.br');
    await expect(
      editarConta(cliente, MEMBRO_LUCAS, {
        id: 'c0000000-0000-0000-0000-000000000003',
        nome: 'Tentativa Invalida BDR'
      })
    ).rejects.toThrow('Não foi possível atualizar a conta.');
  });

  it('Lucas (BDR) é recusado ao tentar importar lista de contas', async () => {
    const cliente = await entrarComoLocal('lucas@evolut.com.br');
    await expect(
      importarContas(cliente, EVOLUT, MEMBRO_LUCAS, [
        { name: 'Conta Proibida', domain: 'proibida.com.br' }
      ])
    ).rejects.toThrow('Não foi possível importar as contas.');
  });

  it('Aline (C-level) importa lista de contas e marca duplicadas sem apagar originais', async () => {
    const cliente = await entrarComoLocal('aline@evolut.com.br');
    const resultado = await importarContas(cliente, EVOLUT, MEMBRO_ALINE, [
      { name: 'Serra Azul Importação Duplicada', domain: 'serraazul.com.br', state_uf: 'MG', city: 'Belo Horizonte' },
      { name: 'Nova Inovação Tech', domain: 'novainovacaotech.com.br', state_uf: 'PR', city: 'Curitiba' }
    ]);

    expect(resultado.total).toBe(2);
    expect(resultado.duplicadas).toBeGreaterThanOrEqual(1);
    expect(resultado.criadas).toBeGreaterThanOrEqual(1);
  });
});
