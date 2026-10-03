import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
});
