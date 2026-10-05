// Nomes de exibição dos 4 agentes (decisão do dono): Zoe, Jax, Lia e Neo. Só a exibição muda:
// os códigos técnicos (comercial, marketing, copy, revops) seguem iguais no banco, no Hermes e nas permissões.
// A troca vem de uma regra em scripts/v18/patches.mjs, então sobrevive a um novo fonte/ do design.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const V18 = path.resolve(__dirname, '..', 'v18');
const gerado = (arq: string) => fs.readFileSync(path.join(V18, arq), 'utf8');
const ARQUIVOS = ['data.js', 'module.js', 'logic.generated.js', 'template.generated.tsx', 'althius.css'];
const NOVOS = [
  { codigo: 'comercial', nome: 'Zoe', sigla: 'ZO' },
  { codigo: 'marketing', nome: 'Jax', sigla: 'JA' },
  { codigo: 'copy', nome: 'Lia', sigla: 'LI' },
  { codigo: 'revops', nome: 'Neo', sigla: 'NE' }
];

describe('nomes de exibição dos agentes', () => {
  const dados = gerado('data.js');

  for (const { codigo, nome, sigla } of NOVOS) {
    it(`${codigo} aparece como ${nome} (${sigla}), sem mudar o código técnico`, () => {
      expect(dados).toMatch(new RegExp(`id: '${codigo}', nome: '${nome}', sigla: '${sigla}'`));
    });
  }

  it('nenhum nome nem sigla antiga sobra em arquivo gerado', () => {
    for (const arq of ARQUIVOS) {
      expect(gerado(arq), arq).not.toMatch(/\b(Venator|Praeco|Stilus|Ratio)\b/);
    }
    expect(dados).not.toMatch(/sigla: '(VE|PR|ST|RA)'/);
    expect(gerado('logic.generated.js')).not.toMatch(/sigla: '(VE|PR|ST|RA)'|\|\| 'VE'/);
  });

  it('o app marca cada avatar pela sigla: o mapa tem as siglas novas, na ordem certa', () => {
    expect(gerado('logic.generated.js')).toContain("{ ZO: 'comercial', JA: 'marketing', LI: 'copy', NE: 'revops' }");
  });

  it('as linhas "Do latim, …" saem (os nomes novos não são latinos), mantendo o resto da frase', () => {
    expect(dados).not.toContain('Do latim');
    expect(dados).toMatch(/latim: 'Vai atrás das contas certas'/);
    expect(dados).toMatch(/latim: 'Anuncia a marca ao mercado'/);
    expect(dados).toMatch(/latim: 'Escreve no tom da marca'/);
    expect(dados).toMatch(/latim: 'Mantém os números de pé'/);
  });
});
