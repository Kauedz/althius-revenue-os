// Normalização no front: domínio, URL, e-mail com nome e CSV.
// Parte dos casos vem dos testes do Twenty (MIT; veja THIRD_PARTY_NOTICES.md, seção 2): normalizeDomain, isValidDomain,
// normalizeUrl, parseEmailAddressList e formatEmailAddress. O alinhamento com o banco está em normalizacao.banco.test.ts.
import { describe, expect, it } from 'vitest';
import {
  dominioValido,
  formatarEmail,
  higienizarValorCsv,
  hostDaUrl,
  lerCsv,
  lerListaDeEmails,
  normalizarDominio,
  normalizarUrl,
  valorParaCsv
} from './normalizacao';
import { AlthiusApp } from './AlthiusApp';

describe('normalizarDominio', () => {
  it.each([
    ['sem www', 'empresa.com.br'],
    ['com www.', 'www.empresa.com.br'],
    ['MAIÚSCULAS', 'WWW.Empresa.COM.br'],
    ['https com barra no fim', 'https://EMPRESA.com.br/'],
    ['http com porta 80', 'http://empresa.com.br:80'],
    ['porta qualquer', 'empresa.com.br:8443'],
    ['caminho, consulta e âncora', 'https://www.empresa.com.br/produtos/importacao?x=1#topo'],
    ['tudo junto', 'HTTPS://WWW.Empresa.com.br:8080/x?y#z'],
    ['usuario:senha@', 'https://usuario:senha@www.empresa.com.br:443/x'],
    ['ponto final', 'empresa.com.br.'],
    ['vários pontos finais', 'empresa.com.br...'],
    ['vários www. seguidos', 'www.www.www.empresa.com.br'],
    ['espaços nas pontas', '  https://www.empresa.com.br  '],
    ['sem protocolo, só //', '//www.empresa.com.br/x'],
    ['barra invertida separa o caminho', 'https:\\\\www.empresa.com.br\\x'],
    ['e-mail vira o domínio dele', 'contato@empresa.com.br']
  ])('%s vira empresa.com.br', (_nome, entrada) => {
    expect(normalizarDominio(entrada)).toBe('empresa.com.br');
  });

  it('mantém subdomínio que não é www', () => {
    expect(normalizarDominio('https://Loja.Empresa.com.br/x')).toBe('loja.empresa.com.br');
    expect(normalizarDominio('twenty.co.uk')).toBe('twenty.co.uk');
  });

  it('converte domínio com acento para punycode (o banco guarda o acento como está: veja normalizacao.banco.test.ts)', () => {
    expect(normalizarDominio('münchen.de')).toBe('xn--mnchen-3ya.de');
    expect(normalizarDominio('https://www.CAFÉ.com.br/')).toBe('xn--caf-dma.com.br');
  });

  it.each([
    ['vazio', ''],
    ['só espaços', '   '],
    ['nulo', null],
    ['indefinido', undefined],
    ['localhost', 'localhost'],
    ['localhost com protocolo e porta', 'http://localhost:3000'],
    ['IP local', '127.0.0.1'],
    ['IP de rede', '192.168.1.1'],
    ['sem terminação', 'empresa'],
    ['só o protocolo', 'http://'],
    ['espaço no meio', 'serra azul.com.br'],
    ['texto solto', 'not a domain'],
    ['esquema perigoso', 'javascript:alert(1)'],
    ['tag', '<script>'],
    ['começa com hífen', '-ruim.com.br'],
    ['só www', 'www.']
  ])('devolve nulo (não é domínio de empresa): %s', (_nome, entrada) => {
    expect(normalizarDominio(entrada)).toBeNull();
  });

  it('é idempotente: normalizar de novo não muda nada', () => {
    const entradas = [
      'https://www.EMPRESA.com.br:8080/x?y#z',
      'www.www.empresa.com.br.',
      'münchen.de',
      'contato@empresa.com.br',
      'localhost',
      '',
      'not a domain',
      'twenty.co.uk'
    ];
    for (const entrada of entradas) {
      const uma = normalizarDominio(entrada);
      expect(normalizarDominio(uma)).toBe(uma);
    }
  });
});

describe('dominioValido', () => {
  it.each(['empresa.com.br', 'https://www.empresa.com.br/vagas?x=1', 'blog.empresa.com.br', 'twenty.co.uk', 'münchen.de', 'empresa.com.br.', 'empresa.com.br:8080'])(
    'aceita %s',
    entrada => {
      expect(dominioValido(entrada)).toBe(true);
    }
  );

  it.each(['', '   ', 'not a domain', 'empresa', 'javascript:alert(1)', '<script>', 'localhost', '192.168.1.1', 'empresa .com.br'])(
    'recusa "%s"',
    entrada => {
      expect(dominioValido(entrada)).toBe(false);
    }
  );
});

describe('hostDaUrl', () => {
  it('devolve só o nome do site, em minúsculas', () => {
    expect(hostDaUrl('https://www.Empresa.com.br:8080/x?y#z')).toBe('www.empresa.com.br');
    expect(hostDaUrl('empresa.com.br')).toBe('empresa.com.br');
    expect(hostDaUrl('  HTTP://Loja.Empresa.com.br/a  ')).toBe('loja.empresa.com.br');
  });

  it('como no Twenty, aceita localhost e IP (quem quiser barrar usa dominioValido)', () => {
    expect(hostDaUrl('http://localhost:3000')).toBe('localhost');
    expect(hostDaUrl('http://127.0.0.1:8080/x')).toBe('127.0.0.1');
  });

  it.each([
    ['vazio', ''],
    ['só espaços', '   '],
    ['espaço no meio', 'não é url'],
    ['só números', '12345'],
    ['só o protocolo', 'http://'],
    ['começa com hífen', 'https://-ruim.com'],
    ['sem terminação', 'https://empresa']
  ])('lança erro em português quando a URL é inválida: %s', (_nome, entrada) => {
    expect(() => hostDaUrl(entrada)).toThrow('URL inválida');
  });
});

describe('normalizarUrl', () => {
  it('devolve vazio para vazio ou só espaços', () => {
    expect(normalizarUrl('')).toBe('');
    expect(normalizarUrl('   ')).toBe('');
  });

  it('coloca https e limpa a origem de endereço sem protocolo', () => {
    expect(normalizarUrl('example.com')).toBe('https://example.com');
    expect(normalizarUrl('  example.com  ')).toBe('https://example.com');
  });

  it('põe a origem em minúsculas e mantém o caminho', () => {
    expect(normalizarUrl('HTTPS://WWW.Example.COM/Path')).toBe('https://www.example.com/Path');
  });

  it('tira a barra do fim e a porta padrão', () => {
    expect(normalizarUrl('https://example.com/')).toBe('https://example.com');
    expect(normalizarUrl('http://empresa.com.br:80')).toBe('http://empresa.com.br');
  });

  it('preserva sequências com % no caminho', () => {
    expect(normalizarUrl('https://example.com/path%2Fencoded')).toBe('https://example.com/path%2Fencoded');
  });
});

describe('lerListaDeEmails', () => {
  it('lê e-mail com nome', () => {
    expect(lerListaDeEmails('Aline Xavier <a@x.com.br>')).toEqual([{ address: 'a@x.com.br', name: 'Aline Xavier' }]);
  });

  it('lê nome entre aspas com vírgula sem quebrar a lista', () => {
    expect(lerListaDeEmails('"Xavier, Aline" <a@x.com.br>')).toEqual([{ address: 'a@x.com.br', name: 'Xavier, Aline' }]);
    expect(lerListaDeEmails('"Doe, John" <jd@example.com>, bob@example.com')).toEqual([
      { address: 'jd@example.com', name: 'Doe, John' },
      { address: 'bob@example.com', name: '' }
    ]);
  });

  it('lê lista separada por vírgula', () => {
    expect(lerListaDeEmails('alice@example.com, bob@example.com')).toEqual([
      { address: 'alice@example.com', name: '' },
      { address: 'bob@example.com', name: '' }
    ]);
  });

  it('lê lista separada por ponto e vírgula', () => {
    expect(lerListaDeEmails('alice@example.com; bob@example.com')).toEqual([
      { address: 'alice@example.com', name: '' },
      { address: 'bob@example.com', name: '' }
    ]);
  });

  it('mistura , e ; na mesma lista', () => {
    expect(lerListaDeEmails('a@x.com.br; Bia <b@x.com.br>, "C, Carlos" <c@x.com.br>')).toEqual([
      { address: 'a@x.com.br', name: '' },
      { address: 'b@x.com.br', name: 'Bia' },
      { address: 'c@x.com.br', name: 'C, Carlos' }
    ]);
  });

  it('lê nomes com aspas e com ou sem espaço', () => {
    expect(lerListaDeEmails('Alice <alice@example.com>, "Bob Smith" <bob@example.com>')).toEqual([
      { address: 'alice@example.com', name: 'Alice' },
      { address: 'bob@example.com', name: 'Bob Smith' }
    ]);
  });

  it('achata grupos nos membros', () => {
    expect(lerListaDeEmails('Team: alice@example.com, Bob <bob@example.com>;, carol@example.com')).toEqual([
      { address: 'alice@example.com', name: '' },
      { address: 'bob@example.com', name: 'Bob' },
      { address: 'carol@example.com', name: '' }
    ]);
    expect(lerListaDeEmails('Outer: Inner: a@b.com;;, c@d.com')).toEqual([
      { address: 'a@b.com', name: '' },
      { address: 'c@d.com', name: '' }
    ]);
  });

  it('descarta grupo vazio', () => {
    expect(lerListaDeEmails('undisclosed-recipients:;')).toEqual([]);
  });

  it('mantém texto sem e-mail como nome com endereço vazio', () => {
    expect(lerListaDeEmails('SemEndereco, bob@example.com')).toEqual([
      { address: '', name: 'SemEndereco' },
      { address: 'bob@example.com', name: '' }
    ]);
  });

  it('usa o comentário entre parênteses como nome quando não há outro', () => {
    expect(lerListaDeEmails('a@x.com.br (Aline)')).toEqual([{ address: 'a@x.com.br', name: 'Aline' }]);
  });

  it('não quebra por causa de < ou ; dentro de aspas', () => {
    expect(lerListaDeEmails('"A; B <c>" <a@x.com.br>, b@x.com.br')).toEqual([
      { address: 'a@x.com.br', name: 'A; B <c>' },
      { address: 'b@x.com.br', name: '' }
    ]);
  });

  it('devolve lista vazia para vazio ou só espaços', () => {
    expect(lerListaDeEmails('')).toEqual([]);
    expect(lerListaDeEmails('   ')).toEqual([]);
  });
});

describe('formatarEmail', () => {
  it('sem nome devolve só o e-mail', () => {
    expect(formatarEmail({ address: 'alice@example.com' })).toBe('alice@example.com');
    expect(formatarEmail({ address: 'alice@example.com', name: '' })).toBe('alice@example.com');
  });

  it('monta Nome <e-mail> sem aspas quando o nome é simples', () => {
    expect(formatarEmail({ address: 'a@x.com.br', name: 'Aline Xavier' })).toBe('Aline Xavier <a@x.com.br>');
  });

  it('põe aspas quando o nome tem vírgula ou ponto', () => {
    expect(formatarEmail({ address: 'a@x.com.br', name: 'Xavier, Aline' })).toBe('"Xavier, Aline" <a@x.com.br>');
    expect(formatarEmail({ address: 'a@x.com.br', name: 'Dra. Aline' })).toBe('"Dra. Aline" <a@x.com.br>');
  });

  it('escapa aspas e barra invertida dentro do nome', () => {
    expect(formatarEmail({ address: 'a@example.com', name: 'A "B" C' })).toBe('"A \\"B\\" C" <a@example.com>');
    expect(formatarEmail({ address: 'a@example.com', name: 'A \\ B' })).toBe('"A \\\\ B" <a@example.com>');
    expect(formatarEmail({ address: 'a@example.com', name: 'x\\"y' })).toBe('"x\\\\\\"y" <a@example.com>');
  });

  it('põe aspas em nome com sintaxe de grupo ou comentário', () => {
    expect(formatarEmail({ address: 'a@b.com', name: 'Re: update' })).toBe('"Re: update" <a@b.com>');
    expect(formatarEmail({ address: 'b@c.com', name: 'Bob (Sales)' })).toBe('"Bob (Sales)" <b@c.com>');
  });

  it('não põe aspas em palavra codificada (RFC 2047)', () => {
    expect(formatarEmail({ address: 'user@example.com', name: '=?UTF-8?B?VGVzdCBVc2Vy?=' })).toBe('=?UTF-8?B?VGVzdCBVc2Vy?= <user@example.com>');
  });

  it.each(['Aline Xavier', 'Xavier, Aline', 'Dra. Aline', 'A "B" C', 'x\\"y', 'A \\ B', 'Re: update', 'Bob (Sales)', 'Zé <z>'])(
    'volta a ser lido igual (nome %s)',
    nome => {
      const montado = formatarEmail({ address: 'a@x.com.br', name: nome });
      expect(lerListaDeEmails(`${montado}, b@x.com.br`)).toEqual([
        { address: 'a@x.com.br', name: nome },
        { address: 'b@x.com.br', name: '' }
      ]);
    }
  );
});

describe('valorParaCsv', () => {
  it('valor simples fica como está', () => {
    expect(valorParaCsv('Serra Azul')).toBe('Serra Azul');
    expect(valorParaCsv(12)).toBe('12');
    expect(valorParaCsv(true)).toBe('true');
  });

  it('nulo e indefinido viram vazio', () => {
    expect(valorParaCsv(null)).toBe('');
    expect(valorParaCsv(undefined)).toBe('');
  });

  it('valor com vírgula vai entre aspas', () => {
    expect(valorParaCsv('Silva, Souza & Cia')).toBe('"Silva, Souza & Cia"');
  });

  it('aspas dentro do valor são dobradas', () => {
    expect(valorParaCsv('ela disse "oi"')).toBe('"ela disse ""oi"""');
  });

  it('quebra de linha vai entre aspas', () => {
    expect(valorParaCsv('linha 1\nlinha 2')).toBe('"linha 1\nlinha 2"');
    expect(valorParaCsv('linha 1\r\nlinha 2')).toBe('"linha 1\r\nlinha 2"');
  });

  it('objeto vira JSON (já protegido por aspas)', () => {
    expect(valorParaCsv({ a: 1, b: 'x' })).toBe('"{""a"":1,""b"":""x""}"');
  });
});

describe('higienizarValorCsv (injeção de fórmula na exportação)', () => {
  it.each(['=SOMA(A1:A9)', '+55 11 99999-0000', '-1+1', '@cmd', '\tcmd', '\rcmd'])(
    'neutraliza valor que começa com caractere perigoso: %j',
    valor => {
      const seguro = higienizarValorCsv(valor);
      expect(seguro).toBe('\u200D' + valor);
      expect(seguro.endsWith(valor)).toBe(true);
    }
  );

  it('não mexe em valor normal nem em caractere perigoso no meio', () => {
    expect(higienizarValorCsv('Serra Azul')).toBe('Serra Azul');
    expect(higienizarValorCsv('a=b')).toBe('a=b');
    expect(higienizarValorCsv('contato@empresa.com.br')).toBe('contato@empresa.com.br');
  });

  it('nulo vira vazio e número vira texto', () => {
    expect(higienizarValorCsv(null)).toBe('');
    expect(higienizarValorCsv(undefined)).toBe('');
    expect(higienizarValorCsv(5)).toBe('5');
  });

  it('higienizar e depois formatar mantém a proteção', () => {
    expect(valorParaCsv(higienizarValorCsv('=1+1'))).toBe('\u200D=1+1');
    expect(valorParaCsv(higienizarValorCsv('=A1,B1'))).toBe('"\u200D=A1,B1"');
  });
});

describe('lerCsv', () => {
  it('lê linhas e células separadas por vírgula, com o número da linha do arquivo', () => {
    const r = lerCsv('a,b,c\n1,2,3\n4,5,6');
    expect(r.linhas).toEqual([
      { numero: 1, celulas: ['a', 'b', 'c'] },
      { numero: 2, celulas: ['1', '2', '3'] },
      { numero: 3, celulas: ['4', '5', '6'] }
    ]);
    expect(r.aspasNaoFechadasNaLinha).toBeNull();
  });

  it('descobre sozinho que o separador é ponto e vírgula', () => {
    expect(lerCsv('nome;site\nSerra Azul;serraazul.com.br').linhas).toEqual([
      { numero: 1, celulas: ['nome', 'site'] },
      { numero: 2, celulas: ['Serra Azul', 'serraazul.com.br'] }
    ]);
  });

  it('lê aspas, vírgula, aspas dobradas e quebra de linha dentro do valor', () => {
    const r = lerCsv('nome,obs\r\n"Silva, ""Zé"" & Cia","linha 1\nlinha 2"\r\nfim,ok');
    expect(r.linhas).toEqual([
      { numero: 1, celulas: ['nome', 'obs'] },
      { numero: 2, celulas: ['Silva, "Zé" & Cia', 'linha 1\nlinha 2'] },
      { numero: 4, celulas: ['fim', 'ok'] }
    ]);
  });

  it('ignora o BOM do começo e as linhas vazias, mas conta o número delas', () => {
    expect(lerCsv('\uFEFFnome,site\n\n   \nA,a.com.br\n').linhas).toEqual([
      { numero: 1, celulas: ['nome', 'site'] },
      { numero: 4, celulas: ['A', 'a.com.br'] }
    ]);
  });

  it('avisa em que linha ficou uma aspa aberta', () => {
    const r = lerCsv('nome,site\n"sem fim,a.com.br\nB,b.com.br');
    expect(r.aspasNaoFechadasNaLinha).toBe(2);
  });

  it('texto vazio não tem linhas', () => {
    expect(lerCsv('').linhas).toEqual([]);
    expect(lerCsv('  \n \n').linhas).toEqual([]);
  });
});

describe('AlthiusApp.dominio (logo pelo site)', () => {
  const dominio = (u: unknown) => (AlthiusApp.prototype as unknown as { dominio: (u: unknown) => string }).dominio.call({}, u);

  it('usa a normalização compartilhada', () => {
    expect(dominio('HTTPS://WWW.Exemplo.com.br:8080/x?y#z')).toBe('exemplo.com.br');
    expect(dominio('http://empresa.com.br:80')).toBe('empresa.com.br');
    expect(dominio('www.www.empresa.com.br.')).toBe('empresa.com.br');
  });

  it('devolve texto vazio (nunca nulo) quando não é domínio', () => {
    expect(dominio('')).toBe('');
    expect(dominio(null)).toBe('');
    expect(dominio(undefined)).toBe('');
    expect(dominio('localhost')).toBe('');
    expect(dominio('não é site')).toBe('');
  });
});
