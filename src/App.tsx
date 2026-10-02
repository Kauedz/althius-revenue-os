import React, { useState } from 'react';
import { 
  Building2, 
  Target, 
  Radar, 
  Users, 
  CheckSquare, 
  GitFork, 
  Activity, 
  CheckCircle2, 
  Layers, 
  Bot, 
  Settings, 
  ChevronDown, 
  Coins, 
  Bell, 
  Sparkles,
  X,
  Send,
  Search
} from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

const mockWorkspaces: Workspace[] = [
  { id: 'a0000000-0000-0000-0000-000000000001', name: 'Empresa Alfa Ltda', slug: 'empresa-alfa' },
  { id: 'b0000000-0000-0000-0000-000000000001', name: 'Empresa Beta Corp', slug: 'empresa-beta' },
];

export function App() {
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace>(mockWorkspaces[0]);
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState<boolean>(false);
  const [activeModule, setActiveModule] = useState<string>('workbench');
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  const [messages, setMessages] = useState<{ sender: 'user' | 'agent'; text: string; time: string }[]>([
    {
      sender: 'agent',
      text: 'Olá! Sou o Orquestrador do Revenue OS. Posso ajudar com estratégia de ICP, receitas de coleta no Apify, revisão de cadências ou status das execuções.',
      time: '14:50'
    }
  ]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = { sender: 'user' as const, text: chatInput, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => [...prev, userMsg]);
    setChatInput('');

    setTimeout(() => {
      setMessages(prev => [...prev, {
        sender: 'agent',
        text: `Recebi sua solicitação para o workspace "${activeWorkspace.name}". As capacidades ativas no momento são governadas por RLS e pelo ledger de créditos.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }, 600);
  };

  const navItems = [
    { id: 'inicio', label: 'Início', icon: Building2 },
    { id: 'mercado', label: 'Mercado & ICP', icon: Target },
    { id: 'sinais', label: 'Sinais & Coleta', icon: Radar },
    { id: 'prospeccao', label: 'Contas & Contatos', icon: Users },
    { id: 'workbench', label: 'Sales Workbench', icon: CheckSquare, badge: '5' },
    { id: 'cadencias', label: 'Cadências', icon: GitFork },
    { id: 'execucoes', label: 'Execuções', icon: Activity },
    { id: 'aprovacoes', label: 'Aprovações', icon: CheckCircle2, badge: '2' },
    { id: 'integracoes', label: 'Hub de Integrações', icon: Layers },
    { id: 'admin', label: 'Administração', icon: Settings },
  ];

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100 antialiased overflow-hidden font-sans">
      {/* 1. SIDEBAR */}
      <aside className="w-64 border-r border-zinc-800/80 bg-zinc-900/40 flex flex-col justify-between shrink-0 select-none">
        <div>
          {/* Logo / Header */}
          <div className="h-14 px-4 flex items-center gap-2.5 border-b border-zinc-800/80">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-600/20">
              A
            </div>
            <div>
              <div className="font-semibold text-sm tracking-tight text-zinc-100">Althius OS</div>
              <div className="text-[11px] text-zinc-500 font-medium">Revenue Operating System</div>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="p-2 space-y-0.5">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveModule(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive 
                      ? 'bg-zinc-800 text-zinc-100 shadow-sm' 
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-zinc-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User / Workspace Member Profile */}
        <div className="p-3 border-t border-zinc-800/80 bg-zinc-900/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-200">
              KZ
            </div>
            <div className="truncate flex-1">
              <div className="text-xs font-medium text-zinc-200 truncate">Kauê Zanato</div>
              <div className="text-[10px] text-indigo-400 capitalize">Estrategista Althius</div>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. MAIN LAYOUT */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* TOPBAR */}
        <header className="h-14 border-b border-zinc-800/80 px-6 flex items-center justify-between bg-zinc-900/20 shrink-0">
          {/* Tenant / Workspace Selector */}
          <div className="flex items-center gap-4">
            <div className="relative">
            <button 
              onClick={() => setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 cursor-pointer transition-colors text-xs font-medium text-zinc-200"
            >
              <Building2 className="w-3.5 h-3.5 text-zinc-400" />
              <span>{activeWorkspace.name}</span>
              <ChevronDown className="w-3 h-3 text-zinc-500 ml-1" />
            </button>

            {isWorkspaceMenuOpen && (
              <div className="absolute top-10 left-0 w-56 rounded-md border border-zinc-800 bg-zinc-900 shadow-xl py-1 z-50">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  Selecione o Workspace
                </div>
                {mockWorkspaces.map(ws => (
                  <button
                    key={ws.id}
                    onClick={() => {
                      setActiveWorkspace(ws);
                      setIsWorkspaceMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-zinc-800 transition-colors ${
                      ws.id === activeWorkspace.id ? 'text-indigo-400 font-semibold' : 'text-zinc-300'
                    }`}
                  >
                    <span>{ws.name}</span>
                    {ws.id === activeWorkspace.id && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>}
                  </button>
                ))}
              </div>
            )}
          </div>

            {/* Quick Search */}
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-500" />
              <input 
                type="text" 
                placeholder="Buscar contas, leads ou execuções..." 
                className="w-full h-8 pl-8 pr-3 rounded-md bg-zinc-900/40 border border-zinc-800 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
              />
            </div>
          </div>

          {/* Right Header Actions: Credit Ledger Meter & Copilot Toggle */}
          <div className="flex items-center gap-3">
            {/* Credit Wallet Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/5 text-xs font-medium">
              <Coins className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-zinc-300">Créditos:</span>
              <span className="font-semibold text-indigo-300">8.400</span>
              <span className="text-[10px] text-zinc-500 font-normal">/ 10.000</span>
            </div>

            {/* Notifications */}
            <button className="p-2 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors">
              <Bell className="w-4 h-4" />
            </button>

            {/* Copilot Drawer Trigger */}
            <button 
              onClick={() => setIsCopilotOpen(!isCopilotOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-sm transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Copiloto</span>
            </button>
          </div>
        </header>

        {/* MAIN BODY AREA */}
        <main className="flex-1 overflow-y-auto p-6 bg-zinc-950">
          <div className="max-w-6xl mx-auto">
            {/* Context Header */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Sales Workbench do BDR</h1>
                <p className="text-xs text-zinc-400 mt-1">
                  Fila diária de tarefas de outbound, enriquecidas com contexto de conta e sinais aprovados.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Supabase RLS Ativo
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                  Nostr Removido (Web Puro)
                </span>
              </div>
            </div>

            {/* Operational Table / Queue Preview */}
            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-zinc-800/80 bg-zinc-900/50 flex items-center justify-between text-xs font-medium text-zinc-400">
                <span>Tarefas Prioritárias de Hoje (5 pendentes)</span>
                <span>Canal / Ação</span>
              </div>
              <div className="divide-y divide-zinc-800/60">
                {[
                  { name: 'Dr. Roberto Silveira', role: 'Diretor de Tecnologia', company: 'Hospital São Lucas', score: 94, motion: 'Vaga de Engenharia detectada', channel: 'E-mail D0 (OAuth Gmail)' },
                  { name: 'Mariana Duarte', role: 'Head de Operações', company: 'Logística Express', score: 88, motion: 'Expansão de filial', channel: 'E-mail D0 (OAuth Gmail)' },
                  { name: 'Carlos Mendes', role: 'CFO', company: 'FinTech Mais', score: 85, motion: 'Captação Rodada Série A', channel: 'E-mail D0 (OAuth Gmail)' },
                ].map((item, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between hover:bg-zinc-800/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-md bg-zinc-800 flex items-center justify-center font-bold text-xs text-indigo-400 border border-zinc-700/60">
                        {item.score}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-zinc-200">{item.name} · <span className="font-normal text-zinc-400">{item.role}</span></div>
                        <div className="text-xs text-zinc-500 mt-0.5">{item.company} · <span className="text-indigo-400/90">{item.motion}</span></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400 mr-2">{item.channel}</span>
                      <button className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors">
                        Revisar & Enviar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* 3. COPILOT SIDE-DRAWER */}
      {isCopilotOpen && (
        <aside className="w-96 border-l border-zinc-800 bg-zinc-900/95 flex flex-col shrink-0 shadow-2xl z-50">
          <div className="h-14 px-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-semibold text-zinc-200">Copiloto de Receita</span>
            </div>
            <button 
              onClick={() => setIsCopilotOpen(false)}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] rounded-lg p-3 text-xs leading-relaxed ${
                  msg.sender === 'user' 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-zinc-800 text-zinc-200 border border-zinc-700/60'
                }`}>
                  {msg.text}
                </div>
                <span className="text-[10px] text-zinc-600 mt-1 px-1">{msg.time}</span>
              </div>
            ))}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-zinc-800 bg-zinc-900">
            <div className="relative">
              <input 
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Peça uma análise ou crie uma missão..."
                className="w-full pl-3 pr-9 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
              />
              <button 
                type="submit"
                className="absolute right-1.5 top-1.5 p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-indigo-400 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </aside>
      )}
    </div>
  );
}
