# O que ficou de fora nestas quatro telas

Isto vale para o modo real, com dados do banco. O que está aqui não foi feito de propósito nesta etapa. Nada disso é um erro de carga: a tela abre, mostra o que existe e avisa quando a leitura falha.

## Integrações

- Não há como conectar Apify, Unipile, HubSpot nem e-mail por esta tela. Ela só lista contas de mensagem que já existem (e-mail, LinkedIn, WhatsApp e Instagram).
- Os botões de conectar, testar e reconectar ficam escondidos.
- As colunas Permissão e Último teste aparecem sempre como "Sem dados ainda". O banco não guarda esses dois dados.
- Cada pessoa vê só as próprias contas de mensagem. Quem é superadmin vê todas, porque a regra do banco permite.
- A coluna Fornecedor continua escondida para quem não tem a permissão de ver fornecedores. O C-level não tem essa permissão, então não vê o nome da conta.

## Campanhas

- Não existe coluna de orçamento em dólar. A coluna Investido fica "Sem dados ainda", mesmo quando a campanha tem verba guardada.
- Investimento, CPL e pipeline influenciado ficam "Sem dados ainda". O número de leads gerados é o único desses indicadores que a tela calcula.
- Ativar uma campanha paga (LinkedIn Ads, Meta Ads, Google Ads, ou qualquer uma com verba) não liga a campanha. O pedido vai para aprovação de quem paga ou para a fila de execução. Uma campanha sem verba e fora desses canais pode ser ligada na hora.

## Estratégia

- Os indicadores de personas, segmentos e contas no ICP ficam "Sem dados ainda". A tela não conta esses três.
- O indicador de ICP vigente mostra a versão do ICP que está publicado, quando existe. Os outros três não.

## Conteúdos

- Publicar passa pelo Hermes, na permissão de decidir aprovações.
- Se a publicação precisa de aprovação, o conteúdo não é marcado como publicado. Ele fica em aprovação.
- Se o Hermes autoriza na hora, aí sim o conteúdo fica publicado.
