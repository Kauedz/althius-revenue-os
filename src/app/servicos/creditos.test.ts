// @vitest-environment node
import { describe, expect, it } from "vitest";
import { comprarCreditos, lerCreditos, salvarPoliticaCreditos, type PoliticaCredito } from "./creditos";
import { adminLocal, bancoLocalNoAr, entrarComoLocal } from "../../test/supabaseLocal";

const EVOLUT = "a0000000-0000-0000-0000-000000000001";
const GRAO = "b0000000-0000-0000-0000-000000000001";
const VERTICE = "c0000000-0000-0000-0000-000000000001";
const RAFAEL = "d0000000-0000-0000-0000-000000000001";
const CAMILA = "d0000000-0000-0000-0000-000000000002";
const ALINE = "d0000000-0000-0000-0000-000000000003";
const LUCAS = "d0000000-0000-0000-0000-000000000004";

const POLITICA_SEED: PoliticaCredito = { modo: "auto", teto: 500, limite: 5000, recarga: false };

function clienteConsultas(respostas: Array<{ data: unknown; error: { code?: string; message?: string } | null }>) {
  let i = 0;
  return {
    from() {
      const atual = respostas[i++] ?? { data: null, error: { message: "sem resposta" } };
      const cadeia: any = new Proxy(function () {}, {
        get: (_alvo: unknown, prop: string) => (prop === "then"
          ? (ok: (v: unknown) => unknown, falha?: (e: unknown) => unknown) => Promise.resolve(atual).then(ok, falha)
          : cadeia),
        apply: () => cadeia
      });
      return cadeia;
    }
  };
}

function clienteRpc(resultado: { data: any; error: { code?: string; message?: string } | null }) {
  return { rpc: async () => resultado };
}

describe("lerCreditos quando o banco responde mal", () => {
  const carteira = { data: { allowance_balance: 10, topup_balance: 5, reserved_balance: 0 }, error: null };
  const politica = { data: { credit_mode: "auto", approval_threshold: 500, monthly_credit_limit: 5000, auto_topup_enabled: false }, error: null };

  it("erro ao ler a carteira", async () => {
    const cliente = clienteConsultas([{ data: null, error: { message: "rede" } }]);
    await expect(lerCreditos(cliente as never, EVOLUT)).rejects.toThrow("Não foi possível carregar o saldo de créditos.");
  });

  it("workspace sem carteira", async () => {
    const cliente = clienteConsultas([{ data: null, error: null }]);
    await expect(lerCreditos(cliente as never, EVOLUT)).rejects.toThrow("Este workspace ainda não tem carteira de créditos.");
  });

  it("erro ao ler o extrato", async () => {
    const cliente = clienteConsultas([carteira, { data: null, error: { message: "rede" } }]);
    await expect(lerCreditos(cliente as never, EVOLUT)).rejects.toThrow("Não foi possível carregar o extrato de créditos.");
  });

  it("erro ao ler as regras", async () => {
    const cliente = clienteConsultas([carteira, { data: [], error: null }, { data: null, error: { message: "rede" } }]);
    await expect(lerCreditos(cliente as never, EVOLUT)).rejects.toThrow("Não foi possível carregar as regras de créditos.");
  });

  it("movimento desconhecido", async () => {
    const cliente = clienteConsultas([
      carteira,
      { data: [{ id: "1", type: "ajuste", amount: 1, description: "x", agent_code: null, created_at: "2026-10-01T12:00:00Z" }], error: null },
      politica
    ]);
    await expect(lerCreditos(cliente as never, EVOLUT)).rejects.toThrow("Movimento de crédito desconhecido.");
  });

  it("agente desconhecido no extrato", async () => {
    const cliente = clienteConsultas([
      carteira,
      { data: [{ id: "1", type: "consume", amount: 1, description: "x", agent_code: "financeiro", created_at: "2026-10-01T12:00:00Z" }], error: null },
      politica
    ]);
    await expect(lerCreditos(cliente as never, EVOLUT)).rejects.toThrow("Não foi possível identificar o agente do extrato.");
  });

  it("reserva e liberação ficam de fora; recarga, vencimento e saldo negativo viram a tela", async () => {
    const cliente = clienteConsultas([
      { data: { allowance_balance: 10, topup_balance: 0, reserved_balance: 40 }, error: null },
      { data: [
        { id: "r", type: "reserve", amount: 40, description: "reserva", agent_code: null, created_at: "2026-10-01T12:00:00Z" },
        { id: "l", type: "release", amount: 40, description: "liberada", agent_code: null, created_at: "2026-10-01T13:00:00Z" },
        { id: "t", type: "topup", amount: 1000, description: "Compra", agent_code: null, created_at: "2026-10-02T12:00:00Z" },
        { id: "e", type: "expiration", amount: 1000, description: "Venceu", agent_code: null, created_at: "2026-10-03T12:00:00Z" }
      ], error: null },
      { data: { credit_mode: "approval", approval_threshold: 200, monthly_credit_limit: 800, auto_topup_enabled: true }, error: null }
    ]);
    const c = await lerCreditos(cliente as never, EVOLUT);
    expect(c.disponivel).toBe(0);
    expect(c.extrato.map(m => m.tipo)).toEqual(["entrada", "saida"]);
    expect(c.extrato[0]).toMatchObject({ quem: "Workspace", desc: "Compra", cr: 1000 });
    expect(c.extrato[0].ag).toBeUndefined();
    expect(c.extrato[1]).toMatchObject({ quem: "Workspace", desc: "Venceu", tipo: "saida" });
    expect(c.politica).toEqual({ modo: "aprovacao", teto: 200, limite: 800, recarga: true });
  });

  it("sem regras gravadas usa o padrão da tela", async () => {
    const cliente = clienteConsultas([
      { data: { allowance_balance: 1, topup_balance: 2, reserved_balance: 0 }, error: null },
      { data: [], error: null },
      { data: null, error: null }
    ]);
    const c = await lerCreditos(cliente as never, EVOLUT);
    expect(c.disponivel).toBe(3);
    expect(c.politica).toEqual(POLITICA_SEED);
  });
});

describe("compra e regras quando a função recusa", () => {
  const pedido = { modo: "auto" as const, teto: 500, limite: 5000, recarga: false };

  it("sem permissão de compra", async () => {
    const cliente = clienteRpc({ data: null, error: { code: "42501", message: "nao" } });
    await expect(comprarCreditos(cliente as never, EVOLUT, LUCAS, 10000)).rejects.toThrow("Você não tem permissão para comprar créditos.");
  });

  it("falha genérica de compra", async () => {
    const cliente = clienteRpc({ data: null, error: { code: "08000", message: "rede" } });
    await expect(comprarCreditos(cliente as never, EVOLUT, ALINE, 10000)).rejects.toThrow("Não foi possível registrar a compra de créditos.");
  });

  it("compra recusada com motivo e sem motivo", async () => {
    await expect(comprarCreditos(clienteRpc({ data: { success: false, reason: "Pacote de créditos não reconhecido." }, error: null }) as never, EVOLUT, ALINE, 1))
      .rejects.toThrow("Pacote de créditos não reconhecido.");
    await expect(comprarCreditos(clienteRpc({ data: { success: false }, error: null }) as never, EVOLUT, ALINE, 1))
      .rejects.toThrow("A compra de créditos não foi registrada.");
  });

  it("sem permissão para mudar as regras", async () => {
    const cliente = clienteRpc({ data: null, error: { code: "42501", message: "nao" } });
    await expect(salvarPoliticaCreditos(cliente as never, EVOLUT, CAMILA, pedido)).rejects.toThrow("Só o C-level e o superadmin mudam as regras de créditos.");
  });

  it("falha genérica ao gravar regras e motivo vazio", async () => {
    await expect(salvarPoliticaCreditos(clienteRpc({ data: null, error: { code: "08000" } }) as never, EVOLUT, ALINE, pedido))
      .rejects.toThrow("Não foi possível gravar as regras de créditos.");
    await expect(salvarPoliticaCreditos(clienteRpc({ data: { success: false, reason: "Modo, teto ou limite mensal inválido." }, error: null }) as never, EVOLUT, ALINE, pedido))
      .rejects.toThrow("Modo, teto ou limite mensal inválido.");
    await expect(salvarPoliticaCreditos(clienteRpc({ data: { success: false }, error: null }) as never, EVOLUT, ALINE, pedido))
      .rejects.toThrow("As regras de créditos não foram gravadas.");
  });
});

async function restaurarPolitica() {
  const { error } = await adminLocal().from("workspace_settings").update({
    credit_mode: "auto", approval_threshold: 500, monthly_credit_limit: 5000, auto_topup_enabled: false
  }).eq("workspace_id", EVOLUT);
  if (error) throw error;
}

async function restaurarCompra(workspaceId: string) {
  const txs = await adminLocal().from("credit_transactions").delete().eq("workspace_id", workspaceId).eq("type", "topup");
  if (txs.error) throw txs.error;
  const carteira = await adminLocal().from("credit_wallets").update({ topup_balance: 0, topup_expires_at: null }).eq("workspace_id", workspaceId);
  if (carteira.error) throw carteira.error;
}

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

  it("BDR, estrategista e superadmin leem o saldo do próprio workspace", async () => {
    for (const email of ["lucas@evolut.com.br", "camila@althius.com.br", "rafael@althius.com.br"]) {
      const c = await lerCreditos(await entrarComoLocal(email), EVOLUT);
      expect(c.disponivel).toBe(7950);
      expect(c.extrato).toHaveLength(8);
    }
  });

  it("estrategista lê o outro workspace em que participa e não o que não participa", async () => {
    const camila = await entrarComoLocal("camila@althius.com.br");
    const grao = await lerCreditos(camila, GRAO);
    expect(grao.disponivel).toBe(10000);
    expect(grao.extrato).toHaveLength(1);
    await expect(lerCreditos(camila, VERTICE)).rejects.toThrow("Este workspace ainda não tem carteira de créditos.");
  });

  it("BDR não compra créditos", async () => {
    const lucas = await entrarComoLocal("lucas@evolut.com.br");
    await expect(comprarCreditos(lucas, EVOLUT, LUCAS, 10000)).rejects.toThrow("Você não tem permissão para comprar créditos.");
  });

  it("estrategista não compra no workspace de que não participa", async () => {
    const camila = await entrarComoLocal("camila@althius.com.br");
    await expect(comprarCreditos(camila, VERTICE, CAMILA, 10000)).rejects.toThrow("Você não tem permissão para comprar créditos.");
  });

  it("pacote que não existe é recusado", async () => {
    const aline = await entrarComoLocal("aline@evolut.com.br");
    await expect(comprarCreditos(aline, EVOLUT, ALINE, 123)).rejects.toThrow("Pacote de créditos não reconhecido.");
  });

  it("estrategista pede a compra e ela vai para a fila, sem creditar", async () => {
    const camila = await entrarComoLocal("camila@althius.com.br");
    let approvalId: string | undefined;
    try {
      const r = await comprarCreditos(camila, EVOLUT, CAMILA, 10000);
      approvalId = r.approval_id;
      expect(r).toMatchObject({ success: true, status: "requires_approval" });
      expect(approvalId).toBeTruthy();
      expect((await lerCreditos(camila, EVOLUT)).disponivel).toBe(7950);
      const linha = (await adminLocal().from("approvals").select("status, approval_type, category, estimated_credits").eq("id", approvalId!).single()).data;
      expect(linha).toMatchObject({ status: "pendente", approval_type: "creditos", category: "gasto", estimated_credits: 10000 });
    } finally {
      if (approvalId) {
        await adminLocal().from("notifications").delete().eq("entity_id", approvalId);
        await adminLocal().from("approvals").delete().eq("id", approvalId);
      }
    }
  });

  it("C-level compra e o saldo aumenta", async () => {
    const aline = await entrarComoLocal("aline@evolut.com.br");
    try {
      expect(await comprarCreditos(aline, EVOLUT, ALINE, 10000)).toMatchObject({ success: true, status: "credited", amount: 10000 });
      expect((await lerCreditos(aline, EVOLUT)).disponivel).toBe(17950);
    } finally {
      await restaurarCompra(EVOLUT);
    }
  });

  it("superadmin compra em qualquer workspace dele", async () => {
    const rafael = await entrarComoLocal("rafael@althius.com.br");
    try {
      expect(await comprarCreditos(rafael, VERTICE, RAFAEL, 25000)).toMatchObject({ success: true, status: "credited", amount: 25000 });
      expect((await lerCreditos(rafael, VERTICE)).disponivel).toBe(35000);
    } finally {
      await restaurarCompra(VERTICE);
    }
  });

  it("estrategista e BDR não mudam as regras", async () => {
    const pedido = { modo: "aprovacao" as const, teto: 100, limite: 1000, recarga: true };
    await expect(salvarPoliticaCreditos(await entrarComoLocal("camila@althius.com.br"), EVOLUT, CAMILA, pedido))
      .rejects.toThrow("Só o C-level e o superadmin mudam as regras de créditos.");
    await expect(salvarPoliticaCreditos(await entrarComoLocal("lucas@evolut.com.br"), EVOLUT, LUCAS, pedido))
      .rejects.toThrow("Só o C-level e o superadmin mudam as regras de créditos.");
    expect((await lerCreditos(await entrarComoLocal("aline@evolut.com.br"), EVOLUT)).politica).toEqual(POLITICA_SEED);
  });

  it("teto negativo é recusado e as regras continuam as mesmas", async () => {
    const aline = await entrarComoLocal("aline@evolut.com.br");
    await expect(salvarPoliticaCreditos(aline, EVOLUT, ALINE, { modo: "auto", teto: -1, limite: 5000, recarga: false }))
      .rejects.toThrow("Modo, teto ou limite mensal inválido.");
    expect((await lerCreditos(aline, EVOLUT)).politica).toEqual(POLITICA_SEED);
  });

  it("C-level e superadmin gravam as regras", async () => {
    const aline = await entrarComoLocal("aline@evolut.com.br");
    const rafael = await entrarComoLocal("rafael@althius.com.br");
    try {
      await salvarPoliticaCreditos(aline, EVOLUT, ALINE, { modo: "aprovacao", teto: 200, limite: 8000, recarga: true });
      expect((await lerCreditos(aline, EVOLUT)).politica).toEqual({ modo: "aprovacao", teto: 200, limite: 8000, recarga: true });
      await salvarPoliticaCreditos(rafael, EVOLUT, RAFAEL, { modo: "auto", teto: 400, limite: 4000, recarga: false });
      expect((await lerCreditos(rafael, EVOLUT)).politica).toEqual({ modo: "auto", teto: 400, limite: 4000, recarga: false });
    } finally {
      await restaurarPolitica();
    }
  });
});