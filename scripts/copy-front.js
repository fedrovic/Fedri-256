const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'frontend');
const dest = path.join(__dirname, '..', 'public');

async function copyDir(srcDir, destDir) {
  await fs.promises.mkdir(destDir, { recursive: true });
  const entries = await fs.promises.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

(async () => {
  try {
    if (!fs.existsSync(src)) {
      console.error('Source frontend directory not found:', src);
      process.exit(1);
    }
    await fs.promises.rm(dest, { recursive: true, force: true });
    await copyDir(src, dest);
    console.log('Copied frontend -> public');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
