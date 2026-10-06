// O que as rotas de integração precisam do banco (migration 119). Funções de sistema falam com a chave de serviço; a
// conferência "esta pessoa pode conectar?" fala com o login DA PESSOA (quem decide é o banco, nunca o servidor).
export type EstadoDoAcesso = 'conectado' | 'precisa_reconectar';

export interface AcessoGuardado {
  estado: EstadoDoAcesso;
  conta: string | null;
  /** tokens cifrados com a chave mestra do cofre; só o servidor decifra */
  accessCifrado: string;
  refreshCifrado: string | null;
  expiraEm: string | null;
  clientId: string;
  issuer: string;
  escopo: string | null;
}

export type ResultadoDaTentativa =
  | { ok: true; workspaceId: string; membroId: string; integracao: string; verifierCifrado: string; redirectUri: string; clientId: string; issuer: string }
  | { ok: false; motivo: 'invalida' | 'usada' | 'expirada' | 'participacao_inativa' };

export interface BancoIntegracoes {
  conferir(jwt: string, workspaceId: string): Promise<{ ok: true; membroId: string } | { ok: false; status: 401 | 403 | 502 }>;
  tentativaAbrir(a: { membroId: string; workspaceId: string; integracao: string; state: string; verifierCifrado: string; redirectUri: string; clientId: string; issuer: string; ttlSegundos: number }): Promise<void>;
  tentativaConsumir(state: string): Promise<ResultadoDaTentativa>;
  acessoSalvar(a: { workspaceId: string; membroId: string; integracao: string; conta: string | null; portal: string | null; accessCifrado: string; refreshCifrado: string | null; expiraEm: string | null; clientId: string; issuer: string; escopo: string | null }): Promise<{ ok: true } | { ok: false; motivo: 'portal_diferente' }>;
  acessoLer(workspaceId: string, membroId: string, integracao: string): Promise<AcessoGuardado | null>;
  acessoRenovar(a: { workspaceId: string; membroId: string; integracao: string; accessCifrado: string; refreshCifrado: string | null; expiraEm: string | null }): Promise<void>;
  acessoMarcar(workspaceId: string, membroId: string, integracao: string, estado: EstadoDoAcesso): Promise<void>;
  desconectar(workspaceId: string, membroId: string, integracao: string): Promise<void>;
  /** Recusa (lança) se a pessoa não pode conectar neste workspace. */
  retirar(workspaceId: string, membroId: string, integracao: string): Promise<void>;
  clienteLer(integracao: string, issuer: string, redirectUri: string): Promise<{ clientId: string; segredoCifrado: string | null } | null>;
  clienteSalvar(integracao: string, issuer: string, redirectUri: string, clientId: string, segredoCifrado: string | null): Promise<{ clientId: string; segredoCifrado: string | null }>;
}

export interface OpcoesBanco {
  base: string;
  chaveAnon: string;
  chaveServico: string;
  buscar?: typeof fetch;
}

export function bancoIntegracoes(o: OpcoesBanco): BancoIntegracoes {
  const buscar = o.buscar ?? fetch;
  const url = (fn: string) => `${o.base.replace(/\/$/, '')}/rpc/${fn}`;
  const comoSistema = async (fn: string, corpo: Record<string, unknown>): Promise<unknown> => {
    const r = await buscar(url(fn), { method: 'POST', headers: { apikey: o.chaveServico, Authorization: `Bearer ${o.chaveServico}`, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    if (!r.ok) throw new Error(`banco recusou ${fn} (HTTP ${r.status})`);
    return r.status === 204 ? null : await r.json().catch(() => null);
  };
  const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
  const txt = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

  return {
    async conferir(jwt, workspaceId) {
      let r: Response;
      try {
        r = await buscar(url('integration_conferir'), { method: 'POST', headers: { apikey: o.chaveAnon, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_workspace_id: workspaceId }) });
      } catch { return { ok: false, status: 502 }; }
      if (r.status === 401) return { ok: false, status: 401 };
      if (r.status === 403) return { ok: false, status: 403 };
      if (!r.ok) {
        // O banco responde 42501 (sem permissão) como HTTP 403; qualquer outra falha é do banco.
        return { ok: false, status: 502 };
      }
      const membro = await r.json().catch(() => null);
      return typeof membro === 'string' ? { ok: true, membroId: membro } : { ok: false, status: 502 };
    },
    async tentativaAbrir(a) {
      await comoSistema('integration_attempt_start', { p_member_id: a.membroId, p_workspace_id: a.workspaceId, p_integration_id: a.integracao, p_state: a.state, p_verifier_cifrado: a.verifierCifrado, p_redirect_uri: a.redirectUri, p_client_id: a.clientId, p_issuer: a.issuer, p_ttl_seconds: a.ttlSegundos });
    },
    async tentativaConsumir(state) {
      const j = obj(await comoSistema('integration_attempt_consume', { p_state: state }));
      if (j.ok !== true) {
        const motivo = j.motivo;
        return { ok: false, motivo: motivo === 'usada' || motivo === 'expirada' || motivo === 'participacao_inativa' ? motivo : 'invalida' };
      }
      return { ok: true, workspaceId: String(j.workspace_id), membroId: String(j.member_id), integracao: String(j.integration_id), verifierCifrado: String(j.verifier_cifrado), redirectUri: String(j.redirect_uri), clientId: String(j.client_id), issuer: String(j.issuer) };
    },
    async acessoSalvar(a) {
      const j = obj(await comoSistema('integration_access_save', { p_workspace_id: a.workspaceId, p_member_id: a.membroId, p_integration_id: a.integracao, p_conta: a.conta, p_portal: a.portal, p_access_cifrado: a.accessCifrado, p_refresh_cifrado: a.refreshCifrado, p_expira_em: a.expiraEm, p_client_id: a.clientId, p_issuer: a.issuer, p_escopo: a.escopo }));
      return j.ok === true ? { ok: true } : { ok: false, motivo: 'portal_diferente' };
    },
    async acessoLer(workspaceId, membroId, integracao) {
      const j = obj(await comoSistema('integration_access_get', { p_workspace_id: workspaceId, p_member_id: membroId, p_integration_id: integracao }));
      if (!j.access_cifrado) return null;
      return { estado: j.estado === 'precisa_reconectar' ? 'precisa_reconectar' : 'conectado', conta: txt(j.conta), accessCifrado: String(j.access_cifrado), refreshCifrado: txt(j.refresh_cifrado), expiraEm: txt(j.expira_em), clientId: String(j.client_id), issuer: String(j.issuer), escopo: txt(j.escopo) };
    },
    async acessoRenovar(a) {
      await comoSistema('integration_access_refresh', { p_workspace_id: a.workspaceId, p_member_id: a.membroId, p_integration_id: a.integracao, p_access_cifrado: a.accessCifrado, p_refresh_cifrado: a.refreshCifrado, p_expira_em: a.expiraEm });
    },
    async acessoMarcar(workspaceId, membroId, integracao, estado) {
      await comoSistema('integration_access_mark', { p_workspace_id: workspaceId, p_member_id: membroId, p_integration_id: integracao, p_estado: estado });
    },
    async desconectar(workspaceId, membroId, integracao) {
      await comoSistema('integration_disconnect', { p_workspace_id: workspaceId, p_member_id: membroId, p_integration_id: integracao });
    },
    async retirar(workspaceId, membroId, integracao) {
      await comoSistema('integration_withdraw', { p_workspace_id: workspaceId, p_member_id: membroId, p_integration_id: integracao });
    },
    async clienteLer(integracao, issuer, redirectUri) {
      const j = obj(await comoSistema('integration_oauth_client_get', { p_integration_id: integracao, p_issuer: issuer, p_redirect_uri: redirectUri }));
      return j.client_id ? { clientId: String(j.client_id), segredoCifrado: txt(j.client_secret_cifrado) } : null;
    },
    async clienteSalvar(integracao, issuer, redirectUri, clientId, segredoCifrado) {
      const j = obj(await comoSistema('integration_oauth_client_save', { p_integration_id: integracao, p_issuer: issuer, p_redirect_uri: redirectUri, p_client_id: clientId, p_client_secret_cifrado: segredoCifrado }));
      return { clientId: String(j.client_id), segredoCifrado: txt(j.client_secret_cifrado) };
    }
  };
}
