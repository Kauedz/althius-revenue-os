import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "../v18/data.js";
import "../v18/module.js";
import { Raiz } from "./Raiz";
import { adminLocal, bancoLocalNoAr, novoClienteLocal } from "../test/supabaseLocal";

const EVOLUT = "a0000000-0000-0000-0000-000000000001";

describe.skipIf(!bancoLocalNoAr)("tela de Creditos (banco local)", () => {
  afterEach(async () => {
    const r = await adminLocal().from("credit_wallets").update({ allowance_balance: 7950 }).eq("workspace_id", EVOLUT);
    if (r.error) throw r.error;
  });
  it("C-level ve o saldo da carteira, nao o extrato ficticio, e preco em reais", async () => {
    const antes = await adminLocal().from("credit_wallets").update({ allowance_balance: 4321 }).eq("workspace_id", EVOLUT).select("allowance_balance");
    if (antes.error) throw antes.error;
    window.location.hash = "#/app/evolut/credits";
    render(<Raiz supabase={novoClienteLocal()} />);
    fireEvent.change(await screen.findByPlaceholderText("voce@empresa.com.br"), { target: { value: "aline@evolut.com.br" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "althius-demo" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findAllByText("4.321", {}, { timeout: 8000 })).not.toHaveLength(0);
    expect(screen.getByText("Mapeamento de comitê · 8 contas")).toBeInTheDocument();
    expect(document.body).toHaveTextContent("R$");
    expect(document.body).not.toHaveTextContent("US$");
  });

  it('ADR 0064: o C-level pede créditos à Althius (sem compra em 1 clique e sem recarga automática); o saldo não muda', async () => {
    cleanup();
    const adm = adminLocal();
    const carteira = async () => (await adm.from('credit_wallets').select('topup_balance').eq('workspace_id', EVOLUT).single()).data?.topup_balance;
    const antes = await carteira();
    window.location.hash = '#/app/evolut/credits';
    render(<Raiz supabase={novoClienteLocal()} />);
    fireEvent.change(await screen.findByPlaceholderText('voce@empresa.com.br'), { target: { value: 'aline@evolut.com.br' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'althius-demo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Pedir créditos à Althius', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.queryByText('Comprar em 1 clique')).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: 'Recarga automática' })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /10\.000/ }).find(b => b.classList.contains('cr-pacote'))!);
    const janela = await screen.findByRole('alertdialog', { name: 'Pedir 10.000 créditos à Althius?' });
    fireEvent.click(within(janela).getByRole('button', { name: 'Enviar pedido' }));
    await waitFor(async () => {
      const { data } = await adm.from('approvals').select('id').eq('workspace_id', EVOLUT).eq('title', 'Pedido de 10000 créditos à Althius');
      expect(data?.length).toBe(1);
    }, { timeout: 8000 });
    expect(await carteira()).toBe(antes);
    const { data: ap } = await adm.from('approvals').select('id').eq('workspace_id', EVOLUT).eq('approval_type', 'creditos');
    const ids = (ap ?? []).map(a => a.id);
    if (ids.length) { await adm.from('notifications').delete().in('entity_id', ids); await adm.from('approvals').delete().in('id', ids); }
  });
});
