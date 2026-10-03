// Regras de produto aplicadas sobre o código gerado do protótipo, a cada `npm run v18:sync`.
// Cada patch precisa encontrar o trecho exato; se uma versão nova do design mudar a tela,
// o conversor para com erro e aponta qual regra revisar (nada é perdido em silêncio).

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
  }
];
