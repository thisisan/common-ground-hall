import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
// The SDK uses a module-relative artwork URL. Inline it for our single-file
// build, where import.meta.url cannot resolve a separate package asset.
const sdkArtwork = {
  name: 'inline-omg-badge-artwork',
  setup(builder) {
    builder.onLoad({ filter: /[/\\]@omg-dev[/\\]sdk[/\\]dist[/\\]OmgBadge-.*\.mjs$/ }, async ({ path }) => {
      const source = await readFile(path, 'utf8');
      const artworkURL = /new URL\(["'](\.\/[^"']+\.webp)["'],\s*import\.meta\.url\)\.href/g;
      let contents = source;
      for (const match of source.matchAll(artworkURL)) {
        const artwork = await readFile(resolve(dirname(path), match[1]));
        contents = contents.replace(match[0], JSON.stringify(`data:image/webp;base64,${artwork.toString('base64')}`));
      }
      return { contents, loader: 'js', resolveDir: dirname(path) };
    });
  },
};
const bundle = await build({ entryPoints: [resolve(root, 'app.js')], bundle: true, write: false, minify: true, format: 'iife', legalComments: 'inline', plugins: [sdkArtwork] });
const font = await readFile(resolve(root, 'assets/manrope.woff2'));
const css = (await readFile(resolve(root, 'styles.css'), 'utf8')).replace('FONT_DATA', `data:font/woff2;base64,${font.toString('base64')}`);
export const html = (await readFile(resolve(root, 'index.html'), 'utf8')).replace('/* INLINE_CSS */', () => css).replace('/* INLINE_APP */', () => bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script'));
await mkdir(resolve(root, 'dist'), { recursive: true });
await writeFile(resolve(root, 'dist/index.html'), html);
console.log(`Built self-contained wall: ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
