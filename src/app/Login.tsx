// Tela de login. Mesmo visual da tela de entrada do protótipo v18, com senha real (Supabase Auth).
import { useState, type FormEvent } from 'react';

export interface LoginProps {
  entrar: (email: string, senha: string) => Promise<void>;
}

const campo = {
  height: 48, boxSizing: 'border-box', padding: '0 14px', border: '1px solid var(--steel)', background: 'var(--paper)',
  color: 'var(--ink)', fontFamily: 'inherit', fontWeight: 400, fontSize: 15, outline: 'none', borderRadius: 10
} as const;

export function Login({ entrar }: LoginProps) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !senha) { setErro('Preencha e-mail e senha.'); return; }
    setErro(''); setEnviando(true);
    try {
      await entrar(email.trim(), senha);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível entrar agora. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={{ height: '100vh', display: 'flex', background: 'var(--paper)', color: 'var(--ink)', fontFamily: 'var(--f-text)', fontWeight: 500, fontSize: 14, lineHeight: 1.5 }}>
      <div style={{ flex: '1 1 auto', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <div style={{ background: '#131313', color: '#F4F4F4', padding: '56px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 40, minHeight: 520 }}>
          <svg viewBox="0 0 352 299" style={{ width: 52, height: 44 }} role="img" aria-label="Althius">
            <path d="M115 0L0 299H81L127 61L169 299H251L141 0Z" fill="#F4F4F4" />
            <circle cx="308" cy="43" r="40" fill="#F7054F" />
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <h1 style={{ fontFamily: 'var(--f-display)', margin: 0, fontWeight: 300, fontSize: 50, lineHeight: 1.06, letterSpacing: '-0.01em', textWrap: 'balance' }}>
              Seu time de receita, agora com agentes.
            </h1>
            <p style={{ margin: 0, maxWidth: 420, fontSize: 18, lineHeight: 1.5, color: '#C1C1C1' }}>
              Estratégia, prospecção, campanhas e agentes no mesmo lugar.
            </p>
          </div>
          <span style={{ fontFamily: 'var(--f-hand)', fontSize: 30, lineHeight: 1, color: '#F7054F' }}>bem-vindo</span>
        </div>
        <div style={{ padding: '56px 48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={enviar} noValidate style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 22 }}>
            <h2 style={{ fontFamily: 'var(--f-display)', margin: 0, fontWeight: 300, fontSize: 34 }}>Acesse sua conta Althius</h2>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--graphite)' }}>E-mail</span>
              <input type="email" autoComplete="email" placeholder="voce@empresa.com.br" value={email} onChange={e => setEmail(e.target.value)} style={campo} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--graphite)' }}>Senha</span>
              <input type="password" autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} style={campo} />
            </label>
            {erro && <span role="alert" style={{ fontSize: 14, color: 'var(--err)' }}>{erro}</span>}
            <button type="submit" className="b-pri" disabled={enviando} style={{ height: 50, border: '1px solid var(--ink)', background: 'var(--ink)', color: 'var(--paper)', fontFamily: 'inherit', fontSize: 14, cursor: enviando ? 'wait' : 'pointer', borderRadius: 10, opacity: enviando ? 0.7 : 1 }}>
              {enviando ? 'Entrando…' : 'Continuar'}
            </button>
            <span style={{ fontSize: 14, color: 'var(--graphite)' }}>Primeiro acesso? Seu estrategista Althius envia o convite.</span>
          </form>
        </div>
      </div>
    </div>
  );
}
