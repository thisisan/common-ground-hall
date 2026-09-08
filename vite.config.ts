import { defineConfig } from 'vite';
import { html } from './scripts/build.mjs';
// omg.dev's production builder runs `vp build`. Keep the exact same standalone
// HTML as the GitHub Pages build, with no external avatar/font/script requests.
export default defineConfig({
  plugins: [{ name: 'common-ground-inline', transformIndexHtml: { order: 'post', handler: () => html } }],
  build: { outDir: 'dist' }
});
