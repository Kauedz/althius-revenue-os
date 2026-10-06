// Cifra do cofre de chaves (ADR 0049): AES-256-GCM. O que vai para o banco é `v1:iv:tag:texto` (base64url).
// A chave mestra (COFRE_CHAVE_MESTRA) fica só no servidor, fora do banco: quem lê o banco sozinho não decifra nada.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export function chaveMestra(env: Record<string, string | undefined> = process.env): Buffer {
  const bruto = (env.COFRE_CHAVE_MESTRA ?? '').trim();
  if (!bruto) throw new Error('Falta COFRE_CHAVE_MESTRA no servidor (rode `npm run docker:env`).');
  const chave = /^[0-9a-fA-F]{64}$/.test(bruto) ? Buffer.from(bruto, 'hex') : Buffer.from(bruto, 'base64');
  if (chave.length !== 32) throw new Error('COFRE_CHAVE_MESTRA precisa ter 32 bytes (64 letras hexadecimais ou base64).');
  return chave;
}

export function cifrar(texto: string, chave: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', chave, iv);
  const ct = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), ct.toString('base64url')].join(':');
}

export function decifrar(cifrado: string, chave: Buffer): string {
  const [v, iv, tag, ct] = cifrado.split(':');
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('formato de segredo desconhecido');
  const d = createDecipheriv('aes-256-gcm', chave, Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
}

/** Só os 4 últimos caracteres: o que a tela pode mostrar. */
export const mascara = (segredo: string) => segredo.slice(-4);
