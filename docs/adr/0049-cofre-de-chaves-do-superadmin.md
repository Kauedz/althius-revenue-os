# ADR 0049 — Cofre de chaves na tela do superadmin

Status: aceita
Data: 2026-10-06
Relacionadas: 0021 (créditos), 0023 (segurança do banco), 0041 (Docker), 0044 (Unipile trocável), 0047 (Hermes responde)

## Contexto
As chaves dos fornecedores (Apify, Unipile, modelo de IA) estavam no `.env` do servidor. Trocar uma chave exigia mexer em arquivo e reiniciar contêiner, e a Apify tinha cinco contas fixas em tabela de texto puro. O dono quer cadastrar e trocar as chaves por uma tela, com **cinco ou mais** chaves da Apify para dividir o trabalho.

## Decisão
1. **Tela em Fornecedores** (só superadmin): botão "Nova chave", e por linha "Testar chave", "Ativar ou desativar" e "Remover chave". A lista mostra só os **4 últimos caracteres**; a chave nunca volta para a tela.
2. **Só cifrado no banco.** Tabela `internal.cofre_segredos` (sem acesso para usuário nem visitante). A cifra é AES-256-GCM, feita no servidor Node com a **chave mestra `COFRE_CHAVE_MESTRA`** (32 bytes, fica no `.env`, fora do banco). Quem lê só o banco não decifra nada. O banco recusa texto que não venha no formato cifrado.
3. **Quem guarda é o backend.** A tela manda a chave para `/cofre/guardar` com o login da pessoa; o servidor pergunta ao banco se é superadmin (`cofre_conferir_superadmin`), cifra e grava com a chave de serviço. Ativar, desativar e remover são funções do banco que exigem superadmin.
4. **Quantas chaves quiser** por fornecedor (sem teto de 5). Rótulo igual = troca da chave, sem duplicar.
5. **Rodízio da Apify** (`src/server/providers/apify-pool.ts`): cada pedido vai para a chave menos ocupada; chave recusada (401/403) ou com limite estourado (429) fica de molho por 60 s e o pedido tenta a próxima; todas falhando = erro claro. A chave vai no cabeçalho, nunca na URL. Sem chave nenhuma não existe "modo simulado": falha pedindo o cadastro.
6. **O cofre vale mais que o `.env`.** Unipile (chave, endereço e segredo do webhook) é lida do cofre a cada uso, com cache de 30 s; sem chave lá, ou com o cofre fora do ar, vale o `.env`. Nada para de funcionar na migração. Sem `COFRE_CHAVE_MESTRA`, o cofre fica desligado e a tela avisa.
7. **Teste de chave** só onde o endereço é conhecido: Apify (`/v2/users/me`) e modelo de IA (`{endereço}/models`, padrão OpenAI). A Unipile não tem teste automático (endereço de teste não confirmado; não inventamos).
8. **Registro** em `internal.cofre_eventos` (quem, quando, o quê, qual fornecedor), nunca com segredo. A auditoria encadeada é por cliente e o cofre é da plataforma, por isso é um registro à parte.
9. **Créditos, nunca dólar** continua valendo: o custo real da Apify segue só nesta tela do superadmin.

## O que esta decisão NÃO faz (próximas etapas)
- (Feito na ADR 0050) A chave do **modelo de IA** é usada pelo gateway, que também permite trocar de fornecedor sem mexer em cada Hermes.
- O envio de chave de Apify para os pedidos de coleta reais depende de existir o ponto de coleta no backend; hoje o rodízio está pronto e testado, e a coleta o chamará.
- Aprendizado entre contas e o aviso de consentimento (PR 18 e 19).

## Cuidados
- **Faça cópia do `.env`.** Sem a chave mestra, as chaves guardadas não abrem (bastaria cadastrá-las de novo, mas é trabalho).
- Trocar a chave mestra deixa as chaves antigas ilegíveis; o sistema as pula sem derrubar o resto. `npm run docker:subir` cria a chave mestra se faltar e nunca troca uma que já existe.
- Segredo digitado nunca entra em log, auditoria, URL ou resposta de erro.
