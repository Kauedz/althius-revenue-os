# ADR 0070 — A Unipile é só a ponte: o histórico é nosso

Status: aceita
Data: 2026-10-07
Relacionadas: 0017 (a conta é da pessoa), 0069 (Caixa no LinkedIn e Instagram, Unipile v1 e v2).

## Contexto
Decisão do Nan: se a Althius trocar de API de mensagens, **todos os dados continuam registrados** e a Unipile é apenas a ponte. Ao ligar a Unipile de verdade (conta v1, com LinkedIn, e-mail, WhatsApp e Instagram), apareceram também falhas de encaixe entre a ponte e a plataforma.

## Decisão
1. **O que mora no nosso banco, e só nele:** contatos e seus canais, contas (empresas), conversas, mensagens, pedidos de resposta, créditos, auditoria. A ponte guarda só o transporte: o login de cada conta conectada e a entrega. Nada do CRM depende de a Unipile ter ou não o dado.
2. **Trocar a ponte não parte o histórico.**
   - A conta de mensagem é um registro nosso (`messaging_accounts`); reconectar (mesma pessoa, mesmo canal) reaproveita o **mesmo registro** e só troca o id externo. Conversas e mensagens ficam presas ao registro nosso, não ao id da ponte.
   - Nos canais de chat (LinkedIn, WhatsApp, Instagram) a conversa é **uma por contato e conta**: se a ponte nova mandar outro id de chat para o mesmo contato, a conversa e o histórico continuam, e só o id externo é atualizado. E-mail segue por assunto.
   - O código fala com a ponte por uma interface pequena (`Mensageiro`, a criação do link de conexão, o receptor de avisos e a sincronia de contas). Há dois adaptadores: Unipile v1 e v2. Outra ponte seria um terceiro adaptador, sem mexer no banco nem nas telas.
3. **Sincronia com a ponte, sem depender de webhook** (`src/server/conexoes/sincronizar.ts`, roda no serviço de envio): (a) um pedido de conexão aberto acha a conta recém-criada do mesmo provedor e a liga, **só se houver exatamente uma candidata**, e o dono continua sendo o do pedido; (b) o estado das contas acompanha a ponte (caiu = pede reconectar, voltou = conectada, sumiu = desconectada, só com a lista completa). Isso cobre aviso perdido e o período em que o sistema ainda não tem endereço público.
4. **Casamento do remetente com o contato do CRM, corrigido:** o WhatsApp manda o número com 55 e o CRM costuma guardar sem, e o contato só era procurado como "whatsapp" (não como "phone"). Agora casa pelo número sem o 55, nos dois tipos. Endereço de perfil do Instagram e do LinkedIn (com barra no fim ou parâmetros) é reduzido ao usuário. A privacidade não muda: quem não é do CRM continua descartado sem gravar nada.
5. **Teste de ponta a ponta com a Unipile real** (`src/server/ponta-a-ponta.unipile.test.ts`): fica pulado no dia a dia; quem roda, com a chave de teste, o número e o texto aprovados, envia **uma mensagem real** passando por: aviso de conexão, mensagem recebida, resposta pela Caixa (política, créditos), serviço de envio e Unipile. Apaga tudo o que cria.

## Limites conhecidos
- O formato dos avisos (webhooks) da v1 segue a documentação; ainda não foi visto com tráfego real porque o sistema não tem endereço público. A sincronia cobre a conexão e o estado, mas **mensagem recebida só entra por webhook**.
- O Instagram ainda não tem conversa pelo nosso código: o nosso envio só responde dentro de uma conversa que já existe, e ela aparece quando a pessoa escrever primeiro.
- Trocar de ponte exige reconectar cada conta (o login mora na ponte). O histórico fica; as contas é que precisam de um novo "Conectar".
