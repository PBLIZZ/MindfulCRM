const fs = require('fs');
const path = require('path');
const glob = require('glob');

const files = glob.sync('server/**/*.ts', {
  ignore: 'node_modules/**',
});

files.forEach((file) => {
  let content = fs.readFileSync(file, 'utf8');

  // Fix relative imports
  content = content.replace(/from\s+['"](\.\.?\/[^'"]+)(?<!\.js)['"]/g, "from '$1.js'");

  // Fix @shared imports to relative paths
  const depth = file.split('/').length - 2; // Adjust for server folder
  const sharedPath = '../'.repeat(depth) + 'shared';
  content = content.replace(/from\s+['"]@shared\/([^'"]+)['"]/g, `from '${sharedPath}/$1.js'`);

  fs.writeFileSync(file, content);
});

console.log('Import paths fixed!');
