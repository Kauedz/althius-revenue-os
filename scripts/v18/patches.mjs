// Regras de produto aplicadas sobre o código gerado do protótipo, a cada `npm run v18:sync`.
// Cada patch precisa encontrar o trecho exato; se uma versão nova do design mudar a tela,
// o conversor para com erro e aponta qual regra revisar (nada é perdido em silêncio).

export const PATCHES = [
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
  }
];
