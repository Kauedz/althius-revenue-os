// @vitest-environment node
import { describe, expect, it } from "vitest";
import { lerCreditos } from "./creditos";
import { bancoLocalNoAr, entrarComoLocal } from "../../test/supabaseLocal";

const EVOLUT = "a0000000-0000-0000-0000-000000000001";

describe.skipIf(!bancoLocalNoAr)("Creditos no banco local", () => {
  it("C-level le saldo e extrato sem dolar", async () => {
    const c = await lerCreditos(await entrarComoLocal("aline@evolut.com.br"), EVOLUT);
    expect(c.disponivel).toBe(7950);
    expect(c.extrato).toHaveLength(8);
    expect(c.extrato[0].desc).toBe("Créditos iniciais do workspace");
    expect(c.extrato[1]).toMatchObject({ desc: "Mapeamento de comitê · 8 contas", quem: "Agente Comercial", ag: "comercial", cr: 200, tipo: "saida" });
    expect(c.politica).toEqual({ modo: "auto", teto: 500, limite: 5000, recarga: false });
    expect(JSON.stringify(c)).not.toMatch(/US\$|USD/);
  });

});
