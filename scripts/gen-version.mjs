// Gera static/version.json a cada build com a APP_VERSION atual.
// Usado pelo runtime pra detectar que o servidor tem versão mais nova
// que o cache local (PWA no iOS não dá F5).

import { readFile, writeFile } from 'node:fs/promises';

const versionFile = await readFile('src/lib/version.ts', 'utf8');
const match = versionFile.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
if (!match) {
  console.error('APP_VERSION não encontrada em src/lib/version.ts');
  process.exit(1);
}
const version = match[1];
const payload = {
  version,
  builtAt: new Date().toISOString()
};
await writeFile('static/version.json', JSON.stringify(payload, null, 2) + '\n');
console.log(`[gen-version] static/version.json -> ${version}`);
