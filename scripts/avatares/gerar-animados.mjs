// Gera src/app/avatares/<nome>-animado.svg a partir de <nome>.svg: acrescenta, por cima da arte original,
// um olho por olho (contorno, branco e uma pupila redonda que passeia dentro dele).
// Por quê: na arte, contorno e pupila são UMA forma preta só (e o branco é um furo), então não existe
// "pupila solta" para animar. As versões paradas continuam sendo a arte original, intacta.
// Uso: node scripts/avatares/gerar-animados.mjs        (depois: confira com o teste dos avatares)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const PASTA = path.resolve(AQUI, '..', '..', 'src', 'app', 'avatares');
const MEDIDAS = JSON.parse(fs.readFileSync(path.join(AQUI, 'olhos.json'), 'utf8')).agentes;

// Cor do fundo dos avatares no app ([data-ag] usa #FFF1E2): o "branco" do olho é um furo e mostra esse fundo.
const COR_BRANCO = '#FFF1E2';
// Proporções medidas na arte (rosto Jax, meia-lua de 49,8 de altura = escala 1): corpo do olho 61 x 53, contorno ~3.
const BASE_H = 49.8;
const P = { cxDeslocamento: 29.5, cyDeslocamento: 24.9, rx: 30.2, ry: 26.2, contorno: 2.9, folga: 0.5, raioPupila: 0.86 };
const DURACAO = '10s';

const n = v => +v.toFixed(2);

function olho(id, lua) {
  const s = lua.h / BASE_H;
  const cx = lua.x + P.cxDeslocamento * s, cy = lua.y + P.cyDeslocamento * s;
  const rx = P.rx * s, ry = P.ry * s, t = P.contorno * s;
  const rxi = rx - t, ryi = ry - t;
  const r = P.raioPupila * ryi;
  const A = rxi - r, B = ryi - r; // quanto a pupila pode andar sem sair do olho
  // Pupila: começa à direita encostada no contorno (como na arte), passeia e volta (laço sem emenda).
  const pontos = [[A, 0], [A, 0], [0.15 * A, -0.55 * B], [-A, 0], [-A, 0], [-0.6 * A, B], [0.3 * A, 0.6 * B], [A, 0], [A, 0]];
  const tempos = [0, 0.12, 0.3, 0.45, 0.6, 0.72, 0.84, 0.94, 1];
  const splines = pontos.slice(1).map(() => '0.45 0 0.2 1').join(';');
  return `<clipPath id="ci-${id}"><ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rxi)}" ry="${n(ryi)}"/></clipPath>
<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx + P.folga)}" ry="${n(ry + P.folga)}" fill="#000"/>
<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rxi)}" ry="${n(ryi)}" fill="${COR_BRANCO}"/>
<g clip-path="url(#ci-${id})"><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="#000"><animateTransform attributeName="transform" type="translate" calcMode="spline" dur="${DURACAO}" repeatCount="indefinite" keyTimes="${tempos.join(';')}" keySplines="${splines}" values="${pontos.map(([x, y]) => `${n(x)} ${n(y)}`).join(';')}"/></circle></g>`;
}

for (const [nome, luas] of Object.entries(MEDIDAS)) {
  const arq = path.join(PASTA, `${nome}.svg`);
  const parado = fs.readFileSync(arq, 'utf8');
  if (parado.includes('data-olhos-animados')) throw new Error(`${nome}.svg já tem olhos animados: gere sempre a partir da arte parada.`);
  const camada = `<g data-olhos-animados="1">\n${luas.map((l, i) => olho(`${nome}${i}`, l)).join('\n')}\n</g>\n`;
  const fim = parado.lastIndexOf('</svg>');
  if (fim < 0) throw new Error(`${nome}.svg sem </svg>`);
  const saida = parado.slice(0, fim) + camada + parado.slice(fim);
  fs.writeFileSync(path.join(PASTA, `${nome}-animado.svg`), saida);
  console.log(`${nome}-animado.svg: ${(saida.length / 1024).toFixed(0)} KB, ${luas.length} olhos`);
}
