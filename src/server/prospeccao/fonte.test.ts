// @vitest-environment node
// Fonte de prospecção como DADO (ADR 0067): a entrada do ator troca {{variáveis}} pelos parâmetros da busca e o
// mapeamento só aponta campos do item. Nada aqui chama a Apify.
import { describe, expect, it } from 'vitest';
import { ErroDeEntrada, mapearItens, montarEntrada, siglaDaUf } from './fonte.ts';

const ENTRADA_MAPS = {
  searchStringsArray: ['{{busca}}'], locationQuery: '{{local}}', maxCrawledPlacesPerSearch: '{{max}}', language: 'pt-BR',
  scrapeContacts: false, maximumLeadsEnrichmentRecords: 0
};
const MAPA_MAPS = {
  chave: 'placeId', prefixo_chave: 'gmaps:', nome: 'title', site: 'website', telefone: 'phone', endereco: 'address', cidade: 'city', uf: 'state',
  categoria: 'categoryName', lat: 'location.lat|latitude', lng: 'location.lng|longitude', dados: ['totalScore', 'url']
};
const ENTRADA_RECEITA = { cnaes: ['{{cnae}}'], states: ['{{uf}}'], municipalities: ['{{municipio}}'], situacaoCadastral: 'ATIVA', maxItems: '{{max}}' };
const MAPA_RECEITA = {
  chave: 'cnpj', prefixo_chave: 'cnpj:', nome: 'nome_fantasia|razao_social', cnpj: 'cnpj', telefone: 'telefone1', cidade: 'municipio', uf: 'uf',
  porte: 'porte', capital_social: 'capital_social|capitalSocial'
};

describe('montar a entrada do ator', () => {
  it('troca as variáveis e o máximo vira número; extras pagos continuam desligados', () => {
    expect(montarEntrada(ENTRADA_MAPS, { busca: 'clínica odontológica', local: 'Campinas, SP, Brasil' }, 50)).toEqual({
      searchStringsArray: ['clínica odontológica'], locationQuery: 'Campinas, SP, Brasil', maxCrawledPlacesPerSearch: 50, language: 'pt-BR',
      scrapeContacts: false, maximumLeadsEnrichmentRecords: 0
    });
  });

  it('parâmetro opcional vazio some da entrada (lista vazia também)', () => {
    expect(montarEntrada(ENTRADA_RECEITA, { cnae: '8630504', uf: 'SP' }, 20)).toEqual({ cnaes: ['8630504'], states: ['SP'], situacaoCadastral: 'ATIVA', maxItems: 20 });
  });

  it('filtro do ICP (porte, capital) não vai para o ator', () => {
    expect(montarEntrada(ENTRADA_RECEITA, { cnae: '8630504', uf: 'SP', porte: 'MICRO,EPP' }, 20)).not.toHaveProperty('porte');
  });

  it('variável sem valor no meio de um texto é erro: nunca chama o ator pela metade', () => {
    expect(() => montarEntrada({ q: 'empresas em {{local}}' }, {}, 10)).toThrow(ErroDeEntrada);
  });
});

describe('ler o que a fonte devolveu', () => {
  it('Google Maps: formato comum, chave com prefixo, UF por extenso vira sigla, coordenadas em location', () => {
    const [x] = mapearItens([{
      title: 'Clínica Sorriso', website: 'https://clinicasorriso.com.br', phone: '+55 19 3333-1111', address: 'Rua A, 10 - Centro', city: 'Campinas', state: 'São Paulo',
      categoryName: 'Dentista', placeId: 'ChIJ123', location: { lat: -22.9, lng: -47.06 }, totalScore: 4.8, url: 'https://maps.google.com/?cid=1', reviews: [{ texto: 'enorme' }]
    }], MAPA_MAPS);
    expect(x).toEqual({
      chave: 'gmaps:ChIJ123', nome: 'Clínica Sorriso', site: 'https://clinicasorriso.com.br', telefone: '+55 19 3333-1111', endereco: 'Rua A, 10 - Centro',
      cidade: 'Campinas', uf: 'SP', categoria: 'Dentista', lat: -22.9, lng: -47.06, dados: { totalScore: 4.8, url: 'https://maps.google.com/?cid=1' }
    });
  });

  it('coordenadas também em latitude/longitude (o mapeamento é tolerante)', () => {
    const [x] = mapearItens([{ title: 'A', placeId: 'p', latitude: '-23.5', longitude: '-46.6' }], MAPA_MAPS);
    expect(x).toMatchObject({ lat: -23.5, lng: -46.6 });
  });

  it('Receita: chave pelo CNPJ só com números, porte e capital social em número', () => {
    const [x] = mapearItens([{ cnpj: '22.333.444/0001-90', razao_social: 'CLINICA MICRO LTDA', porte: 'MICRO EMPRESA', capital_social: 'R$ 10.000,50', municipio: 'SOROCABA', uf: 'sp' }], MAPA_RECEITA);
    expect(x).toMatchObject({ chave: 'cnpj:22333444000190', nome: 'CLINICA MICRO LTDA', cnpj: '22333444000190', porte: 'MICRO', capital_social: 10000.5, cidade: 'SOROCABA', uf: 'SP' });
  });

  it('item sem chave, sem nome ou com erro do ator fica de fora (nunca inventado)', () => {
    expect(mapearItens([{ title: 'Sem chave' }, { placeId: 'p' }, { error: 'falhou', placeId: 'x', title: 'X' }, null, 'texto'], MAPA_MAPS)).toEqual([]);
  });

  it('sigla da UF: por extenso, sem acento ou já sigla; inválida vira nulo', () => {
    expect(siglaDaUf('São Paulo')).toBe('SP');
    expect(siglaDaUf('minas gerais')).toBe('MG');
    expect(siglaDaUf('rj')).toBe('RJ');
    expect(siglaDaUf('State of São Paulo')).toBe('SP');
    expect(siglaDaUf('Texas')).toBeNull();
  });
});
