const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');
const devIndexPath = path.join(distPath, 'index.dev.html');
const notFoundPath = path.join(distPath, '404.html');
const noJekyllPath = path.join(distPath, '.nojekyll');

if (!fs.existsSync(indexPath) && fs.existsSync(devIndexPath)) {
  fs.renameSync(devIndexPath, indexPath);
}

if (!fs.existsSync(indexPath)) {
  console.error('❌ index.html not found in dist/');
  process.exit(1);
}

const indexContent = fs.readFileSync(indexPath, 'utf8');
fs.writeFileSync(notFoundPath, indexContent);
fs.writeFileSync(noJekyllPath, '');

// Pre-create SPA route folders so GitHub Pages serves HTTP 200 directly
const spaRoutes = [
  'campaigns',
  'wiki',
  'wiki/bttf',
  'login',
  'register',
  'dashboard',
  'profile',
  'logs',
  'monitoreo',
  'anuncios',
  'directorio',
  'misiones',
  'articulos',
  'settings',
];

spaRoutes.forEach((route) => {
  const distRouteDir = path.join(distPath, route);
  if (!fs.existsSync(distRouteDir)) {
    fs.mkdirSync(distRouteDir, { recursive: true });
  }
  fs.writeFileSync(path.join(distRouteDir, 'index.html'), indexContent);

  const rootRouteDir = path.join(__dirname, route);
  if (!fs.existsSync(rootRouteDir)) {
    fs.mkdirSync(rootRouteDir, { recursive: true });
  }
  fs.writeFileSync(path.join(rootRouteDir, 'index.html'), indexContent);
});

// Dedicated fast redirect routes for donations (obfuscates personal username)
const redirectRoutes = ['donar', 'kofi'];
const redirectHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Papustanes en Mazmorras - Donaciones</title>
  <meta http-equiv="refresh" content="0; url=https://ko-fi.com/luismedina47871">
  <script>
    window.location.replace("https://ko-fi.com/luismedina47871");
  </script>
</head>
<body style="background:#0c0a09;color:#fde68a;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;">
  <h2>Papustanes en Mazmorras</h2>
  <p>Redirigiendo a Ko-fi...</p>
</body>
</html>`;

redirectRoutes.forEach((route) => {
  const distRouteDir = path.join(distPath, route);
  if (!fs.existsSync(distRouteDir)) {
    fs.mkdirSync(distRouteDir, { recursive: true });
  }
  fs.writeFileSync(path.join(distRouteDir, 'index.html'), redirectHtml);

  const rootRouteDir = path.join(__dirname, route);
  if (!fs.existsSync(rootRouteDir)) {
    fs.mkdirSync(rootRouteDir, { recursive: true });
  }
  fs.writeFileSync(path.join(rootRouteDir, 'index.html'), redirectHtml);
});

console.log('✅ 404.html, .nojekyll, SPA route directories, and donation redirects generated successfully');
