// Testes do `npm run criar-superadmin`. Nenhuma chamada real: o GoTrue e a API do banco são de mentira.
import { describe, expect, it } from 'vitest';
import { criarSuperadmin, lerArgumentos } from './criar-superadmin.mjs';

const URL = 'https://app.exemplo.com.br';
const CHAVE = 'chave-de-servico-secreta-de-teste';
const USER_ID = '11111111-2222-3333-4444-555555555555';

// Servidor de mentira: guarda as chamadas e responde conforme o cenário.
function servidor(cenario = {}) {
  const chamadas = [];
  const fetchFalso = async (endereco, opcoes = {}) => {
    const caminho = endereco.replace(URL, '');
    const metodo = opcoes.method ?? 'GET';
    chamadas.push({ metodo, caminho, corpo: opcoes.body ? JSON.parse(opcoes.body) : undefined, cabecalhos: opcoes.headers });
    const json = (status, corpo) => ({ ok: status < 300, status, json: async () => corpo });
    if (metodo === 'GET' && caminho.startsWith('/rest/v1/workspace_members')) {
      return json(200, cenario.jaTemSuperadmin ? [{ id: 'x' }] : []);
    }
    if (metodo === 'POST' && caminho === '/auth/v1/admin/users') {
      return cenario.usuarioJaExiste ? json(422, { error_code: 'email_exists', msg: 'já existe' }) : json(200, { id: USER_ID, email: opcoes.body && JSON.parse(opcoes.body).email });
    }
    if (metodo === 'GET' && caminho.startsWith('/rest/v1/profiles')) return json(200, [{ id: USER_ID }]);
    if (metodo === 'POST' && caminho === '/auth/v1/admin/generate_link') {
      return cenario.falhaLink ? json(500, { msg: 'erro' }) : json(200, { action_link: `${URL}/auth/v1/verify?token=abc&type=recovery` });
    }
    if (metodo === 'POST' && caminho === '/rest/v1/rpc/bootstrap_superadmin') {
      return cenario.falhaRpc ? json(400, { message: 'Já existe superadmin ativo. Esta operação só serve para o primeiro.' }) : json(200, { ok: true });
    }
    if (metodo === 'DELETE' && caminho === `/auth/v1/admin/users/${USER_ID}`) return json(200, {});
    return json(404, { msg: `não previsto: ${metodo} ${caminho}` });
  };
  return { chamadas, fetchFalso };
}

async function recusa(promessa) {
  try { await promessa; } catch (e) { return e; }
  throw new Error('devia ter recusado');
}

describe('criar-superadmin', () => {
  it('sem e-mail: recusa e nem fala com o servidor', async () => {
    const s = servidor();
    const erro = await recusa(criarSuperadmin({ email: undefined, url: URL, serviceKey: CHAVE, fetchImpl: s.fetchFalso }));
    expect(erro.message).toMatch(/--email/);
    expect(s.chamadas).toHaveLength(0);
  });

  it('e-mail inválido: recusa e nem fala com o servidor', async () => {
    const s = servidor();
    for (const ruim of ['', '   ', 'sem-arroba', 'a@b', 'dois@@x.com']) {
      await recusa(criarSuperadmin({ email: ruim, url: URL, serviceKey: CHAVE, fetchImpl: s.fetchFalso }));
    }
    expect(s.chamadas).toHaveLength(0);
  });

  it('sem endereço ou sem chave do servidor: recusa', async () => {
    const s = servidor();
    await recusa(criarSuperadmin({ email: 'a@b.com', url: '', serviceKey: CHAVE, fetchImpl: s.fetchFalso }));
    await recusa(criarSuperadmin({ email: 'a@b.com', url: URL, serviceKey: '', fetchImpl: s.fetchFalso }));
    expect(s.chamadas).toHaveLength(0);
  });

  it('segunda execução: já existe superadmin ativo, recusa e não cria usuário nenhum', async () => {
    const s = servidor({ jaTemSuperadmin: true });
    const erro = await recusa(criarSuperadmin({ email: 'dono@empresa.com.br', url: URL, serviceKey: CHAVE, fetchImpl: s.fetchFalso }));
    expect(erro.message).toMatch(/já existe superadmin ativo/i);
    expect(s.chamadas.some(c => c.metodo !== 'GET')).toBe(false);
  });

  it('primeira execução: cria o usuário SEM senha, gera o link e registra o superadmin, nessa ordem', async () => {
    const s = servidor();
    const r = await criarSuperadmin({ email: '  Dono@Empresa.com.br ', url: URL, serviceKey: CHAVE, fetchImpl: s.fetchFalso });
    expect(r.email).toBe('dono@empresa.com.br');
    expect(r.link).toBe(`${URL}/auth/v1/verify?token=abc&type=recovery`);
    expect(s.chamadas.map(c => `${c.metodo} ${c.caminho.split('?')[0]}`)).toEqual([
      'GET /rest/v1/workspace_members',
      'POST /auth/v1/admin/users',
      'POST /auth/v1/admin/generate_link',
      'POST /rest/v1/rpc/bootstrap_superadmin',
    ]);
    const criar = s.chamadas.find(c => c.caminho === '/auth/v1/admin/users');
    expect(criar.corpo).toEqual({ email: 'dono@empresa.com.br', email_confirm: true });
    expect(JSON.stringify(s.chamadas)).not.toMatch(/"password"/);
    const link = s.chamadas.find(c => c.caminho.endsWith('generate_link'));
    expect(link.corpo).toMatchObject({ type: 'recovery', email: 'dono@empresa.com.br', redirect_to: `${URL}/definir-senha/` });
    expect(s.chamadas.find(c => c.caminho.endsWith('bootstrap_superadmin')).corpo).toEqual({ p_user_id: USER_ID });
  });

  it('usa a chave de serviço nas chamadas, mas nunca a devolve no resultado', async () => {
    const s = servidor();
    const r = await criarSuperadmin({ email: 'dono@empresa.com.br', url: URL, serviceKey: CHAVE, fetchImpl: s.fetchFalso });
    expect(s.chamadas.every(c => c.cabecalhos.Authorization === `Bearer ${CHAVE}` && c.cabecalhos.apikey === CHAVE)).toBe(true);
    expect(JSON.stringify(r)).not.toContain(CHAVE);
  });

  it('se o banco recusar no fim (corrida), apaga o usuário que acabou de criar', async () => {
    const s = servidor({ falhaRpc: true });
    const erro = await recusa(criarSuperadmin({ email: 'dono@empresa.com.br', url: URL, serviceKey: CHAVE, fetchImpl: s.fetchFalso }));
    expect(erro.message).toMatch(/já existe superadmin ativo/i);
    expect(s.chamadas.some(c => c.metodo === 'DELETE' && c.caminho === `/auth/v1/admin/users/${USER_ID}`)).toBe(true);
  });

  it('se não conseguir gerar o link, apaga o usuário criado e não registra superadmin', async () => {
    const s = servidor({ falhaLink: true });
    await recusa(criarSuperadmin({ email: 'dono@empresa.com.br', url: URL, serviceKey: CHAVE, fetchImpl: s.fetchFalso }));
    expect(s.chamadas.some(c => c.metodo === 'DELETE')).toBe(true);
    expect(s.chamadas.some(c => c.caminho.endsWith('bootstrap_superadmin'))).toBe(false);
  });

  it('usuário que já existia no login (rodada anterior interrompida): reaproveita e, se falhar, NÃO apaga', async () => {
    const s = servidor({ usuarioJaExiste: true, falhaRpc: true });
    await recusa(criarSuperadmin({ email: 'dono@empresa.com.br', url: URL, serviceKey: CHAVE, fetchImpl: s.fetchFalso }));
    expect(s.chamadas.some(c => c.metodo === 'GET' && c.caminho.startsWith('/rest/v1/profiles'))).toBe(true);
    expect(s.chamadas.some(c => c.metodo === 'DELETE')).toBe(false);
  });

  it('lê os argumentos da linha de comando', () => {
    expect(lerArgumentos(['--email', 'a@b.com']).email).toBe('a@b.com');
    expect(lerArgumentos(['--email=a@b.com', '--url=https://x.com']).url).toBe('https://x.com');
    expect(lerArgumentos([]).email).toBeUndefined();
  });
});
