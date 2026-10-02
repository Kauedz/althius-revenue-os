// Converte o protótipo Althius v18 (exportado do Claude Design) em código React do projeto.
//
// Entrada:  althius-frontend-v18/fonte/{template.html, component.js.html, data.js, module.js}
// Saída:    src/v18/{template.generated.tsx, logic.generated.js, althius.css, data.js, module.js}
//
// O template usa a linguagem do runtime "dc" (sc-if, sc-for, {{ caminho }}, sc-camel-*).
// Este script reproduz a mesma semântica do runtime em JSX estático, para que a tela
// fique idêntica ao protótipo sem depender do runtime proprietário.
//
// Uso: node scripts/v18/convert.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, 'althius-frontend-v18', 'fonte');
const OUT = path.join(ROOT, 'src', 'v18');
fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------------------
// Expressões {{ ... }}: caminho, !, ===/!==/==/!=, literais e parênteses.
// ---------------------------------------------------------------------------
const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*/;

function wrapsWhole(e) {
  let d = 0;
  for (let i = 0; i < e.length - 1; i++) {
    if (e[i] === '(') d++;
    else if (e[i] === ')') { d--; if (d === 0) return false; }
  }
  return true;
}

function topLevelEquality(e) {
  let d = 0;
  for (let i = 0; i < e.length; i++) {
    const c = e[i];
    if (c === '[' || c === '(') d++;
    else if (c === ']' || c === ')') d--;
    else if (d === 0 && (c === '=' || c === '!') && e[i + 1] === '=') {
      if (i > 0 && (e[i - 1] === '=' || e[i - 1] === '!')) continue;
      if (!e.slice(0, i).trim()) continue;
      const op = e[i + 2] === '=' ? c + '==' : c + '=';
      return { index: i, op };
    }
  }
  return null;
}

function expr(src, scope) {
  const e = String(src).trim();
  if (!e) return 'undefined';
  if (e[0] === '(' && e[e.length - 1] === ')' && wrapsWhole(e)) return '(' + expr(e.slice(1, -1), scope) + ')';
  const eq = topLevelEquality(e);
  if (eq) return '(' + expr(e.slice(0, eq.index), scope) + ' ' + eq.op + ' ' + expr(e.slice(eq.index + eq.op.length), scope) + ')';
  if (e[0] === '!') return '!' + expr(e.slice(1), scope);
  if (['true', 'false', 'null', 'undefined'].includes(e)) return e;
  if (/^-?\d+(\.\d+)?$/.test(e)) return e;
  if (e.length >= 2 && (e[0] === '"' || e[0] === "'") && e[e.length - 1] === e[0]) return JSON.stringify(e.slice(1, -1));
  const head = e.match(IDENT);
  if (!head) return 'undefined';
  let out = scope.has(head[0]) ? head[0] : '$v.' + head[0];
  let i = head[0].length;
  while (i < e.length) {
    if (e[i] === '.') {
      const m = e.slice(i + 1).match(IDENT) || e.slice(i + 1).match(/^\d+/);
      if (!m) return 'undefined';
      out += /^\d/.test(m[0]) ? '?.[' + m[0] + ']' : '?.' + m[0];
      i += 1 + m[0].length;
    } else if (e[i] === '[') {
      let d = 1, j = i + 1;
      while (j < e.length && d > 0) { if (e[j] === '[') d++; else if (e[j] === ']') { d--; if (d === 0) break; } j++; }
      if (d !== 0) return 'undefined';
      out += '?.[' + expr(e.slice(i + 1, j), scope) + ']';
      i = j + 1;
    } else return 'undefined';
  }
  return out;
}

const WHOLE = /^\s*\{\{([\s\S]+?)\}\}\s*$/;
const PARTS = /\{\{([\s\S]+?)\}\}/g;

// Valor de atributo: expressão inteira, texto misto ou literal (igual ao compileAttr do runtime).
function attrValue(raw, scope) {
  const whole = raw.match(WHOLE);
  if (whole) return { kind: 'expr', code: expr(whole[1], scope) };
  if (raw.includes('{{')) {
    const parts = raw.split(PARTS);
    const code = '`' + parts.map((p, i) => (i & 1) ? '${__s(' + expr(p, scope) + ')}' : p.replace(/[`\\]/g, '\\$&').replace(/\$\{/g, '\\${')).join('') + '`';
    return { kind: 'mixed', code };
  }
  return { kind: 'static', value: raw };
}

// ---------------------------------------------------------------------------
// Atributos
// ---------------------------------------------------------------------------
const EVENT_MAP = { onclick: 'onClick', onchange: 'onChange', oninput: 'onInput', onkeydown: 'onKeyDown', onkeyup: 'onKeyUp', onfocus: 'onFocus', onblur: 'onBlur', onscroll: 'onScroll' };
const HTML_ATTR = { class: 'className', for: 'htmlFor', tabindex: 'tabIndex', readonly: 'readOnly', maxlength: 'maxLength', inputmode: 'inputMode', autocomplete: 'autoComplete', spellcheck: 'spellCheck', crossorigin: 'crossOrigin', colspan: 'colSpan', rowspan: 'rowSpan', autofocus: 'autoFocus' };
const camel = s => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

function reactAttrName(name) {
  let key = name;
  if (key.startsWith('sc-camel-')) key = camel(key.slice('sc-camel-'.length));
  if (HTML_ATTR[key]) return HTML_ATTR[key];
  if (key.startsWith('on')) return EVENT_MAP[key.toLowerCase()] || 'on' + key[2].toUpperCase() + key.slice(3);
  if (key.startsWith('aria-') || key.startsWith('data-')) return key;
  if (key.includes('-')) return camel(key); // atributos SVG: stroke-width -> strokeWidth
  return key;
}

function cssToObj(css) {
  const o = {};
  for (const decl of css.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    o[prop.startsWith('--') ? prop : camel(prop)] = decl.slice(i + 1).trim();
  }
  return o;
}

const importantify = css => css.split(';').map(d => d.trim()).filter(Boolean).map(d => /!important$/.test(d) ? d : d + ' !important').join('; ');
const hoverRules = [];
const hoverCache = new Map();
function pseudoClass(pseudo, css) {
  const k = pseudo + '|' + css;
  if (hoverCache.has(k)) return hoverCache.get(k);
  const cls = 'v18-' + pseudo + '-' + hoverRules.length;
  hoverRules.push('.' + cls + ':' + pseudo + ' { ' + importantify(css) + '; }');
  hoverCache.set(k, cls);
  return cls;
}

function attrsToJsx(node, scope) {
  const out = [];
  const pseudo = [];
  let classCode = null;
  for (const { name, value } of node.attrs) {
    if (name === 'sc-name' || name === 'data-dc-tpl' || name === 'hint-size') continue;
    if (name.startsWith('style-')) { pseudo.push(pseudoClass(name.slice(6), value)); continue; }
    const key = reactAttrName(name);
    const v = attrValue(value, scope);
    if (key === 'className') { classCode = v; continue; }
    if (key === 'style') {
      if (v.kind === 'static') out.push('style={' + JSON.stringify(cssToObj(v.value)) + '}');
      else if (v.kind === 'mixed') out.push('style={__css(' + v.code + ')}');
      else out.push('style={__css(' + v.code + ')}');
      continue;
    }
    if (key === 'value' || key === 'checked') {
      const code = v.kind === 'static' ? JSON.stringify(v.value) : v.code;
      out.push(key + '={' + (key === 'checked' ? '__ck(' : '__val(') + code + ')}');
      continue;
    }
    if (v.kind === 'static') out.push(key + '=' + JSON.stringify(v.value));
    else out.push(key + '={' + v.code + '}');
  }
  if (classCode || pseudo.length) {
    const base = classCode ? (classCode.kind === 'static' ? JSON.stringify(classCode.value) : classCode.code) : null;
    if (!pseudo.length) out.unshift('className={' + base + '}');
    else if (!base) out.unshift('className=' + JSON.stringify(pseudo.join(' ')));
    else out.unshift('className={__cls(' + base + ', ' + JSON.stringify(pseudo.join(' ')) + ')}');
  }
  return out.join(' ');
}

// ---------------------------------------------------------------------------
// Nós
// ---------------------------------------------------------------------------
const RAW_UNWRAP = { 'sc-raw-select': 'select', 'sc-raw-table': 'table', 'sc-raw-tbody': 'tbody', 'sc-raw-thead': 'thead', 'sc-raw-tfoot': 'tfoot', 'sc-raw-tr': 'tr', 'sc-raw-td': 'td', 'sc-raw-th': 'th', 'sc-raw-caption': 'caption' };
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const getAttr = (n, a) => (n.attrs.find(x => x.name === a) || {}).value;

function text(node, scope) {
  const txt = node.value;
  if (!txt.includes('{{')) {
    if (!txt.trim() && !txt.includes(' ')) return '';
    return '{' + JSON.stringify(txt) + '}';
  }
  return txt.split(PARTS).map((p, i) => (i & 1) ? '{__t(' + expr(p, scope) + ')}' : (p ? '{' + JSON.stringify(p) + '}' : '')).join('');
}

function children(node, scope, ind) {
  return (node.childNodes || []).map(c => walk(c, scope, ind)).filter(Boolean).join('\n');
}

function walk(node, scope, ind) {
  const pad = '  '.repeat(ind);
  if (node.nodeName === '#text') { const t = text(node, scope); return t ? pad + t : ''; }
  if (node.nodeName === '#comment') return '';
  const tag = node.tagName;
  if (tag === 'sc-if') {
    const cond = expr((getAttr(node, 'value') || '').replace(WHOLE, '$1'), scope);
    return pad + '{' + cond + ' ? (<>\n' + children(node, scope, ind + 1) + '\n' + pad + '</>) : null}';
  }
  if (tag === 'sc-for') {
    const list = expr((getAttr(node, 'list') || '').replace(WHOLE, '$1'), scope);
    const as = getAttr(node, 'as') || 'item';
    const inner = new Set(scope); inner.add(as); inner.add('$index');
    return pad + '{__arr(' + list + ').map((' + as + ', $index) => (<React.Fragment key={$index}>\n' + children(node, inner, ind + 1) + '\n' + pad + '</React.Fragment>))}';
  }
  if (tag === 'template' || tag === 'script' || tag === 'style') return '';
  if (tag === 'sc-else' || tag === 'dc-import' || tag === 'x-import') throw new Error('Tag não suportada pelo conversor: ' + tag);
  const real = RAW_UNWRAP[tag] || tag;
  const attrs = attrsToJsx(node, scope);
  const open = '<' + real + (attrs ? ' ' + attrs : '');
  if (VOID.has(real)) return pad + open + ' />';
  const body = children(node.tagName === 'template' ? node.content : node, scope, ind + 1);
  if (!body) return pad + open + '></' + real + '>';
  return pad + open + '>\n' + body + '\n' + pad + '</' + real + '>';
}

// ---------------------------------------------------------------------------
// Template -> TSX + CSS
// ---------------------------------------------------------------------------
const html = fs.readFileSync(path.join(SRC, 'template.html'), 'utf8');
const doc = parse(html);
const find = (n, pred) => { if (pred(n)) return n; for (const c of n.childNodes || []) { const r = find(c, pred); if (r) return r; } return null; };
const xdc = find(doc, n => n.tagName === 'x-dc');
if (!xdc) throw new Error('<x-dc> não encontrado no template');

const styles = [];
const roots = [];
for (const c of xdc.childNodes) {
  if (c.tagName === 'helmet') {
    for (const h of c.childNodes) {
      if (h.tagName === 'style') styles.push((h.childNodes || []).map(t => t.value).join(''));
    }
    continue;
  }
  roots.push(c);
}

const jsx = roots.map(r => walk(r, new Set(), 2)).filter(Boolean).join('\n');
const tsx = `// GERADO por scripts/v18/convert.mjs a partir de althius-frontend-v18/fonte/template.html.
// Não edite à mão: altere o template ou o conversor e rode \`npm run v18:sync\`.
// @ts-nocheck
/* eslint-disable */
import React from 'react';
import { __arr, __cls, __css, __ck, __s, __t, __val } from './runtime';

export function renderTemplate($v: Record<string, any>) {
  return (
    <>
${jsx}
    </>
  );
}
`;
fs.writeFileSync(path.join(OUT, 'template.generated.tsx'), tsx);

const css = `/* GERADO por scripts/v18/convert.mjs: estilos do protótipo v18 (helmet) + regras de hover. */\n` + styles.join('\n') + '\n/* Hover (style-hover do template) */\n' + hoverRules.join('\n') + '\n';
fs.writeFileSync(path.join(OUT, 'althius.css'), css);

// ---------------------------------------------------------------------------
// Lógica: class Component extends DCLogic -> AlthiusLogic extends React.Component
// ---------------------------------------------------------------------------
const comp = fs.readFileSync(path.join(SRC, 'component.js.html'), 'utf8');
const body = comp.slice(comp.indexOf('>', comp.indexOf('<script')) + 1, comp.lastIndexOf('</script>'));
if (!body.includes('class Component extends DCLogic {')) throw new Error('Classe Component não encontrada');
const logic = `// GERADO por scripts/v18/convert.mjs a partir de althius-frontend-v18/fonte/component.js.html.
// Lógica original do protótipo v18. Não edite à mão: rode \`npm run v18:sync\`.
/* eslint-disable */
import React from 'react';
import { renderTemplate } from './template.generated';
${body.replace('class Component extends DCLogic {', 'export class AlthiusLogic extends React.Component {')}
AlthiusLogic.prototype.render = function () {
  return renderTemplate({ ...this.props, ...(this.renderVals() || {}) });
};
`;
fs.writeFileSync(path.join(OUT, 'logic.generated.js'), logic);

for (const f of ['data.js', 'module.js']) fs.copyFileSync(path.join(SRC, f), path.join(OUT, f));

console.log('template.generated.tsx:', tsx.split('\n').length, 'linhas');
console.log('althius.css:', css.length, 'bytes; hover:', hoverRules.length);
console.log('logic.generated.js:', logic.split('\n').length, 'linhas');
