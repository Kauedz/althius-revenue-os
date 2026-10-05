// Fonte única dos nomes e siglas de exibição dos agentes (Zoe, Jax, Lia e Neo) para os serviços do app.
// Antes, créditos, relatórios, prospecção, sinais e canais tinham os nomes antigos fixos: a tela Agentes dizia
// "Zoe" e o extrato dizia "Agente Comercial", e as siglas antigas (CO, MK, CP, RO) faziam o avatar novo sumir.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { AGENTES_EXIBICAO, nomeDoAgente, siglaDoAgente } from './agentes-exibicao';

const SRC = path.resolve(__dirname, '..');
const dadosPrototipo = fs.readFileSync(path.join(SRC, 'v18', 'data.js'), 'utf8');

function arquivosDeCodigo(pasta: string): string[] {
  return fs.readdirSync(pasta, { withFileTypes: true }).flatMap(e => {
    const caminho = path.join(pasta, e.name);
    if (e.isDirectory()) return e.name === 'v18' ? [] : arquivosDeCodigo(caminho);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [caminho] : [];
  });
}

describe('nomes de exibição dos agentes nos serviços', () => {
  it('batem com os do protótipo (data.js gerado): nome e sigla', () => {
    for (const [codigo, { nome, sigla }] of Object.entries(AGENTES_EXIBICAO)) {
      expect(dadosPrototipo, codigo).toMatch(new RegExp(`id: '${codigo}', nome: '${nome}', sigla: '${sigla}'`));
    }
  });

  it('são os quatro agentes fixos, com nome e sigla de duas letras', () => {
    expect(Object.keys(AGENTES_EXIBICAO)).toEqual(['comercial', 'marketing', 'copy', 'revops']);
    expect(nomeDoAgente('copy')).toBe('Lia');
    expect(siglaDoAgente('revops')).toBe('NE');
  });

  it('agente desconhecido não vira nome inventado: devolve o próprio código e uma sigla derivada', () => {
    expect(nomeDoAgente('outro')).toBe('outro');
    expect(siglaDoAgente('outro')).toBe('OU');
  });

  it('nenhum nome nem sigla antiga sobra em código do app, do servidor ou dos serviços', () => {
    const achados: string[] = [];
    for (const arq of arquivosDeCodigo(SRC)) {
      // O papel ("o Agente Comercial da Althius") continua nos prompts de LLM: ali só o nome de exibição entra.
      if (arq.endsWith(path.join('server', 'hermes', 'llm-client.ts'))) continue;
      const texto = fs.readFileSync(arq, 'utf8');
      if (/Agente (Comercial|de Marketing|de Copy|de RevOps)/.test(texto)) achados.push(`${path.relative(SRC, arq)}: nome antigo`);
      if (/sigla: '(CO|MK|CP|RO)'|\['Agente [^']*', '(CO|MK|CP|RO)'\]/.test(texto)) achados.push(`${path.relative(SRC, arq)}: sigla antiga`);
    }
    expect(achados).toEqual([]);
  });
});
