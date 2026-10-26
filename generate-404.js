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

console.log('✅ 404.html, .nojekyll, and SPA route directories generated successfully');
