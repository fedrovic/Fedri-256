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
    // Ensure a root index.html exists so static hosts (and Vercel) serve '/'
    const indexPath = path.join(dest, 'index.html');
    if (!fs.existsSync(indexPath)) {
      const redirectHtml = `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <meta http-equiv="refresh" content="0;url=/skillswap-landing.html" />\n    <meta name="viewport" content="width=device-width,initial-scale=1" />\n    <title>Redirecting…</title>\n    <script>location.replace('/skillswap-landing.html');</script>\n  </head>\n  <body>\n    Redirecting to <a href="/skillswap-landing.html">skillswap-landing.html</a>\n  </body>\n</html>`;
      await fs.promises.writeFile(indexPath, redirectHtml, 'utf8');
    }
    console.log('Copied frontend -> public');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
