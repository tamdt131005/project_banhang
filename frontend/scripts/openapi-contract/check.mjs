import { readGeneratedContract, renderContract } from './contract.mjs';

const [expected, actual] = await Promise.all([renderContract(), readGeneratedContract()]);
if (actual !== expected) {
  console.error('Admin API contract is stale. Run: npm run api:generate');
  process.exitCode = 1;
} else {
  console.log('Admin API contract is up to date.');
}
