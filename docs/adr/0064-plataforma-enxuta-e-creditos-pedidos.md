# ADR 0064 — Plataforma enxuta e créditos pedidos à Althius

Status: aceita
Data: 2026-10-06
Relacionadas: 0021 (créditos, nunca dólar), 0057 (o ICP mora no Playbook), 0063 (catálogo enxuto). Mapa de origem: `.scratch/enxugar-plataforma/mapa.md`

## Contexto
O Nan pediu (06/10/2026) para tirar o que polui a plataforma e deixar front e banco 100% coerentes, porque a ideia é os agentes orquestrarem tudo lá dentro. Ele também deixou claro o modelo de negócio: **o cliente assina por mês e a Althius opera a plataforma junto com ele. Não é um SaaS de autoatendimento.**

O mapa, feito no modo real e num workspace vazio, achou três páginas com dado inventado:
- Estratégia (ICP, "3.420 contas", pessoas do protótipo);
- Conteúdos (5 conteúdos fixos, sem banco);
- Equipe e acessos (a equipe do protótipo; a real fica em Configurações).

Achou também a compra de créditos, que **somava saldo na hora, sem pagamento nenhum**.

## Decisão
1. **Conteúdos e Equipe e acessos saem do modo real.** Elas somem do menu, e abrir pela URL mostra "Esta área não faz parte do seu acesso" (`PAGINAS_SEM_BANCO` em `src/app/dados.ts`). A equipe real continua em Configurações → Workspace e membros. Conteúdos volta quando houver tabela, serviço e agente gerando de verdade.
2. **Estratégia mostra só o que existe** (`src/app/servicos/estrategia.ts`):
   - o Playbook publicado de cada agente, onde está o ICP (ADR 0057), com versão, autor e um resumo;
   - as personas alvo do workspace, que o enriquecimento procura;
   - números reais: Playbooks publicados, personas, segmentos e contas.

   Sem "Nova hipótese" e sem "Publicar" fictícios.
3. **Campanhas é uma lista.** No modo real somem os seis cartões de canal. O subtítulo avisa: "Meta Ads: em breve".
4. **Menos poluição:**
   - Prospecção e Sinais não repetem "Sem dados ainda" embaixo de cada número;
   - Execuções fica só na visão Lista;
   - Relatórios não mostra a seção "Relatórios automáticos", que não tem banco por trás.
5. **Créditos se pedem à Althius** (migration 127):
   - `credit_purchase` nunca soma saldo. Cria uma aprovação de gasto "Pedido de N créditos à Althius" e avisa o superadmin.
   - **Só o superadmin decide** esse pedido (gatilho `approvals_creditos_da_althius`). O C-level vê "Decisão da Althius", sem botões.
   - Aprovado, o crédito entra no saldo uma vez, com a linha "Créditos liberados pela Althius" no extrato e na auditoria.
   - A cobrança segue o contrato. Na tela, os valores em reais ficam como referência.
   - **Recarga automática desligada.** Ela deixava o agente gastar além do saldo e creditava 10.000 sozinha. Agora um gatilho mantém `auto_topup_enabled` sempre falso, e a opção sumiu da tela.

## O que mudou em relação ao documento de regras
- "C-level e superadmin compram; o estrategista pede" virou "todos pedem à Althius; o superadmin libera".
- A recarga automática está desligada.
- O evento `membro.papel_mudado` aponta para Configurações → Workspace e membros.

O documento foi atualizado.

## Correção no mapa
O aviso "Coleta automática em breve" de Sinais **não** estava desatualizado. Ele é calculado: aparece quando nenhum sinal tem coleta ligada, que é o caso do banco local. Ficou como está.

## Limites conhecidos
- O modo demonstração continua com o protótipo inteiro (para apresentação).
- Um pedido de créditos pendente não expira sozinho.
- Os pacotes continuam 10, 25, 50 e 100 mil créditos, porque o banco recusa outros valores.
