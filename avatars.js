import parts from './vendor/avatartion/parts.json';
import { avatarParts, avatarColors, defaultAvatar, cleanAvatar } from './avatar-schema.js';
const svgInner = text => text.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
export function avatarSVG(input) {
  const config = cleanAvatar(input) || defaultAvatar;
  const layers = ['body', 'outfit', 'head', 'hair', 'eyes', 'mouth', 'facialHair', 'accessories'];
  const content = layers.map(key => {
    if (key === 'body') return svgInner(parts['base/Body']);
    const spec = avatarParts.find(p => p.key === key);
    const n = config[key];
    return n ? svgInner(parts[`${spec.prefix}${String(n).padStart(2, '0')}`]) : '';
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="306" height="306" viewBox="0 0 306 306"><rect width="306" height="306" fill="${config.background}"/>${content}</svg>`;
}
export const avatarURI = config => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(avatarSVG(config))}`;
export function randomAvatar() {
  const config = { background: avatarColors[Math.floor(Math.random() * avatarColors.length)] };
  avatarParts.forEach(p => config[p.key] = p.optional ? 0 : 1 + Math.floor(Math.random() * p.count));
  return config;
}
export function mountAvatarEditor(root, initial, onChange) {
  let config = cleanAvatar(initial) || { ...defaultAvatar };
  let tab = 'hair';
  root.innerHTML = `<div class="avatar-studio"><div class="avatar-stage"><img alt="Your custom avatar" id="studio-preview"><div class="avatar-stage-actions"><button type="button" class="button" id="studio-random">↻ Shuffle</button><button type="button" class="button" id="studio-download">↓ Save SVG</button></div><div class="avatar-colors" aria-label="Avatar background">${avatarColors.map((c, i) => `<button type="button" style="background:${c}" data-color="${c}" aria-label="Background ${i + 1}" aria-pressed="false"></button>`).join('')}</div></div><div class="avatar-options"><div class="avatar-tabs" role="group" aria-label="Avatar features">${avatarParts.map(p => `<button type="button" data-avatar-tab="${p.key}" aria-pressed="false">${p.label}</button>`).join('')}</div><div class="avatar-choices" role="group" aria-label="Choose a style"></div></div></div><p class="avatar-attribution">Avatar artwork by <a href="https://github.com/wilmerterrero/Avatartion" target="_blank" rel="noopener noreferrer">Avatartion</a> · Make it feel like you.</p>`;
  const render = () => {
    root.querySelector('#studio-preview').src = avatarURI(config);
    root.querySelectorAll('[data-avatar-tab]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.avatarTab === tab)));
    root.querySelectorAll('[data-color]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.color === config.background)));
    const spec = avatarParts.find(p => p.key === tab);
    const start = spec.optional ? 0 : 1;
    root.querySelector('.avatar-choices').innerHTML = Array.from({ length: spec.count - start + 1 }, (_, i) => {
      const number = i + start;
      const uri = number ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(parts[`${spec.prefix}${String(number).padStart(2, '0')}`])}` : '';
      return `<button type="button" data-avatar-choice="${number}" aria-label="${spec.label} ${number || 'none'}" aria-pressed="${config[tab] === number}">${number ? `<img src="${uri}" alt="">` : '<span>None</span>'}<small>${number || '—'}</small></button>`;
    }).join('');
    onChange({ ...config });
  };
  root.addEventListener('click', event => {
    const target = event.target.closest('button'); if (!target) return;
    if (target.dataset.avatarTab) tab = target.dataset.avatarTab;
    else if (target.dataset.avatarChoice !== undefined) config[tab] = Number(target.dataset.avatarChoice);
    else if (target.dataset.color) config.background = target.dataset.color;
    else if (target.id === 'studio-random') config = randomAvatar();
    else if (target.id === 'studio-download') {
      const link = document.createElement('a'); link.href = avatarURI(config); link.download = 'my-hall-avatar.svg'; link.click(); return;
    } else return;
    render();
  });
  render();
  return { setConfig(value) { config = cleanAvatar(value) || { ...defaultAvatar }; render(); } };
}
