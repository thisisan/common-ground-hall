// Generated illustrations stay local: the running wall makes no avatar API calls.
import { Style, Avatar } from '@dicebear/core';
import { writeFile } from 'node:fs/promises';
import definition from '@dicebear/styles/notionists.json' with { type: 'json' };
const style = new Style(definition);
const avatars = Array.from({ length: 16 }, (_, i) => {
  const svg = new Avatar(style, { seed: `hall-neighbor-${i + 12}` }).toString();
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
});
await writeFile(new URL('../assets/avatars.json', import.meta.url), JSON.stringify(avatars));
await writeFile(new URL('../avatar-picker.html', import.meta.url), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Choose your hall avatar</title><style>body{font:16px Arial;background:#f8f8f3;color:#24251f;max-width:1000px;padding:35px;margin:auto}h1{letter-spacing:-1px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:16px}figure{margin:0;background:#e5dff5;border:1px solid #a6ad97;border-radius:12px;text-align:center;overflow:hidden}img{width:100%;display:block}figcaption{background:white;padding:10px;font-weight:bold}footer{margin-top:30px;font-size:12px}</style><h1>Pick your little alter ego.</h1><p>Select the matching number in the Google Form’s Avatar question.</p><div class="grid">${avatars.map((src, i) => `<figure><img src="${src}" alt="Avatar ${i + 1}"><figcaption>${i + 1}</figcaption></figure>`).join('')}</div><footer>Notionists by Zoish, via DiceBear · CC0</footer></html>`);
console.log('Generated 16 Notionists avatars.');
