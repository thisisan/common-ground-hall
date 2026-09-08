import QRCode from 'qrcode';
import { sampleProfiles, normalizeProfiles, validateSettings } from './data.js';
import avatars from './assets/avatars.json';
import defaults from './config.json';
import { avatarURI, randomAvatar, mountAvatarEditor } from './avatars.js';
import { validateSubmission } from './profile-schema.js';
import { createAPI } from './api.js';
import { setupAdmin } from './admin.js';

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
if (!settings.backendUrl && (location.hostname.endsWith('.omgs.app') || (['localhost', '127.0.0.1'].includes(location.hostname) && location.port === '4174'))) settings.backendUrl = location.origin;
const hasBackend = () => !!settings.backendUrl;
const hasFeed = () => !!(settings.backendUrl || settings.feedUrl);
const api = createAPI(() => settings.backendUrl);
let profiles = hasFeed() ? [] : [...localProfiles, ...sampleProfiles];
let filter = 'All';
let query = '';
let selectedAvatar = 0;
let customAvatar = randomAvatar();
let submissionId = crypto.randomUUID();
let isFetching = false;
let feedGeneration = 0;
let activeRequest;
let toastTimer;
let display = false;
let displayPage = 0;
let displayPaused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let displayTimer;
let qrMarkup = '';

function avatar(index, config = null) { return `<img src="${config ? avatarURI(config) : avatars[Math.abs(Number(index) || 0) % avatars.length]}" alt="" draggable="false">`; }
function field(label, text, type) { return `<div class="profile-field">${icon(type)}<div><span class="field-label">${label}</span><p>${escape(text || 'A conversation waiting to happen.')}</p></div></div>`; }
function socialLinks(profile) {
  const links = [];
  if (profile.handle) links.push(`<a class="social-chip" href="https://www.instagram.com/${encodeURIComponent(profile.handle)}/" target="_blank" rel="noopener noreferrer" aria-label="Find ${escape(profile.name)} on Instagram">IG <span>${escape(profile.xhs || profile.linkedin ? '' : '@' + profile.handle)}</span></a>`);
  if (profile.xhs) links.push(`<a class="social-chip xhs" href="${escape(profile.xhs)}" target="_blank" rel="noopener noreferrer" aria-label="Find ${escape(profile.name)} on XHS">小红书</a>`);
  if (profile.linkedin) links.push(`<a class="social-chip linkedin" href="${escape(profile.linkedin)}" target="_blank" rel="noopener noreferrer" aria-label="Find ${escape(profile.name)} on LinkedIn">in <span>LinkedIn</span></a>`);
  return links.length ? `<div class="social-links">${links.join('')}</div>` : '<span class="handle">Say hello around the hall</span>';
}
function cardHTML(profile, detailed = false) {
  return `<div class="portrait" style="--card-color:${profile.avatarConfig?.background || colors[profile.avatar % colors.length]}"><span class="year-badge">${escape(profile.year || 'RESIDENT').toUpperCase()}</span><button class="open-profile" data-profile="${escape(profile.id)}" aria-label="Meet ${escape(profile.name)}">${icon('diagonal')}</button>${avatar(profile.avatar, profile.avatarConfig)}<span class="portrait-doodle" aria-hidden="true">${['✧', '✳', '〰', '✦'][profile.avatar % 4]}</span></div><div class="card-content"><h3${detailed ? ' id="profile-name"' : ''}>${escape(profile.name)}</h3><div class="course">${icon('book')}${escape(profile.curriculum || 'Hall resident')}</div><hr class="card-rule">${field('I AM', profile.intro, 'person')}${field('I CAN HELP WITH', profile.help, 'help')}${field('I WANT TO MEET', profile.meet, 'people')}</div><div class="card-footer">${socialLinks(profile)}<span class="hello-label">Open to a hello</span></div>`;
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
  if (!profiles.length && hasFeed()) {
    $('#empty-state h3').textContent = 'Your hall is ready to meet.';
    $('#empty-state p').textContent = 'Press Refresh wall to load approved resident profiles.';
    $('#reset-filters').hidden = true;
  } else {
    $('#empty-state h3').textContent = 'No familiar faces here. Yet.';
    $('#empty-state p').textContent = 'Try another name, course, or interest.';
    $('#reset-filters').hidden = false;
  }
  $('#display-page').textContent = `${displayPage + 1} / ${pages}`;
  $('#mini-avatars').innerHTML = (profiles.length ? profiles.slice(0, 4) : sampleProfiles.slice(0, 4)).map(p => avatar(p.avatar, p.avatarConfig)).join('');
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
  if (!hasBackend() && settings.formUrl) {
    const a = document.createElement('a'); a.href = settings.formUrl; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.click(); return;
  }
  if (!hasBackend() && settings.feedUrl) { toast('Ask your hall organizer to add the form link in Wall setup.'); return; }
  $('#chosen-avatar').innerHTML = avatar(selectedAvatar, customAvatar);
  $('#join-error').textContent = '';
  $('#demo-form-note').textContent = hasBackend() ? 'Your introduction will appear after your hall organizer approves it.' : 'Try the form. This sample profile is saved on this browser only.';
  $('#join-form .submit-button').innerHTML = hasBackend() ? 'Submit for approval →' : 'Add my sample profile →';
  openDialog('#join-dialog');
}
$$('[data-join]').forEach(button => button.addEventListener('click', joinWall));
$('#change-avatar').addEventListener('click', () => { selectedAvatar = (selectedAvatar + 1) % avatars.length; customAvatar = randomAvatar(); $('#chosen-avatar').innerHTML = avatar(selectedAvatar, customAvatar); });
let studioEditor;
function showAvatarStudio() {
  if (!studioEditor) studioEditor = mountAvatarEditor($('#avatar-editor'), customAvatar, value => { customAvatar = value; $('#chosen-avatar').innerHTML = avatar(0, value); });
  else studioEditor.setConfig(customAvatar);
  $('#avatar-dialog').showModal();
}
$('#customize-avatar').addEventListener('click', showAvatarStudio);
$('#avatar-studio-button').addEventListener('click', showAvatarStudio);
$('#create-avatar-button').addEventListener('click', showAvatarStudio);
$('#use-avatar').addEventListener('click', () => { $('#avatar-dialog').close(); if (!$('#join-dialog').open) joinWall(); });
$('#join-form').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target; const button = form.querySelector('.submit-button');
  if (button.disabled) return;
  const values = Object.fromEntries(new FormData(form));
  try {
    const profile = validateSubmission({ ...values, consent: form.elements.consent.checked, avatar: selectedAvatar, avatarConfig: customAvatar });
    $('#join-error').textContent = ''; button.disabled = true;
    if (hasBackend()) {
      await api('submit', { profile, requestId: submissionId, website: values.website });
      submissionId = crypto.randomUUID();
      $('#join-dialog').close(); form.reset();
      toast('Introduction received! Your hall organizer will review it before it appears on the wall.');
    } else {
      const sample = { ...profile, id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
      localProfiles.unshift(sample);
      const saved = storage.set('samples', localProfiles);
      profiles = [...localProfiles, ...sampleProfiles];
      query = ''; filter = 'All'; $('#search').value = ''; $('[data-filter="All"]').click();
      $('#join-dialog').close(); form.reset(); render();
      toast(saved ? 'You’re on the sample wall! Your profile is saved in this browser.' : 'You’re on the sample wall for this visit. Browser storage isn’t available.');
    }
  } catch (error) { $('#join-error').textContent = error.message; }
  finally { button.disabled = false; }
});
$('#join-form').addEventListener('input', e => e.target.setCustomValidity?.(''));

async function applySettings() {
  const joinURL = hasBackend() ? new URL('?join=1', location.href).href : settings.formUrl;
  $$('[data-hall]').forEach(el => el.textContent = settings.hallName);
  $('.brand').setAttribute('aria-label', `${settings.hallName} home`);
  document.title = `${settings.hallName} · Your hall, together`;
  $('#source-label').textContent = hasFeed() ? 'HALL WALL' : 'SAMPLE WALL';
  $('#note-avatars').hidden = !!joinURL;
  $('#join-qr').hidden = !joinURL;
  $('#note-avatars').innerHTML = [4, 1, 2].map(i => avatar(i)).join('');
  $('.hello-note h2').innerHTML = joinURL ? 'Scan. Say hello.<br>Find your people.' : 'Your next friend might<br>be a few doors away.';
  $('.note-foot').textContent = joinURL ? 'Scan to introduce yourself to the hall.' : 'A little intro goes a long way.';
  qrMarkup = joinURL ? await QRCode.toString(joinURL, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#24251f', light: '#ffffff' } }) : '';
  $('#join-qr').innerHTML = qrMarkup;
  updateDisplayJoin();
}
function showSettings() {
  for (const key of ['hallName', 'formUrl', 'feedUrl', 'backendUrl']) $('#settings-form').elements.namedItem(key).value = settings[key];
  $('#settings-error').textContent = '';
  openDialog('#settings-dialog');
}
$('#settings-button').addEventListener('click', showSettings);
$('#settings-form').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const next = validateSettings(Object.fromEntries(new FormData(e.target)));
    const changed = next.feedUrl !== settings.feedUrl || next.backendUrl !== settings.backendUrl;
    if (changed) { feedGeneration++; activeRequest?.abort(); }
    settings = next;
    const saved = storage.set('settings', settings);
    if (changed) {
      profiles = hasFeed() ? [] : [...localProfiles, ...sampleProfiles];
      $('#feed-status').textContent = hasFeed() ? 'Ready when you are — press Refresh wall' : 'You choose when to update';
      $('#profile-dialog').close();
    }
    await applySettings(); render(); $('#settings-dialog').close();
    if (changed) admin.reset();
    toast(saved ? 'Settings saved. Press Refresh wall when you’re ready.' : 'Settings applied for this visit. Browser storage isn’t available.');
  } catch (error) { $('#settings-error').textContent = error.message; }
});
async function refreshWall() {
  if (isFetching) return;
  if (!hasFeed()) { showSettings(); toast('Connect your backend or Google Sheet to refresh the wall.'); return; }
  isFetching = true;
  const generation = feedGeneration;
  const oldProfiles = new Map(profiles.map(p => [p.id, JSON.stringify(p)]));
  activeRequest = new AbortController();
  const timeout = setTimeout(() => activeRequest?.abort(), 15000);
  $('#refresh-button').disabled = true; $('#display-refresh').disabled = true;
  $('#feed-status').textContent = 'Checking your hall’s submissions…';
  try {
    const response = await fetch(hasBackend() ? `${settings.backendUrl}/api/hall` : settings.feedUrl, { method: 'GET', redirect: 'follow', cache: 'no-store', credentials: 'omit', signal: activeRequest.signal });
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
    if (!next.length) $('#empty-state p').textContent = 'No approved profiles yet. Publish a profile, then press Refresh wall.';
    const changes = [added && `${added} new`, changed && `${changed} updated`, removed && `${removed} removed`].filter(Boolean).join(', ');
    toast(changes ? `Wall refreshed: ${changes} ${added + changed + removed === 1 ? 'profile' : 'profiles'}.` : 'All caught up. No changes to your hall wall.');
  } catch (error) {
    if (generation !== feedGeneration) return;
    $('#feed-status').textContent = 'Couldn’t update · Current wall kept';
    toast('Couldn’t refresh. Check your connection and wall setup, then try again. Your current wall is unchanged.', true);
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
  if (!qrMarkup) return;
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
const admin = setupAdmin({ api, getBaseURL: () => settings.backendUrl, cardHTML, avatar, escape, showSettings, toast });
$('#admin-button').addEventListener('click', admin.open);
applySettings(); render();
if (new URLSearchParams(location.search).has('admin')) admin.open();
if (new URLSearchParams(location.search).has('join')) joinWall();
if (hasFeed()) $('#feed-status').textContent = 'Ready when you are — press Refresh wall';
