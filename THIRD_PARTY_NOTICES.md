# Avisos de terceiros (THIRD_PARTY_NOTICES)

O Althius reaproveita peças de projetos abertos, conforme a [ADR 0038](docs/adr/0038-ferro-velho-twenty-buzz.md).
Cada peça aparece abaixo com origem, licença e o que foi adaptado.

## 1. Buzz — auditoria encadeada por hash

| Campo | Valor |
|---|---|
| Projeto | Buzz — https://github.com/block/buzz |
| Origem | `crates/buzz-audit/src/hash.rs` e `crates/buzz-audit/src/service.rs` |
| Commit | `f0eb5575ffc9d5f57af4ed3f574529d997c83a0d` |
| Licença | Apache License 2.0 |
| Copyright | Copyright 2026 Block, Inc. (linha do arquivo `LICENSE` do repositório; o Buzz não tem arquivo `NOTICE`) |
| Destino | `supabase/migrations/20261002000091_audit_hash_chain.sql` (teste: `supabase/tests/database/00044_audit_hash_chain.sql`) |

**O que foi adaptado:**

- Rust → gatilho e funções em Postgres (`internal.audit_encadear`, `internal.audit_calcular_hash`, `public.audit_verify_chain`). O cálculo roda dentro do banco, então nenhuma tela, agente ou worker grava hash falso.
- `community_id` → `workspace_id`; `pubkey`/`detail` → colunas e JSON do `audit_logs` do Althius (ator, papel, ação, entidade, valores antigos e novos, IP, navegador).
- Rótulo do hash `buzz:audit:v2` → `althius:audit:v1`. A codificação TLV (1 byte de tag + 8 bytes de tamanho, big-endian) e a omissão de campo ausente foram mantidas.
- Trava por tenant: `pg_advisory_lock` → `pg_advisory_xact_lock(hashtextextended(...))`, liberada no fim da transação.
- Data do registro em UTC com microssegundos fixos (precisão do `TIMESTAMPTZ`), como no original.
- Não portados: a versão legada de codificação (v1 do Buzz), a verificação por intervalo e o tipo de ação do Buzz.

### Texto da licença (Apache License 2.0, copiado do `LICENSE` do Buzz no commit acima)

```text
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

Copyright 2026 Block, Inc.

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```

## 2. Twenty - normalização de domínio, e-mail e CSV (TypeScript)

| Campo | Valor |
|---|---|
| Projeto | Twenty - https://github.com/twentyhq/twenty |
| Pacote de origem | `packages/twenty-shared` (campo `license` do `package.json`: `MIT`; arquivo `LICENSE` na raiz do pacote) |
| Commit | `fa512ae4d42d45d05e8907211709e9d614f447b7` |
| Licença | MIT |
| Copyright | Copyright (c) 2023-present Twenty.com, PBC |
| Destino | `src/app/normalizacao.ts` (testes: `src/app/normalizacao.test.ts` e `src/app/normalizacao.banco.test.ts`) |

**Conferência de licença (feita no commit acima, arquivo por arquivo):** nenhum dos arquivos abaixo tem `@license` (nem `@license Enterprise`) e o pacote `twenty-shared` é MIT. Nada fora de `twenty-shared` foi copiado.

**Arquivos portados** (todos em `packages/twenty-shared/src/`):

| Origem | Vira (em `normalizacao.ts`) |
|---|---|
| `utils/url/normalizeDomain.ts` | `normalizarDominio` |
| `utils/url/isValidDomain.ts` | `dominioValido` |
| `utils/url/isValidHostname.ts` | `hostnameValido` (interna) |
| `utils/url/getUrlHostnameOrThrow.ts` | `hostDaUrl` |
| `utils/url/absoluteUrlSchema.ts` | `urlAbsolutaOuNulo` (interna, sem `zod`) |
| `utils/url/ensureAbsoluteUrl.ts` | `garantirUrlAbsoluta` (interna) |
| `utils/url/normalizeUrl.ts` | `normalizarUrl` |
| `utils/url/normalizeUrlOrigin.ts` | `tirarBarraFinal` (interna) |
| `utils/getUrlSafely.ts` | usado dentro de `tirarBarraFinal` |
| `utils/email/formatEmailAddress.ts` | `formatarEmail` (sem `@sniptt/guards`) |
| `utils/email/parseEmailAddressList.ts` | `lerListaDeEmails` (**só o contrato**; ver abaixo) |
| `utils/csv/formatValueForCSV.ts` | `valorParaCsv` (sem `@sniptt/guards`) |
| `utils/csv/sanitizeValueForCSVExport.ts` | `higienizarValorCsv` |
| `constants/CsvDangerousCharacters.ts` | constante interna do CSV |
| `constants/CsvInjectionPreventionZwj.ts` | constante interna do CSV |

**O que foi adaptado:**

- Nomes em português; o nome original fica em comentário de origem em cada função.
- `zod` e `@sniptt/guards` trocados por checagens simples (`typeof`): nenhuma dependência nova.
- `lerListaDeEmails`: o original usa o pacote `addressparser`. Em vez de instalar uma dependência, foi escrito um leitor próprio (sem copiar código do `addressparser`) que cumpre o mesmo contrato (lista com `,` ou `;`, nome entre aspas, grupos achatados) e é testado com os mesmos casos dos testes do Twenty. Diferença conhecida: o `addressparser` perde uma barra invertida dupla ao reler um nome; o nosso devolve o nome exato.
- `normalizarDominio` devolve `null` quando o texto não é um domínio de empresa (vazio, `localhost`, IP, sem terminação), igual à função `public.normalize_domain` do banco. O original devolve o texto como veio.
- `normalizarDominio` também troca `\` por `/` antes de separar o caminho e aceita `//site.com` (sem protocolo), como a função do banco faz.
- `garantirUrlAbsoluta` reconhece `http://` e `https://` em qualquer combinação de maiúsculas e minúsculas (o original só reconhece `http://`, `https://`, `HTTP://` e `HTTPS://`).
- Não portados: `getAbsoluteUrlOrThrow`, `getSafeUrl`, `isSafeUrl`, `buildSignedPath`, `normalizeAllowedIframeOrigin`, `safeDecodeURIComponent` e tudo de `email/` ligado a contas conectadas.

### Texto da licença (MIT, copiado do `LICENSE` de `packages/twenty-shared` no commit acima)

```text
MIT License

Copyright (c) 2023-present Twenty.com, PBC

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 3. Buzz — harness de canal para agentes (desenho, sem cópia de código)

| Campo | Valor |
|---|---|
| Projeto | Buzz — https://github.com/block/buzz |
| Origem | `crates/buzz-acp/src/queue.rs` (fila por canal, lote, tentativas), `filter.rs` (regra de quando o agente responde) e `session_model_channel.md` (uma sessão por canal) |
| Commit | `f0eb5575ffc9d5f57af4ed3f574529d997c83a0d` |
| Licença | Apache License 2.0 (texto completo na seção 1) |
| Copyright | Copyright 2026 Block, Inc. |
| Destino | `supabase/migrations/20261002000110_canais_agentes_harness.sql`, `src/server/agentes/harness.ts` (testes: `supabase/tests/database/00062_canais_agentes_harness.sql`, `src/server/agentes/harness.test.ts`) |

**O que foi adaptado (o código em Rust não foi copiado; o desenho foi reescrito em Postgres e TypeScript):**

- Fila por canal; ao pegar, o canal com o pedido mais antigo entrega **todos** os pendentes de uma vez, em um lote de até 50 (`MAX_BATCH_EVENTS`); teto de 500 pedidos esperando por canal (`MAX_PENDING_PER_CHANNEL`), o mais antigo cai primeiro.
- Tentativas: espera de 5 s dobrando a cada falha, no máximo 300 s (`BASE_RETRY_DELAY_SECS`, `MAX_RETRY_DELAY_SECS`); 10 falhas e o pedido é dado como perdido (`MAX_RETRIES`).
- Prazo máximo do lote em andamento (`in_flight` deadline).
- Política de resposta do agente (menção, dono, sempre), inspirada em `require_mention` do `filter.rs`; o filtro por expressão do Buzz **não** foi portado.
- Nostr (`Event`, pubkey, tags) → `chat_messages` do Althius; memória do processo → tabelas no Postgres, com RLS e acesso só do sistema.
- Acrescentado, sem equivalente no Buzz: um pedido por vez por agente por workspace, agrupamento por "silêncio" do canal, batimento de vida com recolhimento, reserva e consumo de créditos e a política Hermes antes de entrar na fila.
