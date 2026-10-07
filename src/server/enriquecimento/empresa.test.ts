// @vitest-environment node
// Etapa "empresa": site → CNPJ → Receita → localização → logo. Internet falsa (nenhuma chamada real).
import { describe, expect, it } from 'vitest';
import { enriquecerEmpresa, FonteIndisponivel } from './empresa.ts';

type Rota = (url: string) => Response | null | Promise<Response | null>;
function internet(rotas: Record<string, Rota | Response>) {
  const pedidos: string[] = [];
  const buscar = (async (url: string) => {
    pedidos.push(url);
    for (const [prefixo, r] of Object.entries(rotas)) {
      if (url.startsWith(prefixo)) {
        const resp = typeof r === 'function' ? await r(url) : r.clone();
        if (resp) return resp;
      }
    }
    throw new TypeError('fetch failed');
  }) as unknown as typeof fetch;
  return { buscar, pedidos };
}
const html = (t: string) => new Response(t, { headers: { 'content-type': 'text/html; charset=utf-8' } });
const json = (j: unknown, status = 200) => Response.json(j, { status });
const RECEITA = {
  razao_social: 'CANARIO INDUSTRIA LTDA', nome_fantasia: 'CANARIO', uf: 'SP', municipio: 'SAO PAULO', cep: '01310100', descricao_tipo_de_logradouro: 'AVENIDA',
  logradouro: 'PAULISTA', numero: '1000', bairro: 'BELA VISTA', complemento: 'ANDAR 5', ddd_telefone_1: '1133334444', email: 'contato@canario.test',
  cnae_fiscal: 2710401, cnae_fiscal_descricao: 'Fabricação de geradores', porte: 'DEMAIS', descricao_situacao_cadastral: 'ATIVA'
};
const conta = { id: 'c1', nome: 'Canário', dominio: 'canario.test' };
const semEspera = { esperar: async () => undefined };

describe('enriquecimento da empresa', () => {
  it('lê o CNPJ do site, busca na Receita, acha a localização pelo CEP e o logo do site', async () => {
    const { buscar, pedidos } = internet({
      'https://canario.test/apple-touch-icon.png': new Response('png', { headers: { 'content-type': 'image/png' } }),
      'https://canario.test': html('<footer>Canário Indústria — CNPJ 12.345.678/0001-95 · <a href="https://br.linkedin.com/company/canario">in</a></footer>'),
      'https://brasilapi.com.br/api/cnpj/v1/12345678000195': json(RECEITA),
      'https://brasilapi.com.br/api/cep/v2/01310100': json({ city: 'São Paulo', state: 'SP', location: { coordinates: { latitude: '-23.5613', longitude: '-46.6565' } } })
    });
    const r = await enriquecerEmpresa(conta, { buscar, ...semEspera });
    expect(r.campos).toMatchObject({
      cnpj: '12345678000195', razao_social: 'CANARIO INDUSTRIA LTDA', nome_fantasia: 'CANARIO', city: 'São Paulo', state_uf: 'SP', cep: '01310100',
      telefone: '(11) 3333-4444', email_empresa: 'contato@canario.test', cnae: '2710401 - Fabricação de geradores', situacao_cadastral: 'ATIVA',
      lat: -23.5613, lng: -46.6565, localizacao_precisao: 'cep', logo_url: 'https://canario.test/apple-touch-icon.png',
      linkedin_company_url: 'https://www.linkedin.com/company/canario'
    });
    expect(r.campos.endereco).toBe('Avenida Paulista, 1000, Andar 5, Bela Vista');
    expect(r.fontes).toMatchObject({ cnpj: 'Site da empresa', razao_social: 'Receita Federal (BrasilAPI)', lat: 'BrasilAPI (CEP)' });
    expect(pedidos.some(u => u.includes('nominatim'))).toBe(false);
  });

  it('BrasilAPI fora do ar: usa a minhareceita; CEP sem coordenada: procura o endereço no OpenStreetMap', async () => {
    const { buscar, pedidos } = internet({
      'https://canario.test/apple-touch-icon.png': new Response('x', { status: 404 }),
      'https://canario.test': html('CNPJ: 12345678000195'),
      'https://brasilapi.com.br/api/cnpj': json({}, 503),
      'https://minhareceita.org/12345678000195': json(RECEITA),
      'https://brasilapi.com.br/api/cep/v2': json({ city: 'São Paulo', state: 'SP', location: { coordinates: {} } }),
      'https://nominatim.openstreetmap.org/search': json([{ lat: '-23.56', lon: '-46.65' }])
    });
    const r = await enriquecerEmpresa(conta, { buscar, ...semEspera });
    expect(r.fontes.razao_social).toBe('Receita Federal (minhareceita)');
    expect(r.campos).toMatchObject({ lat: -23.56, lng: -46.65, localizacao_precisao: 'endereco' });
    expect(r.campos.logo_url).toBe('https://www.google.com/s2/favicons?domain=canario.test&sz=128');
    expect(new URL(pedidos.find(u => u.includes('nominatim'))!).searchParams.get('q')).toBe('Avenida Paulista, 1000, São Paulo, SP, Brasil');
  });

  it('as duas fontes da Receita fora do ar: avisa para tentar depois (não grava nada pela metade)', async () => {
    const { buscar } = internet({
      'https://canario.test/apple-touch-icon.png': new Response('x', { status: 404 }),
      'https://canario.test': html('CNPJ 12.345.678/0001-95'),
      'https://brasilapi.com.br': json({}, 500),
      'https://minhareceita.org': json({}, 502)
    });
    await expect(enriquecerEmpresa(conta, { buscar, ...semEspera })).rejects.toBeInstanceOf(FonteIndisponivel);
  });

  it('site sem CNPJ e conta só com cidade: localização aproximada pela cidade; nada inventado', async () => {
    const { buscar } = internet({
      'https://canario.test/apple-touch-icon.png': new Response('x', { status: 404 }),
      'https://canario.test/': html('<p>Sem CNPJ aqui</p>'),
      'https://canario.test': html('<p>Sem CNPJ aqui</p>'),
      'https://nominatim.openstreetmap.org/search': json([{ lat: '-22.9', lon: '-47.06' }])
    });
    const r = await enriquecerEmpresa({ ...conta, cidade: 'Campinas', uf: 'SP' }, { buscar, ...semEspera });
    expect(r.campos.cnpj).toBeUndefined();
    expect(r.campos.razao_social).toBeUndefined();
    expect(r.campos).toMatchObject({ lat: -22.9, lng: -47.06, localizacao_precisao: 'cidade' });
  });

  it('site fora do ar e conta sem nada: resultado vazio (o banco devolve o crédito)', async () => {
    const { buscar } = internet({});
    const r = await enriquecerEmpresa(conta, { buscar, ...semEspera });
    expect(r).toEqual({ campos: {}, fontes: {}, custoUsd: 0 });
  });

  it('conta que já tem localização não procura de novo; CNPJ da conta tem prioridade sobre o do site', async () => {
    const { buscar, pedidos } = internet({
      'https://canario.test/apple-touch-icon.png': new Response('x', { status: 404 }),
      'https://canario.test': html('CNPJ 00.000.000/0001-91'),
      'https://brasilapi.com.br/api/cnpj/v1/12345678000195': json(RECEITA)
    });
    const r = await enriquecerEmpresa({ ...conta, cnpj: '12345678000195', lat: -23, lng: -46 }, { buscar, ...semEspera });
    expect(r.campos.cnpj).toBeUndefined();
    expect(r.campos.razao_social).toBe('CANARIO INDUSTRIA LTDA');
    expect(r.campos.lat).toBeUndefined();
    expect(pedidos.some(u => u.includes('/cep/') || u.includes('nominatim'))).toBe(false);
  });

  it('respeita o uso justo do OpenStreetMap (espera entre pedidos)', async () => {
    const esperas: number[] = [];
    const { buscar } = internet({
      'https://nominatim.openstreetmap.org/search': json([])
    });
    await enriquecerEmpresa({ ...conta, dominio: null, cidade: 'Campinas', uf: 'SP' }, { buscar, esperar: async ms => { esperas.push(ms); } });
    await enriquecerEmpresa({ ...conta, dominio: null, cidade: 'Campinas', uf: 'SP' }, { buscar, esperar: async ms => { esperas.push(ms); } });
    expect(esperas.length).toBeGreaterThan(0);
    expect(Math.max(...esperas)).toBeLessThanOrEqual(1100);
  });
});

describe('CNPJ por busca (quando o site não mostra o CNPJ)', () => {
  const rotasBase = {
    'https://canario.test/apple-touch-icon.png': new Response('x', { status: 404 }),
    'https://canario.test': html('<footer>Canário — fale conosco</footer>'),
    'https://brasilapi.com.br/api/cep/v2': json({ city: 'São Paulo', state: 'SP', location: { coordinates: {} } }),
    'https://nominatim.openstreetmap.org/search': json([])
  };
  const busca = (candidatos: string[], custoUsd: number | null = 0.004) => {
    const chamadas: unknown[] = [];
    return { chamadas, buscarCnpj: async (c: unknown) => { chamadas.push(c); return { candidatos, custoUsd }; } };
  };

  it('aceita o CNPJ da busca quando a Receita confirma que o nome é o da conta', async () => {
    const { buscar } = internet({ ...rotasBase, 'https://brasilapi.com.br/api/cnpj/v1/12345678000195': json(RECEITA) });
    const b = busca(['12345678000195']);
    const r = await enriquecerEmpresa(conta, { buscar, ...semEspera, buscarCnpj: b.buscarCnpj });
    expect(r.campos).toMatchObject({ cnpj: '12345678000195', razao_social: 'CANARIO INDUSTRIA LTDA', cep: '01310100' });
    expect(r.fontes.cnpj).toBe('Busca no Google, conferida na Receita Federal');
    expect(r.custoUsd).toBe(0.004);
    expect(b.chamadas).toHaveLength(1);
  });

  it('recusa o CNPJ de outra empresa: não preenche nem o CNPJ nem os dados da Receita', async () => {
    const outra = { ...RECEITA, razao_social: 'OUTRA EMPRESA LTDA', nome_fantasia: 'OUTRA' };
    const { buscar } = internet({ ...rotasBase, 'https://brasilapi.com.br/api/cnpj/v1/12345678000195': json(outra) });
    const r = await enriquecerEmpresa(conta, { buscar, ...semEspera, buscarCnpj: busca(['12345678000195']).buscarCnpj });
    expect(r.campos.cnpj).toBeUndefined();
    expect(r.campos.razao_social).toBeUndefined();
    expect(r.campos.endereco).toBeUndefined();
  });

  it('confere um candidato de cada vez e fica com o primeiro que bate (no máximo 3)', async () => {
    const outra = { ...RECEITA, razao_social: 'OUTRA EMPRESA LTDA', nome_fantasia: 'OUTRA' };
    const { buscar, pedidos } = internet({
      ...rotasBase,
      'https://brasilapi.com.br/api/cnpj/v1/00000000000191': json(outra),
      'https://brasilapi.com.br/api/cnpj/v1/12345678000195': json(RECEITA)
    });
    const r = await enriquecerEmpresa(conta, { buscar, ...semEspera, buscarCnpj: busca(['00000000000191', '12345678000195', '11222333000181', '11444777000161']).buscarCnpj });
    expect(r.campos.cnpj).toBe('12345678000195');
    expect(pedidos.filter(u => u.includes('/cnpj/v1/'))).toHaveLength(2);

    const { buscar: buscar2, pedidos: pedidos2 } = internet({ ...rotasBase, 'https://brasilapi.com.br/api/cnpj/v1/': json(outra) });
    const tudo = await enriquecerEmpresa(conta, { buscar: buscar2, ...semEspera,
      buscarCnpj: busca(['00000000000191', '11222333000181', '11444777000161', '12345678000195']).buscarCnpj });
    expect(tudo.campos.cnpj).toBeUndefined();
    expect(pedidos2.filter(u => u.includes('/cnpj/v1/'))).toHaveLength(3);
  });

  it('não gasta busca quando o site já mostra o CNPJ ou a conta já tem CNPJ', async () => {
    const b = busca(['12345678000195']);
    const noSite = internet({ ...rotasBase, 'https://canario.test': html('CNPJ 12.345.678/0001-95'), 'https://brasilapi.com.br/api/cnpj/v1/12345678000195': json(RECEITA) });
    const r1 = await enriquecerEmpresa(conta, { buscar: noSite.buscar, ...semEspera, buscarCnpj: b.buscarCnpj });
    expect(r1.custoUsd).toBe(0);
    const digitado = internet({ ...rotasBase, 'https://brasilapi.com.br/api/cnpj/v1/12345678000195': json(RECEITA) });
    await enriquecerEmpresa({ ...conta, cnpj: '12345678000195' }, { buscar: digitado.buscar, ...semEspera, buscarCnpj: b.buscarCnpj });
    expect(b.chamadas).toHaveLength(0);
  });

  it('busca que falha (sem chave da Apify, por exemplo) não derruba o resto: segue sem CNPJ e sem custo', async () => {
    const { buscar } = internet(rotasBase);
    const r = await enriquecerEmpresa(conta, { buscar, ...semEspera, buscarCnpj: async () => { throw new Error('Nenhuma chave da Apify cadastrada.'); } });
    expect(r.campos.cnpj).toBeUndefined();
    expect(r.campos.logo_url).toBeDefined();
    expect(r.custoUsd).toBe(0);
  });

  it('custo desconhecido da busca continua desconhecido (o banco assume o pior)', async () => {
    const { buscar } = internet({ ...rotasBase, 'https://brasilapi.com.br/api/cnpj/v1/12345678000195': json(RECEITA) });
    const r = await enriquecerEmpresa(conta, { buscar, ...semEspera, buscarCnpj: busca(['12345678000195'], null).buscarCnpj });
    expect(r.custoUsd).toBeNull();
  });

  it('Receita fora do ar na conferência: tenta depois (não aceita nem recusa às cegas)', async () => {
    const { buscar } = internet({ ...rotasBase, 'https://brasilapi.com.br/api/cnpj': json({}, 503), 'https://minhareceita.org': json({}, 503) });
    await expect(enriquecerEmpresa(conta, { buscar, ...semEspera, buscarCnpj: busca(['12345678000195']).buscarCnpj })).rejects.toBeInstanceOf(FonteIndisponivel);
  });
});
