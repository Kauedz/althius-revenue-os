import { describe, expect, it } from 'vitest';
import { configDoAmbiente, lerConfig, URL_PADRAO_UNIPILE } from './config';

describe('config da Unipile', () => {
  it('usa o endereço padrão e tira espaços e barra final', () => {
    expect(lerConfig({ UNIPILE_API_KEY: ' k1 ' })).toEqual({ apiKey: 'k1', url: URL_PADRAO_UNIPILE });
    expect(lerConfig({ UNIPILE_API_KEY: 'k', UNIPILE_API_URL: 'https://x.test/' })).toEqual({ apiKey: 'k', url: 'https://x.test' });
  });
  it('sem chave, a chave vem vazia (canal desligado)', () => {
    expect(lerConfig({}).apiKey).toBe('');
  });
  it('trocar a chave vale na hora: a config é relida a cada uso', () => {
    const env: Record<string, string> = { UNIPILE_API_KEY: 'antiga' };
    const obter = configDoAmbiente(env);
    expect(obter().apiKey).toBe('antiga');
    env.UNIPILE_API_KEY = 'nova';
    expect(obter().apiKey).toBe('nova');
  });
});
