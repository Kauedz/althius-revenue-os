# 04: Aprovações com Categoria (Operação vs. Gasto) e Payload Hash

**What to build:** Single-use approval queue system supporting `category: 'operacao'` (approvable by Estrategista, C-level, Superadmin) and `'gasto'` (exclusive to C-level or Superadmin), with cryptographic `payload_hash` that invalidates approval upon payload modification.

**Blocked by:** 02: Função de Política do Hermes: As 4 Checagens, Auditoria e Notificações

**Status:** completed

- [x] Table `approvals` created/updated with `category` (`operacao`, `gasto`), `payload_hash`, `status` (`pendente`, `aprovado`, `rejeitado`), and decider metadata
- [x] Database validation preventing non-C-level/non-superadmin members from deciding `gasto` approvals
- [x] Invalidation logic checking cryptographic payload hash before releasing execution
- [x] Unit tests for single-use consumption and tampering detection
