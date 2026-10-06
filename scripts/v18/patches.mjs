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
];
