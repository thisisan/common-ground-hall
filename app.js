import QRCode from 'qrcode';
import { sampleProfiles, normalizeProfiles, validateSettings } from './data.js';
import avatars from './assets/avatars.json';
import defaults from './config.json';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const colors = ['#e3dfef', '#f0e6cf', '#dde6df', '#e8e6ed', '#e6e9d4', '#e8ddd4', '#dce5e9', '#efe2d9'];
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
const storage = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(`common-ground:${key}`)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(`common-ground:${key}`, JSON.stringify(value)); return true; } catch { return false; } }
};
let settings;
try { settings = validateSettings({ ...defaults, ...storage.get('settings', {}) }); } catch { settings = validateSettings(defaults); }
let localProfiles;
try { localProfiles = normalizeProfiles({ profiles: storage.get('samples', []) }); } catch { localProfiles = []; }
let profiles = settings.feedUrl ? [] : [...localProfiles, ...sampleProfiles];
let filter = 'All';
let query = '';
let selectedAvatar = 0;
let isFetching = false;
let feedGeneration = 0;
let activeRequest;
let toastTimer;
let display = false;
let displayPage = 0;
let displayPaused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let displayTimer;
let qrMarkup = '';

function avatar(index) { return `<img src="${avatars[Math.abs(Number(index) || 0) % avatars.length]}" alt="" draggable="false">`; }
function field(label, text, type) { return `<div class="profile-field">${icon(type)}<div><span class="field-label">${label}</span><p>${escape(text || 'A conversation waiting to happen.')}</p></div></div>`; }
function cardHTML(profile, detailed = false) {
  return `<div class="portrait" style="--card-color:${colors[profile.avatar % colors.length]}"><span class="year-badge">${escape(profile.year || 'RESIDENT').toUpperCase()}</span><button class="open-profile" data-profile="${escape(profile.id)}" aria-label="Meet ${escape(profile.name)}">${icon('diagonal')}</button>${avatar(profile.avatar)}<span class="portrait-doodle" aria-hidden="true">${['✧', '✳', '〰', '✦'][profile.avatar % 4]}</span></div><div class="card-content"><h3${detailed ? ' id="profile-name"' : ''}>${escape(profile.name)}</h3><div class="course">${icon('book')}${escape(profile.curriculum || 'Hall resident')}</div><hr class="card-rule">${field('I AM', profile.intro, 'person')}${field('I CAN HELP WITH', profile.help, 'help')}${field('I WANT TO MEET', profile.meet, 'people')}</div><div class="card-footer">${profile.handle ? `<a class="handle" href="https://www.instagram.com/${encodeURIComponent(profile.handle)}/" target="_blank" rel="noopener noreferrer" aria-label="Find ${escape(profile.name)} on Instagram">${icon('send')}<span>@${escape(profile.handle)}</span></a>` : '<span class="handle">Say hello around the hall</span>'}<span class="hello-label">Open to a hello</span></div>`;
}
function filteredProfiles() {
  return profiles.filter(p => (filter === 'All' || p.category === filter) && (!query || [p.name, p.curriculum, p.intro, p.help, p.meet, p.handle, p.year].join(' ').toLowerCase().includes(query)));
}
function perPage() { return matchMedia('(max-width: 1000px)').matches ? 2 : 4; }
function render() {
  const filtered = display ? profiles : filteredProfiles();
  const pages = Math.max(1, Math.ceil(filtered.length / perPage()));
  displayPage %= pages;
  const visible = display ? filtered.slice(displayPage * perPage(), (displayPage + 1) * perPage()) : filtered;
  $('#profile-grid').innerHTML = visible.map((p, i) => `<article class="profile-card" style="animation-delay:${i % 4 * 45}ms">${cardHTML(p)}</article>`).join('');
  $('#resident-count').textContent = String(profiles.length);
  $('#hero-count').textContent = `${profiles.length} ${profiles.length === 1 ? 'resident' : 'residents'}`;
  $('#result-line').textContent = !display && (query || filter !== 'All') ? `${filtered.length} ${filtered.length === 1 ? 'resident' : 'residents'} found${filter !== 'All' ? ` in ${filter}` : ''}` : '';
  $('#empty-state').hidden = !!visible.length;
  if (!profiles.length && settings.feedUrl) {
    $('#empty-state h3').textContent = 'Your hall is ready to meet.';
    $('#empty-state p').textContent = 'Press Refresh wall to load approved profiles from your Google Sheet.';
    $('#reset-filters').hidden = true;
  } else {
    $('#empty-state h3').textContent = 'No familiar faces here. Yet.';
    $('#empty-state p').textContent = 'Try another name, course, or interest.';
    $('#reset-filters').hidden = false;
  }
  $('#display-page').textContent = `${displayPage + 1} / ${pages}`;
  $('#mini-avatars').innerHTML = (profiles.length ? profiles.slice(0, 4) : sampleProfiles.slice(0, 4)).map(p => avatar(p.avatar)).join('');
}
function toast(message, error = false) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.toggle('error', error);
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => $('#toast').hidden = true, 5500);
}
function openDialog(id) {
  $$('dialog[open]').forEach(d => d.close());
  $(id).showModal();
}
$$('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$$('dialog').forEach(dialog => {
  if (dialog.id !== 'profile-dialog') {
    const heading = dialog.querySelector('h2'); heading.id = `${dialog.id}-heading`;
    dialog.setAttribute('aria-labelledby', heading.id);
  }
  dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
});
$('#profile-grid').addEventListener('click', e => {
  const button = e.target.closest('[data-profile]');
  if (!button) return;
  const p = profiles.find(profile => profile.id === button.dataset.profile);
  if (!p) return;
  $('#profile-detail').innerHTML = cardHTML(p, true);
  $('#profile-dialog').setAttribute('aria-labelledby', 'profile-name');
  openDialog('#profile-dialog');
});
$$('[data-filter]').forEach(button => button.addEventListener('click', () => {
  filter = button.dataset.filter;
  $$('[data-filter]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); });
  render();
}));
$('#search').addEventListener('input', e => { query = e.target.value.trim().toLowerCase(); render(); });
$('#reset-filters').addEventListener('click', () => { $('#search').value = ''; query = ''; $('[data-filter="All"]').click(); });
function joinWall() {
  if (settings.formUrl) {
    const a = document.createElement('a');
    a.href = settings.formUrl; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.click();
    return;
  }
  if (settings.feedUrl) { toast('Ask your hall organizer to add the Google Form link in Wall setup.'); return; }
  $('#chosen-avatar').innerHTML = avatar(selectedAvatar);
  openDialog('#join-dialog');
}
$$('[data-join]').forEach(button => button.addEventListener('click', joinWall));
$('#change-avatar').addEventListener('click', () => { selectedAvatar = (selectedAvatar + 1) % avatars.length; $('#chosen-avatar').innerHTML = avatar(selectedAvatar); });
$('#join-form').addEventListener('submit', e => {
  e.preventDefault();
  const values = Object.fromEntries(new FormData(e.target));
  for (const name of ['name', 'curriculum', 'intro', 'help', 'meet']) {
    const input = e.target.elements.namedItem(name);
    input.setCustomValidity(values[name].trim() ? '' : 'Please add a little about yourself.');
    if (!input.reportValidity()) return;
  }
  const profile = normalizeProfiles({ profiles: [{ ...values, avatar: selectedAvatar, id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }] })[0];
  localProfiles.unshift(profile);
  const saved = storage.set('samples', localProfiles);
  profiles = [...localProfiles, ...sampleProfiles];
  query = ''; filter = 'All'; $('#search').value = ''; $('[data-filter="All"]').click();
  $('#join-dialog').close(); e.target.reset(); render();
  toast(saved ? 'You’re on the sample wall! Your profile is saved in this browser.' : 'You’re on the sample wall for this visit. Browser storage isn’t available.');
});
$('#join-form').addEventListener('input', e => e.target.setCustomValidity?.(''));

async function applySettings() {
  $$('[data-hall]').forEach(el => el.textContent = settings.hallName);
  $('.brand').setAttribute('aria-label', `${settings.hallName} home`);
  document.title = `${settings.hallName} · Your hall, together`;
  $('#source-label').textContent = settings.feedUrl ? 'HALL WALL' : 'SAMPLE WALL';
  $('#note-avatars').hidden = !!settings.formUrl;
  $('#join-qr').hidden = !settings.formUrl;
  $('#note-avatars').innerHTML = [4, 1, 2].map(avatar).join('');
  $('.hello-note h2').innerHTML = settings.formUrl ? 'Scan. Say hello.<br>Find your people.' : 'Your next friend might<br>be a few doors away.';
  $('.note-foot').textContent = settings.formUrl ? 'Scan to introduce yourself to the hall.' : 'A little intro goes a long way.';
  qrMarkup = settings.formUrl ? await QRCode.toString(settings.formUrl, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#24251f', light: '#ffffff' } }) : '';
  $('#join-qr').innerHTML = qrMarkup;
  updateDisplayJoin();
}
function showSettings() {
  for (const key of ['hallName', 'formUrl', 'feedUrl']) $('#settings-form').elements.namedItem(key).value = settings[key];
  $('#settings-error').textContent = '';
  openDialog('#settings-dialog');
}
$('#settings-button').addEventListener('click', showSettings);
$('#settings-form').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const next = validateSettings(Object.fromEntries(new FormData(e.target)));
    const changed = next.feedUrl !== settings.feedUrl;
    if (changed) { feedGeneration++; activeRequest?.abort(); }
    settings = next;
    const saved = storage.set('settings', settings);
    if (changed) {
      profiles = settings.feedUrl ? [] : [...localProfiles, ...sampleProfiles];
      $('#feed-status').textContent = settings.feedUrl ? 'Ready when you are — press Refresh wall' : 'You choose when to update';
      $('#profile-dialog').close();
    }
    await applySettings(); render(); $('#settings-dialog').close();
    toast(saved ? 'Settings saved. Press Refresh wall when you’re ready.' : 'Settings applied for this visit. Browser storage isn’t available.');
  } catch (error) { $('#settings-error').textContent = error.message; }
});
async function refreshWall() {
  if (isFetching) return;
  if (!settings.feedUrl) { showSettings(); toast('Connect your Google Sheet to refresh the wall.'); return; }
  isFetching = true;
  const generation = feedGeneration;
  const oldProfiles = new Map(profiles.map(p => [p.id, JSON.stringify(p)]));
  activeRequest = new AbortController();
  const timeout = setTimeout(() => activeRequest?.abort(), 15000);
  $('#refresh-button').disabled = true; $('#display-refresh').disabled = true;
  $('#feed-status').textContent = 'Checking your hall’s submissions…';
  try {
    const response = await fetch(settings.feedUrl, { method: 'GET', redirect: 'follow', cache: 'no-store', credentials: 'omit', signal: activeRequest.signal });
    if (!response.ok) throw new Error(`The feed returned ${response.status}.`);
    const next = normalizeProfiles(await response.json());
    if (generation !== feedGeneration) return;
    const added = next.filter(p => !oldProfiles.has(p.id)).length;
    const changed = next.filter(p => oldProfiles.has(p.id) && oldProfiles.get(p.id) !== JSON.stringify(p)).length;
    const removed = profiles.filter(p => !next.some(n => n.id === p.id)).length;
    profiles = next;
    $('#profile-dialog').close();
    displayPage = 0; render();
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    $('#feed-status').textContent = `Updated ${time} · Manual refresh`;
    if (!next.length) $('#empty-state p').textContent = 'No approved profiles yet. Approve a row in your Sheet, then press Refresh wall.';
    const changes = [added && `${added} new`, changed && `${changed} updated`, removed && `${removed} removed`].filter(Boolean).join(', ');
    toast(changes ? `Wall refreshed: ${changes} ${added + changed + removed === 1 ? 'profile' : 'profiles'}.` : 'All caught up. No changes to your hall wall.');
  } catch (error) {
    if (generation !== feedGeneration) return;
    $('#feed-status').textContent = 'Couldn’t update · Current wall kept';
    toast('Couldn’t refresh. Check your connection and the Apps Script sharing settings, then try again. Your current wall is unchanged.', true);
  } finally {
    clearTimeout(timeout); isFetching = false; activeRequest = null;
    $('#refresh-button').disabled = false; $('#display-refresh').disabled = false;
  }
}
$('#refresh-button').addEventListener('click', refreshWall);
$('#display-refresh').addEventListener('click', refreshWall);
$('#about-button').addEventListener('click', () => openDialog('#about-dialog'));

function updateDisplayJoin() {
  $('.display-join')?.remove();
  if (!settings.formUrl) return;
  const join = document.createElement('div'); join.className = 'display-join';
  join.innerHTML = `${qrMarkup}<span><strong>Join your hall wall</strong>Scan to say hello.</span>`;
  $('.site-header').append(join);
  join.hidden = !display;
}
function scheduleDisplay() {
  clearInterval(displayTimer);
  $('#pause-display').textContent = displayPaused ? 'Resume rotation' : 'Pause rotation';
  if (display && !displayPaused) displayTimer = setInterval(() => {
    if (document.hidden || $('dialog[open]')) return;
    displayPage++; render();
  }, 12000);
}
function exitDisplay() {
  display = false; document.body.classList.remove('display-mode');
  $('#display-controls').hidden = true;
  if ($('.display-join')) $('.display-join').hidden = true;
  clearInterval(displayTimer); render();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  $('#display-button').focus();
}
$('#display-button').addEventListener('click', () => {
  display = true; displayPage = 0; document.body.classList.add('display-mode');
  $('#display-controls').hidden = false;
  if ($('.display-join')) $('.display-join').hidden = false;
  render(); scheduleDisplay(); window.scrollTo(0, 0);
  document.documentElement.requestFullscreen?.().catch(() => {});
  $('#exit-display').focus();
});
$('#exit-display').addEventListener('click', exitDisplay);
$('#pause-display').addEventListener('click', () => { displayPaused = !displayPaused; scheduleDisplay(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && display && !$('dialog[open]')) exitDisplay(); });
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && display) exitDisplay(); });
window.addEventListener('resize', () => { if (display) render(); });
applySettings(); render();
if (settings.feedUrl) $('#feed-status').textContent = 'Ready when you are — press Refresh wall';
