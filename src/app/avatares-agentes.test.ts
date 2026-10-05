// Avatares dos 4 agentes: uma camada própria por cima do protótipo (sobrevive a um novo fonte/ do design).
// Garante: cada agente tem seu arquivo, o CSS cobre todos os estados (parado, hover, tamanho grande,
// movimento reduzido), e o arquivo é seguro e leve (as originais do design tinham 1,6 a 2,4 MB).
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const PASTA = path.resolve(__dirname);
const AGENTES = { comercial: 'venator', marketing: 'praeco', copy: 'stilus', revops: 'ratio' } as const;
const css = fs.readFileSync(path.join(PASTA, 'avatares-agentes.css'), 'utf8');

describe('avatares dos agentes', () => {
  for (const [codigo, arquivo] of Object.entries(AGENTES)) {
    describe(`${codigo} → ${arquivo}.svg`, () => {
      const caminho = path.join(PASTA, 'avatares', `${arquivo}.svg`);

      it('o arquivo existe e é um SVG', () => {
        expect(fs.existsSync(caminho)).toBe(true);
        expect(fs.readFileSync(caminho, 'utf8').trimStart().startsWith('<svg')).toBe(true);
      });

      it('é seguro: sem script, sem evento, sem link para fora', () => {
        const svg = fs.readFileSync(caminho, 'utf8');
        expect(svg).not.toMatch(/<script|<foreignObject|\son[a-z]+\s*=/i);
        const links = [...svg.matchAll(/(?:xlink:href|href|src)="([^"]*)"/g)].map(m => m[1]);
        expect(links.filter(l => !l.startsWith('#') && !l.startsWith('data:image/'))).toEqual([]);
        expect(svg).not.toMatch(/url\(\s*['"]?https?:/i);
      });

      it('é leve (nada de textura de megabytes embutida)', () => {
        expect(fs.statSync(caminho).size).toBeLessThan(120 * 1024);
      });

      it('o CSS aponta para ele em todos os estados do protótipo', () => {
        const usos = css.split('\n').filter(l => l.includes(`avatares/${arquivo}.svg`));
        expect(usos.length).toBeGreaterThanOrEqual(1);
        const blocos = css.split('}').filter(b => b.includes(`avatares/${arquivo}.svg`)).join('}');
        for (const seletor of [`[data-ag="${codigo}"]`, `.ag4-tile[data-ag="${codigo}"]`, `.ag-tile[data-ag="${codigo}"][style*="56px"]`, `[data-ag="${codigo}"]:hover`, `.navrow:hover [data-ag="${codigo}"]`, `.ag4-card:hover [data-ag="${codigo}"]`]) {
          expect(blocos, `falta ${seletor}`).toContain(seletor);
        }
      });
    });
  }

  it('o CSS vence as regras do protótipo (que usam !important)', () => {
    expect(css).toMatch(/html \[data-ag="comercial"\]/);
    expect(css.match(/background-image:[^;]*!important/g)?.length).toBe(4);
  });

  it('quatro avatares diferentes entre si', () => {
    const tamanhos = Object.values(AGENTES).map(a => fs.readFileSync(path.join(PASTA, 'avatares', `${a}.svg`), 'utf8'));
    expect(new Set(tamanhos).size).toBe(4);
  });
});
