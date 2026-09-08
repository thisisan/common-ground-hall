import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const bundle = await build({ entryPoints: [resolve(root, 'app.js')], bundle: true, write: false, minify: true, format: 'iife', legalComments: 'inline' });
const font = await readFile(resolve(root, 'assets/manrope.woff2'));
const css = (await readFile(resolve(root, 'styles.css'), 'utf8')).replace('FONT_DATA', `data:font/woff2;base64,${font.toString('base64')}`);
export const html = (await readFile(resolve(root, 'index.html'), 'utf8')).replace('/* INLINE_CSS */', () => css).replace('/* INLINE_APP */', () => bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script'));
await mkdir(resolve(root, 'dist'), { recursive: true });
await writeFile(resolve(root, 'dist/index.html'), html);
console.log(`Built self-contained wall: ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
