# Gemini CLI: preparação da análise

Data: 06/10/2026. Pedido do Nan: usar o REA para estudar a estrutura de um agente com ferramentas e trazer os padrões para o Althius. O alvo escolhido pelo dono foi o Gemini CLI, porque é código aberto (Apache-2.0) e usa o mesmo stack (Node/TypeScript). Analisar o código do Claude foi recusado (software fechado).

## 1. Recursos do REA disponíveis

- **Ferramenta:** REA (`morluto/rea`, MIT), commit `91daaa68`, versão 4.0.1, compilado localmente (`npm ci && npm run build`).
- **Ambiente:** Ubuntu 24.04 e Node 22.22. Hopper e Ghidra **não** estão instalados, e os recursos de macOS não existem neste sistema.
- **Disponíveis** (`rea capabilities`, em [evidencias/rea-capabilities.json](evidencias/rea-capabilities.json)):
  - `extract_artifact`, `inspect_artifact`;
  - `decode_interface_builder`, `inspect_keyed_archive`;
  - `inspect_managed_*` (.NET).
- **Indisponíveis:** os 9 recursos nativos de macOS (`unsupported_host`) e a análise binária profunda (precisa de Hopper ou Ghidra).
- **Fluxo de JavaScript:** `analyze-javascript-application` não depende de Hopper nem Ghidra e serve para este alvo.

## 2. Doctor

`rea doctor` está salvo em [evidencias/rea-doctor.json](evidencias/rea-doctor.json).

- **Resultado geral:** `healthy: false`.
- **Pontos verdes:** Node e sistema.
- **Pontos vermelhos:**
  - Hopper e Ghidra não instalados (`missing_analysis_engine`);
  - skill e registro do REA no cliente (`config_drift`), porque não rodamos `rea setup` para não mexer na configuração do agente.
- **Efeito:** nada disso impede a análise estática de JavaScript.

## 3. Artefato local autorizado

| Item | Valor |
|---|---|
| Pacote publicado | `@google/gemini-cli@0.62.0` (via `npm pack`, sem instalar) |
| SHA-256 do .tgz | `2276032b1c33d2b828b1cf197e52f48e74b0a395326763ff01a80d97d0fbc0c3` ([evidencias/artefato.sha256](evidencias/artefato.sha256)) |
| Fonte para conferência | `github.com/google-gemini/gemini-cli`, commit `fb972b2f87fe7d5b06d37eac711490162d98de2c` |
| Licença | Apache-2.0 (arquivo LICENSE do pacote e do repositório) |
| Onde ficou | Pasta separada fora do projeto. Nada do alvo foi executado, instalado ou compilado. |

## 4. Como a análise foi feita (somente leitura)

1. **`rea inspect-artifact` no .tgz.** Recusado com `unsupported binary format`, porque o REA não abre .tgz direto. Está registrado em [evidencias/rea-inspect-artifact.json](evidencias/rea-inspect-artifact.json).
2. **`rea analyze-javascript-application`**, tentado duas vezes:
   - Na pasta extraída do pacote completo (`@google/gemini-cli`, que tem um pedaço de 16,7 MB): passou de 40 minutos e 3,2 GB de memória sem terminar e foi interrompido.
   - No núcleo publicado separado (`@google/gemini-cli-core@0.62.0`, Apache-2.0, 892 arquivos JS, SHA-256 `1dddd8c1a8990c23a7007bf9bd25e03a3df69577254a51136c0ed30cff930c82`): passou de 10 minutos sem resultado e também foi interrompido.
   - **Não há grafo do REA nesta análise.** Isso é um limite registrado, não um resultado.
3. **Leitura do código-fonte do mesmo produto, arquivo por arquivo,** nas 14 categorias pedidas. Cada fato traz o caminho e a linha em `packages/core/src` (ou `packages/cli/src`).

O resultado está em [categorias.md](categorias.md). O que virou código no Althius está na ADR 0061.
