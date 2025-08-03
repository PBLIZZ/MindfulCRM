import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

const projectRoot = process.cwd();
const files = glob.sync('{server,client,shared}/**/*.{ts,tsx}', {
  cwd: projectRoot,
  ignore: 'node_modules/**',
});

const importRegex = /(import(?:["'\s]*(?:[\w*{}\n\r\t, ]+)from\s*)?)(["'\s])((@shared\/|@\/|\.\.?\/)[.A-Za-z0-9\-_/]+)\2/gm;

let filesChanged = 0;

for (const file of files) {
  const filePath = path.join(projectRoot, file);
  let content = await fs.readFile(filePath, 'utf-8');
  let changed = false;

  const newContent = content.replace(importRegex, (match, pre, quote, impPath) => {
    // Don't add .js if it already has an extension
    if (path.extname(impPath)) {
      return match;
    }
    changed = true;
    return `${pre}${quote}${impPath}.js${quote}`;
  });

  if (changed) {
    filesChanged++;
    await fs.writeFile(filePath, newContent, 'utf-8');
    console.log(`Updated imports in: ${file}`);
  }
}

console.log(`\nProcess complete. Updated ${filesChanged} files.`);
