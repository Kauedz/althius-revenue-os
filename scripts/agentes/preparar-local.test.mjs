// Peças puras do "conversar com os agentes no meu computador": lê o ambiente do Supabase CLI e monta as opções. Sem rede, sem Docker.
import { describe, expect, it } from 'vitest';
import { argumentosDoComposeLocal, ambienteDoSupabase, ambienteDoCiclo, opcoesDeProvisionamento, WORKSPACE_PADRAO, RESPONSAVEL_PADRAO } from './preparar-local.mjs';

const SAIDA = [
  'API_URL="http://127.0.0.1:54321"',
  'ANON_KEY="anon-publica-123"',
  'SERVICE_ROLE_KEY="servico-secreta-456"',
  'DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"',
  ''
].join('\n');

describe('ambienteDoSupabase', () => {
  it('lê o endereço e as duas chaves da saída do supabase status', () => {
    expect(ambienteDoSupabase(SAIDA)).toEqual({ api: 'http://127.0.0.1:54321', anon: 'anon-publica-123', servico: 'servico-secreta-456' });
  });
  it('banco desligado (sem as chaves): erro que diz o que fazer', () => {
    expect(() => ambienteDoSupabase('API_URL="http://127.0.0.1:54321"\n')).toThrow('npx supabase start');
  });
});

describe('opcoesDeProvisionamento', () => {
  const amb = ambienteDoSupabase(SAIDA);
  it('modo local, modelo pelo login do Codex, workspace e responsável de demonstração', () => {
    const o = opcoesDeProvisionamento(amb, {});
    expect(o).toMatchObject({ modo: 'local', 'modelo-oauth': 'gpt-6-luna', workspace: WORKSPACE_PADRAO, responsavel: RESPONSAVEL_PADRAO, slug: 'evolut', urlBanco: 'http://127.0.0.1:54321/rest/v1', chavePublica: 'anon-publica-123', chaveServico: 'servico-secreta-456' });
  });
  it('o modelo pode ser trocado', () => {
    expect(opcoesDeProvisionamento(amb, { modelo: 'gpt-5.6-luna' })['modelo-oauth']).toBe('gpt-5.6-luna');
  });
});

describe('ambienteDoCiclo', () => {
  it('o ciclo dos agentes fala com o banco local e lê o registro de executores do modo local', () => {
    const e = ambienteDoCiclo(ambienteDoSupabase(SAIDA), '/proj');
    expect(e).toMatchObject({ BANCO_URL: 'http://127.0.0.1:54321/rest/v1', SERVICE_ROLE_KEY: 'servico-secreta-456' });
    expect(e.AGENTES_EXECUTORES_ARQUIVO.split(String.fromCharCode(92)).join('/')).toBe('/proj/docker/agentes-executores.local.json');
  });
});

describe('argumentosDoComposeLocal', () => {
  it('os caminhos do compose valem a partir da raiz do projeto (senão o Docker monta uma pasta vazia dentro de docker/)', () => {
    const a = argumentosDoComposeLocal(['up', '-d']);
    expect(a.slice(0, 5)).toEqual(['compose', '--project-directory', '.', '-f', 'docker/agentes-hermes.local.compose.yml']);
    expect(a.slice(5)).toEqual(['up', '-d']);
  });
});
