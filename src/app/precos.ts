// Preço de venda dos créditos, sempre em reais. A plataforma nunca mostra dólar ao cliente
// (ADR 0021): o custo real do fornecedor fica no schema internal e só o superadmin vê.
//
// Valor provisório: 10.000 créditos = R$ 529,00 (tabela comercial do Blueprint).
// Confirmar com o comercial antes de cobrar clientes.
export const PRECO_CREDITO_BRL = 0.0529;

export const precoEmReais = (creditos: number): string =>
  (creditos * PRECO_CREDITO_BRL).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
