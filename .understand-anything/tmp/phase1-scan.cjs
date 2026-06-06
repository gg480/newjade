// Phase 1: File scanner using Node.js fs/glob
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.argv[2] || 'D:\\02工作\\ERP\\newjade';
const EXCLUDE = new Set([
  'node_modules', '.next', '.git', 'dist', 'build', '.claude',
  '.understand-anything', 'coverage', '.turbo', 'target', 'obj'
]);
const EXCLUDE_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2',
  '.ttf', '.eot', '.mp3', '.mp4', '.pdf', '.zip', '.tar', '.gz', '.lock',
  '.db', '.db-journal', '.db-wal', '.sqlite', '.sqlite3'
]);

function walk(dir, relative = '') {
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.env.nas.example' && entry.name !== '.gitignore' && entry.name !== '.dockerignore' && entry.name !== '.github' && entry.name !== '.vscode') continue;
      if (EXCLUDE.has(entry.name)) continue;

      const full = path.join(dir, entry.name);
      const rel = relative ? `${relative}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        results.push(...walk(full, rel));
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (EXCLUDE_EXT.has(ext)) continue;

        let size = 0;
        try {
          size = fs.readFileSync(full, 'utf-8').split('\n').length;
        } catch { size = 0; }

        results.push({ path: rel, sizeLines: size });
      }
    }
  } catch (e) {
    // Permission denied, skip
  }
  return results;
}

console.log('Scanning project files...');
const files = walk(PROJECT_ROOT);
console.log(JSON.stringify({ totalFiles: files.length, files }, null, 2));
