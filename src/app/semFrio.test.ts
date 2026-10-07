// Regra do produto (ADR 0069): toda empresa do cliente é uma empresa que vale a conversa, então a plataforma nunca diz
// que uma conta é "fria". A menor chama é "Aquecendo". Este teste varre os textos do produto (telas, serviços, agentes e seed).
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZES = ['src', 'supabase/seed.sql'];
const IGNORAR = /(\.test\.|node_modules|\.generated\.)/;
const PROIBIDO = /\b(fri[oa]s?|cold)\b/i;

function arquivos(caminho: string): string[] {
  if (IGNORAR.test(caminho)) return [];
  if (statSync(caminho).isFile()) return /\.(ts|tsx|js|mjs|sql)$/.test(caminho) ? [caminho] : [];
  return readdirSync(caminho).flatMap(n => arquivos(join(caminho, n)));
}

describe('a plataforma nunca chama uma conta de fria', () => {
  it('nenhum texto do produto usa "frio", "fria" ou "cold"', () => {
    const achados = RAIZES.flatMap(arquivos).flatMap(a =>
      readFileSync(a, 'utf8').split('\n').map((linha, i) => (PROIBIDO.test(linha) ? `${a}:${i + 1}: ${linha.trim().slice(0, 100)}` : '')).filter(Boolean));
    expect(achados).toEqual([]);
  });
});
