import { residentProfiles } from './residents.js';
import { SOCIAL_PLATFORMS, socialHref, socialText } from './social-schema.js';
import avatars from './assets/avatars.json';
import { avatarURI } from './avatars.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const colors = ['#e8edf8', '#f3eedf', '#e7f2f3', '#eceef4', '#e5edf6', '#f2eee8', '#e7f0f3', '#f0eef6'];
const paths = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  diagonal: '<path d="M6 18 18 6M6 6h12v12"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  collapse: '<path d="M3 8h5V3m13 5h-5V3M3 16h5v5m13-5h-5v5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 6.1A8 8 0 0 1 20 12M17.9 17.9A8 8 0 0 1 4 12"/>',
  book: '<path d="M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1v15"/>',
  person: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  help: '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6z"/><path d="m12 7 1.3 2.6 2.7.4-2 2 .5 3-2.5-1.4L9.5 15l.5-3-2-2 2.7-.4z"/>',
  people: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M16 4a4 4 0 0 1 0 8m2 3a6 6 0 0 1 4 6"/>',
  send: '<path d="m22 2-7 20-4-9-9-4L22 2Zm0 0L11 13"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3" fill="var(--paper)"/><circle cx="16" cy="17" r="3" fill="var(--paper)"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  shuffle: '<path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 3-2 4-4m4-4c1-2 2-4 4-4h3m-4-4 4 4-4 4"/>',
  check: '<path d="m5 12 4 4L19 6"/>'
};
function icon(name) { return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.person}</svg>`; }
$$('[data-icon]').forEach(el => el.outerHTML = icon(el.dataset.icon));
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
let profiles = residentProfiles;
let filter = 'All';
let query = '';
function avatar(index, config = null) { return `<img src="${config ? avatarURI(config) : avatars[Math.abs(Number(index) || 0) % avatars.length]}" alt="" draggable="false">`; }
function profileAvatar(profile) {
  if (profile.photo) return `<img class="resident-photo" src="${escape(profile.photo)}" alt="${escape(profile.name)}’s uploaded picture" draggable="false">`;
  if (profile.imported) {
    const initials = profile.name.split(/\s+/).slice(0, 2).map(word => [...word][0]).join('').toUpperCase();
    return `<span class="resident-initials" role="img" aria-label="${escape(profile.name)} — picture not yet supplied">${escape(initials)}</span>`;
  }
  return avatar(profile.avatar, profile.avatarConfig);
}
function field(label, text, type) { return `<div class="profile-field">${icon(type)}<div><span class="field-label">${label}</span><p>${escape(text || 'A conversation waiting to happen.')}</p></div></div>`; }
function socialLinks(profile) {
  const entries = (Array.isArray(profile.socials) ? profile.socials : []).filter(entry => SOCIAL_PLATFORMS[entry?.platform] && entry.value);
  if (!entries.length) return `<span class="handle">${profile.contact ? 'Contact details' : 'Say hello around the hall'}</span>`;
  // One account gets its handle spelled out; several stay compact as badges.
  const detailed = entries.length === 1;
  const chips = entries.map(entry => {
    const spec = SOCIAL_PLATFORMS[entry.platform];
    const href = socialHref(entry);
    const aria = `Find ${escape(profile.name)} on ${escape(spec.label)}`;
    if (!href) return `<span class="social-chip ${escape(entry.platform)}" title="${escape(spec.label)}">${escape(spec.short)} <span>${escape(entry.value)}</span></span>`;
    return `<a class="social-chip ${escape(entry.platform)}" href="${escape(href)}" target="_blank" rel="noopener noreferrer" aria-label="${aria}">${escape(spec.short)}${detailed ? ` <span>${escape(socialText(entry))}</span>` : ''}</a>`;
  });
  return `<div class="social-links">${chips.join('')}</div>`;
}
function cardHTML(profile, detailed = false) {
  return `<div class="portrait" style="--card-color:${profile.avatarConfig?.background || colors[profile.avatar % colors.length]}"><span class="year-badge">${escape(profile.year || 'RESIDENT').toUpperCase()}</span><button class="open-profile" data-profile="${escape(profile.id)}" aria-label="Meet ${escape(profile.name)}">${icon('diagonal')}</button>${profileAvatar(profile)}<span class="portrait-doodle" aria-hidden="true">${['✧', '✳', '〰', '✦'][profile.avatar % 4]}</span></div><div class="card-content"><h3${detailed ? ' id="profile-name"' : ''}>${escape(profile.name)}</h3><div class="course">${icon('book')}${escape(profile.curriculum || 'Hall resident')}</div><hr class="card-rule">${field('I AM', profile.intro, 'person')}${field('I CAN HELP WITH', profile.help, 'help')}${field('I WANT TO MEET', profile.meet, 'people')}${detailed && profile.contact ? field('SAY HELLO', profile.contact, 'send') : ''}</div><div class="card-footer">${socialLinks(profile)}${profile.contact && !detailed ? `<button class="contact-button" data-profile="${escape(profile.id)}" aria-label="Contact ${escape(profile.name)}">Say hello ${icon('arrow')}</button>` : `<span class="hello-label">Open to a hello</span>`}</div>`;
}
function filteredProfiles() {
  return profiles.filter(p => (filter === 'All' || p.category === filter) && (!query || [p.name, p.curriculum, p.intro, p.help, p.meet, p.year, p.contact, ...(p.socials || []).map(entry => entry.value)].join(' ').toLowerCase().includes(query)));
}

function render() {
  const visible = filteredProfiles();
  $('#profile-grid').innerHTML = visible.map((p, i) => `<article class="profile-card" style="animation-delay:${i % 4 * 45}ms">${cardHTML(p)}</article>`).join('');
  $('#resident-count').textContent = String(profiles.length);
  $('#hero-count').textContent = `${profiles.length} SKYers`;
  $('#result-line').textContent = query || filter !== 'All' ? `${visible.length} ${visible.length === 1 ? 'SKYer' : 'SKYers'} found` : '';
  $('#empty-state').hidden = !!visible.length;
  $('#mini-avatars').innerHTML = profiles.slice(0, 4).map(profileAvatar).join('');
}
$('#note-avatars').innerHTML = profiles.slice(0, 3).map(profileAvatar).join('');
$$('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$('#profile-dialog').addEventListener('click', e => {
  if (e.target !== e.currentTarget) return;
  const r = e.currentTarget.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.currentTarget.close();
});
$('#profile-grid').addEventListener('click', e => {
  const button = e.target.closest('[data-profile]');
  const p = profiles.find(profile => profile.id === button?.dataset.profile);
  if (!p) return;
  $('#profile-detail').innerHTML = cardHTML(p, true);
  $('#profile-dialog').setAttribute('aria-labelledby', 'profile-name');
  $('#profile-dialog').showModal();
});
$$('[data-filter]').forEach(button => button.addEventListener('click', () => {
  filter = button.dataset.filter;
  $$('[data-filter]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); });
  render();
}));
$('#search').addEventListener('input', e => { query = e.target.value.trim().toLowerCase(); render(); });
$('#reset-filters').addEventListener('click', () => { $('#search').value = ''; query = ''; $('[data-filter="All"]').click(); });
render();
