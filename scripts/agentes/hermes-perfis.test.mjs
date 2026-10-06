import { describe, expect, it } from 'vitest';
import { AGENTES, FERRAMENTAS_DESLIGADAS, HERMES_IMAGEM, envDoPerfil, envPadrao, mesclarExecutores, montarCompose, perfilDoAgente, perfilPadrao, slugValido, uuidValido } from './hermes-perfis.mjs';

const WS = 'a0000000-0000-0000-0000-000000000001';
const base = { urlBanco: 'http://web:8081', chavePublica: 'anon-publica', token: 'alt_agente_abc', modelo: { url: 'https://api.exemplo.test/v1', nome: 'modelo-x' } };

describe('perfilDoAgente', () => {
  it('só o MCP da Althius, nenhuma ferramenta embutida e a chave do modelo vem do .env (nunca no config)', () => {
    const c = perfilDoAgente(base);
    expect(c).toContain('provider: custom');
    expect(c).toContain('base_url: "https://api.exemplo.test/v1"');
    expect(c).toContain('key_env: MODELO_CHAVE');
    expect(c).toContain('api_server: []');
    for (const f of FERRAMENTAS_DESLIGADAS) expect(c).toContain(f);
    for (const f of ['terminal', 'file', 'browser', 'code_execution']) expect(FERRAMENTAS_DESLIGADAS).toContain(f);
    expect(c).toContain('mcp_servers:');
    expect(c).toContain('/opt/althius/mcp-althius.mjs');
    expect(c).toContain('ALTHIUS_AGENTE_TOKEN: "alt_agente_abc"');
    expect(c).toContain('ALTHIUS_SUPABASE_CHAVE_PUBLICA: "anon-publica"');
    expect(c).not.toMatch(/service_role|SERVICE_ROLE|MODELO_CHAVE=/);
  });
  it('valores com aspas ou quebra de linha não escapam do YAML', () => {
    const c = perfilDoAgente({ ...base, modelo: { url: 'https://x.test/v1', nome: 'a"b\nc: d' } });
    expect(c).toContain('default: "a\\"b\\nc: d"');
  });
  it('exige tudo (sem token, sem modelo: erro claro)', () => {
    expect(() => perfilDoAgente({ ...base, token: '' })).toThrow('token');
    expect(() => perfilDoAgente({ ...base, modelo: { url: '', nome: '' } })).toThrow('modelo');
  });
});

describe('envs', () => {
  it('perfil do agente: ligado, chave da API e chave do modelo', () => {
    expect(envDoPerfil({ chaveApi: 'k1', chaveModelo: 'm1' })).toBe('API_SERVER_ENABLED=true\nAPI_SERVER_KEY=k1\nMODELO_CHAVE=m1\n');
    expect(() => envDoPerfil({})).toThrow();
  });
  it('perfil padrão: fechado, com chave aleatória e ouvinte aberto só na rede interna do Docker', () => {
    expect(perfilPadrao()).toContain('api_server: []');
    const e = envPadrao({ chaveAleatoria: 'alt_padrao_x' });
    expect(e).toContain('API_SERVER_KEY=alt_padrao_x');
    expect(e).toContain('API_SERVER_PORT=8642');
  });
});

describe('montarCompose', () => {
  it('um serviço por cliente, imagem fixada por digest, sem porta publicada, só na rede interna', () => {
    const c = montarCompose(['grao', 'evolut']);
    expect(c).toContain('hermes-evolut:');
    expect(c).toContain('hermes-grao:');
    expect(c.indexOf('hermes-evolut')).toBeLessThan(c.indexOf('hermes-grao'));
    expect(c).toContain(`image: ${HERMES_IMAGEM}`);
    expect(HERMES_IMAGEM).toMatch(/@sha256:[0-9a-f]{64}$/);
    expect(c).toContain('./docker/hermes/evolut/data:/opt/data');
    expect(c).toContain('./docker/hermes/mcp:/opt/althius:ro');
    expect(c).toContain('networks: [interna]');
    expect(c).not.toContain('ports:');
  });
  it('sem clientes, um arquivo válido e vazio; slug estranho é recusado', () => {
    expect(montarCompose([])).toBe('services: {}\n');
    expect(() => montarCompose(['../x'])).toThrow('slug inválido');
  });
});

describe('mesclarExecutores', () => {
  it('acrescenta os 4 agentes do cliente sem tocar nos outros', () => {
    const chaves = { comercial: 'a', marketing: 'b', copy: 'c', revops: 'd' };
    const antes = { executores: { 'b0000000-0000-0000-0000-000000000001/comercial': { url: 'http://outro', chave: 'z', modelo: 'comercial' } } };
    const r = mesclarExecutores(antes, { workspaceId: WS.toUpperCase(), slug: 'evolut', chaves });
    expect(Object.keys(r.executores)).toHaveLength(5);
    expect(r.executores[`${WS}/marketing`]).toEqual({ url: 'http://hermes-evolut:8642/p/marketing', chave: 'b', modelo: 'marketing' });
    expect(r.executores['b0000000-0000-0000-0000-000000000001/comercial'].chave).toBe('z');
  });
  it('arquivo ausente ou torto vira um começo limpo; trocar a chave de um agente troca só a dele', () => {
    expect(Object.keys(mesclarExecutores(null, { workspaceId: WS, slug: 's', chaves: { copy: 'x' } }).executores)).toEqual([`${WS}/copy`]);
    const r1 = mesclarExecutores(null, { workspaceId: WS, slug: 's', chaves: { copy: 'x', revops: 'y' } });
    const r2 = mesclarExecutores(r1, { workspaceId: WS, slug: 's', chaves: { copy: 'novo' } });
    expect(r2.executores[`${WS}/copy`].chave).toBe('novo');
    expect(r2.executores[`${WS}/revops`].chave).toBe('y');
  });
  it('os 4 agentes fixos', () => expect(AGENTES).toEqual(['comercial', 'marketing', 'copy', 'revops']));
});

describe('validações', () => {
  it('slug e uuid', () => {
    expect(slugValido('evolut')).toBe(true);
    expect(slugValido('Evolut')).toBe(false);
    expect(slugValido('a/b')).toBe(false);
    expect(slugValido('')).toBe(false);
    expect(uuidValido(WS)).toBe(true);
    expect(uuidValido('nao-e-uuid')).toBe(false);
  });
});
