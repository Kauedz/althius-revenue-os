// Avatares dos 4 agentes: uma camada própria por cima do protótipo (sobrevive a um novo fonte/ do design).
// Garante: cada agente tem o desenho parado e o animado (olhos que mexem), o CSS cobre todos os estados
// (parado, animado, hover, movimento reduzido), os arquivos são seguros e leves (os originais do design
// tinham 1,6 a 2,4 MB) e a pupila nunca sai do olho.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const PASTA = path.resolve(__dirname);
const AGENTES = { comercial: 'zoe', marketing: 'jax', copy: 'lia', revops: 'neo' } as const;
const css = fs.readFileSync(path.join(PASTA, 'avatares-agentes.css'), 'utf8');
const ler = (arq: string) => fs.readFileSync(path.join(PASTA, 'avatares', arq), 'utf8');

// Estados em que o protótipo mostra o avatar animado (tamanho grande e hover).
const seletoresAnimados = (c: string) => [`html .ag4-tile[data-ag="${c}"]`, `html .ag-tile[data-ag="${c}"][style*="56px"]`, `html [data-ag="${c}"]:hover`, `html .navrow:hover [data-ag="${c}"]`, `html .ag4-card:hover [data-ag="${c}"]`];

// Blocos do CSS: { seletores, arquivo, reduzido }
function blocos() {
  const r: { seletores: string; arquivo: string; reduzido: boolean }[] = [];
  const re = /(@media \(prefers-reduced-motion: reduce\) \{\s*)?([^{}@]+?)\{\s*background-image:\s*url\("\.\/avatares\/([^"]+)"\)\s*!important;\s*\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) r.push({ seletores: m[2], arquivo: m[3], reduzido: !!m[1] });
  return r;
}

describe('avatares dos agentes', () => {
  for (const [codigo, nome] of Object.entries(AGENTES)) {
    describe(`${codigo} → ${nome}`, () => {
      for (const arquivo of [`${nome}.svg`, `${nome}-animado.svg`]) {
        it(`${arquivo}: existe, é SVG, seguro e leve`, () => {
          const svg = ler(arquivo);
          expect(svg.trimStart().startsWith('<svg')).toBe(true);
          expect(svg).not.toMatch(/<script|<foreignObject|\son[a-z]+\s*=/i);
          const links = [...svg.matchAll(/(?:xlink:href|href|src)="([^"]*)"/g)].map(m => m[1]);
          expect(links.filter(l => !l.startsWith('#') && !l.startsWith('data:image/'))).toEqual([]);
          expect(svg).not.toMatch(/url\(\s*['"]?https?:/i);
          expect(fs.statSync(path.join(PASTA, 'avatares', arquivo)).size).toBeLessThan(120 * 1024);
        });
      }

      it('o desenho parado não tem animação (é a arte original) e o animado tem', () => {
        expect(ler(`${nome}.svg`)).not.toMatch(/<animate|data-olhos-animados/);
        const animado = ler(`${nome}-animado.svg`);
        expect(animado).toContain('data-olhos-animados');
        expect(animado.match(/<animateTransform/g)?.length).toBe(2); // uma por olho
        expect(animado).toContain('repeatCount="indefinite"');
        expect(animado).not.toMatch(/begin="[^"]*(click|mouse|focus|\.)/); // nada de gatilho por evento
      });

      it('a pupila nunca sai do olho (em nenhum instante da animação)', () => {
        const animado = ler(`${nome}-animado.svg`);
        const camada = animado.slice(animado.indexOf('data-olhos-animados'));
        const olhos = [...camada.matchAll(/<clipPath id="ci-[^"]+"><ellipse cx="([\d.]+)" cy="([\d.]+)" rx="([\d.]+)" ry="([\d.]+)"\/><\/clipPath>[\s\S]*?<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"[^>]*><animateTransform[^>]*values="([^"]+)"/g)];
        expect(olhos).toHaveLength(2);
        for (const o of olhos) {
          const [rxi, ryi, r] = [+o[3], +o[4], +o[7]];
          const passos = o[8].split(';').map(p => p.trim().split(/\s+/).map(Number));
          const dx = Math.max(...passos.map(p => Math.abs(p[0]))), dy = Math.max(...passos.map(p => Math.abs(p[1])));
          expect(dx + r).toBeLessThanOrEqual(rxi + 0.05);
          expect(dy + r).toBeLessThanOrEqual(ryi + 0.05);
          expect(dx).toBeGreaterThan(4); // e anda de verdade (movimento perceptível)
        }
      });

      it('o CSS: parado em todo lugar, animado nos estados grandes/hover, parado de novo se pedir movimento reduzido', () => {
        const todos = blocos().filter(b => b.arquivo === `${nome}.svg` || b.arquivo === `${nome}-animado.svg`);
        const base = todos.find(b => !b.reduzido && b.arquivo === `${nome}.svg`);
        const animado = todos.find(b => !b.reduzido && b.arquivo === `${nome}-animado.svg`);
        const reduzido = todos.find(b => b.reduzido && b.arquivo === `${nome}.svg`);
        expect(base?.seletores).toContain(`html [data-ag="${codigo}"]`);
        for (const s of seletoresAnimados(codigo)) {
          expect(animado?.seletores, `animado sem ${s}`).toContain(s);
          expect(reduzido?.seletores, `movimento reduzido sem ${s}`).toContain(s);
        }
        // a ordem importa (igual especificidade, vence o último): base, depois animado, depois movimento reduzido
        const pos = (b?: { arquivo: string }) => css.indexOf(b ? `avatares/${b.arquivo}` : '', 0);
        expect(css.indexOf(`avatares/${nome}.svg`)).toBeLessThan(css.indexOf(`avatares/${nome}-animado.svg`));
        expect(css.lastIndexOf(`avatares/${nome}.svg`)).toBeGreaterThan(css.indexOf(`avatares/${nome}-animado.svg`));
        expect(pos(base)).toBeGreaterThanOrEqual(0);
      });
    });
  }

  it('o CSS vence as regras do protótipo (que usam !important)', () => {
    expect(css).toMatch(/html \[data-ag="comercial"\]/);
    expect(blocos().length).toBe(12); // 4 agentes x (parado, animado, movimento reduzido)
  });

  it('quatro avatares diferentes entre si', () => {
    const arquivos = Object.values(AGENTES).map(a => ler(`${a}.svg`));
    expect(new Set(arquivos).size).toBe(4);
  });
});
