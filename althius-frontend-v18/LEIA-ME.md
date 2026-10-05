# Althius — frontend v22 (pacote para o backend; a pasta mantém o nome v18)

## O que tem aqui

| Arquivo | O que é |
| --- | --- |
| `Althius_Desktop_v22.html` | O front inteiro, em um arquivo só. Abra no navegador: funciona offline, com dados de demonstração. **É a exportação do design e está desatualizada:** ainda mostra Venator, Praeco, Stilus e Ratio e os avatares antigos. O app de verdade é o de `src/` (Zoe, Jax, Lia e Neo). Para atualizar este arquivo, reexporte do Claude Design. |
| `fonte/template.html` | O HTML da interface (todas as telas), com os estilos. Legível. |
| `fonte/component.js.html` | A lógica da interface: estado, rotas, permissões e o que cada tela mostra. Legível. |
| `fonte/data.js` | Mocks e "services" de demonstração: papéis (`ROLES`), permissões (`PERMS`), navegação (`NAV`), workspaces, agentes, execuções, aprovações e notificações. |
| `fonte/module.js` | Dados das telas (`window.ALTHIUS_MOD`) e catálogos: sinais, skills, playbooks, conectores, comitês e a matriz de capacidades (`window.ALTHIUS_CAPS`). |
| `docs/Althius_papeis_permissoes_conexoes_Hermes.md` / `.pdf` | A regra de negócio: papéis, matriz, Hermes, Apify, Unipile, Pipeline, créditos, conferência com os documentos anteriores e mudanças no banco. O PDF tem os diagramas. |

Os arquivos de `fonte/` foram extraídos do HTML e são só para leitura. O HTML é a versão que roda.

## Como navegar no protótipo

- **Rotas:** `#/app/{workspace}/{página}/{id}`, por exemplo `#/app/evolut/pipeline`.
- **Páginas:** `home`, `strategy`, `approvals`, `accounts`, `prospecting`, `cadences`, `tasks`, `campaigns`, `pipeline`, `inbox`, `agents`, `agents/{comercial|marketing|copy|revops}`, `executions`, `contents`, `signals`, `analytics`, `integrations`, `credits`, `team`, `settings`, `channels/{slug}`, `admin/{workspaces|usage|providers|margins|audit|health}`.
- **Trocar de papel:** clique no avatar (canto superior direito) → "Modo demonstração · papel". Isso muda a tela inteira conforme a matriz.
- **Workspaces de exemplo:** `evolut`, `grao`, `vertice`.

## Onde está cada regra no código

Em `fonte/component.js.html`, dentro de `renderVals()`, as áreas são separadas por comentários em maiúsculas: `// HOME`, `// PIPELINE`, `// CAMPANHAS`, `// CAIXA DE ENTRADA`, `// CRÉDITOS`, `// RELATÓRIOS`, `// CANAL`, `// NOVA TAREFA`, `// CONECTORES`, `// CONFIGURAÇÕES`, `// DETALHE DO AGENTE` e outras.

| Função | Para que serve | No backend, vira |
| --- | --- | --- |
| `can(chave)` | Toda checagem de permissão; lê `PERMS[papel]` | A checagem 1 do Hermes + RLS |
| `wsPermitidos()` | Superadmin vê todos os workspaces; os outros papéis, só os em que são membros | `workspace_members` + RLS |
| `gastar(créditos, descrição, agente)` | Debita créditos no extrato | Credit Service (reserva → consumo → liberação) |
| `extrato()`, `saldo()`, `credCfg()` | Extrato, saldo e regra de consumo | `credit_wallets`, `credit_transactions`, `workspace_settings` |
| `pipeBase()`, `pipe()` | Quadros, motions, etapas e negócios | `pipelines`, `stage_definitions`, `opportunities` |
| `inboxCon()` | Contas de mensagem conectadas pela pessoa | `messaging_accounts` (Unipile) |
| `sinaisDe()`, `sinalAtivo()`, `skillsDe()` | Sinais e skills por agente | `signal_definitions`, `workspace_signal_settings`, `agent_skills` |
| `canais()` | Canais de chat, com #geral obrigatório | `chat_channels` (ou o Buzz) |
| `logoDe()`, `wsLogo()` | Logo puxado do site (conta e workspace) | Função de backend que busca o logo e salva no storage |
| `membros(ws)` | Membros e papéis do workspace | `workspace_members` |

## O que é demonstração

- **Dados:** todos são fictícios (empresas, pessoas, números).
- **Integrações e Caixa de entrada:** o OAuth das integrações e o QR code do WhatsApp são simulados.
- **Logo:** é buscado direto pelo navegador. No produto, isso é função do backend.
- **Estado:** quase tudo fica só na memória da página. Recarregar zera. As exceções são tema, foto e histórico do copiloto, que ficam no `localStorage`.
- **Contrato de dados:** os "services" em `data.js` (`workspaceService`, `agentService` e outros) são o lugar onde a API real deve entrar, mantendo o mesmo formato de dados.

## Avatares dos agentes (camada do projeto)
Os nomes de exibição são **Zoe** (comercial), **Jax** (marketing), **Lia** (copy) e **Neo** (revops); os códigos técnicos não mudam. A troca de nome vive em `scripts/v18/patches.mjs` (sobrevive a um novo `fonte/`).

Os desenhos ficam em `src/app/avatares/` e são ligados por `src/app/avatares-agentes.css`, por cima do protótipo. Para cada agente há dois arquivos: `zoe.svg` (a arte original, parada) e `zoe-animado.svg` (**os olhos mexem**). Mesma regra do protótipo: parado nos tamanhos pequenos, animado nos grandes e quando o mouse passa em cima, e parado de novo para quem pede movimento reduzido no sistema.

Os `*-animado.svg` são **gerados**, não editados à mão: `node scripts/avatares/gerar-animados.mjs` (usa as medidas de `scripts/avatares/olhos.json`). Na arte, contorno e pupila são uma forma só, então o gerador desenha por cima de cada olho um olho equivalente com a pupila móvel. Para trocar um desenho: troque o `<nome>.svg`, meça os olhos em `olhos.json` e rode o gerador. O `src/app/avatares-agentes.test.ts` recusa arquivo com script, com link para fora, acima de 120 KB (os originais do design vinham com texturas de 1,6 a 2,4 MB: reduza antes de entrar) ou com pupila que sai do olho.
