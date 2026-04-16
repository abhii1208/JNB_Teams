const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'public', 'Screenshot 2026-04-13 134937.png');
const resRoot = path.join(root, 'android', 'app', 'src', 'main', 'res');

if (!fs.existsSync(source)) {
  throw new Error(`Brand icon source not found: ${source}`);
}

const folders = fs.readdirSync(resRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('drawable'))
  .map((entry) => entry.name);

for (const folder of folders) {
  const target = path.join(resRoot, folder, 'splash.png');
  if (fs.existsSync(target)) {
    fs.copyFileSync(source, target);
  }
}
