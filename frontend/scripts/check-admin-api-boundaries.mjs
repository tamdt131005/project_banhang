import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const protectedRoots = ['src/pages/admin', 'src/components/admin'];
const forbidden = [
  /from\s+['"][^'"]*api\/client['"]/, 
  /from\s+['"][^'"]*api\/generated(?:\/[^'"]*)?['"]/, 
  /import[\s\S]*?\badminApi\b[\s\S]*?from\s+['"][^'"]*api\/admin['"]/, 
];

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return ['.ts', '.tsx'].includes(extname(entry.name)) ? [path] : [];
  }));
  return nested.flat();
}

const violations = [];
for (const protectedRoot of protectedRoots) {
  for (const file of await sourceFiles(resolve(root, protectedRoot))) {
    const source = await readFile(file, 'utf8');
    if (forbidden.some((pattern) => pattern.test(source))) {
      violations.push(relative(root, file));
    }
  }
}

if (violations.length > 0) {
  console.error(`Admin UI must use adminGateway; forbidden API imports: ${violations.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Admin API import boundaries are valid.');
}
