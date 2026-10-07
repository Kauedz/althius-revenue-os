// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { acharCnpjs, acharLinkedinDaEmpresa, cnpjValido, cnpjsDosResultados, consultaDoCnpj } from './cnpj.ts';

describe('CNPJ', () => {
  it('confere os dígitos verificadores', () => {
    expect(cnpjValido('00.000.000/0001-91')).toBe(true); // Banco do Brasil
    expect(cnpjValido('12.345.678/0001-95')).toBe(true);
    expect(cnpjValido('12.345.678/0001-96')).toBe(false);
    expect(cnpjValido('11111111111111')).toBe(false);
    expect(cnpjValido('123')).toBe(false);
  });

  it('lê o CNPJ do rodapé, com ou sem pontuação, o mais citado primeiro', () => {
    const html = `<footer>Empresa LTDA — CNPJ: 12.345.678/0001-95<br>Filial CNPJ 00000000000191 · CNPJ&nbsp;12.345.678/0001-95</footer>`;
    expect(acharCnpjs(html)).toEqual(['12345678000195', '00000000000191']);
  });

  it('ignora número inválido e pedaço de número maior', () => {
    expect(acharCnpjs('Tel 12.345.678/0001-96 · código 9912345678000195123')).toEqual([]);
  });

  it('acha a página da empresa no LinkedIn', () => {
    expect(acharLinkedinDaEmpresa('<a href="https://br.linkedin.com/company/canario-sa/">LinkedIn</a>')).toBe('https://www.linkedin.com/company/canario-sa');
    expect(acharLinkedinDaEmpresa('<a href="https://linkedin.com/in/pessoa">x</a>')).toBeNull();
  });
});

describe('CNPJ achado pela busca do Google', () => {
  const res = (organicResults: unknown[]) => [{ organicResults }];

  it('lê os CNPJs válidos dos títulos e das descrições, o mais citado primeiro, sem repetir', () => {
    const itens = res([
      { title: 'Canário Indústria - CNPJ 12.345.678/0001-95', description: 'Razão social. CNPJ: 00.000.000/0001-91' },
      { title: 'Canário em CNPJ.biz', description: 'Sede em Campinas. 12345678000195' },
      { title: 'Telefone 11 99999-0000', description: 'CNPJ 12.345.678/0001-96' }
    ]);
    expect(cnpjsDosResultados(itens)).toEqual(['12345678000195', '00000000000191']);
  });

  it('resultado sem texto, sem lista ou de formato estranho não quebra', () => {
    expect(cnpjsDosResultados([{}, null, 'x', { organicResults: 'y' }, ...res([{ url: 'https://x.test' }, null])])).toEqual([]);
  });

  it('a consulta leva o nome, a cidade e o estado, sem aspas soltas', () => {
    expect(consultaDoCnpj({ nome: 'Canário "Top" Ltda', cidade: 'Campinas', uf: 'SP' })).toBe('CNPJ "Canário Top Ltda" Campinas SP');
    expect(consultaDoCnpj({ nome: 'Canário', cidade: null, uf: null })).toBe('CNPJ "Canário"');
  });
});
