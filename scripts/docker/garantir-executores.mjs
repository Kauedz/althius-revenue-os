// Garante que docker/agentes-executores.json existe antes de subir o Docker. Se o arquivo faltar, o Docker cria uma
// PASTA com esse nome no lugar e o serviço `agentes` quebra. Vazio = nenhum agente responde (os pedidos esperam na fila).
import { existsSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const CONTEUDO_VAZIO = '{\n  "executores": {}\n}\n';

/** true quando criou o arquivo; erro claro se já existe uma PASTA com o nome (resto de uma subida anterior). */
export function garantirExecutores(arquivo) {
  if (existsSync(arquivo)) {
    if (statSync(arquivo).isDirectory()) throw new Error(`${arquivo} é uma pasta (o Docker a criou). Apague a pasta e rode de novo: ela deve ser um arquivo.`);
    return false;
  }
  writeFileSync(arquivo, CONTEUDO_VAZIO);
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  try {
    if (garantirExecutores(path.join(raiz, 'docker', 'agentes-executores.json'))) console.log('Criei docker/agentes-executores.json vazio (nenhum agente responde até você registrar os executores).');
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
