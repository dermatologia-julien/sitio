// Arma una versión de vista previa (dist-preview/) a partir de dist/:
// CSS y JS en línea, fuentes como data URI y rutas relativas. Solo para revisión interna.
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'dist-preview');
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let css = readFileSync(join(DIST, 'css/styles.css'), 'utf8');
css = css.replace(/url\("\/fonts\/([^"]+)"\)/g, (_, f) =>
  `url("data:font/woff;base64,${readFileSync(join(DIST, 'fonts', f)).toString('base64')}")`);
const js = readFileSync(join(DIST, 'js/main.js'), 'utf8');

let html = readFileSync(join(DIST, 'index.html'), 'utf8');
html = html
  .replace(/<link rel="preload"[^>]+>\n?/g, '')
  .replace(/<link rel="stylesheet" href="\/css\/styles\.css[^"]*">/, () => `<style>${css}</style>`)
  .replace(/<script src="\/js\/main\.js[^"]*" defer><\/script>/, () => `<script>${js}</script>`)
  .replace(/ data-map-src="[^"]*"/, '')
  .replace(/(["\s,])\/(img|uploads)\//g, '$1$2/')
  .replace('<title>', '<title>[Vista previa] ')
  // Vista previa liviana: una sola variante webp por foto.
  .replace(/<picture><source[^>]*><img src="img\/opt\/([^"]+)-\d+\.jpg" srcset="[^"]*" sizes="[^"]*"/g, '<img src="img/opt/$1-1200.webp"')
  .replace(/(<img src="img\/opt\/[^>]+>)<\/picture>/g, '$1');
writeFileSync(join(OUT, 'index.html'), html);

mkdirSync(join(OUT, 'img/opt'), { recursive: true });
for (const f of readdirSync(join(DIST, 'img'))) if (f.endsWith('.png')) cpSync(join(DIST, 'img', f), join(OUT, 'img', f));
for (const f of readdirSync(join(DIST, 'img/opt'))) if (f.endsWith('-1200.webp') && html.includes(f)) cpSync(join(DIST, 'img/opt', f), join(OUT, 'img/opt', f));
console.log('dist-preview/ listo');
