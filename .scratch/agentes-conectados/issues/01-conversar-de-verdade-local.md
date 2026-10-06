# 01: Conversar de verdade com um agente, no computador local

**What to build:** o Nan escreve num canal da equipe e a Zoe (e os outros três agentes) responde com o modelo real do Codex (login OAuth, ADR 0051), rodando o Hermes oficial em Docker na própria máquina, ligado ao banco local, ao servidor de ferramentas e ao ciclo do harness. Um comando documentado sobe tudo e outro confere se está respondendo.

**Blocked by:** None (can start immediately).

**Status:** feito e conferido de verdade em 06/10/2026: Hermes oficial no Docker local, modelo pelo login do Codex (nome `gpt-6-luna` aceito), canal `geral` da Evolut, Zoe respondeu "8 contas e 0 negócios abertos" em 12 s, igual ao banco.

## Pode mexer
Scripts de agentes (`scripts/agentes/`), documentação em `docs/agentes/`, composição Docker dos agentes (arquivos gerados fora do git), testes dos scripts.

## Não mexa
Migrations antigas, arquivos gerados do protótipo, regras de segurança do perfil do Hermes (sem terminal, sem arquivos).

## Critérios
- [x] Um passo a passo curto em português (`docs/agentes/conversar-local.md`) que o Nan consegue seguir sem programar.
- [x] O provisionamento local funciona com o banco do Supabase CLI e o modo `--modelo-oauth luna`, sem chave de API em lugar nenhum.
- [x] Sem login feito, a conferência avisa "falta entrar no Codex" em vez de mostrar a mensagem de erro do Hermes como se fosse resposta do agente (ADR 0051, item 4).
- [x] Teste de ponta a ponta (Hermes e modelo falsos) segue verde; o resultado real é conferido pelo Nan.

## Passos do Nan
1. Docker Desktop aberto.
2. Entrar no Codex dentro do contêiner (o assistente entrega o comando pronto; o código aparece no navegador).
3. Escrever uma mensagem no canal e confirmar que a Zoe responde.
