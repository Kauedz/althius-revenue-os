// Mundo falso das integrações para os testes: um banco em memória que aplica as mesmas regras do banco de verdade.
// Só os testes importam isto.
import type { AcessoGuardado, BancoIntegracoes } from './banco.ts';

export const membros: Record<string, string> = { 'jwt-aline': 'm-aline', 'jwt-camila': 'm-camila' };

/** Banco falso: guarda tudo em memória e aplica as mesmas regras do banco de verdade. */
type AgenteFalso = { workspaceId?: string; agente?: string; solicitanteId?: string | null; pausado?: boolean };
export function bancoFalso(opcoes: { semPermissao?: string[]; portal?: string; agentes?: Record<string, AgenteFalso> } = {}) {
  const auditoria: Array<{ workspaceId: string; agente: string; membroId: string | null; integracao: string; ferramenta: string; resultado: string }> = [];
  const tentativas = new Map<string, { workspaceId: string; membroId: string; integracao: string; verifierCifrado: string; redirectUri: string; clientId: string; issuer: string; expira: number; usada: boolean }>();
  const acessos = new Map<string, AcessoGuardado>();
  const clientes = new Map<string, { clientId: string; segredoCifrado: string | null }>();
  let portalFixado: string | null = opcoes.portal ?? null;
  let tempo = 1_000_000;
  const chamadas: string[] = [];
  const chave = (ws: string, m: string, i: string) => `${ws}|${m}|${i}`;
  const banco: BancoIntegracoes = {
    async contextoDoAgente(token) {
      const a = opcoes.agentes?.[token];
      if (!a) return { ok: false, motivo: 'token_invalido' };
      if (a.pausado) return { ok: false, motivo: 'agente_pausado' };
      return { ok: true, workspaceId: a.workspaceId ?? '', agente: a.agente ?? '', solicitanteId: a.solicitanteId ?? null };
    },
    async auditarUsoDoAgente(uso) { auditoria.push({ ...uso }); },
    async conferir(jwt) {
      chamadas.push('conferir');
      if (!jwt || !membros[jwt]) return { ok: false, status: 401 };
      if (opcoes.semPermissao?.includes(membros[jwt])) return { ok: false, status: 403 };
      return { ok: true, membroId: membros[jwt] };
    },
    async tentativaAbrir(a) { chamadas.push('tentativaAbrir'); tentativas.set(a.state, { ...a, expira: tempo + a.ttlSegundos * 1000, usada: false }); },
    async tentativaConsumir(state) {
      const t = tentativas.get(state);
      if (!t) return { ok: false, motivo: 'invalida' };
      if (t.usada) return { ok: false, motivo: 'usada' };
      t.usada = true;
      if (t.expira < tempo) return { ok: false, motivo: 'expirada' };
      return { ok: true, ...t };
    },
    async acessoSalvar(a) {
      if (portalFixado && a.portal && portalFixado !== a.portal) return { ok: false, motivo: 'portal_diferente' };
      if (a.portal) portalFixado = a.portal;
      acessos.set(chave(a.workspaceId, a.membroId, a.integracao), { estado: 'conectado', conta: a.conta, accessCifrado: a.accessCifrado, refreshCifrado: a.refreshCifrado, expiraEm: a.expiraEm, clientId: a.clientId, issuer: a.issuer, escopo: a.escopo });
      return { ok: true };
    },
    async acessoLer(ws, m, i) { return acessos.get(chave(ws, m, i)) ?? null; },
    async acessoRenovar(a) {
      const x = acessos.get(chave(a.workspaceId, a.membroId, a.integracao))!;
      x.accessCifrado = a.accessCifrado; x.refreshCifrado = a.refreshCifrado ?? x.refreshCifrado; x.expiraEm = a.expiraEm; x.estado = 'conectado';
    },
    async acessoMarcar(ws, m, i, estado) { chamadas.push(`marcar:${estado}`); const x = acessos.get(chave(ws, m, i)); if (x) x.estado = estado; },
    async desconectar(ws, m, i) { chamadas.push(`desconectar:${m}`); acessos.delete(chave(ws, m, i)); },
    async retirar(ws, m, i) {
      if (opcoes.semPermissao?.includes(m)) throw new Error('403');
      chamadas.push(`retirar:${m}`);
      for (const k of [...acessos.keys()]) if (k.startsWith(`${ws}|`) && k.endsWith(`|${i}`)) acessos.delete(k);
    },
    async clienteLer(i, issuer, redirect) { return clientes.get(`${i}|${issuer}|${redirect}`) ?? null; },
    async clienteSalvar(i, issuer, redirect, clientId, segredoCifrado) {
      const k = `${i}|${issuer}|${redirect}`;
      if (!clientes.has(k)) clientes.set(k, { clientId, segredoCifrado });
      return clientes.get(k)!;
    }
  };
  return { banco, tentativas, acessos, clientes, chamadas, auditoria, avancar: (ms: number) => { tempo += ms; } };
}

