# Coleta de sinais: melhores atores (e fontes) por sinal

Data dos testes: 06/10/2026. Conta Apify gratuita (US$ 5 por mês). Gasto dos testes: cerca de **US$ 0,61** (uso mensal foi de US$ 1,69 para US$ 2,30). O token nunca foi gravado em arquivo; o Nan vai revogá-lo.

Este documento é interno. Preços em dólar aparecem aqui porque é custo real de fornecedor (só superadmin vê; ADR 0021). Nenhuma tela de cliente mostra dólar.

## Como ler

- **Testado hoje** = rodei o ator ou a fonte com uma entrada pequena e olhei a saída real. **Não testado** = só li a página/esquema; trate como hipótese.
- Preços são os da faixa **Free** lidos ao vivo na API da Apify em 06/10/2026. Vários estavam errados na pesquisa antiga do protótipo (ex.: vagas do `curious_coder` custam US$ 0,002 por vaga, o dobro do que se achava).
- Alvo de teste: Magazine Luiza (empresa pública e grande). Exemplos de saída abaixo **não têm nome de pessoa**.
- "Crédito" = `credits_per_account` de `signal_definitions`. Preço de venda provisório: R$ 0,0529 por crédito (`src/app/precos.ts`). Para comparar com o custo em dólar usei **R$ 5,50 por US$ 1 como referência de ordem de grandeza** (suposição minha, o Nan confirma o câmbio).

## Resumo em uma tabela

| Sinal | Créditos | Fonte recomendada | Apify? | Custo estimado por conta | Situação |
| --- | --- | --- | --- | --- | --- |
| vagas_cargo | 5 | `valig/linkedin-jobs-scraper` + reserva `curious_coder/linkedin-jobs-scraper` | Sim | ~US$ 0,005 | Testado, funciona |
| troca_cargo | 5 | `harvestapi/linkedin-profile-scraper` (decisores) + `linkedin-profile-search` (nova liderança) | Sim | US$ 0,01 a 0,12 | Testado, funciona; custo pede cuidado |
| posts_decisor | 3 | `harvestapi/linkedin-profile-posts` (+ `linkedin-company-posts`) | Sim | ~US$ 0,01 | Testado, funciona |
| noticias_empresa | 3 | RSS do Google News | **Não** (grátis) | US$ 0 | Testado, 48 notícias em pt-BR |
| rodada_investimento | 4 | RSS (termos de captação) + CVM (fatos relevantes) + classificação por IA | **Não** | ~US$ 0 | RSS e CVM testados; classificação falta |
| anuncios_ativos | 5 | `curious_coder/facebook-ads-library-scraper` + `silva95gustavo/google-ads-scraper` | Sim | ~US$ 0,03 | Testado, funciona (LinkedIn Ads não validou) |
| avaliacoes_reclamacoes | 3 | `compass/Google-Maps-Reviews-Scraper` | Sim | ~US$ 0,012 | Maps testado; Reclame Aqui **não cabe** nos 3 créditos |
| nova_filial | 3 | `compass/crawler-google-places` + BrasilAPI | Sim | ~US$ 0,02 | Lojas testadas; comparação mês a mês falta |
| receita_federal | 2 | BrasilAPI (CNPJ) | **Não** (grátis) | US$ 0 | Testado, funciona |
| importacao_ncm | 4 | Não achei fonte por empresa | Não | n/d | **Sem solução boa; decisão do Nan** |
| licitacoes_publicas | 4 | API oficial do PNCP | **Não** (grátis) | US$ 0 | Testado, funciona |
| expositores_eventos | 6 | Nenhuma validada | Parcial | n/d | **Fraco; não validou** |
| gaps_seo | 8 | `constant_quadruped/lighthouse-auditor` | Sim | ~US$ 0,005 | Testado, funciona |
| geo_presence | 10 | `apify/google-search-scraper` com "Visão geral por IA" | Sim | ~US$ 0,04 (5 perguntas) | Testado, funciona (ChatGPT/Perplexity são caros) |
| seguidores_concorrente | 20 | `scraping_solutions/instagram-scraper-followers-following-no-cookies` | Sim | ~US$ 0,17 por 200 seguidores | Funciona, mas **risco de LGPD e valor duvidoso** |
| mudanca_tech_stack | 4 | `motivational_nickel/website-technology-detector` + `benthepythondev/tech-stack-detector` | Sim | ~US$ 0,005 | Testado; sites com bloqueio dão falso "vazio" |

Dos 16 sinais externos, **5 não precisam de Apify** (notícias, rodada, Receita, licitações e boa parte de nova filial) e **2 não têm solução boa hoje** (importação por NCM e expositores).

## Regras da plataforma que o coletor precisa respeitar (descobertas dos testes)

1. O rodízio atual (`apify-pool.ts`) só **dispara** a execução e devolve o `runId`. Falta esperar terminar, ler os itens e **limitar o gasto** (parâmetro `maxTotalChargeUsd`, que funcionou em todos os testes). Também precisa poder pedir a versão `latest` do ator e a memória certa.
2. A conta grátis permite **5 execuções ao mesmo tempo** (testei e deu erro 402). O coletor tem de respeitar um limite de concorrência.
3. Alguns atores recusam teto de gasto baixo (mínimo de US$ 0,50 por execução no Google Maps e no Google Search) ou exigem mínimo de itens (Meta: pelo menos 10 anúncios e 1 URL por 512 MB). Isso fica registrado por ator na receita, não no código.
4. O campo `usageTotalUsd` da execução **não mostra as cobranças por resultado** na hora. O gasto confiável é o uso mensal da conta. O custo gravado por execução deve ser nossa estimativa (itens × preço do ator), conferida depois.
5. Site que bloqueia robô (Magazine Luiza responde 403) devolve "nenhuma tecnologia". **Isso não pode virar evento de mudança.** Resposta 403/vazia = erro, crédito devolvido.
6. O ator de notícias rápido (`data_xplorer/google-news-scraper-fast`) falhou por "permissão insuficiente" (proxy). Não precisamos dele, pois o RSS é grátis e funcionou.

## Por sinal

### vagas_cargo (comercial, 5 créditos, semanal)
- **Combinação:** 1º `valig/linkedin-jobs-scraper` (US$ 0,0004 por vaga + US$ 0,001 por início); 2º `curious_coder/linkedin-jobs-scraper` (US$ 0,002 por vaga; traz descrição completa e quem postou); 3º `valig/indeed-jobs-scraper` e `zen-studio/gupy-jobs-scraper` (cobertura extra; **não testei hoje**, o protótipo validou o Indeed em 30/09).
- **Por quê:** os dois primeiros devolveram as **mesmas 5 vagas reais** para "analista de comércio exterior" no Brasil (MCassab, Aeroflex, Kobra, Indisa, Supermed), mas o primeiro custa 5 vezes menos.
- **Entrada testada:** `{"keywords":"analista de comércio exterior","location":"Brazil","datePosted":"r604800","limit":5}`. Para monitorar uma conta o `valig` tem `companyName` (**não testei esse filtro hoje**).
- **Saída real (campos):** `title, companyName, location, postedDate, experienceLevel, contractType, workType, applyUrl, description`.
- **Riscos:** raspagem do LinkedIn tem risco de termos de uso; a mesma vaga aparece em várias fontes (remover repetidas por empresa+cargo).

### troca_cargo (comercial, 5 créditos, semanal)
- **Combinação:** (a) `harvestapi/linkedin-profile-scraper` nos decisores já mapeados (US$ 0,004 por perfil) guardando o retrato anterior para comparar; (b) `harvestapi/linkedin-profile-search` com `currentCompanies` + `recentlyChangedJobs` para achar **nova liderança** (US$ 0,10 por página de 25); (c) `harvestapi/linkedin-company-employees` com `yearsAtCurrentCompanyIds=1` para entradas (US$ 0,02 por início + US$ 0,003 por perfil).
- **Testado hoje:** (a), (b) e (c) funcionam. A busca achou **224 pessoas** com mudança recente de cargo na Magalu. Cada posição traz `title`, `companyName`, `startedOn`, `tenureAtPosition`. O perfil completo traz `experience[]` com `startDate/endDate`.
- **Atenção ao custo:** só a página de busca (US$ 0,10) já passa do que 5 créditos pagam (R$ 0,26, perto de US$ 0,05). **Recomendação:** rodar (a) por padrão (3 decisores = US$ 0,012) e (b)/(c) só com filtro de cargo ou como opção cobrada à parte.
- **Entrada (b) que funcionou:** `{"profileScraperMode":"Short ($4 per 1k)","currentCompanies":["https://www.linkedin.com/company/magazine-luiza"],"recentlyChangedJobs":true,"maxItems":5,"takePages":1}` (teto de gasto precisa ser ≥ US$ 0,25; com 0,15 parou sem resultado).
- **Riscos:** dado de pessoa (LGPD: guardar só o profissional público, com origem e data); nomes de modo mudam no esquema (o texto do modo inclui o preço).

### posts_decisor (copy, 3 créditos, semanal)
- **Combinação:** `harvestapi/linkedin-profile-posts` (US$ 0,002 por post) para o decisor + `harvestapi/linkedin-company-posts` para a empresa. `harvestapi/linkedin-post-search` (US$ 0,002 por post) serve para achar anúncios de mudança ("novo cargo"); **não testei esse**.
- **Testado hoje:** posts de empresa e de pessoa funcionam (3 posts cada). Saída: `content, postedAt.date, engagement.likes/comments/shares, linkedinUrl`.
- **Custo:** 3 posts de 2 decisores ≈ US$ 0,012. Deixar reações e comentários **desligados** (cobrados à parte).

### noticias_empresa (copy, 3 créditos, semanal)
- **Fonte recomendada:** RSS do Google News, **grátis**: `https://news.google.com/rss/search?q="<empresa>" when:7d&hl=pt-BR&gl=BR&ceid=BR:pt-419`.
- **Testado hoje:** 48 notícias da última semana sobre a Magalu, com título, fonte e data, em português.
- **Apify:** `data_xplorer/google-news-scraper-fast` (US$ 0,004 por notícia) **falhou** nos testes. Não vale a pena.
- **Riscos:** é uso não oficial do RSS (o Google pode limitar); guardar só título, link, data e fonte; a classificação do evento fica com nossa IA. Pedir 1 busca por conta e espaçar as chamadas.

### rodada_investimento (comercial, 4 créditos, semanal)
- **Combinação:** (1) RSS do Google News com termos "rodada", "série A/B", "capta", "aporte", "adquire", "fusão"; (2) **CVM**, fatos relevantes de companhias abertas (arquivo oficial `ipe_cia_aberta_<ano>.zip`, **1,7 MB, grátis**, testado que baixa); (3) classificação por IA para separar "é rodada de verdade" de menção.
- **Apify:** `memo23/crunchbase-scraper` (US$ 0,008 por item) **não testei**; cobertura de empresas brasileiras é duvidosa, deixo para depois.
- **Riscos:** falso positivo (notícia que só cita a palavra). O evento deve guardar o link como evidência.

### anuncios_ativos (marketing, 5 créditos, semanal)
- **Combinação:** `curious_coder/facebook-ads-library-scraper` (Meta, US$ 0,00075 por anúncio) + `silva95gustavo/google-ads-scraper` (Google, US$ 0,0019 por anúncio). `silva95gustavo/linkedin-ad-library-scraper` (US$ 0,002 por anúncio, **mínimo de 25 resultados**) **não validou**: a busca por nome devolveu 0.
- **Testado hoje:** Meta devolveu 10 anúncios ativos no Brasil; Google devolveu 5 anúncios da "MAGAZINE LUIZA S/A" (com datas de início e último dia exibido) a partir do domínio `magazineluiza.com.br`.
- **Achado importante:** a saída da Meta traz `snapshot.page_id` e `snapshot.brazil_tax_id` (o CNPJ do anunciante). Dá para **confirmar que o anúncio é da conta certa pelo CNPJ** e evitar falso positivo por nome.
- **Regras do ator:** Meta exige `count`/`limitPerSource` ≥ 10 e memória 512 MB (1 URL por 512 MB).
- **Custo:** 10 anúncios Meta + 5 Google ≈ US$ 0,017 por conta.

### avaliacoes_reclamacoes (marketing, 3 créditos, semanal)
- **Combinação:** `compass/Google-Maps-Reviews-Scraper` (US$ 0,0006 por avaliação) com `personalData=false`; achar o `placeId` antes pelo `compass/crawler-google-places`.
- **Testado hoje:** 10 avaliações recentes em português de uma loja (texto, estrelas, data, resposta do dono).
- **Reclame Aqui:** `blackfalcondata/reclameaqui-scraper` funciona (3 reclamações), mas cobra US$ 0,05 pela empresa e **US$ 0,025 por reclamação**. Com 3 reclamações já passa do que 3 créditos pagam. **Recomendação:** Reclame Aqui não entra nos 3 créditos; ou vira opção paga à parte, ou um coletor nosso mais barato (decisão do Nan).
- **Riscos:** os termos do Google Maps proíbem cópia em massa; não guardar dado pessoal de quem avaliou.

### nova_filial (comercial, 3 créditos, mensal)
- **Combinação:** `compass/crawler-google-places` buscando o nome da marca na cidade (US$ 0,004 por lugar) para contar lojas, **comparando com o mês anterior**; e BrasilAPI para confirmar o CNPJ da unidade nova.
- **Testado hoje:** busca "Magazine Luiza" em São Paulo devolveu 4 lugares (nome, endereço, `placeId`, nota, nº de avaliações). Um deles era uma loja de móveis com 1 avaliação, ou seja, **a busca por nome traz lugares que não são da empresa**; só vale com filtro (CNPJ/site/categoria).
- **Melhor fonte, não testada:** a base mensal de estabelecimentos da Receita (dados abertos) lista todas as filiais por raiz de CNPJ com data de início. É grátis, mas é um arquivo pesado e precisa de um job próprio.

### receita_federal (comercial, 2 créditos, mensal)
- **Fonte:** BrasilAPI `https://brasilapi.com.br/api/cnpj/v1/<CNPJ>`, **grátis**, sem Apify.
- **Testado hoje:** devolveu razão social, nome fantasia, CNAE, capital social (R$ 14,2 bi), porte, situação, data de início e 5 sócios (QSA) do CNPJ da Magalu.
- **Riscos:** sem garantia de disponibilidade; ter reserva (`minhareceita.org`, que pode ser auto-hospedado, **não testei**). Respeitar o uso justo (espaçar pedidos).

### importacao_ncm (comercial, 4 créditos, mensal): **sem solução boa**
- **O que achei:** os atores da Apify para comércio exterior cobrem EUA/Índia (ImportYeti, Zauba) ou dados por código NCM e país, **não por empresa brasileira**. O Comex Stat (MDIC) também é agregado por NCM/estado/país, e a API respondeu 403 para mim; o arquivo em lote não respondeu. **Não testei nada que dê importação por empresa.**
- **Decisão para o Nan:** (a) deixar o sinal "Em breve" até haver fonte; (b) trocar por sinal de **mercado por NCM** (agregado, sem empresa); ou (c) contratar um fornecedor pago de dados aduaneiros. Não sei qual fornecedor serve; não vou inventar nome.

### licitacoes_publicas (comercial, 4 créditos, semanal)
- **Fonte:** API oficial do PNCP, **grátis** (`pncp.gov.br/api/consulta/v1/contratos` e `/contratacoes/publicacao`).
- **Testado hoje:** na última semana havia **40.702 contratos** e 6.348 contratações. O contrato traz `niFornecedor` (CNPJ do fornecedor) e `nomeRazaoSocialFornecedor`.
- **Limite:** não achei filtro por fornecedor na consulta; o coletor lê a janela da semana e **filtra pelos CNPJs das contas do cliente**. Isso é muita página, então rodar uma vez por semana e para todos os clientes juntos.
- **Apify:** os atores de PNCP têm 1 a 2 usuários por mês e um deles falha 29% das vezes. Não recomendo.

### expositores_eventos (marketing, 6 créditos, mensal): **fraco**
- Testei `zen-studio/10times-events-scraper` (US$ 0,0035 por evento), que **estourou o tempo** (150 s, sem resultado). Os `skython/*-exhibitor-list-scraper` são um por feira, e quase todas são feiras da Europa/EUA. Não achei ator para feiras brasileiras.
- **Alternativa (não testada):** busca "expositor <empresa> <feira>" pelo `apify/google-search-scraper` (US$ 0,0045 por página) com classificação por IA. **Recomendação:** deixar "Em breve" até o Nan escolher quais feiras importam.

### gaps_seo (marketing, 8 créditos, mensal)
- **Combinação:** `constant_quadruped/lighthouse-auditor` (testado) e, como alternativa mais estável, a API gratuita PageSpeed Insights do Google (**não testei**; pede chave do Google).
- **Testado hoje:** em um site aberto (RD Station) devolveu desempenho 63 e SEO 100 em 100 segundos, com 10 auditorias falhando e 4 oportunidades. Custo ≈ US$ 0,004.
- **Risco:** sites que bloqueiam robô (a Magalu devolveu 403) voltam com notas vazias. Notas vazias = erro, não "gap".

### geo_presence (marketing, 10 créditos, mensal)
- **Combinação:** `apify/google-search-scraper` com `aiOverview.scrapeFullAiOverview=true` (US$ 0,0045 a página + US$ 0,003 a visão por IA).
- **Testado hoje:** a pergunta "melhores marketplaces do Brasil para vender" devolveu o texto da Visão geral por IA e as **fontes citadas** (dá para ver se a marca aparece), mais 8 resultados orgânicos.
- **Caros demais:** `apify/chatgpt-search-scraper` e o modo IA custam US$ 0,20 por resultado, que é mais do que 10 créditos pagam (R$ 0,53). Perplexity: **não sei o preço**.
- **Custo sugerido:** 5 perguntas por conta ≈ US$ 0,04.

### seguidores_concorrente (marketing, 20 créditos, mensal, desligado por padrão): **repensar**
- `scraping_solutions/instagram-scraper-followers-following-no-cookies` (US$ 0,00085 por seguidor) funciona: devolveu 25 seguidores (usuário, nome, se é privado/verificado).
- **Problemas:** é lista de **pessoas físicas** (LGPD), só Instagram, e mostra seguidores de qualquer tipo, não decisores B2B. Com 20 créditos (R$ 1,06) compra uns 200 seguidores.
- **Recomendação:** manter desligado; se for mantido, trocar para variação de **número de seguidores do concorrente** (`apify/instagram-profile-scraper`, US$ 0,0026 por perfil, **não testei**), sem guardar pessoas.

### mudanca_tech_stack (revops, 4 créditos, mensal)
- **Combinação:** `motivational_nickel/website-technology-detector` (US$ 0,0015 por site + US$ 0,002 por início) como principal e `benthepythondev/tech-stack-detector` (US$ 0,0025 por site) como conferência. `automation-lab/tech-stack-detector` cobra US$ 0,035 por início e quase usa todo o orçamento de 4 créditos.
- **Testado hoje (rdstation.com):** CMS WordPress, framework Next.js, CDN Cloudflare. O primeiro devolve categorias separadas (analytics, marketing, publicidade, pagamentos).
- **Risco principal:** sites com proteção (Magalu, Akamai) devolvem 403 e **zero tecnologias**. Se o coletor comparar com o mês anterior, isso viraria "trocou tudo". Resposta 403 ou lista vazia = erro (crédito devolvido), nunca mudança.
- Os atores têm pouquíssimos usuários (20 a 30 por mês): risco de sumirem.

## Os 4 sinais internos (sem Apify)
`objecoes_recorrentes`, `duplicidade_crm`, `negocio_parado` e `contato_invalido` rodam sobre o banco e a Caixa de entrada. Ficam fora desta tarefa.

## O que reaproveitar do protótipo (`AppAlthius`)
- O protótipo já tem adaptadores de vagas, movimentação, anúncios e avaliações em `AppAlthius/supabase/functions/signal-runner/adaptadores/` (em Deno, com testes e dedupe por acontecimento). Eles devem ser **portados** para Node em `src/server/sinais/`, não reescritos do zero.
- O protótipo validou em execução real (30/09/2026, Nubank) `vaga_linkedin` (50 vagas, 21 sinais) e `vaga_indeed` (92 vagas, 42 sinais). Este relatório confirma o LinkedIn de vagas com preço atualizado.
- Regras úteis dele: o mesmo acontecimento não conta duas vezes; sinal vale 30 dias de "conta quente"; avaliação do Google sem dado pessoal.

## Não verificado hoje
Filtro `companyName` do `valig`; Indeed e Gupy; `linkedin-post-search`; Crunchbase; PageSpeed Insights; `instagram-profile-scraper`; `skython/*` para feiras; ChatGPT/Perplexity no GEO; base mensal da Receita; Comex Stat em lote; aprovação de permissão de atores novos no console da Apify (alguns pedem na primeira vez).

## Descobertas na construção (06/10/2026)
- **Vagas:** o filtro `companyName` do `valig` funciona, mas só com o nome como o LinkedIn escreve ("Magalu" achou vagas, "Magazine Luiza" nenhuma). Testado com Nubank (8 vagas) e Magalu.
- **Troca de cargo e posts:** testados de ponta a ponta. O ator devolve `currentPosition` (cargo e empresa atuais) e não guarda a leitura anterior, então o retrato fica no banco. O identificador do perfil diferencia maiúsculas e minúsculas, e endereços "com código" (`/in/ACw...`) voltam como outro identificador.
- **Custo:** a Apify fecha a conta alguns segundos depois; o coletor relê até estabilizar (ex.: vagas, 11 itens = US$ 0,0054).
- **Ator com entrada recusada** devolve um item de erro com HTTP 200 no corpo; o coletor trata como falha.
