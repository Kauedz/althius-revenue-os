import { describe, expect, it } from 'vitest';
import { baseDaApi, configDoAmbiente, lerConfig, URL_PADRAO_UNIPILE, versaoDaApi } from './config';

describe('config da Unipile', () => {
  it('usa o endereço padrão e tira espaços e barra final', () => {
    expect(lerConfig({ UNIPILE_API_KEY: ' k1 ' })).toEqual({ apiKey: 'k1', url: URL_PADRAO_UNIPILE });
    expect(lerConfig({ UNIPILE_API_KEY: 'k', UNIPILE_API_URL: 'https://x.test/' })).toEqual({ apiKey: 'k', url: 'https://x.test' });
  });
  it('sem chave, a chave vem vazia (canal desligado)', () => {
    expect(lerConfig({}).apiKey).toBe('');
  });
  it('versão da API (ADR 0069): v2 por padrão; v1 pelo formato do endereço ou forçada', () => {
    expect(versaoDaApi(lerConfig({ UNIPILE_API_KEY: 'k' }))).toBe('v2');
    expect(versaoDaApi(lerConfig({ UNIPILE_API_KEY: 'k', UNIPILE_API_URL: 'https://api68.unipile.com:19840' }))).toBe('v1');
    expect(versaoDaApi(lerConfig({ UNIPILE_API_KEY: 'k', UNIPILE_API_URL: 'https://api68.unipile.com:19840/api/v1/' }))).toBe('v1');
    expect(versaoDaApi(lerConfig({ UNIPILE_API_KEY: 'k', UNIPILE_API_URL: 'https://x.test', UNIPILE_API_VERSION: 'V1' }))).toBe('v1');
    expect(versaoDaApi(lerConfig({ UNIPILE_API_KEY: 'k', UNIPILE_API_URL: 'https://api68.unipile.com:19840', UNIPILE_API_VERSION: 'v2' }))).toBe('v2');
    expect(versaoDaApi({ apiKey: 'k', url: 'https://api.unipile.com' })).toBe('v2');
  });
  it('o endereço-base nunca leva /api/v1 (isso é da versão)', () => {
    expect(lerConfig({ UNIPILE_API_URL: 'https://api68.unipile.com:19840/api/v1' }).url).toBe('https://api68.unipile.com:19840');
    expect(baseDaApi({ apiKey: 'k', url: 'https://api68.unipile.com:19840/api/v1/' })).toBe('https://api68.unipile.com:19840');
  });
  it('trocar a chave vale na hora: a config é relida a cada uso', () => {
    const env: Record<string, string> = { UNIPILE_API_KEY: 'antiga' };
    const obter = configDoAmbiente(env);
    expect(obter().apiKey).toBe('antiga');
    env.UNIPILE_API_KEY = 'nova';
    expect(obter().apiKey).toBe('nova');
  });
});
