// Garante COFRE_CHAVE_MESTRA no `.env` (ADR 0049): a chave que cifra as chaves cadastradas na tela do superadmin.
// Se já existe, não mexe (trocar a chave deixaria as chaves guardadas ilegíveis). Se falta, gera uma nova.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export const NOME = 'COFRE_CHAVE_MESTRA';

/** Devolve o texto do .env com a chave mestra; `criada` diz se foi preciso gerar. */
export function comChaveMestra(texto, gerar = () => randomBytes(32).toString('hex')) {
  const linhas = texto.split('\n');
  const i = linhas.findIndex(l => l.startsWith(`${NOME}=`));
  if (i >= 0 && linhas[i].slice(NOME.length + 1).trim()) return { texto, criada: false };
  const linha = `${NOME}=${gerar()}`;
  if (i >= 0) linhas[i] = linha;
  else {
    const aviso = '# Chave que cifra as chaves cadastradas na tela do superadmin. FAÇA CÓPIA deste arquivo: sem ela, as chaves guardadas não abrem.';
    if (linhas.length && linhas[linhas.length - 1] === '') linhas.splice(linhas.length - 1, 0, aviso, linha);
    else linhas.push(aviso, linha);
  }
  return { texto: linhas.join('\n'), criada: true };
}

/** Lê o .env, garante a chave e grava se mudou. Sem .env, não faz nada (o gerar-env cria já com a chave). */
export function garantirCofre(arquivo) {
  if (!existsSync(arquivo)) return false;
  const r = comChaveMestra(readFileSync(arquivo, 'utf8'));
  if (r.criada) writeFileSync(arquivo, r.texto, { mode: 0o600 });
  return r.criada;
}
