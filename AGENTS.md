# AGENTS.md — regras do projeto Althius (leia inteiro antes de qualquer mudança)

Althius é um Revenue OS B2B vendido a clientes reais. O dono do produto **não é programador**: explique o que fez em português simples, sem jargão desnecessário. Código, nomes de tabela e comentários de domínio em português quando já for o padrão do arquivo.

## Ordem de verdade
1. `althius-frontend-v18/docs/Althius_papeis_permissoes_conexoes_Hermes.md` (regra de negócio)
2. Front v18 (`althius-frontend-v18/`) → 3. documentos antigos.
Em conflito, **não decida sozinho**: registre uma ADR curta em `docs/adr/` com o padrão indicado no documento e avise o dono.
Decisões já tomadas estão em `docs/adr/` (0001 a 0024). Não desfaça uma ADR sem o dono pedir; crie uma nova que a substitua.

## Mapa do projeto
- `supabase/migrations/` banco (Postgres, RLS por `workspace_id`) · `supabase/tests/database/` testes pgTAP · `supabase/seed.sql` dados de demonstração.
- `src/v18/*.generated.*` **código gerado do protótipo. NUNCA edite à mão.** Mudança de produto sobre o protótipo = nova regra em `scripts/v18/patches.mjs` + `npm run v18:sync`.
- `src/app/` integração do front com o banco (login, contexto, `AlthiusApp.ts`, `servicos/*`). É aqui que se liga uma tela ao banco.
- `src/server/` esqueleto do backend (filas, provedores, Hermes). Ainda não roda em produção.
- Modo real (padrão, com login) e modo demo (`VITE_ALTHIUS_MODO=demo`).

## Regras inegociáveis
1. **Créditos, nunca dólar.** Nenhuma tela de cliente mostra US$ nem a conversão (ADR 0021). Preço de compra em reais (`src/app/precos.ts`). Custo real do fornecedor só para o superadmin.
2. **Nunca invente dado.** Se a consulta falhar, mostre erro claro com "Tentar de novo". Proibido cair para número fictício.
3. **Segurança do banco (ADR 0023).** Função nova no schema `public` nasce **sem** permissão de execução. Dê `GRANT` explícito: `authenticated` só para ações de tela; `service_role` para funções de sistema. Função que recebe id de membro chama `public.assert_caller_is_member(...)`. Toda tabela nova tem RLS por workspace. O front nunca usa `service_role` nem segredos. Exceção documentada: as funções `agent_*` da porta do Hermes Agent aceitam `anon` porque exigem o token do agente (ADR 0024).
4. **Papel vale por workspace.** São 4 papéis (`superadmin`, `estrategista`, `clevel`, `bdr`); a matriz de 33 capacidades está no banco (`role_permissions`) e é testada contra o front (`src/app/matriz.test.ts`). "Quem paga decide o gasto": só C-level e superadmin aprovam gasto; o estrategista pede.
5. **Migrations já commitadas não mudam.** Correção = migration nova com o próximo número, pequena e com teste.
6. **TDD.** Escreva o teste que falha primeiro (pgTAP para banco; Vitest para serviço/tela), depois o código. Uma fatia vertical por vez: migration + RLS + função + teste + serviço + tela.
7. **Dados de cliente nunca saem do workspace dele.** Teste de isolamento entre dois workspaces para tudo que for novo.
8. Apify, Unipile (mensagens), HubSpot e o modelo de IA ficam atrás de uma interface nossa, com versão falsa para teste. **Nenhum teste chama API real.** Toda ação externa tem chave de idempotência e registro.

## Armadilhas conhecidas
- Em JavaScript, `texto.replace(a, b)` transforma `$$` em `$` e quebra SQL. Use `replace(a, () => b)` ou edite o arquivo direto.
- Testes de integração usam o banco local e rodam um arquivo por vez. Dados de seed mutáveis devem ser restaurados (veja `src/test/isolarAprovacoes.ts`).
- Janela de confirmação do protótipo (`confirmar`) é o jeito padrão de mostrar aviso/erro ao usuário.

## Como trabalhar
0. **Uma IA por pasta.** Cada IA trabalha na própria cópia do projeto (git worktree), nunca na mesma pasta de outra:
   `git worktree add ../A-<ia> -b ia/<ia>-<tarefa> master` e, no Windows, `mklink /J node_modules ..\A\node_modules`.
   Branches diferentes na **mesma** pasta não isolam nada. O banco local (Docker) é um só: **apenas uma IA por vez** roda `npm run verificar` ou `supabase db reset`, porque ele apaga e recria os dados. Antes, confira se existe o arquivo `BANCO-EM-USO.txt` na Área de Trabalho (pasta acima do projeto): se existir, espere; se não, crie com o nome da IA e apague ao terminar.
1. `git log --oneline | head` e leia as ADRs da área antes de mexer.
2. Comandos (Docker Desktop precisa estar aberto): `npx supabase start` · `npm run dev` (http://localhost:3000; superadmin `rafael@althius.com.br`, senha `althius-demo`, só no ambiente local).
3. Antes de **todo commit**: `npm run verificar` (confere gerados, tipos, reseta o banco, testes de banco, testes do front, build). O commit é bloqueado por `.githooks/pre-commit` se as travas (`npm run guardas`) falharem: migration antiga alterada, arquivo gerado editado, segredo, dólar em tela. **Nunca use `--no-verify`.**
4. Commits pequenos, mensagem em português. Nunca commite `.env`.
5. Ao terminar: relate o que mudou, quais testes passaram, o que ficou pendente e qualquer conflito com o documento de regras. Não diga "concluído" sem ter rodado `npm run verificar` e visto passar.

## O que NÃO fazer (resumo para IAs menos cuidadosas)
- Não reescrever arquivos grandes "para melhorar". Mude o mínimo necessário.
- Não apagar nem desativar testes para fazê-los passar. Corrija a causa.
- Não instalar dependências novas sem justificar no commit.
- Não mexer em `src/v18/*.generated.*`, `supabase/migrations/` antigas, `.githooks/` nem `scripts/guardas.mjs`.
- Não criar tela, tabela ou agente que o documento de regras não prevê (são 4 agentes fixos: comercial, marketing, copy, revops).
