const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'public', 'Screenshot 2026-04-13 134937.png');
const targets = [
  path.join(root, 'public', 'new_logo.png'),
  path.join(root, 'public', 'logo.png'),
  path.join(root, 'resources', 'new_logo.png'),
  path.join(root, 'resources', 'logo.png'),
  path.join(root, 'android', 'app', 'src', 'main', 'res', 'drawable', 'jnb_logo.png'),
  path.join(root, 'android', 'app', 'src', 'main', 'res', 'drawable-night', 'jnb_logo.png'),
];

if (!fs.existsSync(source)) {
  throw new Error(`Brand logo source not found: ${source}`);
}

for (const target of targets) {
  fs.copyFileSync(source, target);
}
