// Regras de produto aplicadas sobre o código gerado do protótipo, a cada `npm run v18:sync`.
// Cada patch precisa encontrar o trecho exato; se uma versão nova do design mudar a tela,
// o conversor para com erro e aponta qual regra revisar (nada é perdido em silêncio).

// Nomes de exibição dos agentes (decisão do dono, 2026-10-05). O design v22 traz Venator, Praeco, Stilus e Ratio;
// o produto usa Zoe, Jax, Lia e Neo. Só a exibição muda: os códigos (comercial, marketing, copy, revops) ficam.
// O app marca cada avatar pela sigla (MAPA), então nome, sigla e mapa precisam mudar juntos.
const AGENTES_EXIBICAO = [
  ['Venator', 'Zoe', 'VE', 'ZO'],
  ['Praeco', 'Jax', 'PR', 'JA'],
  ['Stilus', 'Lia', 'ST', 'LI'],
  ['Ratio', 'Neo', 'RA', 'NE']
];
function renomearAgentes(regra) {
  return texto => {
    let trocas = 0;
    const troca = (re, por) => { texto = texto.replace(re, (...m) => { trocas++; return typeof por === 'function' ? por(...m) : por; }); };
    for (const [velho, novo, siglaVelha, siglaNova] of AGENTES_EXIBICAO) {
      troca(new RegExp(`\\b${velho}\\b`, 'g'), novo);
      troca(new RegExp(`sigla: '${siglaVelha}'`, 'g'), `sigla: '${siglaNova}'`);
      troca(new RegExp(`\\|\\| '${siglaVelha}'`, 'g'), `|| '${siglaNova}'`);
    }
    troca(/\{ VE: 'comercial', PR: 'marketing', ST: 'copy', RA: 'revops' \}/g, "{ ZO: 'comercial', JA: 'marketing', LI: 'copy', NE: 'revops' }");
    // "Do latim, o caçador: vai atrás das contas certas" deixa de fazer sentido com nomes que não são latinos.
    troca(/latim: 'Do latim, [^:']*: ([^']*)'/g, (_m, resto) => `latim: '${resto.charAt(0).toUpperCase()}${resto.slice(1)}'`);
    if (trocas === 0) throw new Error(`Regra "${regra}": não achei nenhum nome de agente. O design mudou? Revise scripts/v18/patches.mjs.`);
    return texto;
  };
}

export const PATCHES = [
  {
    regra: 'modo real: saldo de creditos vem da carteira',
    arquivo: 'logic.generated.js',
    trocar: 'saldo() { return this.extrato().reduce((s, e) => s + (e.tipo === \'entrada\' ? e.cr : -e.cr), 0); }',
    por: 'saldo() { if (typeof this.state.saldoCreditos === \'number\') return this.state.saldoCreditos; return this.extrato().reduce((s, e) => s + (e.tipo === \'entrada\' ? e.cr : -e.cr), 0); }'
  },
  {
    regra: 'modo real: regras de creditos gravam no banco',
    arquivo: 'logic.generated.js',
    trocar: 'setCfg = o => this.setState({ credCfg: Object.assign({}, this.credCfg(), o) })',
    por: 'setCfg = o => this.modoDemo === false && this.salvarPoliticaCreditos ? this.salvarPoliticaCreditos(o) : this.setState({ credCfg: Object.assign({}, this.credCfg(), o) })'
  },
  {
    regra: 'modo real: compra ou pedido de creditos passa pelo banco',
    arquivo: 'logic.generated.js',
    trocar: "const comprar = n => { const preco = 'US$ ' + (n * VAL).toLocaleString('pt-BR'); if (!podeComprar) {",
    por: "const comprar = n => { if (this.modoDemo === false && this.comprarOuPedirCreditos) return this.comprarOuPedirCreditos(n); const preco = 'US$ ' + (n * VAL).toLocaleString('pt-BR'); if (!podeComprar) {"
  },
  {
    regra: 'modo real: conectar conta de mensagem pelo assistente hospedado (nao ha QR simulado)',
    arquivo: 'logic.generated.js',
    trocar: "else this.setState({ ixCon: { k, via: 'gmail' } }); } }; });",
    por: "else if (this.modoDemo === false && k !== 'email') this.conectarContaReal(k); else this.setState({ ixCon: { k, via: 'gmail' } }); } }; });"
  },
  {
    regra: 'modo real: o e-mail escolhe Gmail ou Outlook e segue para o assistente hospedado',
    arquivo: 'logic.generated.js',
    trocar: "confirmar: () => { this.setState({ ixCon: Object.assign({}, x, { ocupado: true }) });",
    por: "confirmar: () => { if (this.modoDemo === false) return this.conectarContaReal(x.k, x.via); this.setState({ ixCon: Object.assign({}, x, { ocupado: true }) });"
  },
  {
    regra: 'modo real: desconectar grava no banco',
    arquivo: 'logic.generated.js',
    trocar: "'Desconectar', () => { setIC(k, null);",
    por: "'Desconectar', () => { if (this.modoDemo === false) return this.desconectarContaReal(k, c); setIC(k, null);"
  },
  {
    regra: 'modo real: mover card grava no banco (historico com quem moveu)',
    arquivo: 'logic.generated.js',
    trocar: "const moverCard = (id, col, antes) => { let msg = '';",
    por: "const moverCard = (id, col, antes) => { let msg = ''; if (this.modoDemo === false) { fimDrag(); return this.moverNegocioReal(id, col, antes); }"
  },
  {
    regra: 'modo real: reordenar etapas do quadro grava no banco',
    arquivo: 'logic.generated.js',
    trocar: "const moverEtapa = (k, antes) => { if (k === antes || k === 'ganho') { fimDrag(); return; } this.mudarPipe(",
    por: "const moverEtapa = (k, antes) => { if (k === antes || k === 'ganho') { fimDrag(); return; } if (this.modoDemo === false) { const o = (q.ordem || ETAPAS).filter(x => x !== k); let j = o.indexOf(antes); if (j < 0 || antes === 'ganho') j = o.indexOf('ganho'); o.splice(j, 0, k); fimDrag(); return this.reordenarEtapasReal(q.id, o); } this.mudarPipe("
  },
  {
    regra: 'modo real: novo quadro grava no banco',
    arquivo: 'logic.generated.js',
    trocar: "novoQuadro: () => { const id = 'q-' + mot + '-' + Date.now(); const nome = 'Novo quadro ' + (qs.length + 1); this.mudarPipe(",
    por: "novoQuadro: () => { const id = 'q-' + mot + '-' + Date.now(); const nome = 'Novo quadro ' + (qs.length + 1); if (this.modoDemo === false) return this.novoQuadroReal(mot, nome); this.mudarPipe("
  },
  {
    regra: 'modo real: renomear quadro grava no banco',
    arquivo: 'logic.generated.js',
    trocar: "salvarNome: () => { const n = (this.state.pipeNome || '').trim() || q.nome; this.mudarPipe(",
    por: "salvarNome: () => { const n = (this.state.pipeNome || '').trim() || q.nome; if (this.modoDemo === false) return this.renomearQuadroReal(q.id, n); this.mudarPipe("
  },
  {
    regra: 'modo real: excluir quadro grava no banco',
    arquivo: 'logic.generated.js',
    trocar: "'Excluir quadro', () => { this.mudarPipe(",
    por: "'Excluir quadro', () => { if (this.modoDemo === false) return this.excluirQuadroReal(q.id); this.mudarPipe("
  },
  {
    regra: 'modo real: remover negocio arquiva no banco',
    arquivo: 'logic.generated.js',
    trocar: "'Remover', () => { this.mudarPipe(p => { const b = p.quadros[p.motion].find(x => x.id === q.id); b.deals = b.deals.filter(d => d.id !== c.id); });",
    por: "'Remover', () => { if (this.modoDemo === false) return this.arquivarNegocioReal(c.id); this.mudarPipe(p => { const b = p.quadros[p.motion].find(x => x.id === q.id); b.deals = b.deals.filter(d => d.id !== c.id); });"
  },
  {
    regra: 'modo real: salvar negocio grava no banco',
    arquivo: 'logic.generated.js',
    trocar: "const d = { cid: x.cid || null, conta: x.conta, dono: x.dono,",
    por: "if (this.modoDemo === false) return this.salvarNegocioReal(x, q.id); const d = { cid: x.cid || null, conta: x.conta, dono: x.dono,"
  },
  {
    regra: 'modo real: criar tarefa grava no banco',
    arquivo: 'logic.generated.js',
    trocar: "const [yy, mm, dd] = x.data.split('-'), hoje =",
    por: "if (this.modoDemo === false) return this.criarTarefaReal(x); const [yy, mm, dd] = x.data.split('-'), hoje ="
  },
  {
    regra: 'modo real: carga inicial protegida contra troca de workspace',
    arquivo: 'logic.generated.js',
    trocar: 'return Promise.all([D.homeService.summary(), D.agentService.list(), D.executionService.list(), D.approvalService.list(), D.notificationService.list()]);',
    por: 'return this.carregarDadosIniciais ? this.carregarDadosIniciais() : Promise.all([D.homeService.summary(), D.agentService.list(), D.executionService.list(), D.approvalService.list(), D.notificationService.list()]);'
  },
  {
    regra: 'modo real: carga inicial é publicada pela camada do banco',
    arquivo: 'logic.generated.js',
    trocar: '.then(([home, agents, execs, aprov, notifs]) => this.setState({ home, agents, execs, aprov, notifs, pronto: true, carregandoRota: false }))',
    por: '.then(resultado => { if (resultado) { const [home, agents, execs, aprov, notifs] = resultado; this.setState({ home, agents, execs, aprov, notifs, pronto: true, carregandoRota: false }); } })'
  },
  {
    regra: 'modo real: controles de execução passam pelo serviço do banco',
    arquivo: 'logic.generated.js',
    trocar: "const muda = (status, msg) => () => { this.setState({ execs:",
    por: "const muda = (status, msg) => () => { if (this.modoDemo === false) return this.D.executionService.control(e.id, status); this.setState({ execs:"
  },
  {
    regra: 'modo real: repetir execução cria pedido pelo Hermes',
    arquivo: 'logic.generated.js',
    trocar: "() => this.avisar('exec', 'Nova execução criada na fila.')",
    por: "() => this.modoDemo === false ? this.D.executionService.repeat(e.id) : this.avisar('exec', 'Nova execução criada na fila.')"
  },
  // --- Créditos: o cliente só vê créditos, nunca dólar (ADR 0021) -----------------------
  {
    regra: 'créditos sem dólar: conversão para US$ removida; preço de pacote em reais',
    arquivo: 'logic.generated.js',
    trocar: "usd = n => 'US$ ' + (n * VAL).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })",
    por: "usd = n => '', brl = n => precoEmReais(n)"
  },
  {
    regra: 'créditos sem dólar: KPI "Valor do crédito" vira consumo médio por dia',
    arquivo: 'logic.generated.js',
    trocar: "{ label: 'Valor do crédito', valor: 'US$ 0,005', delta: '200 créditos = US$ 1' }",
    por: "{ label: 'Consumo por dia', valor: nf(porDia), delta: 'média do ciclo' }"
  },
  {
    regra: 'créditos sem dólar: KPIs de saldo, entrada e saída sem valor em dólar',
    arquivo: 'logic.generated.js',
    trocar: "[{ label: 'Saldo', valor: nf(saldo), delta: usd(saldo) }, { label: 'Entrou', valor: nf(entrou), delta: usd(entrou) }, { label: 'Saiu', valor: nf(saiu), delta: usd(saiu) },",
    por: "[{ label: 'Saldo', valor: nf(saldo), delta: 'créditos disponíveis' }, { label: 'Entrou', valor: nf(entrou), delta: 'créditos no ciclo' }, { label: 'Saiu', valor: nf(saiu), delta: 'créditos usados' },"
  },
  {
    regra: 'créditos sem dólar: pedido/compra de créditos com preço em reais',
    arquivo: 'logic.generated.js',
    trocar: "const preco = 'US$ ' + (n * VAL).toLocaleString('pt-BR');",
    por: 'const preco = brl(n);'
  },
  {
    regra: 'créditos sem dólar: pacotes com preço em reais',
    arquivo: 'logic.generated.js',
    trocar: "preco: 'US$ ' + (n * VAL).toLocaleString('pt-BR'),",
    por: 'preco: brl(n),'
  },
  {
    regra: 'créditos sem dólar: import do preço em reais',
    arquivo: 'logic.generated.js',
    trocar: "import { renderTemplate } from './template.generated';",
    por: "import { renderTemplate } from './template.generated';\nimport { precoEmReais } from '../app/precos';"
  },
  {
    regra: 'créditos sem dólar: cabeçalho do saldo',
    arquivo: 'template.generated.tsx',
    trocar: '{"1 crédito = US$ 0,005"}',
    por: '{"Franquia mensal + recargas"}'
  },
  {
    regra: 'créditos sem dólar: saldo sem equivalência em dólar',
    arquivo: 'template.generated.tsx',
    trocar: '{"créditos · "}{__t($v.cr?.saldoUsd)}',
    por: '{"créditos"}'
  },
  {
    regra: 'créditos sem dólar: uso por agente sem dólar',
    arquivo: 'template.generated.tsx',
    trocar: '{__t(a?.creditos)}{" · "}{__t(a?.usd)}',
    por: '{__t(a?.creditos)}'
  },
  {
    regra: 'créditos sem dólar: tabela "como os agentes gastam" sem dólar por ação',
    arquivo: 'logic.generated.js',
    trocar: "usd: typeof c === 'number' ? 'US$ ' + (c * VAL).toLocaleString('pt-BR', { minimumFractionDigits: 3 }) : '—'",
    por: "usd: ''"
  },
  {
    regra: 'créditos sem dólar: lançamento inicial do extrato',
    arquivo: 'logic.generated.js',
    trocar: "quem: 'Althius · US$ 50'",
    por: "quem: 'Althius · franquia mensal'"
  },
  {
    regra: 'créditos sem dólar: texto de boas-vindas do saldo',
    arquivo: 'template.generated.tsx',
    trocar: 'Todo workspace começa com 10.000 créditos (US$ 50).',
    por: 'Todo workspace começa com 10.000 créditos por mês.'
  },
  {
    regra: 'créditos sem dólar: recarga automática',
    arquivo: 'template.generated.tsx',
    trocar: '{"Abaixo de 1.000, compra 10.000 créditos (US$ 50)."}',
    por: '{"Abaixo de 1.000, compra 10.000 créditos."}'
  },
  {
    regra: 'créditos sem dólar: subtítulo da tela de créditos',
    arquivo: 'module.js',
    trocar: "sub: '1 crédito = US$ 0,005 · tudo que entra e sai'",
    por: "sub: 'Tudo que entra e sai, em créditos'"
  },
  {
    regra: 'créditos sem dólar: coluna "Em dólar" removida do uso por agente',
    arquivo: 'module.js',
    trocar: " ['custo', 'Em dólar', '1fr'],",
    por: ''
  },

  // --- Login real: troca de papel existe só no modo demonstração -------------------------
  {
    regra: 'modo real: esconder "Modo demonstração · papel" do menu do avatar',
    arquivo: 'template.generated.tsx',
    aplicar: texto => {
      const rotulo = texto.indexOf('{"Modo demonstração · papel"}');
      if (rotulo < 0 || texto.indexOf('{"Modo demonstração · papel"}', rotulo + 1) >= 0) throw new Error('Regra "modo demonstração": rótulo não encontrado (ou repetido) no template.');
      const inicio = texto.lastIndexOf('<div ', rotulo);
      const fimLista = texto.indexOf('</React.Fragment>))}', rotulo);
      const fim = texto.indexOf('</div>', fimLista) + '</div>'.length;
      if (inicio < 0 || fimLista < 0 || fim < fimLista) throw new Error('Regra "modo demonstração": estrutura do bloco mudou.');
      return texto.slice(0, inicio) + '{$v.modoDemo !== false ? (<>' + texto.slice(inicio, fim) + '</>) : null}' + texto.slice(fim);
    }
  },
  {
    regra: 'modo real: tirar "Ver como <papel>" da busca rápida (Ctrl K)',
    arquivo: 'logic.generated.js',
    trocar: "Object.keys(D.ROLES).forEach(k => itens.push({ label: 'Ver como '",
    por: "if (this.modoDemo !== false) Object.keys(D.ROLES).forEach(k => itens.push({ label: 'Ver como '"
  },

  // --- Papel por workspace: na tela de membros vale o papel no workspace escolhido ----------
  {
    regra: 'membros: alçada calculada pelo papel no workspace selecionado (não o da rota)',
    arquivo: 'logic.generated.js',
    trocar: "const P = this.PAPEL_INFO, admin = papel === 'superadmin' || papel === 'estrategista' || papel === 'cliente';",
    por: "const papelCfg = this.papelEm ? this.papelEm(wsCfg) : papel, P = this.PAPEL_INFO, admin = papelCfg === 'superadmin' || papelCfg === 'estrategista' || papelCfg === 'cliente';"
  },
  {
    regra: 'membros: papéis que a pessoa pode dar seguem o papel no workspace selecionado',
    arquivo: 'logic.generated.js',
    trocar: "cliente: ['cliente', 'bdr'], bdr: [] }[papel];",
    por: "cliente: ['cliente', 'bdr'], bdr: [] }[papelCfg];"
  },

  // ---- Agentes (Claude): pausar e capacidades gravam no banco
  {
    regra: 'agentes: pausar/retomar grava no banco (botão de quem configura e do C-level)',
    arquivo: 'logic.generated.js',
    aplicar: texto => {
      const alvo = "'Pausar agente', () => {";
      const n = texto.split(alvo).length - 1;
      if (n !== 2) throw new Error('Regra "agentes: pausar": esperava 2 botões de pausa, achei ' + n + '.');
      return texto.split(alvo).join(alvo + ' if (this.modoDemo === false) return this.pausarAgenteReal(a);');
    }
  },
  {
    regra: 'agentes: ligar/desligar capacidade grava no banco',
    arquivo: 'logic.generated.js',
    trocar: 'alternar: () => this.setState({ caps: Object.assign({}, st.caps, { [a.id]:',
    por: 'alternar: () => this.modoDemo === false ? this.salvarCapacidadeReal(a, k, !capsAg[k]) : this.setState({ caps: Object.assign({}, st.caps, { [a.id]:'
  },
  {
    regra: 'agentes: sem execuções a taxa de sucesso aparece como "—", sem "%" solto',
    arquivo: 'template.generated.tsx',
    trocar: '{__t($v.ag?.sucesso)}{"%"}',
    por: '{__t($v.ag?.sucesso)}{typeof $v.ag?.sucesso === "number" ? "%" : ""}'
  },

  // ---- Listas genéricas (Claude): botão principal da página e formulário simples (ADR 0030)
  {
    regra: 'listas: botão principal da página passa pela camada do banco quando ela trata a página',
    arquivo: 'logic.generated.js',
    trocar: "md.acao = () => { if (page === 'tasks') {",
    por: "md.acao = () => { if (this.modoDemo === false && this.acaoDaPaginaReal && this.acaoDaPaginaReal(page)) return; if (page === 'tasks') {"
  },
  {
    regra: 'listas: formulário simples dentro da lista (campos, erro, salvar e cancelar) quando md.form existe',
    arquivo: 'template.generated.tsx',
    aplicar: texto => {
      const marca = '{$v.md?.temPorConta ? (<>';
      if (texto.split(marca).length !== 2) throw new Error('Regra "formulário da lista": ponto de inserção não encontrado (ou repetido).');
      const form = `{$v.md?.form ? (<section aria-label={$v.md.form.titulo} style={{"display":"flex","flexDirection":"column","gap":"12px","padding":"18px","border":"1px solid var(--steel)","borderRadius":"12px","background":"var(--paper)"}}>
                  <h2 style={{"fontFamily":"var(--f-display)","margin":"0","fontWeight":"400","fontSize":"18px"}}>{__t($v.md.form.titulo)}</h2>
                  <div className={"cfg-grid"}>
                    {__arr($v.md.form.campos).map((c, $index) => (<label key={$index} className={"cfg-campo"}><span>{__t(c?.label)}</span><input value={__val(c?.valor)} onChange={c?.mudar} placeholder={c?.placeholder} type={c?.tipo || "text"} /></label>))}
                  </div>
                  {$v.md.form.erro ? (<p role="alert" style={{"margin":"0","color":"var(--err)","fontSize":"14px"}}>{__t($v.md.form.erro)}</p>) : null}
                  <div className={"cfg-acoes"}>
                    <button className={"b-pri cfg-salvar"} onClick={$v.md.form.salvar}>{__t($v.md.form.salvarLabel)}</button>
                    <button className={"b-sec mini-btn"} onClick={$v.md.form.cancelar} style={{"height":"38px"}}>{"Cancelar"}</button>
                  </div>
                </section>) : null}
                `;
      return texto.replace(marca, () => form + marca);
    }
  },

  // ---- Listas genéricas (Claude): ganchos para abrir linha e ações de linha gravarem no banco
  {
    regra: 'listas: abrir uma linha avisa a camada do banco (ex.: conversa vira lida)',
    arquivo: 'logic.generated.js',
    trocar: "const abrir = l => () => { if (page === 'accounts') { this.abrirConta(l.id, 'comite'); return; } setMs({ aberto: l.id }); };",
    por: "const abrir = l => () => { if (page === 'accounts') { this.abrirConta(l.id, 'comite'); return; } if (this.modoDemo === false && this.aoAbrirLinhaReal) this.aoAbrirLinhaReal(page, l); setMs({ aberto: l.id }); };"
  },
  {
    regra: 'listas: ação de linha passa pela camada do banco quando ela trata a página',
    arquivo: 'logic.generated.js',
    trocar: "fn: () => { const run = () => { if (a[2] === 'avancar' && M.grupos)",
    por: "fn: () => { const run = () => { if (this.modoDemo === false && this.acaoDeLinhaReal && this.acaoDeLinhaReal(page, a[0], sel)) { setMs({ aberto: null }); return; } if (a[2] === 'avancar' && M.grupos)"
  },

  {
    regra: 'caixa de entrada: no modo real quem vê cada conversa é o banco (RLS), não as conexões de quem olha',
    arquivo: 'logic.generated.js',
    trocar: "(page !== 'inbox' || !IXK[l.canal] || !!ixOn[IXK[l.canal]])",
    por: "(page !== 'inbox' || this.modoDemo === false || !IXK[l.canal] || !!ixOn[IXK[l.canal]])"
  },

  // ---- Canais (Claude): canais e mensagens no banco; agente chamado vira pedido, sem resposta inventada
  {
    regra: 'canais: no modo real as mensagens vêm do banco (sem as de exemplo do protótipo)',
    arquivo: 'logic.generated.js',
    trocar: 'const msgsCanal = (st.canalMsgs[canal.id] || MSGS[canal.id] || []);',
    por: 'const msgsCanal = (st.canalMsgs[canal.id] || (this.modoDemo === false ? null : MSGS[canal.id]) || []);'
  },
  {
    regra: 'canais: enviar grava no banco e chamar agente vira pedido pela política Hermes',
    arquivo: 'logic.generated.js',
    trocar: "const t = (this.state.canalTexto || '').trim(); if (!t) return;",
    por: "const t = (this.state.canalTexto || '').trim(); if (!t) return; if (this.modoDemo === false) return this.enviarNoCanalReal(canal, t);"
  },
  {
    regra: 'canais: criar e mudar canal gravam no banco',
    arquivo: 'logic.generated.js',
    trocar: 'salvar: () => { const x = this.state.canalModal;',
    por: 'salvar: () => { const x = this.state.canalModal; if (this.modoDemo === false) return this.salvarCanalReal(x, ed);'
  },
  {
    regra: 'canais: arquivar canal grava no banco (mensagens ficam guardadas)',
    arquivo: 'logic.generated.js',
    trocar: "'Arquivar', () => { this.setState({ canais: this.canais().filter(c => c.id !== cm.id), canalModal: null });",
    por: "'Arquivar', () => { if (this.modoDemo === false) return this.arquivarCanalReal(cm.id); this.setState({ canais: this.canais().filter(c => c.id !== cm.id), canalModal: null });"
  },
  {
    regra: 'canais: editar a própria mensagem grava no banco',
    arquivo: 'logic.generated.js',
    trocar: 'const nova = msgsCanal.map((x, j) => j === idxEdit',
    por: "if (this.modoDemo === false) { this.setState({ editMsg: null, editTexto: '' }); return this.editarMensagemReal(canal, msgsCanal[idxEdit], t); } const nova = msgsCanal.map((x, j) => j === idxEdit"
  },
  {
    regra: 'canais: reagir grava no banco',
    arquivo: 'logic.generated.js',
    trocar: 'const reagir = emoji => () => {',
    por: 'const reagir = emoji => () => { if (this.modoDemo === false) return this.reagirReal(canal, m, emoji);'
  },

  // ---- Copiloto (Claude): pedido vira execução na fila; o plano e o progresso simulados não aparecem
  {
    regra: 'copiloto: no modo real o pedido vai para a fila pela política Hermes (sem plano encenado)',
    arquivo: 'logic.generated.js',
    trocar: "const iniciar = t => { const tx = (t || '').trim(); if (!tx) return;",
    por: "const iniciar = t => { const tx = (t || '').trim(); if (!tx) return; if (this.modoDemo === false) return this.pedirAoCopilotoReal(tx);"
  },

  // ---- Playbook do agente (Claude): sugestões dos agentes e publicação gravam no banco (ADR 0024)
  {
    regra: 'playbook: aplicar sugestão registra a decisão no banco (o texto entra no rascunho)',
    arquivo: 'logic.generated.js',
    trocar: 'aplicar: () => { const linha = s.mudanca',
    por: "aplicar: () => { if (this.modoDemo === false) this.decidirSugestaoReal(s.id, 'aplicada'); const linha = s.mudanca"
  },
  {
    regra: 'playbook: descartar sugestão registra a decisão no banco',
    arquivo: 'logic.generated.js',
    trocar: 'descartar: () => gravar({ descartadas: descartadas.concat([s.id]) }) }))',
    por: "descartar: () => this.modoDemo === false ? this.decidirSugestaoReal(s.id, 'descartada') : gravar({ descartadas: descartadas.concat([s.id]) }) }))"
  },
  {
    regra: 'playbook: publicar cria a versão nova no banco',
    arquivo: 'logic.generated.js',
    trocar: 'salvar: () => { const t = (((this.state.pb || {})[a.id] || {}).rascunho);',
    por: 'salvar: () => { const t = (((this.state.pb || {})[a.id] || {}).rascunho); if (this.modoDemo === false) return this.publicarPlaybookReal(a, t !== undefined ? t : publicado);'
  },

  // ---- Configurações (Claude): Minha conta e Notificações gravam no banco
  {
    regra: 'configurações: salvar nome, cargo e telefone grava no perfil',
    arquivo: 'logic.generated.js',
    trocar: "salvar: () => this.avisarCfg('Dados salvos.'),",
    por: "salvar: () => this.modoDemo === false ? this.salvarMinhaContaReal() : this.avisarCfg('Dados salvos.'),"
  },
  {
    // Antes do perfil chegar do banco, o campo Cargo mostrava o papel do sistema (BDR/SDR) como se fosse o cargo.
    regra: 'configurações: cargo não mostra o papel do sistema enquanto o perfil carrega',
    arquivo: 'logic.generated.js',
    trocar: 'cargo: pf.cargo !== undefined ? pf.cargo : U.label,',
    por: "cargo: pf.cargo !== undefined ? pf.cargo : (this.modoDemo === false ? '' : U.label),"
  },
  {
    regra: 'configurações: foto vai para o depósito de fotos',
    arquivo: 'logic.generated.js',
    trocar: 'trocarFoto: e => { const f = e.target.files && e.target.files[0]; if (!f) return;',
    por: 'trocarFoto: e => { const f = e.target.files && e.target.files[0]; if (!f) return; if (this.modoDemo === false) return this.trocarFotoReal(f);'
  },
  {
    regra: 'configurações: remover foto limpa o perfil',
    arquivo: 'logic.generated.js',
    trocar: "removerFoto: () => { this.setState({ minhaFoto: '' });",
    por: "removerFoto: () => { if (this.modoDemo === false) return this.removerFotoReal(); this.setState({ minhaFoto: '' });"
  },
  {
    regra: 'configurações: alterar senha confere a atual e troca no login',
    arquivo: 'logic.generated.js',
    trocar: "this.setState({ senha: {} }); this.avisarCfg('Senha alterada. Os outros dispositivos vão pedir login de novo.'); }",
    por: "if (this.modoDemo === false) return this.alterarSenhaReal(s); this.setState({ senha: {} }); this.avisarCfg('Senha alterada. Os outros dispositivos vão pedir login de novo.'); }"
  },
  {
    regra: 'configurações: sair dos outros dispositivos encerra as sessões de verdade',
    arquivo: 'logic.generated.js',
    trocar: "sairOutras: () => this.avisarCfg('Você saiu dos outros dispositivos.')",
    por: "sairOutras: () => this.modoDemo === false ? this.sairOutrosReal() : this.avisarCfg('Você saiu dos outros dispositivos.')"
  },
  {
    regra: 'configurações: preferências de notificação gravam no perfil',
    arquivo: 'logic.generated.js',
    trocar: 'alternar: () => this.setState({ ops: Object.assign({}, this.state.ops, { [k]: !this.state.ops[k] }) })',
    por: 'alternar: () => this.modoDemo === false ? this.alternarPreferenciaReal(k) : this.setState({ ops: Object.assign({}, this.state.ops, { [k]: !this.state.ops[k] }) })'
  },
  {
    regra: 'configurações: verificação em duas etapas some no modo real até existir de verdade',
    arquivo: 'template.generated.tsx',
    aplicar: texto => {
      const rotulo = texto.indexOf('aria-label="Verificação em duas etapas"');
      if (rotulo < 0 || texto.indexOf('aria-label="Verificação em duas etapas"', rotulo + 1) >= 0) throw new Error('Regra "duas etapas": botão não encontrado (ou repetido).');
      const inicio = texto.lastIndexOf('<div className={"cfg-row cfg-row-line"}>', rotulo);
      const fimBotao = texto.indexOf('</button>', rotulo);
      const fim = texto.indexOf('</div>', fimBotao) + '</div>'.length;
      if (inicio < 0 || fimBotao < 0 || fim < fimBotao) throw new Error('Regra "duas etapas": estrutura do bloco mudou.');
      return texto.slice(0, inicio) + '{$v.modoDemo !== false ? (<>' + texto.slice(inicio, fim) + '</>) : null}' + texto.slice(fim);
    }
  },

  // ---- Nomes de exibição dos agentes: Zoe, Jax, Lia e Neo
  ...['data.js', 'module.js', 'logic.generated.js', 'template.generated.tsx'].map(arquivo => ({
    regra: `agentes: nomes de exibição Zoe, Jax, Lia e Neo (${arquivo})`,
    arquivo,
    aplicar: renomearAgentes(`agentes: nomes de exibição (${arquivo})`)
  })),

  // ---- Início sem dado inventado (modo real): o mapa usa as contas do banco.
  // O protótipo tinha uma distribuição fixa por estado, filtros de "30/60 dias" que aplicavam 36% e 61% sobre ela,
  // "27 estados" e "contas sem endereço" fixos. No banco só existe a contagem por estado (não há data de sinal).
  {
    regra: 'início real: o mapa não usa período inventado',
    arquivo: 'logic.generated.js',
    trocar: "const per = st.mapaPer || '30', uSel",
    por: "const per = this.modoDemo === false ? 'tudo' : (st.mapaPer || '30'), uSel"
  },
  {
    regra: 'início real: o mapa conta as contas do banco por estado',
    arquivo: 'logic.generated.js',
    trocar: 'const n = MAPA_DIST[u.uf] || 0;',
    por: 'const n = (this.modoDemo === false ? ((h && h.mapa) || {}) : MAPA_DIST)[u.uf] || 0;'
  },
  {
    regra: 'início real: o mapa diz quantos estados têm conta de verdade',
    arquivo: 'logic.generated.js',
    trocar: "' · 27 estados';",
    por: "' · ' + (this.modoDemo === false ? MAPA_UFS.filter(u => cont[u.uf] > 0).length : 27) + ' estados';"
  },
  {
    regra: 'início real: contas sem endereço vêm do banco',
    arquivo: 'logic.generated.js',
    trocar: "m.semLocal = per === '30' ? 5 : per === '60' ? 9 : 14;",
    por: "m.semLocal = this.modoDemo === false ? ((h && h.semLocalizacao) || 0) : (per === '30' ? 5 : per === '60' ? 9 : 14);"
  },
  {
    regra: 'início real: sem seletor de período do mapa (não há data de sinal no banco)',
    arquivo: 'template.generated.tsx',
    aplicar: texto => {
      const abre = '<div className={"seg seg-li"} role="radiogroup" aria-label="Período do mapa">';
      const inicio = texto.indexOf(abre);
      const fim = texto.indexOf('</div>', inicio) + '</div>'.length;
      if (inicio < 0 || texto.indexOf(abre, inicio + 1) >= 0 || fim < inicio + abre.length) throw new Error('Regra "período do mapa": estrutura do bloco mudou.');
      return texto.slice(0, inicio) + '{$v.modoDemo !== false ? (' + texto.slice(inicio, fim) + ') : null}' + texto.slice(fim);
    }
  },

  // As listas de contas dos modais de negócio e de tarefa vinham fixas no desenho (a1…a8, as contas do protótipo).
  // Passam a vir das contas do workspace (as do banco, no modo real).
  ...[['pd', 'Escolha a conta'], ['tf', 'Sem conta']].map(([modal, vazio]) => ({
    regra: `contas do modal ${modal} vêm do workspace (não fixas no desenho)`,
    arquivo: 'template.generated.tsx',
    aplicar: texto => {
      const abre = `<select className={"cfg-select"} value={__val($v.${modal}?.conta)} onChange={$v.${modal}?.mudarConta} style={{"height":"40px"}}>`;
      const inicio = texto.indexOf(abre);
      const fim = texto.indexOf('</select>', inicio);
      if (inicio < 0 || fim < 0 || texto.indexOf(abre, inicio + 1) >= 0 || !texto.slice(inicio, fim).includes(`{"${vazio}"}`)) throw new Error(`Regra "contas do modal ${modal}": estrutura do bloco mudou.`);
      const opcoes = `<option value={__val("")}>{"${vazio}"}</option>{__arr($v.${modal}?.contasOpc).map((o, $index) => (<option key={$index} value={__val(o?.id)}>{__t(o?.nome)}</option>))}`;
      return texto.slice(0, inicio) + abre + opcoes + texto.slice(fim);
    }
  })),
  {
    regra: 'lista de contas do modal de negocio vem de MOD.accounts',
    arquivo: 'logic.generated.js',
    trocar: "v.pd = { aberto: true, titulo: c.novo ?",
    por: "v.pd = { contasOpc: contas.map(a => ({ id: a.id, nome: a.nome })), aberto: true, titulo: c.novo ?"
  },
  {
    regra: 'lista de contas do modal de tarefa vem de MOD.accounts',
    arquivo: 'logic.generated.js',
    trocar: "v.tf = { aberto: true, titulo: t.titulo || '',",
    por: "v.tf = { contasOpc: contas.map(a => ({ id: a.id, nome: a.nome })), aberto: true, titulo: t.titulo || '',"
  },

  {
    regra: 'formulario generico das listas aceita lista de opcoes e texto longo',
    arquivo: 'template.generated.tsx',
    aplicar: texto => {
      const velho = '<input value={__val(c?.valor)} onChange={c?.mudar} placeholder={c?.placeholder} type={c?.tipo || "text"} />';
      if (texto.split(velho).length !== 2) throw new Error('Regra "formulario generico": o campo do formulario mudou.');
      const novo = '{c?.opcoes ? (<select className={"cfg-select"} value={__val(c?.valor)} onChange={c?.mudar}>{__arr(c?.opcoes).map((o, $i) => (<option key={$i} value={__val(o?.valor)}>{__t(o?.label)}</option>))}</select>) : c?.longo ? (<textarea value={__val(c?.valor)} onChange={c?.mudar} placeholder={c?.placeholder} rows={4} />) : (' + velho + ')}';
      return texto.replace(velho, () => novo);
    }
  },
  {
    regra: 'modo real: cadencia por conta (plano padrao do desenho) nao aparece na lista',
    arquivo: 'logic.generated.js',
    trocar: "md.temPorConta = page === 'cadences' && !vazio;",
    por: "md.temPorConta = page === 'cadences' && !vazio && this.modoDemo !== false;"
  },

  // ---- Aprendizado compartilhado entre contas (Claude, ADR 0052): seção em Configurações + botão "Agora não" no aviso
  {
    regra: 'aprendizado: nova seção "Aprendizado" em Configurações (menos para o BDR)',
    arquivo: 'logic.generated.js',
    trocar: "['Agentes', 'Configuração por agente']].filter(s => papel !== 'bdr'",
    por: "['Agentes', 'Configuração por agente'], ['Aprendizado', 'Compartilhar para melhorar os agentes']].filter(s => papel !== 'bdr'"
  },
  {
    regra: 'aprendizado: descrição da seção',
    arquivo: 'logic.generated.js',
    trocar: "const DESC = { 'Minha conta':",
    por: "const DESC = { 'Aprendizado': 'Ajude os agentes a aprender mais rápido, com o que funciona em contas parecidas com a sua.', 'Minha conta':"
  },
  {
    regra: 'aprendizado: dados da seção vêm da camada do app (banco no modo real, local na demonstração)',
    arquivo: 'logic.generated.js',
    trocar: "v.cfgToggles = secAtual === 'Notificações';",
    por: "v.cfgToggles = secAtual === 'Notificações'; v.cfgAprendizado = secAtual === 'Aprendizado'; v.aprendizado = this.aprendizadoTela ? this.aprendizadoTela() : { titulo: 'Ajudar a melhorar o aprendizado dos agentes', desc: 'Quando as contas compartilham o que funciona, todos os agentes aprendem mais rápido, os seus também.', on: st.aprendizadoDemo ? 'true' : 'false', travado: false, nota: '', alternar: () => this.setState({ aprendizadoDemo: !this.state.aprendizadoDemo }) };"
  },
  {
    regra: 'aprendizado: interruptor da seção em Configurações',
    arquivo: 'template.generated.tsx',
    aplicar: texto => {
      const marca = '{$v.cfgAgentes ? (<>';
      if (texto.split(marca).length !== 2) throw new Error('Regra "aprendizado": ponto de inserção em Configurações não encontrado (ou repetido).');
      const bloco = `{$v.cfgAprendizado ? (<>
                    <section className={"cfg-box"}>
                      <div className={"cfg-row cfg-row-line"}>
                        <span style={{"flex":"1 1 auto","minWidth":"0","display":"flex","flexDirection":"column","gap":"2px"}}>
                          <span style={{"fontSize":"14px","fontWeight":"500"}}>{__t($v.aprendizado?.titulo)}</span>
                          <span style={{"fontSize":"13px","color":"var(--graphite)"}}>{__t($v.aprendizado?.desc)}</span>
                          {$v.aprendizado?.nota ? (<span style={{"fontSize":"13px","color":"var(--graphite)"}}>{__t($v.aprendizado?.nota)}</span>) : null}
                        </span>
                        <button className={"switch"} role="switch" aria-checked={$v.aprendizado?.on} aria-label={$v.aprendizado?.titulo} onClick={$v.aprendizado?.alternar} disabled={$v.aprendizado?.travado}>
                          <span></span>
                        </button>
                      </div>
                    </section>
                  </>) : null}
                  `;
      return texto.replace(marca, () => bloco + marca);
    }
  },
  {
    regra: 'aprendizado: o botão de cancelar da janela de confirmação pode ter outro texto (ex.: "Agora não")',
    arquivo: 'template.generated.tsx',
    aplicar: texto => {
      const re = /(onClick=\{\$v\.confirmCancelar\}[^>]*>\s*)\{"Cancelar"\}/;
      if (!re.test(texto)) throw new Error('Regra "aprendizado": botão Cancelar da janela de confirmação não encontrado.');
      return texto.replace(re, (_m, antes) => antes + '{__t($v.confirm?.cancelar || "Cancelar")}');
    }
  },

  // ---- Conectores (Claude): no modo real só conecta o que tem perfil disponível (AlthiusApp.conectorReal); o resto fica "Em breve" com o motivo
  {
    regra: 'conectores: no modo real só o que existe de verdade conecta; o resto aparece como "Em breve" com o motivo (sem autorização simulada)',
    arquivo: 'logic.generated.js',
    trocar: "const k = cons[c.id], ok = !!k && !k.erro, erro = !!k && !!k.erro;\n        return { nome: c.nome, desc: c.desc, auth: c.auth, logo: LG[c.id], conectado: ok, erro, estado: ok ? 'ok' : erro ? 'erro' : 'off', usoTexto: k ? 'usado por ' + usoTexto(k) : '',\n          btnCls: ok ? 'con-btn-sec' : 'con-btn', acaoLabel: ok ? 'Gerenciar' : erro ? 'Reconectar' : 'Conectar', acaoRotulo: (ok ? 'Gerenciar ' : 'Conectar ') + c.nome, acao: () => this.abrirOauth(c.id) };",
    por: "const k = cons[c.id], ok = !!k && !k.erro, erro = !!k && !!k.erro, em = this.modoDemo === false && !(this.conectorReal && this.conectorReal(c.id));\n        return { nome: c.nome, desc: this.modoDemo === false ? (em ? c.desc + ' Em breve: ' + this.motivoDoConector(c.id) : erro ? c.desc + ' Precisa reconectar.' : c.desc) : c.desc, auth: c.auth, logo: LG[c.id], conectado: ok, erro, estado: ok ? 'ok' : erro ? 'erro' : 'off', usoTexto: this.modoDemo === false ? (k && !erro ? 'Conta: ' + k.conta : '') : (k ? 'usado por ' + usoTexto(k) : ''), emBreve: em,\n          btnCls: em || ok ? 'con-btn-sec' : 'con-btn', acaoLabel: em ? 'Em breve' : ok ? 'Gerenciar' : erro ? 'Reconectar' : 'Conectar', acaoRotulo: em ? c.nome + ' (em breve)' : (ok ? 'Gerenciar ' : 'Conectar ') + c.nome, acao: () => { if (!em) this.abrirOauth(c.id); } };"
  },
  {
    regra: 'conectores: o resumo do modo real diz quantos conectores já conectam e que os demais chegam em breve',
    arquivo: 'logic.generated.js',
    trocar: "v.cat.resumo = nCon + ' conectados de ' + KC.lista.length + ' disponíveis · cada conexão é autorizada na página oficial da ferramenta';",
    por: "v.cat.resumo = this.modoDemo === false ? this.resumoDosConectores() : nCon + ' conectados de ' + KC.lista.length + ' disponíveis · cada conexão é autorizada na página oficial da ferramenta';"
  },
  {
    regra: 'conectores: a autorização simulada não abre no modo real',
    arquivo: 'logic.generated.js',
    trocar: "abrirOauth(id) { const ag",
    por: "abrirOauth(id) { if (this.modoDemo === false) return; const ag"
  },
  {
    regra: 'conectores: botão "Em breve" fica desabilitado',
    arquivo: 'template.generated.tsx',
    trocar: '<button className={c?.btnCls} onClick={c?.acao} aria-label={c?.acaoRotulo}>',
    por: '<button className={c?.btnCls} onClick={c?.acao} aria-label={c?.acaoRotulo} disabled={c?.emBreve}>'
  },

  // ---- Conversa direta e privada com o agente (migration 124, ADR 0059): a aba Conversa deixa de ser encenação
  {
    regra: 'conversa do agente: no modo real as mensagens vêm do banco (nada de resposta fixa, plano ou delegação inventados)',
    arquivo: 'logic.generated.js',
    trocar: 'chatDe(a) {',
    por: 'chatDe(a) {\n    if (this.modoDemo === false) return this.mensagensDaConversaDireta(a);'
  },
  {
    regra: 'conversa do agente: as threads são as conversas reais da pessoa com aquele agente',
    arquivo: 'logic.generated.js',
    trocar: "v.threads = [['Prioridades de hoje', 'agora', true],",
    por: "v.threads = this.modoDemo === false ? this.threadsDaConversaDireta(a) : [['Prioridades de hoje', 'agora', true],"
  },
  {
    regra: 'conversa do agente: enviar escreve de verdade para o agente (o protótipo respondia com texto fixo)',
    arquivo: 'logic.generated.js',
    trocar: 'const enviar = texto => {',
    por: 'const enviar = texto => {\n        if (this.modoDemo === false) return this.enviarNaConversaDireta(a, texto);'
  },
  {
    regra: 'conversa do agente: botão "Nova conversa" (só no modo real)',
    arquivo: 'logic.generated.js',
    trocar: 'v.enviarMsg = () => enviar(st.msgTexto);',
    por: 'v.enviarMsg = () => enviar(st.msgTexto);\n      v.novaConversa = this.modoDemo === false ? () => this.novaConversaDireta(a) : undefined;'
  },
  {
    regra: 'conversa do agente: o cabeçalho das threads ganha "Nova conversa"',
    arquivo: 'template.generated.tsx',
    trocar: '{"Threads"}',
    por: '<span style={{"display":"flex","justifyContent":"space-between","alignItems":"center","gap":"8px"}}>{"Threads"}{$v.novaConversa ? (<button onClick={$v.novaConversa} style={{"minHeight":"32px","padding":"0 10px","border":"1px solid var(--rule)","background":"var(--paper)","fontFamily":"inherit","fontSize":"13px","cursor":"pointer","borderRadius":"8px"}}>{"Nova conversa"}</button>) : null}</span>'
  },
  {
    regra: 'conversa do agente: clicar numa thread abre a conversa',
    arquivo: 'template.generated.tsx',
    trocar: "<span style={__css(`min-height: 44px; padding: 10px 14px; border-bottom: 1px solid var(--rule); font-size: 14px; background: ${__s(th?.bg)}; display: flex; flex-direction: column;`)}>",
    por: "<span onClick={th?.abrir} onKeyDown={(e) => { if (th?.abrir && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); th.abrir(); } }} role={th?.abrir ? 'button' : undefined} tabIndex={th?.abrir ? 0 : undefined} style={__css(`min-height: 44px; padding: 10px 14px; border-bottom: 1px solid var(--rule); font-size: 14px; background: ${__s(th?.bg)}; display: flex; flex-direction: column; cursor: ${th?.abrir ? 'pointer' : 'default'};`)}>"
  },
  {
    regra: 'conversa do agente: arquivar uma conversa (só no modo real)',
    arquivo: 'template.generated.tsx',
    trocar: '{__t(th?.quando)}',
    por: '{__t(th?.quando)}{th?.arquivar ? (<button aria-label="Arquivar conversa" title="Arquivar" onClick={(e) => { e.stopPropagation(); th.arquivar(); }} style={{"marginLeft":"8px","border":"none","background":"transparent","cursor":"pointer","color":"var(--graphite)"}}>{"×"}</button>) : null}'
  },

  // ---- Relatórios, Sinais e Prospecção (Grok)
  // Relatórios, no modo real, troca os números na própria tela (AlthiusApp).
  // Sem patch no arquivo gerado. Sinais e Prospecção entram nesta seção depois.

  // ---- Enriquecimento de contas (ADR 0062): toda conta aparece no mapa do Início, sem estragar as outras.
  // Com coordenada (do enriquecimento): pin no ponto. Só com o estado: pin em volta do número do estado, com contorno
  // tracejado (local aproximado). Sem nada: marcador "Sem localização" no oceano, que lista essas contas ao clicar.
  {
    regra: 'mapa real: toda conta vira pin (ponto exato, aproximado pelo estado ou "Sem localização")',
    arquivo: 'logic.generated.js',
    trocar: 'm.pins = contas.filter(c => MAPA_GEO[c.id] && MAPA_GEO[c.id][2] <= diasMax && (COM[c.id] || []).length).map(c => { const g = MAPA_GEO[c.id], xy = proj(g[0], g[1]), p = pct(xy[0], xy[1]);',
    por: "const real = this.modoDemo === false;\n" +
      "      const pontoReal = c => { const g = this.geoDaContaNoMapa ? this.geoDaContaNoMapa(c.id) : null; if (g) return { xy: proj(g.lat, g.lng), aprox: !!g.aprox };\n" +
      "        const u = MAPA_UFS.find(x => x.uf === ufDe(c)); if (!u) return null;\n" +
      "        let hsh = 0; for (const ch of String(c.id)) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;\n" +
      "        const ang = (hsh % 360) * Math.PI / 180, raio = 22 + (hsh >>> 9) % 12;\n" +
      "        return { xy: [u.cx + Math.cos(ang) * raio, u.cy + Math.sin(ang) * raio], aprox: true }; };\n" +
      "      const semLocalReal = real ? contas.filter(c => !pontoReal(c)) : [];\n" +
      "      m.pins = (real ? contas.filter(c => pontoReal(c)) : contas.filter(c => MAPA_GEO[c.id] && MAPA_GEO[c.id][2] <= diasMax && (COM[c.id] || []).length)).map(c => { const pr = real ? pontoReal(c) : null, g = real ? [0, 0, 0] : MAPA_GEO[c.id], xy = real ? pr.xy : proj(g[0], g[1]), p = pct(xy[0], xy[1]);"
  },
  {
    regra: 'mapa real: pin aproximado se diferencia (contorno) e diz que o local é aproximado',
    arquivo: 'logic.generated.js',
    trocar: 'return { x: p.x, y: p.y, nome: c.nome, cidade: c.cidade, fit: c.fit,',
    por: "return { x: p.x, y: p.y, dica: 'Abrir conta e comitê', aprox: pr && pr.aprox ? 'true' : 'false', semLocal: 'false', nome: c.nome, cidade: c.cidade + (pr && pr.aprox ? ' (local aproximado)' : ''), fit: c.fit,"
  },
  {
    regra: 'mapa real: marcador "Sem localização" no oceano e textos da legenda',
    arquivo: 'logic.generated.js',
    trocar: "      const regs = ['Brasil', 'Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];",
    por: "      if (real) {\n" +
      "        m.semLocal = semLocalReal.length; cont.SL = semLocalReal.length;\n" +
      "        if (semLocalReal.length) { const xy = proj(0.5, -35.5), p = pct(xy[0], xy[1]);\n" +
      "          m.pins.push({ x: p.x, y: p.y, dica: 'Ver quais contas', aprox: 'false', semLocal: 'true', nome: 'Sem localização', cidade: semLocalReal.length + (semLocalReal.length === 1 ? ' conta sem endereço' : ' contas sem endereço'), fit: '—', nivel: '0', chamas: [], dim: 'false',\n" +
      "            rotulo: 'Sem localização: ' + semLocalReal.length + (semLocalReal.length === 1 ? ' conta' : ' contas') + '. Ver quais', abrir: () => this.setState({ mapaUf: this.state.mapaUf === 'SL' ? null : 'SL' }) }); }\n" +
      "      }\n" +
      "      m.semLocalTexto = real ? (m.semLocal ? m.semLocal + (m.semLocal === 1 ? ' conta sem endereço fica' : ' contas sem endereço ficam') + ' no marcador \"Sem localização\", no oceano. O enriquecimento completa sozinho quando achar o endereço.' : 'Todas as contas estão no mapa.') : m.semLocal + ' contas sem endereço ainda ficam fora do mapa.';\n" +
      "      m.legendaPins = real ? ' cada pin é uma conta. Contorno tracejado = local aproximado (só a cidade ou o estado). Os números agrupam por estado; clique no estado para ver as contas dele.' : ' o mapa mostra contas com sinal no período escolhido. Os números agrupam por estado; os pins mostram as contas com comitê mapeado. Clique no estado para ver as contas dele.';\n" +
      "      const regs = ['Brasil', 'Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];"
  },
  {
    regra: 'mapa real: clicar em "Sem localização" lista as contas sem endereço',
    arquivo: 'logic.generated.js',
    trocar: 'if (uSel) { const u = MAPA_UFS.find(x => x.uf === uSel), cs = contas.filter(c => ufDe(c) === uSel && (MAPA_GEO[c.id] || [0, 0, 0])[2] <= diasMax);',
    por: "if (uSel) { const u = MAPA_UFS.find(x => x.uf === uSel) || { nome: 'Sem localização', uf: 'SL', regiao: 'sem endereço' }, cs = uSel === 'SL' ? semLocalReal : contas.filter(c => ufDe(c) === uSel && (MAPA_GEO[c.id] || [0, 0, 0])[2] <= diasMax);"
  },
  {
    regra: 'mapa real: o pin leva as marcas de aproximado e de sem localização',
    arquivo: 'template.generated.tsx',
    trocar: '<button className={"mapa-pin"} data-nivel={p?.nivel} data-dim={p?.dim}',
    por: '<button className={"mapa-pin"} data-nivel={p?.nivel} data-dim={p?.dim} data-aprox={p?.aprox} data-semlocal={p?.semLocal}'
  },
  {
    regra: 'mapa real: legenda explica os pins',
    arquivo: 'template.generated.tsx',
    trocar: '{" o mapa mostra contas com sinal no período escolhido. Os números agrupam por estado; os pins mostram as contas com comitê mapeado. Clique no estado para ver as contas dele."}',
    por: '{__t($v.mapa?.legendaPins)}'
  },
  {
    regra: 'mapa real: legenda diz onde ficam as contas sem endereço',
    arquivo: 'template.generated.tsx',
    trocar: '{__t($v.mapa?.semLocal)}{" contas sem endereço ainda ficam fora do mapa."}',
    por: '{__t($v.mapa?.semLocalTexto)}'
  },
  {
    regra: 'mapa real: estilo do pin aproximado (contorno tracejado) e do "Sem localização"',
    arquivo: 'althius.css',
    trocar: '.mapa-pin[data-dim="true"] { opacity: 0.2; pointer-events: none; }',
    por: '.mapa-pin[data-dim="true"] { opacity: 0.2; pointer-events: none; }\n' +
      '  .mapa-pin[data-aprox="true"] path { fill: var(--paper); stroke: var(--ink); stroke-dasharray: 3 2; } .mapa-pin[data-aprox="true"] circle { fill: var(--ink); }\n' +
      '  .mapa-pin[data-semlocal="true"] path { fill: var(--paper); stroke: var(--graphite); stroke-width: 2; stroke-dasharray: 2 2; } .mapa-pin[data-semlocal="true"] circle { fill: var(--graphite); }'
  },
  {
    regra: 'conta real: salvar o site grava no banco (o logo e o enriquecimento usam o site)',
    arquivo: 'logic.generated.js',
    trocar: "this.avisar('mod', 'Site salvo. O logo vem do próprio ' + d + ' e aparece aqui, na lista de contas e no Pipeline.'); };",
    por: "if (this.modoDemo === false && this.salvarSiteDaConta) this.salvarSiteDaConta(contaSel.id, d);\n            this.avisar('mod', 'Site salvo. O logo vem do próprio ' + d + ' e aparece aqui, na lista de contas e no Pipeline.'); };"
  },
  {
    // Pessoa achada pelo enriquecimento costuma vir só com LinkedIn: sem isso a tela mostrava "undefined · undefined".
    regra: 'comitê: contato sem e-mail ou telefone não mostra "undefined"',
    arquivo: 'logic.generated.js',
    trocar: "contato: (p.emails || [])[0] + ' · ' + (p.fones || [])[0],",
    por: "contato: [(p.emails || [])[0], (p.fones || [])[0]].filter(Boolean).join(' · ') || 'Sem e-mail nem telefone ainda',"
  },
  {
    regra: 'mapa real: a dica do pin diz o que o clique faz ("Sem localização" abre a lista, não uma conta)',
    arquivo: 'template.generated.tsx',
    trocar: '{"Abrir conta e comitê"}',
    por: '{__t(p?.dica)}'
  },
  {
    regra: 'mapa real: a lista "Sem localização" não fala de uma sigla de estado',
    arquivo: 'logic.generated.js',
    trocar: "' de ' + u.uf + ' em Contas e leads'",
    por: "(uSel === 'SL' ? '' : ' de ' + u.uf) + ' em Contas e leads'"
  },
  {
    regra: 'mapa real: "Ver as contas" da lista "Sem localização" não filtra por um estado que não existe',
    arquivo: 'logic.generated.js',
    trocar: '{ uf: uSel, aberto: null }',
    por: "{ uf: uSel === 'SL' ? null : uSel, aberto: null }"
  },
  {
    regra: 'mapa real: a dica do marcador "Sem localização" (na borda direita) não é cortada',
    arquivo: 'althius.css',
    trocar: '.mapa-pin[data-semlocal="true"] path {',
    por: '.mapa-pin[data-semlocal="true"] .pin-tip { left: auto; right: 0; transform: none; }\n  .mapa-pin[data-semlocal="true"] path {'
  },
  {
    // ADR 0063: o Nan enxugou o catálogo em 06/10/2026. Fica o que conecta hoje (HubSpot, Pipedrive, Notion, Apollo, canais de
    // mensagem...) mais o que ele quer ter: RD Station, Google Agenda e Meta Ads (os três "Em breve"). O resto, que não existe, sai.
    regra: 'catálogo de conectores: só os que existem ou foram pedidos (ADR 0063)',
    arquivo: 'module.js',
    aplicar: texto => {
      const FICAM = ['hubspot', 'pipedrive', 'rdstation', 'whatsapp', 'instagram', 'gmail', 'gcal', 'outlook', 'granola', 'otter', 'notion', 'confluence', 'apollo', 'linkedin', 'calendly', 'meta'];
      const inicio = texto.indexOf('window.ALTHIUS_CONECTORES = ');
      if (inicio < 0) throw new Error('Regra "catálogo de conectores": não achei window.ALTHIUS_CONECTORES. O design mudou? Revise scripts/v18/patches.mjs.');
      const fimLinha = texto.indexOf('\n', inicio) < 0 ? texto.length : texto.indexOf('\n', inicio);
      const catalogo = JSON.parse(texto.slice(inicio + 'window.ALTHIUS_CONECTORES = '.length, fimLinha).replace(/;\s*$/, ''));
      const faltam = FICAM.filter(id => !catalogo.lista.some(c => c.id === id));
      if (faltam.length) throw new Error(`Regra "catálogo de conectores": o design não traz mais ${faltam.join(', ')}. Revise scripts/v18/patches.mjs.`);
      catalogo.lista = catalogo.lista.filter(c => FICAM.includes(c.id));
      catalogo.cats = catalogo.cats.filter(cat => catalogo.lista.some(c => c.cat === cat.id));
      return texto.slice(0, inicio) + 'window.ALTHIUS_CONECTORES = ' + JSON.stringify(catalogo) + ';' + texto.slice(fimLinha);
    }
  },
  {
    // ADR 0063: os cartões de canal da tela de Campanhas ligavam cada canal a conectores que saíram do catálogo (apareciam
    // com o código cru, como "liads"). O canal continua (é como a campanha é classificada); só cita o conector que existe.
    regra: 'campanhas: cartões de canal só citam conectores que existem (ADR 0063)',
    arquivo: 'logic.generated.js',
    trocar: "['LinkedIn Ads', ['liads'], 'ABM com as contas do ICP: anúncio só para quem está na lista.'",
    por: "['LinkedIn Ads', [], 'ABM com as contas do ICP: anúncio só para quem está na lista.'"
  },
  {
    regra: 'campanhas: Google Ads sem conectores que saíram do catálogo (ADR 0063)',
    arquivo: 'logic.generated.js',
    trocar: "['Google Ads', ['gads', 'ga4'],",
    por: "['Google Ads', [],"
  },
  {
    regra: 'campanhas: Orgânico sem Google Drive (ADR 0063)',
    arquivo: 'logic.generated.js',
    trocar: "['Orgânico', ['notion', 'gdrive'],",
    por: "['Orgânico', ['notion'],"
  },
  {
    regra: 'campanhas: Evento sem Eventbrite (ADR 0063)',
    arquivo: 'logic.generated.js',
    trocar: "['Evento', ['eventbrite', 'hubspot'],",
    por: "['Evento', ['hubspot'],"
  },
  {
    regra: 'campanhas: SEO/GEO sem Search Console nem Analytics (ADR 0063)',
    arquivo: 'logic.generated.js',
    trocar: "['SEO/GEO', ['gsc', 'ga4'],",
    por: "['SEO/GEO', [],"
  },
  {
    regra: 'agentes: Jax não cita Google Ads nem LinkedIn Ads, que saíram do catálogo (ADR 0063)',
    arquivo: 'data.js',
    trocar: "I('Mídia paga','Meta Ads','Leitura'), I('Mídia paga','Google Ads','Leitura'), I('Mídia paga','LinkedIn Ads','Leitura')",
    por: "I('Mídia paga','Meta Ads','Leitura')"
  },
  {
    regra: 'agentes: Neo não cita Google Sheets, que saiu do catálogo (ADR 0063)',
    arquivo: 'data.js',
    trocar: "I('CRM','HubSpot','Leitura e escrita'), I('Planilhas','Google Sheets','Escrita')",
    por: "I('CRM','HubSpot','Leitura e escrita')"
  },
  {
    // ADR 0064: a Althius opera junto com o cliente; nada compra créditos sozinho. Recarga automática some no modo real.
    regra: 'créditos: recarga automática escondida no modo real (abre)',
    arquivo: 'template.generated.tsx',
    trocar: "<span style={{\"display\":\"flex\",\"alignItems\":\"center\",\"gap\":\"12px\",\"flex\":\"1 1 300px\"}}>",
    por: "{$v.cr?.mostraRecarga ? (<span style={{\"display\":\"flex\",\"alignItems\":\"center\",\"gap\":\"12px\",\"flex\":\"1 1 300px\"}}>"
  },
  {
    regra: 'créditos: recarga automática escondida no modo real (fecha)',
    arquivo: 'template.generated.tsx',
    trocar: "{\"Abaixo de 1.000, compra 10.000 créditos.\"}\n                            </span>\n                          </span>\n                        </span>",
    por: "{\"Abaixo de 1.000, compra 10.000 créditos.\"}\n                            </span>\n                          </span>\n                        </span>) : null}"
  },
  {
    regra: 'créditos: o cliente pede à Althius (ADR 0064)',
    arquivo: 'logic.generated.js',
    trocar: "leitura, compraTitulo: podeComprar ? 'Comprar em 1 clique' : 'Pedir créditos', compraSub: podeComprar ? 'cai na hora' : 'quem decide: ' + decisor,",
    por: "leitura, mostraRecarga: this.modoDemo !== false, compraTitulo: this.modoDemo === false ? 'Pedir créditos à Althius' : podeComprar ? 'Comprar em 1 clique' : 'Pedir créditos', compraSub: this.modoDemo === false ? 'a Althius confere e libera' : podeComprar ? 'cai na hora' : 'quem decide: ' + decisor,"
  },
  {
    regra: 'créditos: nota do pedido à Althius (ADR 0064)',
    arquivo: 'logic.generated.js',
    trocar: "compraNota: podeComprar ? 'Preço fixo por crédito,",
    por: "compraNota: this.modoDemo === false ? 'O pedido vai para a Althius, que libera os créditos no saldo. A cobrança segue o seu contrato; os valores são de referência.' : podeComprar ? 'Preço fixo por crédito,"
  },
  {
    // ADR 0064: pedido de créditos é para a Althius. Só o superadmin decide; o C-level vê "Decisão da Althius", sem botões.
    regra: 'aprovações: pedido de créditos à Althius só o superadmin decide (botões)',
    arquivo: 'logic.generated.js',
    trocar: "podeDecidir: can('approvals.decide') && !dec && (!/Orçamento|acima de limite/i.test(sel.tipo) || can('approvals.spend')),",
    por: "podeDecidir: can('approvals.decide') && !dec && (!/Orçamento|acima de limite/i.test(sel.tipo) || can('approvals.spend')) && (!/pedido à Althius/i.test(sel.tipo) || papel === 'superadmin'),"
  },
  {
    regra: 'aprovações: pedido de créditos à Althius mostra quem decide',
    arquivo: 'logic.generated.js',
    trocar: "label: dec ? dec : (can('approvals.decide') && (!/Orçamento|acima de limite/i.test(sel.tipo) || can('approvals.spend')) ? 'Sua decisão' : 'Decisão do C-level'),",
    por: "label: dec ? dec : (/pedido à Althius/i.test(sel.tipo) ? (papel === 'superadmin' ? 'Sua decisão' : 'Decisão da Althius') : can('approvals.decide') && (!/Orçamento|acima de limite/i.test(sel.tipo) || can('approvals.spend')) ? 'Sua decisão' : 'Decisão do C-level'),"
  },
  {
    // ADR 0064: no modo real, Campanhas é só a lista. Os seis cartões de canal (texto longo e conectores) somem; o aviso
    // de que subir no Meta Ads ainda não existe fica no subtítulo (AlthiusApp.publicarCampanhas).
    regra: 'campanhas: sem os cartões de canal no modo real (ADR 0064)',
    arquivo: 'logic.generated.js',
    trocar: "v.cp = { ativo: page === 'campaigns' && vista === 'modulo', canais: [], conAgente: [] };",
    por: "v.cp = { ativo: page === 'campaigns' && vista === 'modulo' && this.modoDemo !== false, canais: [], conAgente: [] };"
  },
  {
    // ADR 0064: no modo real, Execuções fica só na Lista (Kanban e Timeline eram poluição sem uso).
    regra: 'execuções: só a visão Lista no modo real (abas)',
    arquivo: 'logic.generated.js',
    trocar: "v.exViews = [['lista','Lista'],['kanban','Kanban'],['timeline','Timeline']].map(",
    por: "v.exViews = (this.modoDemo === false ? [] : [['lista','Lista'],['kanban','Kanban'],['timeline','Timeline']]).map("
  },
  {
    regra: 'execuções: só a visão Lista no modo real (conteúdo)',
    arquivo: 'logic.generated.js',
    trocar: "v.exLista = st.exView === 'lista' && !v.exVazio; v.exKanban = st.exView === 'kanban' && !v.exVazio; v.exTimeline = st.exView === 'timeline' && !v.exVazio;",
    por: "const exVista = this.modoDemo === false ? 'lista' : st.exView; v.exLista = exVista === 'lista' && !v.exVazio; v.exKanban = exVista === 'kanban' && !v.exVazio; v.exTimeline = exVista === 'timeline' && !v.exVazio;"
  },
  {
    // ADR 0064: "Relatórios automáticos" não tem banco por trás; no modo real a seção some (título e tabela genérica).
    regra: 'relatórios: sem a seção "Relatórios automáticos" no modo real (título)',
    arquivo: 'template.generated.tsx',
    trocar: "<h2 style={{\"fontFamily\":\"var(--f-display)\",\"margin\":\"4px 0 0\",\"fontWeight\":\"400\",\"fontSize\":\"18px\"}}>\n                    {\"Relatórios automáticos\"}\n                  </h2>",
    por: "{$v.md?.mostraAutomaticos ? (<h2 style={{\"fontFamily\":\"var(--f-display)\",\"margin\":\"4px 0 0\",\"fontWeight\":\"400\",\"fontSize\":\"18px\"}}>\n                    {\"Relatórios automáticos\"}\n                  </h2>) : null}"
  },
  {
    regra: 'relatórios: sem a seção "Relatórios automáticos" no modo real (tabela)',
    arquivo: 'logic.generated.js',
    trocar: "if (page === 'pipeline' || page === 'credits') { md.tabela = false; md.kanban = false; md.vazio = false; }",
    por: "md.mostraAutomaticos = !(page === 'analytics' && this.modoDemo === false); if (page === 'pipeline' || page === 'credits' || !md.mostraAutomaticos) { md.tabela = false; md.kanban = false; md.vazio = false; md.filtros = []; }"
  },
  {
    // ADR 0065: no modo real, o card do Pipeline abre a ficha da conta (como em Contas e leads); o lápis edita o negócio.
    regra: 'pipeline: rótulo do card diz o que o Enter faz',
    arquivo: 'logic.generated.js',
    trocar: "rotulo: d.conta + ', ' + brl(d.valor) + ', ' + rot(d.etapa) + ', ' + s[0] + '. Enter para editar.',",
    por: "rotulo: d.conta + ', ' + brl(d.valor) + ', ' + rot(d.etapa) + ', ' + s[0] + (this.modoDemo === false ? '. Enter para abrir a conta.' : '. Enter para editar.'),"
  },
  {
    regra: 'pipeline: clicar no card abre a ficha da conta; o lápis edita o negócio',
    arquivo: 'logic.generated.js',
    trocar: "abrir: () => { if (!meu) { bloq(); return; } this.setState({ pipeCard: Object.assign({ id: d.id }, d, { valor: String(d.valor) }) }); },",
    por: "editar: e => { if (e && e.stopPropagation) e.stopPropagation(); if (!meu) { bloq(); return; } this.setState({ pipeCard: Object.assign({ id: d.id }, d, { valor: String(d.valor) }) }); }, abrir: () => { if (this.modoDemo === false && d.cid) { this.abrirConta(d.cid, 'comite'); return; } if (!meu) { bloq(); return; } this.setState({ pipeCard: Object.assign({ id: d.id }, d, { valor: String(d.valor) }) }); },"
  },
  {
    regra: 'pipeline: Enter no card abre a ficha da conta no modo real',
    arquivo: 'logic.generated.js',
    trocar: "tecla: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.setState({ pipeCard: Object.assign({ id: d.id }, d, { valor: String(d.valor) }) }); } } }; }) }; }) };",
    por: "tecla: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (this.modoDemo === false && d.cid) { this.abrirConta(d.cid, 'comite'); return; } this.setState({ pipeCard: Object.assign({ id: d.id }, d, { valor: String(d.valor) }) }); } } }; }) }; }) };"
  },
  {
    regra: 'pipeline: lápis no card para editar o negócio',
    arquivo: 'template.generated.tsx',
    trocar: "<span className={\"pk-tag\"}>\n                                    {__t(c?.motion)}\n                                  </span>",
    por: "<span className={\"pk-tag\"}>\n                                    {__t(c?.motion)}\n                                  </span><button className={\"icon-btn\"} style={{\"width\":\"26px\",\"height\":\"26px\",\"flex\":\"0 0 auto\"}} onClick={c?.editar} aria-label={\"Editar negócio de \" + (c?.conta || \"\")} title=\"Editar negócio\"><svg width=\"13\" height=\"13\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"1.6\" strokeLinecap=\"round\" strokeLinejoin=\"round\" aria-hidden=\"true\"><path d=\"M14.5 5.5l4 4\"></path><path d=\"M4 20l1-4.5L15.8 4.7a1.8 1.8 0 0 1 2.5 0l1 1a1.8 1.8 0 0 1 0 2.5L8.5 19z\"></path></svg></button>"
  },
  {
    // ADR 0065: segundo botão no topo das páginas de módulo (ex.: "Importar lista" em Contas, "Adicionar contas da base" no Pipeline).
    regra: 'módulos: botão secundário no topo (acao2)',
    arquivo: 'template.generated.tsx',
    trocar: "<span style={{\"flex\":\"1 1 auto\"}}></span>\n                  {\"\\n              \"}\n                  {$v.md?.temAcao ? (<>",
    por: "<span style={{\"flex\":\"1 1 auto\"}}></span>\n                  {\"\\n              \"}\n                  {$v.md?.temAcao2 ? (<button className={\"b-sec\"} onClick={$v.md?.acao2} style={{\"height\":\"44px\",\"padding\":\"0 16px\",\"border\":\"1px solid var(--ink)\",\"borderRadius\":\"10px\",\"background\":\"var(--paper)\",\"color\":\"var(--ink)\",\"fontFamily\":\"inherit\",\"fontSize\":\"14px\",\"cursor\":\"pointer\"}}>{__t($v.md?.acao2Label)}</button>) : null}{$v.md?.temAcao ? (<>"
  },
  {
    regra: 'ficha da conta: botão "Adicionar ao Pipeline" (ADR 0065)',
    arquivo: 'template.generated.tsx',
    trocar: "<button className={\"b-sec\"} onClick={$v.cta?.fechar} aria-label=\"Fechar\"",
    por: "{$v.cta?.podePipeline ? (<button className={\"b-sec mini-btn\"} onClick={$v.cta?.adicionarPipeline} style={{\"flex\":\"none\",\"height\":\"40px\"}}>{\"Adicionar ao Pipeline\"}</button>) : null}<button className={\"b-sec\"} onClick={$v.cta?.fechar} aria-label=\"Fechar\""
  },
  {
    regra: 'ficha da conta: botão "Monitorar sinais" (ADR 0066)',
    arquivo: 'template.generated.tsx',
    trocar: "{$v.cta?.podePipeline ? (<button className={\"b-sec mini-btn\"} onClick={$v.cta?.adicionarPipeline}",
    por: "{$v.cta?.podeMonitorar ? (<button className={\"b-sec mini-btn\"} onClick={$v.cta?.alternarMonitorar} title={$v.cta?.monitorarDica} style={{\"flex\":\"none\",\"height\":\"40px\"}}>{__t($v.cta?.monitorarLabel)}</button>) : null}{$v.cta?.podePipeline ? (<button className={\"b-sec mini-btn\"} onClick={$v.cta?.adicionarPipeline}"
  },
  {
    // ADR 0067: o fit é calculado pelo banco; a ficha mostra o "por que esta nota" (ICP, sinais e dados).
    regra: 'ficha da conta: por que esta nota (fit calculado)',
    arquivo: 'template.generated.tsx',
    trocar: "<span className={\"co-site\"}>",
    por: "{$v.cta?.fitPorque ? (<span className={\"fit-porque\"} style={{\"fontSize\":\"12px\",\"lineHeight\":\"1.4\",\"color\":\"var(--graphite)\"}}>{__t($v.cta?.fitPorque)}</span>) : null}<span className={\"co-site\"}>"
  },
  {
    // ADR 0067 (fatia 5): os papéis dos 4 agentes decididos pelo Nan. Zoe é a única que prospecta; Jax cuida da
    // estratégia, do ICP e da mídia; Lia de copy e cadências; Neo de RevOps. Sem integração que não existe (Apollo) e
    // com o Meta Ads "Em breve" (ADR 0063).
    regra: 'agentes: papéis de Zoe, Jax, Lia e Neo',
    arquivo: 'data.js',
    aplicar: texto => {
      const trocas = [
        ["funcao: 'Comercial · ICP, contas e comitê', latim: 'Vai atrás das contas certas'",
         "funcao: 'Prospecção · empresas, pessoas e comitê', latim: 'Vai atrás das contas certas'"],
        ["objetivo: 'Encontra e prioriza contas dentro do ICP, mapeia o comitê de compra e acompanha sinais de compra.', escopo: 'Lê o CRM, pesquisa dados públicos e da Receita Federal, monta listas e comitês. Não escreve no CRM sem aprovação.'",
         "objetivo: 'A única que prospecta: busca empresas novas pelo ICP (Google Maps, Receita Federal), traz candidatas para você incluir ou excluir, mapeia o comitê de compra e acompanha os sinais das contas.', escopo: 'Diz o custo antes de rodar e só roda quando uma pessoa pede. Propõe contas, enriquecimento, Pipeline e planos; nada muda sem aprovação.'"],
        ["I('Enriquecimento de contatos','Apollo','Leitura')", "I('Busca de empresas','Google Maps','Leitura')"],
        ["funcao: 'Marketing · mídia, SEO/GEO e eventos', latim: 'Anuncia a marca ao mercado'",
         "funcao: 'Estratégia · ICP e mídia paga', latim: 'Anuncia a marca ao mercado'"],
        ["objetivo: 'Planeja e lê campanhas pagas, orgânico, SEO/GEO e eventos, e aponta onde realocar orçamento.', escopo: 'Lê dados de mídia e do site. Mudanças de orçamento e publicação exigem aprovação.'",
         "objetivo: 'Escreve e remodela o ICP pelo que já vende, pelos dados e pelo Playbook, e cuida das campanhas e da verba de mídia paga.', escopo: 'Propõe mudanças no ICP, nas campanhas e na verba; tudo vira aprovação (verba, só o C-level). Lookalike no Meta Ads quando o conector existir.'"],
        ["integracoes: [I('Mídia paga','Meta Ads','Leitura')]", "integracoes: [I('Mídia paga','Meta Ads','Em breve')]"],
        ["funcao: 'Copy · mensagens e conteúdo', latim: 'Escreve no tom da marca'",
         "funcao: 'Copy · mensagens e cadências', latim: 'Escreve no tom da marca'"],
        ["objetivo: 'Escreve e-mails, mensagens, roteiros de ligação, anúncios e conteúdos no tom da marca.'",
         "objetivo: 'Escreve e-mails, mensagens e roteiros de ligação no tom da marca e monta os passos das cadências.'"],
        ["funcao: 'RevOps · CRM, pipeline e relatórios', latim: 'Mantém os números de pé'",
         "funcao: 'RevOps · métricas e relatórios', latim: 'Mantém os números de pé'"],
        ["objetivo: 'Mantém o CRM limpo, acompanha o pipeline, avisa sobre negócios parados e monta os relatórios do ciclo.', escopo: 'Lê e escreve no CRM somente com aprovação. Publica relatórios internos.'",
         "objetivo: 'Lê as métricas, o pipeline e os negócios parados, explica os números e monta os relatórios quando você pede.', escopo: 'Lê o CRM e os números. Mudanças no CRM e tarefas só com aprovação.'"]
      ];
      for (const [de, para] of trocas) {
        if (texto.split(de).length !== 2) throw new Error('Regra "agentes: papéis": não achei exatamente uma vez: ' + de.slice(0, 60));
        texto = texto.replace(de, () => para);
      }
      return texto;
    }
  }
];
