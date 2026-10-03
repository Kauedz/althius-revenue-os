# ADR 0026: Limites da fatia de Cadências e Tarefas

## Contexto
As telas v18 usam dados de demonstração e alterações na memória. O pedido do dono exige leitura e gravação reais, BDR limitado às próprias tarefas, isolamento Evolut/Grão Norte e registro de tarefa/execução sem envio real de mensagens.

## Regras confirmadas pelo pedido
- O dono da tarefa é assignee_member_id, um membro do mesmo workspace. O BDR lê e conclui somente tarefas atribuídas a ele; criar para outra pessoa continua restrito aos papéis com escopo correspondente em tasks.assign.
- A referência genérica do documento a tarefas sem responsável visíveis não amplia esse alcance: o pedido desta fatia é explícito e a tabela atual exige responsável.
- Nenhuma mensagem será enviada nesta fatia; nenhuma conclusão afirmará envio ou atualização de CRM que ainda não aconteceu.
- Testes Vitest observam o serviço público e a tela. Consultas de preparação/restauração não servem como prova lateral das ações; os arquivos registram seu Seam.
- Escrita no banco será testada no contrato público por pgTAP, com identidade verificada e permissões explícitas conforme ADR 0023.

## Divergência resolvida pelo dono
A matriz do documento (cadences.auto) permite C-level ligar o modo automático. A revisão de congruência da seção Cadências diz “C-level só vê”. O dono respondeu nesta tarefa: “Pode alterar somente o modo, conforme a matriz”. Assim, C-level pode alternar automático/manual dos passos compatíveis, pela capacidade cadences.auto. Edição de texto e sequência segue cadences.edit: C-level apenas lê. Trocar modo grava configuração; o envio real continua fora desta fatia.

## Consequências
A próxima integração preserva as telas v18 e substitui o caminho de dados e gravações. Execução externa, consumo efetivo por envio, credenciais e sincronização de CRM ficam com suas próprias fatias e interfaces. Não criar confirmações fictícias no front.
