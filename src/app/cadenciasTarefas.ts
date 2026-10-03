// Integração das telas existentes, registrada pela seção final de AlthiusApp.
import type { AlthiusApp } from './AlthiusApp';
import { adiarTarefa, concluirTarefa, criarTarefa, listarTarefas, type NovaTarefa, type Tarefa } from './servicos/tarefas';

const canais={call:'Ligação',email:'E-mail',whatsapp:'WhatsApp',linkedin:'LinkedIn',instagram:'Instagram',outro:'Outro'};
const status={pendente:'Pendente',em_andamento:'Em andamento',concluida:'Concluída'};
class TarefasNaTela {
  private geracao=0;
  private chave='';
  private vivo=true;
  private pronto=false;
  private tarefas:Tarefa[]=[];
  private gravando=false;
  private emMutacao=new Set<string>();
  private pedidoCriacao:{base:string;corpo:string;chave:string}|null=null;
  constructor(private app:AlthiusApp) {}
  sintonizar() {
    const chave=this.app.state.rota.page==='tasks' ? this.app.wsId()+'/tasks' : '';
    if(chave===this.chave) return;
    this.chave=chave; this.geracao++; this.tarefas=[]; this.pronto=false;
    if(chave) void this.carregar();
  }
  encerrar() { this.vivo=false; this.geracao++; }
  private atualizar() { this.app.setState({tarefasVersao:this.geracao}); }
  private async carregar() {
    const geracao=++this.geracao;
    const ws=this.app.props.dados.workspaceNoBanco(this.app.wsId());
    this.pronto=false; this.tarefas=[]; this.atualizar();
    try {
      if(!ws?.membroId) throw new Error('Você não participa deste workspace.');
      const tarefas=await listarTarefas(this.app.props.supabase,ws.uuid);
      if(!this.vivo || geracao!==this.geracao) return;
      this.tarefas=tarefas; this.pronto=true; this.atualizar();
    } catch(erro) {
      if(!this.vivo || geracao!==this.geracao) return;
      this.app.confirmar('Tarefas não carregadas',erro instanceof Error ? erro.message : 'Não foi possível carregar as tarefas.',
        'Tentar de novo',()=>{void this.carregar();});
    }
  }
  private async criar() {
    if(this.gravando) return;
    const app=this.app, t=app.state.tarefa, ws=app.props.dados.workspaceNoBanco(app.wsId());
    if(!t || !ws?.membroId) return;
    const prazo=new Date(t.data+'T'+(t.hora || '10:00')+':00');
    if(!t.titulo?.trim() || !Number.isFinite(prazo.getTime())) {
      app.setState({tarefa:{...t,erro:'Escreva o que precisa ser feito e escolha uma data e hora válidas.'}}); return;
    }
    const nova:NovaTarefa={titulo:t.titulo.trim(),responsavelId:t.responsavelId || ws.membroId,prazo:prazo.toISOString(),
      canal:({Ligação:'call','E-mail':'email',WhatsApp:'whatsapp',LinkedIn:'linkedin',Instagram:'instagram'} as const)[t.canal as 'Ligação'] || 'outro',
      contaId:t.conta || undefined,contatoId:t.contato || undefined,nota:t.nota || undefined,agenteId:t.agente || undefined,
      status:({'Pendente':'pendente','Em andamento':'em_andamento','Concluída':'concluida'} as const)[t.status as 'Pendente']};
    const corpo=JSON.stringify(nova);
    if(this.pedidoCriacao?.base!==t.chave || this.pedidoCriacao?.corpo!==corpo) {
      this.pedidoCriacao={base:t.chave,corpo,chave:crypto.randomUUID()};
    }
    const geracao=this.geracao;
    this.gravando=true; this.atualizar();
    try {
      await criarTarefa(app.props.supabase,ws.uuid,ws.membroId,this.pedidoCriacao.chave,nova);
      if(!this.vivo || geracao!==this.geracao) return;
      app.setState({tarefa:null});
      await this.carregar();
    } catch(erro) {
      if(!this.vivo || geracao!==this.geracao) return;
      app.confirmar('Tarefa não registrada',erro instanceof Error ? erro.message : 'Não foi possível registrar a tarefa.',
        'Tentar de novo',()=>{void this.criar();});
    } finally { this.gravando=false; if(this.vivo) this.atualizar(); }
  }
  private async concluirOuAdiar(tarefaId:string,prazo?:string) {
    if(this.emMutacao.has(tarefaId)) return;
    const app=this.app, ws=app.props.dados.workspaceNoBanco(app.wsId()), geracao=this.geracao;
    if(!ws?.membroId || app.state.rota.page!=='tasks') return;
    this.emMutacao.add(tarefaId);
    try {
      if(prazo) await adiarTarefa(app.props.supabase,ws.membroId,tarefaId,prazo);
      else await concluirTarefa(app.props.supabase,ws.membroId,tarefaId);
      if(!this.vivo || geracao!==this.geracao) return;
      app.setState({modSt:{...app.state.modSt,tasks:{...app.state.modSt?.tasks,aberto:null}}});
      await this.carregar();
    } catch(erro) {
      if(!this.vivo || geracao!==this.geracao) return;
      app.confirmar(prazo ? 'Adiamento não registrado' : 'Conclusão não registrada',erro instanceof Error ? erro.message : 'Não foi possível concluir a tarefa.',
        'Tentar de novo',()=>{void this.concluirOuAdiar(tarefaId,prazo);});
    } finally { this.emMutacao.delete(tarefaId); }
  }
  valores(v:any) {
    if(this.app.state.rota.page!=='tasks' || !v.vModulo) return;
    const app=this.app, ms=app.state.modSt?.tasks || {};
    const todas=this.pronto ? this.tarefas : [];
    const linhas=todas.map(t=>({id:t.id,titulo:t.titulo,tipo:canais[t.canal] || 'Outro',
      conta:(app.state.contas || []).find((c:any)=>c.id===t.contaId)?.nome || 'Sem conta',
      prazo:new Date(t.prazo).toLocaleString('pt-BR'),status:status[t.status],nota:t.nota || ''}));
    const busca=(ms.busca || '').trim().toLocaleLowerCase('pt-BR');
    const visiveis=linhas.filter(l=>(!busca || Object.values(l).some(x=>String(x).toLocaleLowerCase('pt-BR').includes(busca)))
      && (!ms.filtro || ms.filtro==='Todos' || l.tipo===ms.filtro));
    if(ms.ord) visiveis.sort((a,b)=>ms.ord[1]*String(a[ms.ord[0] as keyof typeof a]).localeCompare(String(b[ms.ord[0] as keyof typeof b]),'pt-BR'));
    const selecionar=(id:string|null)=>app.setState({modSt:{...app.state.modSt,tasks:{...ms,aberto:id}}});
    const campos=['titulo','tipo','conta','prazo','status'] as const;
    const abrir=(id:string)=>()=>selecionar(id);
    v.md.temKpis=this.pronto;
    v.md.kpis=this.pronto ? [
      {label:'Pendentes',valor:String(todas.filter(t=>t.status==='pendente').length),delta:''},
      {label:'Em andamento',valor:String(todas.filter(t=>t.status==='em_andamento').length),delta:''},
      {label:'Concluídas',valor:String(todas.filter(t=>t.status==='concluida').length),delta:''}
    ] : [];
    v.md.temFunil=false; v.md.funil=[]; v.md.temAcao=this.pronto;
    v.md.acaoLabel='Nova tarefa';
    v.md.acao=()=>app.setState({tarefa:{chave:crypto.randomUUID(),canal:'Ligação',status:'Pendente',
      responsavelId:app.props.dados.workspaceNoBanco(app.wsId())?.membroId,data:new Date().toLocaleDateString('en-CA'),hora:'10:00'}});
    if(v.tf.aberto) {
      const t=app.state.tarefa, ws=app.props.dados.workspaceNoBanco(app.wsId());
      v.tf.salvar=()=>{void this.criar();}; v.tf.gravando=this.gravando;
      v.tf.resps=app.membros(app.wsId()).filter((m:any)=>!m.pendente && (app.papel()!=='bdr' || m.id===ws?.membroId))
        .map((m:any)=>({nome:m.nome,sigla:m.nome.split(' ').map((n:string)=>n[0]).slice(0,2).join(''),temFoto:false,
          ativo:t.responsavelId===m.id ? 'true':'false',escolher:()=>app.setState({tarefa:{...app.state.tarefa,responsavelId:m.id}})}));
      v.tf.contas=(app.state.contas || []).map((c:any)=>({id:c.id,nome:c.nome}));
    }
    v.md.filtros=['Todos',...new Set(linhas.map(l=>l.tipo))].map(tipo=>({label:tipo,
      n:tipo==='Todos' ? linhas.length : linhas.filter(l=>l.tipo===tipo).length,
      ativo:(ms.filtro || 'Todos')===tipo ? 'true':'false',bg:'var(--paper)',cor:'var(--ink)',borda:'var(--rule)',semFogo:true,
      ir:()=>app.setState({modSt:{...app.state.modSt,tasks:{...ms,filtro:tipo}}})}));
    v.md.vazio=visiveis.length===0; v.md.tabela=visiveis.length>0;
    v.md.linhas=visiveis.map(l=>({abrir:abrir(l.id),tecla:(ev:KeyboardEvent)=>{if(ev.key==='Enter') selecionar(l.id);},bg:'transparent',
      celulas:campos.map((campo,i)=>({v:l[campo],temTexto:true,fs:i===0?'15px':'14px',cor:'var(--ink)',ws:i===0?'normal':'nowrap'}))}));
    const selecionada=linhas.find(l=>l.id===ms.aberto);
    v.md.detalheAberto=!!selecionada; v.md.fechar=()=>selecionar(null);
    const acoes=selecionada && todas.find(t=>t.id===selecionada.id)?.status!=='concluida' ? [{label:'Concluir',
      bg:'var(--ink)',cor:'var(--paper)',borda:'var(--ink)',fn:()=>{void this.concluirOuAdiar(selecionada.id);}},
      {label:'Adiar 1 dia',bg:'var(--paper)',cor:'var(--ink)',borda:'var(--ink)',fn:()=>{
        const prazo=new Date(todas.find(t=>t.id===selecionada.id)!.prazo);
        prazo.setDate(prazo.getDate()+1);
        void this.concluirOuAdiar(selecionada.id,prazo.toISOString());
      }}] : [];
    v.md.det=selecionada ? {titulo:selecionada.titulo,campos:[{label:'Status',v:selecionada.status},{label:'Nota',v:selecionada.nota}],acoes,temAcoes:acoes.length>0} : {campos:[],acoes:[]};
  }
}

/** A restrição de edição do arquivo compartilhado exige registro no final, sem reescrever seus métodos. */
export function ligarCadenciasETarefas(App:typeof AlthiusApp) {
  const controladores=new WeakMap<AlthiusApp,TarefasNaTela>();
  const obter=(app:AlthiusApp)=>{
    let controle=controladores.get(app);
    if(!controle) { controle=new TarefasNaTela(app); controladores.set(app,controle); }
    return controle;
  };
  const montar=App.prototype.componentDidMount, atualizar=App.prototype.componentDidUpdate;
  const desmontar=App.prototype.componentWillUnmount, valores=App.prototype.renderVals;
  App.prototype.componentDidMount=function(){montar.call(this);obter(this).sintonizar();};
  App.prototype.componentDidUpdate=function(props,estado){atualizar.call(this,props,estado);obter(this).sintonizar();};
  App.prototype.componentWillUnmount=function(){obter(this).encerrar();desmontar.call(this);};
  App.prototype.renderVals=function(){const v=valores.call(this);obter(this).valores(v);return v;};
}