import { mkdir, copyFile, writeFile } from 'node:fs/promises';
await import('./build.mjs');
const docs = new URL('../docs/', import.meta.url);
await mkdir(docs, { recursive: true });
await copyFile(new URL('../dist/index.html', import.meta.url), new URL('index.html', docs));
await copyFile(new URL('../avatar-picker.html', import.meta.url), new URL('avatar-picker.html', docs));
await writeFile(new URL('.nojekyll', docs), '');
console.log('GitHub Pages output ready in docs/. Commit and push docs/ to publish.');
