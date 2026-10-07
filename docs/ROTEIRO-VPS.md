# Roteiro: colocar a Althius no ar na VPS (você e seu sócio, antes do primeiro cliente)

Para quem não é programador: cada passo diz **onde** rodar (no seu computador ou no servidor), **o que** colar e **como saber que deu certo**. Se um passo der erro, pare e mande o texto do erro para quem está te ajudando; não pule para o próximo.

Combinado para esta fase: VPS básica (1 vCPU, 4 GB, 50 GB), só você e seu sócio usando, contas **gratuitas** da Apify (5, em rodízio) e da Unipile (as de 7 dias, trocando), Hermes dentro do mesmo servidor entrando pelo login do Codex. Quando entrar o primeiro cliente: subir o plano da VPS, passar as contas para pagas e o Hermes para chave de API (veja o fim).

Troque sempre `app.seudominio.com.br` pelo seu endereço de verdade.

---

## Parte A. Antes de mexer no servidor (no seu computador)

**A1. O código precisa estar no GitHub, na branch principal (`master`).** Quem está te ajudando faz isso (junta as branches e envia). Só avance quando ele disser "está no GitHub".

**A2. O repositório do GitHub é público**, então o servidor baixa o código sem senha nem token. (Por isso o código **nunca** pode ter chave, senha ou dado de pessoa real: cada chave fica só no `.env` do servidor e no cofre do sistema. Se um dia o repositório virar privado, será preciso criar um token de leitura no GitHub e usá-lo no passo C1.)

**A3. Aponte o domínio para a VPS.** No painel onde você comprou o domínio (ou no DNS dele), crie um registro:
- Tipo **A**, nome `app`, valor = o **IP da VPS** (aparece no painel da Hostinger).
- Se o DNS for da Cloudflare, deixe a nuvem **cinza** ("somente DNS") por enquanto.

Como saber que deu certo (pode levar de minutos a algumas horas): no seu computador, `ping app.seudominio.com.br` mostra o IP da VPS.

**A4. Na compra/configuração da VPS:** escolha o sistema **Ubuntu 24.04** e o datacenter do **Brasil**. Anote o IP e a senha do usuário `root`, ou, melhor, cadastre a sua chave SSH.

---

## Parte B. Preparar o servidor (uma vez)

Entre no servidor pelo terminal do seu computador:

```
ssh root@IP_DA_VPS
```

**B1. Atualizar e criar o espaço extra de memória (swap).** Sem isso a primeira compilação pode travar a máquina.

```
apt update && apt -y upgrade
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
free -h
```
Certo se: a linha `Swap` mostra `2.0Gi`.

**B2. Firewall (só entram as portas de uso) e proteção contra tentativas de invasão.**

```
apt -y install ufw fail2ban unattended-upgrades git
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

**B3. Um usuário comum, para não trabalhar sempre como `root`.**

```
adduser deploy
usermod -aG sudo deploy
```
(Defina uma senha forte quando pedir.) Se você usa chave SSH, copie-a: `rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy`. Depois **saia** (`exit`) e entre de novo como `deploy`:

```
ssh deploy@IP_DA_VPS
```

**B4. Instalar o Docker e o Node 22.**

```
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -y nodejs
```
**Saia e entre de novo** (`exit`, `ssh deploy@IP_DA_VPS`) para o Docker valer para o seu usuário. Depois confira:

```
docker compose version
node -v
```
Certo se: o Docker mostra uma versão e o Node mostra `v22.18` ou mais novo (ou `v24`).

---

## Parte C. Baixar e subir o sistema

**C1. Baixar o código.**

```
git clone https://github.com/Kauedz/althius-revenue-os.git
cd althius-revenue-os
```

**C2. Gerar as senhas do sistema (o arquivo `.env`).**

```
npm run docker:env -- --site=https://app.seudominio.com.br
```
Isso cria o `.env` com senhas novas e aleatórias.

> **Faça agora uma cópia segura do `.env`** (ele guarda a chave do banco e a chave do cofre; sem ele, as chaves guardadas não abrem). No **seu computador**:
> ```
> scp deploy@IP_DA_VPS:~/althius-revenue-os/.env ./althius-env-NAO-COMPARTILHAR
> ```
> Guarde esse arquivo no gerenciador de senhas ou em um pendrive. Nunca no GitHub.

**C3. Subir tudo.** A primeira vez demora (baixa e compila): são uns 10 a 20 minutos. Pode deixar rodando.

```
npm run docker:subir
```

**C4. Conferir.**

```
docker compose ps
```
Certo se: todos os serviços aparecem `running` ou `healthy` (o `migrar` aparece como concluído/`exited 0`, e isso é normal). Depois abra `https://app.seudominio.com.br` no navegador: deve aparecer a tela de login, com cadeado (o certificado sai sozinho).

Se o cadeado não aparecer: confira o passo A3 (o `ping` mostra o IP certo?) e rode `docker compose logs web`.

**C5. Criar o seu usuário (superadmin).** Uma única vez:

```
npm run criar-superadmin -- --email seu@email.com.br
```
O comando mostra um **link para definir a senha**. Abra o link no navegador e escolha a senha. Seu sócio é criado depois, **dentro do sistema** (tela de superadmin), sem comando.

---

## Parte D. Ligar as contas gratuitas (dentro do sistema)

Entre como superadmin → **Fornecedores** → **Nova chave**.

**D1. Apify (as 5 contas gratuitas).** Cadastre uma chave por conta (cada uma é o "API token" do painel da Apify). O sistema divide o trabalho entre elas; quando uma esgota o mês, ela sai de cena por 6 horas e a próxima assume (a tela mostra "Limite do mês esgotado nesta conta"). Use **Testar chave** em cada uma.

**D2. Unipile.** Cadastre a **chave** e o **endereço** da conta de teste atual (por exemplo `https://api68.unipile.com:19840`; o sistema reconhece a v1 pelo formato do endereço).

**D3. Segredo dos webhooks da Unipile.** Invente um texto longo e aleatório (32 caracteres ou mais). Cadastre-o como "segredo do webhook" da Unipile e guarde o mesmo texto: você vai usar no próximo passo.

**D4. Registrar os webhooks na Unipile.** Isso faz as **respostas das pessoas entrarem na Caixa de entrada**. No servidor, na pasta do projeto (troque a chave, o endereço e o segredo pelos da conta atual):

```
UNIPILE_API_KEY='CHAVE_DA_UNIPILE' UNIPILE_API_URL='https://api68.unipile.com:19840' \
npm run unipile:webhooks -- --url https://app.seudominio.com.br/webhooks/unipile --segredo 'O_SEGREDO_DO_D3'
```
Ele só **mostra** o que faria. Se estiver certo, rode de novo acrescentando `--aplicar` no fim. Depois apague no painel da Unipile os webhooks antigos de teste (os que apontam para `example.com`).

**D5. Conectar as contas de mensagem.** Cada pessoa, no sistema: **Caixa de entrada** → **Conectar** (LinkedIn, e-mail, WhatsApp, Instagram). O sistema fixa a conta no dono; se ela cair, aparece um aviso na tela pedindo para reconectar.

**Quando trocar a conta da Unipile (as de 7 dias):** repita D2 (troca a chave e o endereço no sistema) e D4 (com os dados da conta nova), e cada pessoa clica em **Reconectar agora** no aviso. As conversas e o histórico continuam.

---

## Parte E. Hermes (os agentes) dentro do servidor, entrando pelo login do Codex

**E1. Descobrir os números de que o comando precisa.**

```
set -a; . ./.env; set +a
docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db psql -h localhost -U supabase_admin -d postgres -c "select id, name from workspaces;"
docker compose exec -T -e PGPASSWORD="$POSTGRES_PASSWORD" db psql -h localhost -U supabase_admin -d postgres -c "select id, workspace_id, role from workspace_members where role = 'superadmin';"
```
Anote o `id` do workspace **"Althius (interno)"** e o `id` do seu membro superadmin desse workspace.

**E2. Preparar o Hermes.** Troque os dois números pelos que você anotou. O nome do modelo (`gpt-6-luna`; a alternativa é `gpt-5.6-luna`) só é confirmado no login, no passo E4.

```
npm run agentes:provisionar -- --workspace ID_DO_WORKSPACE --responsavel ID_DO_MEMBRO --slug althius --modelo-oauth gpt-6-luna
npm run docker:subir
```

**E3. Fazer o login do Codex, uma vez.**

```
docker exec -it hermes-althius hermes auth add openai-codex
```
Ele mostra um **endereço e um código**. Abra o endereço no navegador do seu computador, entre na sua conta do ChatGPT/Codex e digite o código.

**E4. Ver qual modelo a sua conta enxerga.**

```
docker exec -it hermes-althius hermes model
```
Se `gpt-6-luna` não aparecer, use o que aparecer (por exemplo `gpt-5.6-luna`) e rode de novo o `agentes:provisionar` do E2 com esse nome.

**E5. Testar.** No sistema, converse com um agente (por exemplo a Zoe). Se aparecer "Provider authentication failed… No Codex credentials stored", o login do E3 não pegou: repita-o.

> **Atenção:** o login do Codex é de uma **pessoa**, tem limites do plano e é **só para testes**. Antes de atender cliente pagante, confira os termos da OpenAI e passe para chave de API (veja o fim).

---

## Parte F. Cuidados do dia a dia

**Ver o que está rodando e os problemas**
```
docker compose ps
docker compose logs -f webhooks        # trocar "webhooks" por cadencia, auth, rest, web...
```

**Atualizar o sistema** (quando houver versão nova no GitHub)
```
cd ~/althius-revenue-os && git pull && npm run docker:subir
```
O sistema fica fora do ar por alguns minutos nessa hora.

**Backup** — o sistema já grava um backup por dia em `~/althius-revenue-os/backups`, **na mesma máquina**. Isso **não protege** se o servidor se perder. Faça as duas coisas:
1. Ative o **snapshot automático** no painel da Hostinger.
2. Copie a pasta para fora do servidor, por exemplo a cada semana, no **seu computador**:
   ```
   scp -r deploy@IP_DA_VPS:~/althius-revenue-os/backups ./backups-althius
   ```
Combine com seu sócio de **testar uma restauração** pelo menos uma vez (o passo a passo está em `docker/LEIA-ME.md`, seção "Restaurar um backup").

**Aviso de "o site caiu"** — crie uma conta gratuita em um monitor como o UptimeRobot e cadastre `https://app.seudominio.com.br` para receber um e-mail se sair do ar.

**Nunca faça:** `docker compose down -v` (apaga o banco), `npm run docker:env:demo` (cria usuários com senha pública), apagar o `.env`.

---

## Parte G. Quando entrar o primeiro cliente

1. **Suba o plano da VPS** (2 vCPU e 8 GB, na mesma máquina, sem perder nada) no painel da Hostinger.
2. **Apify e Unipile pagas:** troque as chaves em Fornecedores (D1 e D2) e registre os webhooks da conta paga (D4).
3. **Hermes com chave de API:** passe do login do Codex para o gateway com chave (rode `agentes:provisionar` **sem** `--modelo-oauth` e cadastre a chave do modelo em Fornecedores).
4. **Crie o cliente** na tela de superadmin e dê os créditos; o teto de coleta é de US$ 50 por mês por cliente (ajustável em "Uso global").
5. Confira o backup externo e a restauração antes de colocar dado de cliente.
