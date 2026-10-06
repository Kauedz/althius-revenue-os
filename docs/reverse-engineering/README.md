# Engenharia reversa (somente leitura)

Esta pasta guarda o estudo de outros produtos para trazer ideias ao Althius. Ninguém copia código daqui: o que vira código no Althius é escrito do zero e citado na ADR correspondente.

## Regras

1. **Alvo autorizado.** Só analisamos software com licença aberta que permite estudo e reuso (Apache-2.0, MIT…), na versão exata registrada aqui.
   - **Não analisamos software fechado.** Isso inclui o Claude Code e o Claude Agent SDK da Anthropic: os termos proíbem descompilar e reproduzir.
2. **Somente leitura.** O alvo é baixado numa pasta separada e nunca executado. Lemos o código e usamos a análise estática do REA. Ninguém roda o build nem os scripts do alvo.
3. **Evidência separada.** Cada conclusão vai em uma de três listas:
   - **Fatos:** arquivo e linha conferidos.
   - **Hipóteses:** inferências não conferidas.
   - **Desconhecidos:** o que não foi possível ver.
4. **Do estudo ao código.** O que for adotado entra no Althius por uma ADR, com testes, adaptado às nossas regras: créditos e nunca dólar, aprovação de uma pessoa, isolamento por cliente.

## Estudos

| Alvo | Versão | Licença | Pasta | ADR |
|---|---|---|---|---|
| Gemini CLI (Google) | npm `@google/gemini-cli` 0.62.0 · fonte `fb972b2f` | Apache-2.0 | [gemini-cli/](gemini-cli/) | [0061](../adr/0061-camada-de-execucao-das-ferramentas.md) |
