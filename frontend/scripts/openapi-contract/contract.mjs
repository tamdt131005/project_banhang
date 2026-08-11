import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString, COMMENT_HEADER } from 'openapi-typescript';

export const schemaUrl = new URL('../../../docs/backend/openapi.yaml', import.meta.url);
export const outputUrl = new URL('../../src/api/generated/admin-contract.ts', import.meta.url);

export async function renderContract() {
  const nodes = await openapiTS(schemaUrl);
  return `${COMMENT_HEADER}${astToString(nodes)}`;
}

export async function readGeneratedContract() {
  return readFile(fileURLToPath(outputUrl), 'utf8');
}
