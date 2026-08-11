import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { outputUrl, renderContract } from './contract.mjs';

const outputPath = fileURLToPath(outputUrl);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, await renderContract(), 'utf8');
console.log(`Generated ${outputPath}`);
