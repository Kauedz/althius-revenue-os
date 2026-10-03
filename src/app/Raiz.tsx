// Ponto de entrada do modo real: sessão do Supabase -> login ou app com dados do banco.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AlthiusApp } from './AlthiusApp';
import { carregarContexto } from './contexto';
import { montarDados, type DadosAlthius } from './dados';
import { Login } from './Login';

type Estado =
  | { tela: 'carregando' }
  | { tela: 'login' }
  | { tela: 'erro'; mensagem: string }
  | { tela: 'sem-workspace'; email: string }
  | { tela: 'app'; dados: DadosAlthius };

declare global {
  interface Window {
    ALTHIUS_DATA?: Record<string, any>;
    ALTHIUS_CAPS?: any;
  }
}

/**
 * O protótipo guarda no navegador a foto e o histórico do copiloto sem separar por usuário.
 * Na saída, isso é apagado para a próxima pessoa no mesmo computador não ver.
 * (Tema, densidade e menu recolhido são preferências do aparelho e ficam.)
 */
export const CHAVES_PESSOAIS = ['althius-foto', 'althius-cop-hist'];
export function limparDadosPessoais() {
  for (const chave of CHAVES_PESSOAIS) {
    try { localStorage.removeItem(chave); } catch { /* navegador sem storage: nada a limpar */ }
  }
}

/** Traduz os erros de login do Supabase para algo que a pessoa entende. */
export function mensagemDeLogin(erro: { message?: string; status?: number } | null): string {
  const m = (erro?.message || '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail pelo link do convite antes de entrar.';
  if (m.includes('fetch') || m.includes('network')) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
  return 'Não foi possível entrar agora. Tente de novo em instantes.';
}

export function Raiz({ supabase }: { supabase: SupabaseClient }) {
  const [estado, setEstado] = useState<Estado>({ tela: 'carregando' });
  // Dados do protótipo usados nas telas que ainda não foram ligadas ao banco.
  const demo = useRef({ data: window.ALTHIUS_DATA || {}, caps: window.ALTHIUS_CAPS || { papeis: [], grupos: [] } });

  const carregar = useCallback(async () => {
    setEstado({ tela: 'carregando' });
    try {
      const ctx = await carregarContexto(supabase);
      if (!ctx.workspaces.length) { setEstado({ tela: 'sem-workspace', email: ctx.usuario.email }); return; }
      const dados = montarDados(ctx, demo.current.data, demo.current.caps);
      window.ALTHIUS_DATA = dados;
      window.ALTHIUS_CAPS = dados.CAPS;
      // Abre num workspace que a pessoa pode ver (a URL pode ter vindo de outra sessão).
      const slug = (location.hash.match(/^#\/app\/([^/]+)/) || [])[1];
      if (!slug || !ctx.workspaces.some(w => w.slug === slug)) location.hash = '#/app/' + ctx.workspaces[0].slug + '/home';
      setEstado({ tela: 'app', dados });
    } catch (falha) {
      setEstado({ tela: 'erro', mensagem: falha instanceof Error ? falha.message : 'Erro ao carregar seus dados.' });
    }
  }, [supabase]);

  // Volta ao login sem deixar nada da pessoa anterior na página nem no navegador.
  const encerrar = useCallback(() => {
    window.ALTHIUS_DATA = demo.current.data;
    window.ALTHIUS_CAPS = demo.current.caps;
    limparDadosPessoais();
    location.hash = '';
    setEstado({ tela: 'login' });
  }, []);

  useEffect(() => {
    let vivo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return;
      if (data.session) carregar(); else setEstado({ tela: 'login' });
    });
    // Sessão expirada ou saída em outra aba também encerram aqui.
    const { data: inscricao } = supabase.auth.onAuthStateChange(evento => {
      if (evento === 'SIGNED_OUT') encerrar();
    });
    return () => { vivo = false; inscricao.subscription.unsubscribe(); };
  }, [supabase, carregar, encerrar]);

  const entrar = async (email: string, senha: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) throw new Error(mensagemDeLogin(error));
    await carregar();
  };

  const sair = async () => {
    const { error } = await supabase.auth.signOut();
    // Sem conexão com o servidor, ao menos apaga a sessão deste navegador.
    if (error) await supabase.auth.signOut({ scope: 'local' });
    encerrar();
  };

  switch (estado.tela) {
    case 'carregando':
      return <Aviso titulo="Carregando seu workspace…" />;
    case 'login':
      return <Login entrar={entrar} />;
    case 'erro':
      return <Aviso titulo="Não foi possível abrir a Althius" texto={estado.mensagem} acao={{ rotulo: 'Tentar de novo', fazer: carregar }} secundaria={{ rotulo: 'Sair', fazer: sair }} />;
    case 'sem-workspace':
      return <Aviso titulo="Você ainda não está em nenhum workspace" texto={`A conta ${estado.email} existe, mas ainda não foi adicionada a um workspace. Peça ao seu estrategista Althius para enviar o convite.`} acao={{ rotulo: 'Sair', fazer: sair }} />;
    case 'app':
      return <AlthiusApp dados={estado.dados} aoSair={sair} />;
  }
}

function Aviso({ titulo, texto, acao, secundaria }: {
  titulo: string; texto?: string;
  acao?: { rotulo: string; fazer: () => void }; secundaria?: { rotulo: string; fazer: () => void };
}) {
  const botao = (primario: boolean) => ({
    height: 44, padding: '0 18px', border: '1px solid ' + (primario ? 'var(--ink)' : 'var(--steel)'), background: primario ? 'var(--ink)' : 'var(--paper)',
    color: primario ? 'var(--paper)' : 'var(--ink)', fontFamily: 'inherit', fontSize: 14, cursor: 'pointer', borderRadius: 10
  });
  return (
    <div role="status" style={{ height: '100vh', display: 'grid', placeItems: 'center', background: 'var(--paper)', color: 'var(--ink)', fontFamily: 'var(--f-text)', fontWeight: 500, fontSize: 14 }}>
      <div style={{ maxWidth: 440, padding: 24, display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center', alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'var(--f-display)', fontWeight: 300, fontSize: 30, margin: 0 }}>{titulo}</h1>
        {texto && <p style={{ margin: 0, color: 'var(--graphite)', lineHeight: 1.5 }}>{texto}</p>}
        <div style={{ display: 'flex', gap: 10 }}>
          {acao && <button onClick={acao.fazer} style={botao(true)}>{acao.rotulo}</button>}
          {secundaria && <button onClick={secundaria.fazer} style={botao(false)}>{secundaria.rotulo}</button>}
        </div>
      </div>
    </div>
  );
}
