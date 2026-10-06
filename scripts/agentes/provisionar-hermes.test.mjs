// Provisionamento com disco temporário e banco falso: nenhuma chamada real, nenhum Docker.
import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lerArgumentos, provisionar, URL_BANCO_INTERNA } from './provisionar-hermes.mjs';
import { argumentosDoCompose } from '../docker/subir.mjs';

const WS = 'a0000000-0000-0000-0000-000000000001';
const MEMBRO = 'd0000000-0000-0000-0000-000000000002';
let pasta = '';
afterEach(() => { if (pasta) rmSync(pasta, { recursive: true, force: true }); pasta = ''; });

function ambiente(status = 200) {
  pasta = mkdtempSync(join(tmpdir(), 'prov-'));
  const chamadas = [];
  let n = 0;
  const buscar = async (url, init) => {
    chamadas.push({ url, h: init.headers, corpo: JSON.parse(init.body) });
    return { ok: status < 300, status, json: async () => `alt_agente_token${++n}` };
  };
  const opcoes = { workspace: WS, responsavel: MEMBRO, slug: 'evolut',
    urlBanco: 'http://localhost/rest/v1', chavePublica: 'anon-publica', chaveServico: 'servico-secreta' };
  const io = { buscar, raiz: pasta, semChown: true, empacotar: () => {}, log: () => {} };
  return { chamadas, opcoes, io };
}
const ler = (...p) => readFileSync(join(pasta, ...p), 'utf8');

describe('provisionar', () => {
  it('cria os 4 tokens, os 4 perfis, o perfil padrão, o compose e o registro de executores', async () => {
    const { chamadas, opcoes, io } = ambiente();
    const r = await provisionar(opcoes, io);
    expect(r.criados).toEqual(['comercial', 'marketing', 'copy', 'revops']);
    expect(chamadas).toHaveLength(4);
    expect(chamadas[0].url).toBe('http://localhost/rest/v1/rpc/agent_runtime_token_create');
    expect(chamadas[0].corpo).toEqual({ p_workspace_id: WS, p_agent_code: 'comercial', p_member_id: MEMBRO });
    expect(chamadas[0].h.apikey).toBe('servico-secreta');
    for (const a of ['comercial', 'marketing', 'copy', 'revops']) {
      const cfg = ler('docker', 'hermes', 'evolut', 'data', 'profiles', a, 'config.yaml');
      expect(cfg).toContain(`ALTHIUS_SUPABASE_URL: "${URL_BANCO_INTERNA}"`);
      expect(cfg).toContain('ALTHIUS_AGENTE_TOKEN: "alt_agente_token');
      expect(cfg).not.toContain('servico-secreta');
      // O modelo é o gateway da Althius (ADR 0050): endereço interno, nome lógico e nenhuma chave de provedor.
      expect(cfg).toContain('base_url: "http://gateway:3300/v1"');
      expect(cfg).toContain('default: "althius"');
      const env = ler('docker', 'hermes', 'evolut', 'data', 'profiles', a, '.env');
      expect(env).toMatch(/API_SERVER_KEY=alt_hermes_[0-9a-f]{48}/);
      expect(env).toMatch(/MODELO_CHAVE=alt_agente_token\d/); // a chave do gateway é o token do próprio agente
    }
    expect(ler('docker', 'hermes', 'evolut', 'data', '.env')).toMatch(/API_SERVER_KEY=alt_padrao_/);
    expect(ler('docker', 'agentes-hermes.compose.yml')).toContain('hermes-evolut:');
    const ex = JSON.parse(ler('docker', 'agentes-executores.json'));
    expect(Object.keys(ex.executores)).toEqual([`${WS}/comercial`, `${WS}/marketing`, `${WS}/copy`, `${WS}/revops`]);
    expect(ex.executores[`${WS}/comercial`].url).toBe('http://hermes-evolut:8642/p/comercial');
    // a chave que o harness usa é a do .env do perfil
    expect(`API_SERVER_KEY=${ex.executores[`${WS}/comercial`].chave}`).toBe(ler('docker', 'hermes', 'evolut', 'data', 'profiles', 'comercial', '.env').split('\n')[1]);
  });

  it('arquivos com segredo ficam só para o dono (0600)', async () => {
    const { opcoes, io } = ambiente();
    await provisionar(opcoes, io);
    for (const arq of [['profiles', 'comercial', 'config.yaml'], ['profiles', 'comercial', '.env'], ['.env']]) {
      expect(statSync(join(pasta, 'docker', 'hermes', 'evolut', 'data', ...arq)).mode & 0o777).toBe(0o600);
    }
    expect(statSync(join(pasta, 'docker', 'agentes-executores.json')).mode & 0o777).toBe(0o600);
  });

  it('rodar de novo não troca tokens nem chaves (idempotente) e não chama o banco', async () => {
    const { chamadas, opcoes, io } = ambiente();
    await provisionar(opcoes, io);
    const antes = ler('docker', 'agentes-executores.json');
    const cfgAntes = ler('docker', 'hermes', 'evolut', 'data', 'profiles', 'copy', 'config.yaml');
    const padraoAntes = ler('docker', 'hermes', 'evolut', 'data', '.env');
    const r = await provisionar(opcoes, io);
    expect(r.criados).toEqual([]);
    expect(chamadas).toHaveLength(4);
    expect(ler('docker', 'agentes-executores.json')).toBe(antes);
    expect(ler('docker', 'hermes', 'evolut', 'data', 'profiles', 'copy', 'config.yaml')).toBe(cfgAntes);
    expect(ler('docker', 'hermes', 'evolut', 'data', '.env')).toBe(padraoAntes);
  });

  it('um segundo cliente entra no mesmo compose e no mesmo registro, sem mexer no primeiro', async () => {
    const { opcoes, io } = ambiente();
    await provisionar(opcoes, io);
    await provisionar({ ...opcoes, workspace: 'b0000000-0000-0000-0000-000000000001', slug: 'grao' }, io);
    const c = ler('docker', 'agentes-hermes.compose.yml');
    expect(c).toContain('hermes-evolut:');
    expect(c).toContain('hermes-grao:');
    expect(Object.keys(JSON.parse(ler('docker', 'agentes-executores.json')).executores)).toHaveLength(8);
  });

  it('o banco recusa o token (responsável sem alçada): erro claro e nada de perfil pela metade', async () => {
    const { opcoes, io } = ambiente(400);
    await expect(provisionar(opcoes, io)).rejects.toThrow(/recusou criar o token do agente comercial.*estrategista, C-level ou superadmin/);
    expect(existsSync(join(pasta, 'docker', 'agentes-hermes.compose.yml'))).toBe(false);
  });

  it.each([
    [{ workspace: 'x' }, '--workspace'], [{ responsavel: 'x' }, '--responsavel'], [{ slug: 'Maiuscula' }, '--slug'],
    [{ 'modelo-url': 'ftp://x' }, '--modelo-url'], [{ 'modelo-nome': '' }, '--modelo-nome'], [{ chavePublica: '' }, 'chavePublica']
  ])('argumento inválido %j: erro claro, sem tocar no banco', async (troca, texto) => {
    const { chamadas, opcoes, io } = ambiente();
    await expect(provisionar({ ...opcoes, ...troca }, io)).rejects.toThrow(texto);
    expect(chamadas).toHaveLength(0);
  });
});

describe('modelo', () => {
  it('o endereço e o nome podem ser trocados à mão (ex.: teste com um modelo falso), mas o padrão é o gateway', async () => {
    const { opcoes, io } = ambiente();
    await provisionar({ ...opcoes, 'modelo-url': 'http://127.0.0.1:8999/v1', 'modelo-nome': 'fake-model' }, io);
    const cfg = ler('docker', 'hermes', 'evolut', 'data', 'profiles', 'comercial', 'config.yaml');
    expect(cfg).toContain('base_url: "http://127.0.0.1:8999/v1"');
    expect(cfg).toContain('default: "fake-model"');
  });
});

describe('modo assinatura (teste sem custo)', () => {
  it('--modelo-oauth: perfil usa o login do Codex, sem gateway e sem chave no .env', async () => {
    const { opcoes, io } = ambiente();
    await provisionar({ ...opcoes, 'modelo-oauth': 'gpt-6-luna' }, io);
    for (const a of ['comercial', 'marketing', 'copy', 'revops']) {
      const cfg = ler('docker', 'hermes', 'evolut', 'data', 'profiles', a, 'config.yaml');
      expect(cfg).toContain('provider: openai-codex');
      expect(cfg).toContain('default: "gpt-6-luna"');
      expect(cfg).not.toContain('gateway:3300');
      expect(ler('docker', 'hermes', 'evolut', 'data', 'profiles', a, '.env')).toContain('MODELO_CHAVE=\n');
    }
  });
  it('--modelo-oauth junto de --modelo-url é pedido contraditório: erro claro, sem tocar no banco', async () => {
    const { chamadas, opcoes, io } = ambiente();
    await expect(provisionar({ ...opcoes, 'modelo-oauth': 'gpt-6-luna', 'modelo-url': 'http://x/v1' }, io)).rejects.toThrow('--modelo-oauth');
    expect(chamadas).toHaveLength(0);
  });
  it('rodar de novo SEM a opção volta para o gateway (o modo não fica preso)', async () => {
    const { opcoes, io } = ambiente();
    await provisionar({ ...opcoes, 'modelo-oauth': 'gpt-6-luna' }, io);
    await provisionar(opcoes, io);
    expect(ler('docker', 'hermes', 'evolut', 'data', 'profiles', 'comercial', 'config.yaml')).toContain('base_url: "http://gateway:3300/v1"');
  });
});

describe('argumentos e subida', () => {
  it('lerArgumentos lê pares --nome valor e recusa o resto', () => {
    expect(lerArgumentos(['--slug', 'evolut', '--workspace', WS])).toEqual({ slug: 'evolut', workspace: WS });
    expect(() => lerArgumentos(['slug'])).toThrow('Argumento desconhecido');
  });
  it('docker:subir inclui o compose dos Hermes só quando ele existe', () => {
    expect(argumentosDoCompose(false)).toEqual(['compose', '-f', 'docker-compose.yml', 'up', '-d', '--build']);
    expect(argumentosDoCompose(true)).toEqual(['compose', '-f', 'docker-compose.yml', '-f', 'docker/agentes-hermes.compose.yml', 'up', '-d', '--build']);
  });
});
