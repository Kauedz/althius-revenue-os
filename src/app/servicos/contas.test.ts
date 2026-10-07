// @vitest-environment node
// Seam: src/app/servicos/contas.ts (listarContas, criarConta, editarConta, importarContas)
import { describe, expect, it } from 'vitest';
import {
  listarContas,
  linkedinDoPerfil,
  geoDaConta,
  textoUltimoContato,
  SEM_CONTATO,
  criarConta,
  editarConta,
  importarContas,
  definirMonitoramento,
  porqueDoFit
} from './contas';
import { bancoLocalNoAr, entrarComoLocal } from '../../test/supabaseLocal';
import { isolarContas } from '../../test/isolarContas';

const EVOLUT = 'a0000000-0000-0000-0000-000000000001';
const GRAO_NORTE = 'b0000000-0000-0000-0000-000000000001';
const MEMBRO_ALINE = 'd0000000-0000-0000-0000-000000000003';
const MEMBRO_LUCAS = 'd0000000-0000-0000-0000-000000000004';

describe('por que esta nota (ADR 0067)', () => {
  it('monta a frase com as três partes; sem partes, nada', () => {
    expect(porqueDoFit(72, [
      { parte: 'ICP', pontos: 40, max: 60, motivo: 'setor sim, porte sem dado, região sim' },
      { parte: 'Sinais', pontos: 18, max: 25, motivo: '2 sinais nos últimos 30 dias' },
      { parte: 'Dados', pontos: 14, max: 15, motivo: 'falta telefone' }
    ])).toBe('Por que fit 72: ICP 40/60 (setor sim, porte sem dado, região sim) · Sinais 18/25 (2 sinais nos últimos 30 dias) · Dados 14/15 (falta telefone)');
    expect(porqueDoFit(10, [])).toBe('');
    expect(porqueDoFit(10, null)).toBe('');
  });
});

describe('textoUltimoContato', () => {
  const agora = new Date('2026-10-06T12:00:00Z');
  const em = (ms: number) => new Date(agora.getTime() - ms).toISOString();
  const MIN = 60_000, H = 60 * MIN, D = 24 * H;

  it('sem mensagem, é "Sem contato ainda" (nunca uma data inventada)', () => {
    expect(textoUltimoContato(null, agora)).toBe(SEM_CONTATO);
    expect(textoUltimoContato(undefined, agora)).toBe(SEM_CONTATO);
    expect(textoUltimoContato({ quando: 'lixo', direcao: 'in', canal: 'email' }, agora)).toBe(SEM_CONTATO);
  });
  it('mostra o tempo em minutos, horas e dias, no singular e no plural', () => {
    expect(textoUltimoContato({ quando: em(10 * 1000), direcao: null, canal: null }, agora)).toBe('agora');
    expect(textoUltimoContato({ quando: em(5 * MIN), direcao: null, canal: null }, agora)).toBe('há 5 min');
    expect(textoUltimoContato({ quando: em(3 * H), direcao: null, canal: null }, agora)).toBe('há 3 h');
    expect(textoUltimoContato({ quando: em(1 * D + H), direcao: null, canal: null }, agora)).toBe('há 1 dia');
    expect(textoUltimoContato({ quando: em(3 * D), direcao: null, canal: null }, agora)).toBe('há 3 dias');
  });
  it('depois de 30 dias mostra a data', () => {
    expect(textoUltimoContato({ quando: '2026-08-01T12:00:00Z', direcao: null, canal: null }, agora)).toBe('01/08/2026');
  });
  it('diz o canal e quem falou por último', () => {
    expect(textoUltimoContato({ quando: em(3 * D), direcao: 'in', canal: 'linkedin' }, agora)).toBe('há 3 dias · LinkedIn · resposta do contato');
    expect(textoUltimoContato({ quando: em(3 * D), direcao: 'out', canal: 'email' }, agora)).toBe('há 3 dias · E-mail · mensagem nossa');
    expect(textoUltimoContato({ quando: em(2 * H), direcao: 'out', canal: 'whatsapp' }, agora)).toBe('há 2 h · WhatsApp · mensagem nossa');
  });
  it('relógio do contato à frente do nosso não gera tempo negativo', () => {
    expect(textoUltimoContato({ quando: new Date(agora.getTime() + 5 * MIN).toISOString(), direcao: 'in', canal: 'email' }, agora)).toBe('agora · E-mail · resposta do contato');
  });
});

describe('listarContas (unitário / mapeamento)', () => {
  it('traz o último contato da visão e "Sem contato ainda" para quem não tem', async () => {
    const f = (tabelas: Record<string, { data?: any; error?: any }>) => ({
      from: (t: string) => { const r = tabelas[t] || { data: [], error: null }; const c: any = { select: () => c, eq: () => c, in: () => c, order: () => c, then: (ok: any) => Promise.resolve(r).then(ok) }; return c; }
    }) as any;
    const cliente = f({
      accounts: { data: [{ id: 'c1', name: 'Com contato' }, { id: 'c2', name: 'Sem contato' }], error: null },
      account_last_contact: { data: [{ account_id: 'c1', last_contact_at: new Date(Date.now() - 2 * 3_600_000).toISOString(), last_direction: 'in', last_channel: 'whatsapp' }], error: null }
    });
    const contas = await listarContas(cliente, 'ws-1');
    expect(contas.find(c => c.id === 'c1')?.ultimoContato).toBe('há 2 h · WhatsApp · resposta do contato');
    expect(contas.find(c => c.id === 'c2')?.ultimoContato).toBe(SEM_CONTATO);
  });
  it('falha ao consultar o último contato vira erro claro (não cai para dado fictício)', async () => {
    const cliente = {
      from: (t: string) => { const r = t === 'account_last_contact' ? { data: null, error: { message: 'falhou' } } : t === 'accounts' ? { data: [{ id: 'c1' }], error: null } : { data: [], error: null };
        const c: any = { select: () => c, eq: () => c, in: () => c, order: () => c, then: (ok: any) => Promise.resolve(r).then(ok) }; return c; }
    } as any;
    await expect(listarContas(cliente, 'ws-1')).rejects.toThrow('Não foi possível carregar o último contato das contas.');
  });

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
      uf: 'SP',
      geo: null,
      monitorar: false,
      ultimoContato: 'Sem contato ainda',
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

  it('enriquecimento: o perfil do LinkedIn guardado e o ponto no mapa (exato pelo CEP, aproximado pela cidade)', async () => {
    const conta = (id: string, extra: Record<string, unknown>) => ({ id, name: id, domain: id + '.test', logo_url: null, segment: 'x', fit: 50, temperature: 1, last_signal_text: null, owner_member_id: null, city: 'Campinas', state_uf: 'SP', status: 'ativa', ...extra });
    const cliente = mockSupabase({
      accounts: { data: [conta('exata', { lat: -22.9, lng: -47.06, localizacao_precisao: 'cep' }), conta('cidade', { lat: -22.9, lng: -47.06, localizacao_precisao: 'cidade' }), conta('sem', { state_uf: null, city: null })], error: null },
      contacts: { data: [{ id: 'p1', account_id: 'exata', name: 'Bia Rocha', job_title: 'CEO', buying_role: 'decisor', photo_url: 'https://media.licdn.test/bia.jpg', linkedin_status: 'sem_conexao' }], error: null },
      contact_channels: { data: [{ contact_id: 'p1', type: 'linkedin', value: 'https://www.linkedin.com/in/bia-rocha', position: 1 }], error: null }
    });
    const contas = await listarContas(cliente, 'ws');
    expect(contas.map(c => c.geo)).toEqual([{ lat: -22.9, lng: -47.06, aprox: false }, { lat: -22.9, lng: -47.06, aprox: true }, null]);
    expect(contas.map(c => c.uf)).toEqual(['SP', 'SP', null]);
    expect(contas[0].comite?.[0]).toMatchObject({ linkedin: 'https://www.linkedin.com/in/bia-rocha', foto: 'https://media.licdn.test/bia.jpg' });
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
      temperatura: 3,
      sinal: 'Vaga aberta · Gerente de Importação',
      dono: 'Lucas Teixeira',
      cidade: 'São Paulo, SP',
      decisor: 'Aline Xavier'
    });

    // ADR 0067: o fit é calculado pelo banco (nunca o número fixo do seed) e vem com o "por que".
    expect(serraAzul!.fit).toBeGreaterThanOrEqual(0);
    expect(serraAzul!.fitPorque).toMatch(new RegExp(String.raw`^Por que fit ${serraAzul!.fit}: ICP \d+/60 \(.+\) · Sinais \d+/25 \(.+\) · Dados \d+/15 \(.+\)$`));

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

  it('Último contato vem das mensagens: C-level vê a conta com conversa; conta sem conversa mostra "Sem contato ainda"', async () => {
    const contas = await listarContas(await entrarComoLocal('aline@evolut.com.br'), EVOLUT);
    expect(contas.find(c => c.nome === 'Serra Azul Têxtil')?.ultimoContato).toMatch(/^há \d+ (h|dias?) · LinkedIn · resposta do contato$/);
    expect(contas.find(c => c.nome === 'Rio Claro Cosméticos')?.ultimoContato).toBe(SEM_CONTATO);
  });

  it('BDR enxerga o último contato só das próprias conversas (Lucas não vê a conversa de e-mail da Bruna)', async () => {
    const contas = await listarContas(await entrarComoLocal('lucas@evolut.com.br'), EVOLUT);
    // A conversa da Bruna é com a conta 4 (Delta Saúde): para o Lucas, sem contato.
    expect(contas.find(c => c.nome === 'Delta Saúde')?.ultimoContato).toBe(SEM_CONTATO);
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

  it('ADR 0066: marcar a conta para monitorar sinais (a tela lê a marca; o BDR só mexe nas dele)', async () => {
    const aline = await entrarComoLocal('aline@evolut.com.br');
    const antes = (await listarContas(aline, EVOLUT)).find(c => c.nome === 'Campo Belo Agro')!;
    expect(antes.monitorar).toBe(false);
    expect(await definirMonitoramento(aline, EVOLUT, MEMBRO_ALINE, antes.id, true)).toEqual({ ok: true });
    expect((await listarContas(aline, EVOLUT)).find(c => c.id === antes.id)!.monitorar).toBe(true);
    expect(await definirMonitoramento(aline, EVOLUT, MEMBRO_ALINE, antes.id, false)).toEqual({ ok: true });
    const lucas = await entrarComoLocal('lucas@evolut.com.br');
    const deOutro = (await listarContas(aline, EVOLUT)).find(c => c.nome === 'Metalúrgica Ipê')!;
    expect(await definirMonitoramento(lucas, EVOLUT, MEMBRO_LUCAS, deOutro.id, true)).toEqual({ ok: false, mensagem: 'BDR só mexe nas contas em que é o responsável.' });
  });
});

describe('ajudas do enriquecimento na tela', () => {
  it('perfil do LinkedIn: aceita endereço completo ou só o identificador; o resto é nulo', () => {
    expect(linkedinDoPerfil('https://br.linkedin.com/in/bia-rocha/?trk=x')).toBe('https://www.linkedin.com/in/bia-rocha');
    expect(linkedinDoPerfil('bia-rocha')).toBe('https://www.linkedin.com/in/bia-rocha');
    expect(linkedinDoPerfil('javascript:alert(1)')).toBeNull();
    expect(linkedinDoPerfil('')).toBeNull();
  });

  it('ponto no mapa: só dentro do Brasil e com as duas coordenadas', () => {
    expect(geoDaConta({ lat: -23.5, lng: -46.6, localizacao_precisao: 'endereco' })).toEqual({ lat: -23.5, lng: -46.6, aprox: false });
    expect(geoDaConta({ lat: -23.5, lng: -46.6 })).toEqual({ lat: -23.5, lng: -46.6, aprox: true });
    expect(geoDaConta({ lat: 40.7, lng: -74 })).toBeNull();
    expect(geoDaConta({ lat: -23.5, lng: null })).toBeNull();
  });
});
