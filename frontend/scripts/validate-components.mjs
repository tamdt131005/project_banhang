/**
 * Chạy validator AST của skill Stitch `react-components` lên mọi file .tsx.
 *
 * Validator kiểm tra hai điều:
 *   1. File phải khai báo `interface ...Props` (interface thật, không phải
 *      type alias) — mỗi component phải nói rõ hợp đồng của nó.
 *   2. Thuộc tính className không được chứa mã màu hex — màu phải đi qua token
 *      trong index.css để đổi một chỗ là đổi toàn bộ.
 *
 * Đường dẫn tới validator có chứa git SHA nên đổi mỗi lần cập nhật plugin;
 * vì vậy phải dò tìm thay vì ghi cứng.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PLUGIN_CACHE = path.join(os.homedir(), '.claude', 'plugins', 'cache');
const TAIL = path.join('skills', 'react-components', 'scripts', 'validate.js');

function findValidator() {
  if (!fs.existsSync(PLUGIN_CACHE)) return null;

  const candidates = [];
  for (const marketplace of fs.readdirSync(PLUGIN_CACHE)) {
    const pluginDir = path.join(PLUGIN_CACHE, marketplace);
    if (!fs.statSync(pluginDir).isDirectory()) continue;

    for (const plugin of fs.readdirSync(pluginDir)) {
      const versionsDir = path.join(pluginDir, plugin);
      if (!fs.statSync(versionsDir).isDirectory()) continue;

      for (const version of fs.readdirSync(versionsDir)) {
        const full = path.join(versionsDir, version, TAIL);
        if (fs.existsSync(full)) candidates.push(full);
      }
    }
  }

  if (candidates.length === 0) return null;
  // Bản mới nhất khi có nhiều phiên bản cùng tồn tại.
  return candidates.sort(
    (a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs,
  )[0];
}

/**
 * main.tsx là điểm khởi động (createRoot + các provider), không khai báo
 * component nào nên luật "phải có interface Props" không áp dụng được.
 */
const SKIP = new Set(['main.tsx']);

function collectTsx(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectTsx(full);
    if (!entry.name.endsWith('.tsx') || SKIP.has(entry.name)) return [];
    return [full];
  });
}

const validator = findValidator();

if (!validator) {
  console.error(
    'Không tìm thấy validator của skill Stitch.\n' +
      'Cài plugin bằng:  npx plugins add google-labs-code/stitch-skills --scope project --target claude-code',
  );
  process.exit(1);
}

if (!fs.existsSync(path.join(path.dirname(validator), '..', 'node_modules'))) {
  console.error(
    `Validator thiếu dependency. Chạy:\n  cd "${path.join(path.dirname(validator), '..')}" && npm install`,
  );
  process.exit(1);
}

const files = collectTsx(path.resolve('src'));
const failed = [];

for (const file of files) {
  const result = spawnSync(process.execPath, [validator, file], { encoding: 'utf8' });
  const relative = path.relative(process.cwd(), file);

  if (result.status === 0) {
    console.log(`  ok    ${relative}`);
  } else {
    failed.push(relative);
    const reason = `${result.stdout ?? ''}${result.stderr ?? ''}`
      .split('\n')
      .filter((line) => line.includes('❌') || line.includes('-'))
      .map((line) => line.trim())
      .join(' | ');
    console.log(`  FAIL  ${relative}  ${reason}`);
  }
}

console.log(`\n${files.length - failed.length}/${files.length} file hợp lệ.`);

if (failed.length > 0) {
  console.error(`\n${failed.length} file chưa đạt:\n${failed.map((f) => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
