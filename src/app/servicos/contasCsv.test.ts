// @vitest-environment node
// Seam: src/app/servicos/contas.ts (contasDeCsv). Base da importação de lista de contas por CSV (sem tela ainda).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contasDeCsv } from './contas';

const exemplo = () => readFileSync(new URL('./__fixtures__/contas-exemplo.csv', import.meta.url), 'utf8');

describe('contasDeCsv', () => {
  it('lê o arquivo de exemplo: acentos, aspas, vírgula no nome, linha vazia, sem inventar dado', () => {
    const r = contasDeCsv(exemplo());
    expect(r.contas).toEqual([
      { name: 'Serra Azul Importadora', domain: 'serraazul.com.br', state_uf: 'SP', city: 'São Paulo' },
      { name: 'Comércio "Boa Vista", Ltda', domain: 'boavista.com.br', state_uf: 'MG', city: 'Belo Horizonte' },
      { name: 'Café Ouro', domain: 'cafeouro.com.br', state_uf: 'RJ' },
      { name: 'Tecnologia Ágil', domain: 'tecagil.com.br', state_uf: 'PR', city: 'Curitiba' }
    ]);
    // O número é a linha do arquivo (a linha 4 é a vazia).
    expect(r.problemas).toEqual(['linha 5: site inválido', 'linha 7: nome em branco']);
  });

  it('normaliza o site do mesmo jeito que o banco (www., maiúsculas, http/https, porta, caminho)', () => {
    const r = contasDeCsv('nome,site\nA,www.empresa.com.br\nB,https://EMPRESA.com.br/\nC,http://empresa.com.br:80');
    expect(r.contas.map(c => c.domain)).toEqual(['empresa.com.br', 'empresa.com.br', 'empresa.com.br']);
    expect(r.problemas).toEqual([]);
  });

  it('aceita separador ponto e vírgula, cabeçalhos em inglês/com acento e colunas em qualquer ordem', () => {
    const r = contasDeCsv('Cidade;Domínio;Name;Estado\nRecife;recife.com.br;Loja Recife;pe');
    expect(r.contas).toEqual([{ name: 'Loja Recife', domain: 'recife.com.br', state_uf: 'PE', city: 'Recife' }]);
    expect(r.problemas).toEqual([]);
  });

  it.each([
    ['name', 'domain'],
    ['nome', 'site'],
    ['nome', 'dominio'],
    ['name', 'site']
  ])('reconhece os cabeçalhos %s e %s', (colNome, colSite) => {
    const r = contasDeCsv(`${colNome},${colSite}\nLoja,loja.com.br`);
    expect(r.contas).toEqual([{ name: 'Loja', domain: 'loja.com.br' }]);
  });

  it('aceita arquivo com BOM e quebra de linha do Windows', () => {
    const r = contasDeCsv('\uFEFFnome,site,uf\r\nLoja A,a.com.br,sp\r\nLoja B,b.com.br,rj\r\n');
    expect(r.contas.map(c => [c.name, c.domain, c.state_uf])).toEqual([
      ['Loja A', 'a.com.br', 'SP'],
      ['Loja B', 'b.com.br', 'RJ']
    ]);
  });

  it('aponta a linha de cada problema, sem importar a linha com problema', () => {
    const r = contasDeCsv('nome,site,uf\nBoa,boa.com.br,SP\nSem site,,SP\nSite ruim,localhost,SP\nUF ruim,ok.com.br,São Paulo\n,sem.com.br,SP');
    expect(r.contas).toEqual([{ name: 'Boa', domain: 'boa.com.br', state_uf: 'SP' }]);
    expect(r.problemas).toEqual([
      'linha 3: site em branco',
      'linha 4: site inválido',
      'linha 5: UF inválida (use a sigla com 2 letras)',
      'linha 6: nome em branco'
    ]);
  });

  it('linha com problema nos dois campos lista os dois', () => {
    const r = contasDeCsv('nome,site\n,xyz');
    expect(r.contas).toEqual([]);
    expect(r.problemas).toEqual(['linha 2: nome em branco', 'linha 2: site inválido']);
  });

  it('linha com menos colunas que o cabeçalho conta as que faltam como em branco', () => {
    const r = contasDeCsv('nome,site,uf,cidade\nSó nome');
    expect(r.contas).toEqual([]);
    expect(r.problemas).toEqual(['linha 2: site em branco']);
  });

  it('não repete o campo opcional em branco (nunca inventa UF nem cidade)', () => {
    const r = contasDeCsv('nome,site,uf,cidade\nLoja,loja.com.br,,');
    expect(r.contas).toEqual([{ name: 'Loja', domain: 'loja.com.br' }]);
    expect('state_uf' in r.contas[0]).toBe(false);
    expect('city' in r.contas[0]).toBe(false);
  });

  it('arquivo sem a coluna de nome ou de site avisa pelo cabeçalho e não importa nada', () => {
    expect(contasDeCsv('empresa,site\nLoja,loja.com.br')).toEqual({
      contas: [],
      problemas: ['cabeçalho: falta a coluna do nome (nome ou name)']
    });
    expect(contasDeCsv('nome,url\nLoja,loja.com.br')).toEqual({
      contas: [],
      problemas: ['cabeçalho: falta a coluna do site (site, dominio ou domain)']
    });
    expect(contasDeCsv('a,b\n1,2').problemas).toHaveLength(2);
  });

  it('arquivo vazio, só com espaços ou só com o cabeçalho', () => {
    expect(contasDeCsv('')).toEqual({ contas: [], problemas: ['arquivo vazio'] });
    expect(contasDeCsv('  \n \n')).toEqual({ contas: [], problemas: ['arquivo vazio'] });
    expect(contasDeCsv('nome,site')).toEqual({ contas: [], problemas: ['nenhuma conta no arquivo'] });
  });

  it('avisa de aspas que ficaram abertas', () => {
    const r = contasDeCsv('nome,site\n"Loja sem fim,loja.com.br');
    expect(r.problemas).toContain('linha 2: aspas sem fechar');
  });

  it('tira espaços das pontas dos valores', () => {
    const r = contasDeCsv('nome,site,uf,cidade\n  Loja  ,  loja.com.br  , sp ,  Recife  ');
    expect(r.contas).toEqual([{ name: 'Loja', domain: 'loja.com.br', state_uf: 'SP', city: 'Recife' }]);
  });
});
