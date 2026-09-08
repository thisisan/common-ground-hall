import { validateSubmission } from './profile-schema.js';
export function setupAdmin({ api, getBaseURL, cardHTML, avatar, escape: esc, showSettings, toast }) {
  let rows = []; let status = 'pending'; let search = ''; let active = null; let busy = false;
  let sessionBase = ''; let token = '';
  const board = document.createElement('section'); board.id = 'admin-board'; board.hidden = true;
  board.innerHTML = `<div class="admin-topline"><div class="eyebrow">✳ COMMON GROUND / HALL MANAGEMENT</div><button class="button" id="back-to-wall">← Back to wall</button></div><div class="admin-heading"><div><h1>A little care.<br>A better community.</h1><p>Review introductions and help your residents find their people.</p></div><div class="admin-toolbar"><button class="button" id="admin-reload">↻ Reload queue</button><button class="button" id="admin-logout">Sign out</button></div></div><div id="admin-login-panel"><div class="admin-login-card"><span class="login-flower">✳</span><h2>A warm welcome starts with you.</h2><p>Sign in to review introductions and manage the hall wall.</p><form id="admin-login-form"><label>Admin password<input type="password" name="password" autocomplete="current-password" required maxlength="256"></label><p id="admin-login-error" class="form-error" role="alert"></p><button class="button primary" type="submit">Sign in to your hall →</button></form><button class="text-button" id="admin-connect">Connect an omg.dev backend</button><p class="admin-privacy">Admin access is checked by the server. Residents can only submit profiles and view approved cards.</p></div></div><div id="admin-workspace" hidden><div class="admin-stats"><button data-admin-status="pending"><span>AWAITING A HELLO</span><strong id="pending-total">0</strong><small>Pending review ↗</small></button><button data-admin-status="published"><span>OUT ON THE WALL</span><strong id="published-total">0</strong><small>Published profiles ↗</small></button><button data-admin-status="archived"><span>TAKING A BREAK</span><strong id="archived-total">0</strong><small>Archived profiles ↗</small></button></div><div class="admin-queue"><div class="admin-queue-heading"><div><h2 id="queue-title">Pending introductions</h2><p id="queue-description">A few new faces are waiting for your welcome.</p></div><label class="search"><input type="search" id="admin-search" aria-label="Search admin profiles" placeholder="Find a resident or course…"></label></div><div class="admin-table-head"><span>RESIDENT</span><span>COURSE / YEAR</span><span>STATUS</span><span>MANAGE</span></div><div id="admin-rows"></div><p id="admin-empty" hidden>No profiles here yet. New introductions will arrive in Pending.</p></div><div class="admin-note">✳ Publishing changes the saved feed. The hall display updates when you press <strong>Refresh wall</strong>.</div></div><p id="admin-error" class="form-error" role="alert"></p>`;
  document.querySelector('.site-header').after(board);
  const dialog = document.createElement('dialog'); dialog.id = 'admin-review-dialog'; dialog.className = 'admin-review-dialog'; document.body.append(dialog);
  const $ = selector => document.querySelector(selector);
  function readToken() { sessionBase = getBaseURL(); try { token = sessionStorage.getItem(`hall-admin:${sessionBase}`) || ''; } catch { token = ''; } }
  function saveToken(value) { token = value; sessionBase = getBaseURL(); try { if (value) sessionStorage.setItem(`hall-admin:${sessionBase}`, value); else sessionStorage.removeItem(`hall-admin:${sessionBase}`); } catch {} }
  function loginView() { $('#admin-login-panel').hidden = false; $('#admin-workspace').hidden = true; $('.admin-toolbar').hidden = true; }
  function reset() { saveToken(''); rows = []; dialog.close(); $('#admin-rows').replaceChildren(); loginView(); }
  async function request(action, values = {}) {
    if (sessionBase !== getBaseURL()) { reset(); throw new Error('The backend changed. Sign in again.'); }
    try { return await api(action, { ...values, sessionToken: token }); }
    catch (error) { if (error.status === 401) reset(); throw error; }
  }
  function render() {
    $('#admin-login-panel').hidden = true; $('#admin-workspace').hidden = false; $('.admin-toolbar').hidden = false;
    ['pending', 'published', 'archived'].forEach(key => {
      $(`#${key}-total`).textContent = rows.filter(p => p.status === key).length;
      board.querySelector(`[data-admin-status="${key}"]`).setAttribute('aria-pressed', String(key === status));
    });
    $('#queue-title').textContent = ({ pending: 'Pending introductions', published: 'On the wall', archived: 'Archived profiles' })[status];
    $('#queue-description').textContent = ({ pending: 'A few new faces are waiting for your welcome.', published: 'The people who make your hall feel like home.', archived: 'Restore an introduction whenever they’re ready.' })[status];
    const visible = rows.filter(p => p.status === status && `${p.name} ${p.curriculum}`.toLowerCase().includes(search));
    $('#admin-empty').hidden = !!visible.length;
    $('#admin-rows').innerHTML = visible.map(p => `<div class="admin-row"><div class="admin-resident"><div class="admin-avatar">${avatar(p.avatar, p.avatarConfig)}</div><span><strong>${esc(p.name)}</strong><small>${p.featured ? '✦ Featured · ' : ''}${new Date(p.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</small></span></div><div class="admin-course"><strong>${esc(p.curriculum)}</strong><small>${esc(p.year)}</small></div><span class="status-pill ${p.status}">${p.status === 'published' ? 'Published' : p.status === 'archived' ? 'Archived' : 'Pending'}</span><button class="button" data-review="${esc(p.id)}">${status === 'pending' ? 'Review' : 'Manage'} ↗</button></div>`).join('');
  }
  async function reload() {
    if (busy) return; busy = true; $('#admin-reload').disabled = true;
    try { const result = await request('admin-list'); rows = result.profiles; $('#admin-error').textContent = ''; render(); }
    catch (error) { $('#admin-error').textContent = error.message; }
    finally { busy = false; $('#admin-reload').disabled = false; }
  }
  function open() {
    document.body.classList.add('admin-mode'); board.hidden = false; window.scrollTo(0, 0);
    readToken(); if (token) reload(); else loginView();
  }
  $('#back-to-wall').addEventListener('click', () => { board.hidden = true; document.body.classList.remove('admin-mode'); });
  $('#admin-connect').addEventListener('click', showSettings);
  $('#admin-login-form').addEventListener('submit', async e => {
    e.preventDefault(); const button = e.target.querySelector('button'); if (button.disabled) return; button.disabled = true;
    try {
      const result = await api('login', { password: e.target.elements.password.value });
      saveToken(result.token); e.target.reset(); $('#admin-login-error').textContent = ''; await reload();
    } catch (error) { $('#admin-login-error').textContent = error.message; }
    finally { button.disabled = false; }
  });
  $('#admin-logout').addEventListener('click', async () => { try { await request('logout'); reset(); } catch (error) { $('#admin-error').textContent = error.message; } });
  $('#admin-reload').addEventListener('click', reload);
  board.querySelectorAll('[data-admin-status]').forEach(b => b.addEventListener('click', () => { status = b.dataset.adminStatus; render(); }));
  $('#admin-search').addEventListener('input', e => { search = e.target.value.toLowerCase().trim(); render(); });
  $('#admin-rows').addEventListener('click', event => {
    const button = event.target.closest('[data-review]'); if (!button) return;
    active = rows.find(p => p.id === button.dataset.review); if (active) review();
  });
  function review() {
    const p = active;
    const field = (name, title, value, max, type = 'text') => `<label>${title}<input type="${type}" name="${name}" value="${esc(value)}" maxlength="${max}" ${['xhs', 'linkedin', 'handle'].includes(name) ? '' : 'required'}></label>`;
    const select = (name, title, values) => `<label>${title}<select name="${name}">${values.map(v => `<option ${p[name] === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>`;
    dialog.innerHTML = `<button class="close-button" id="close-review" aria-label="Close profile review">×</button><div class="modal-eyebrow">A NEW CONNECTION STARTS HERE</div><h2 id="review-title">${esc(p.name)}</h2><div class="admin-review-columns"><div class="admin-profile-preview"><article class="profile-card">${cardHTML(p)}</article></div><div><span class="status-pill ${p.status}">${esc(p.status)}</span><form id="admin-edit-form"><div class="form-row">${field('name', 'Name', p.name, 60)}${field('curriculum', 'Course', p.curriculum, 80)}</div><div class="form-row">${select('category', 'Curriculum group', ['Arts & Design', 'Business', 'Engineering', 'Science', 'Other'])}${select('year', 'Year of study', ['Year 1', 'Year 2', 'Year 3', 'Year 4+', 'Postgraduate'])}</div>${field('intro', 'I am', p.intro, 180)}${field('help', 'I can help with', p.help, 140)}${field('meet', 'I want to meet', p.meet, 140)}${field('handle', 'Instagram handle', p.handle, 31)}${field('xhs', 'XHS profile link', p.xhs, 700, 'url')}${field('linkedin', 'LinkedIn profile link', p.linkedin, 700, 'url')}<label class="checkbox-label"><input type="checkbox" name="featured" ${p.featured ? 'checked' : ''}> Feature this resident at the front of the wall</label><button type="submit" class="button">Save profile changes</button></form><div class="review-actions">${p.status !== 'published' ? '<button type="button" class="button primary" data-moderate="publish">Approve & publish ✓</button>' : ''}${p.status !== 'archived' ? '<button type="button" class="button" data-moderate="archive">Archive profile</button>' : '<button type="button" class="button" data-moderate="restore">Return to pending</button>'}</div><details class="delete-section"><summary>Permanently delete profile</summary><p>This removes the saved profile. Type DELETE to confirm.</p><input id="delete-confirmation" aria-label="Type DELETE to confirm"><button type="button" class="button danger" data-moderate="delete">Delete permanently</button></details><p id="review-error" class="form-error" role="alert"></p><p class="field-note">Changes are saved centrally. The hall display stays unchanged until its next manual refresh.</p></div></div>`;
    dialog.setAttribute('aria-labelledby', 'review-title');
    if (!dialog.open) dialog.showModal();
    $('#close-review').addEventListener('click', () => dialog.close());
    $('#admin-edit-form').addEventListener('submit', async event => {
      event.preventDefault();
      try {
        const values = Object.fromEntries(new FormData(event.target));
        const profile = validateSubmission({ ...p, ...values, consent: true });
        await mutate('update', { profile, featured: event.target.elements.featured.checked });
      } catch (error) { $('#review-error').textContent = error.message; }
    });
    dialog.querySelectorAll('[data-moderate]').forEach(button => button.addEventListener('click', () => mutate(button.dataset.moderate, { confirmation: $('#delete-confirmation').value })));
  }
  async function mutate(action, values = {}) {
    if (busy) return; busy = true;
    dialog.querySelectorAll('button').forEach(b => b.disabled = true);
    try {
      const result = await request(action, { ...values, id: active.id, version: active.version });
      if (action === 'delete') { rows = rows.filter(p => p.id !== active.id); dialog.close(); }
      else { active = result.profile; rows = rows.map(p => p.id === active.id ? active : p); if (action === 'update') review(); else dialog.close(); }
      render(); toast(action === 'update' ? 'Profile changes saved.' : action === 'delete' ? 'Profile permanently removed.' : 'Profile status updated. Refresh the wall when you’re ready.');
    } catch (error) { if ($('#review-error')) $('#review-error').textContent = error.message; else $('#admin-error').textContent = error.message; }
    finally { busy = false; dialog.querySelectorAll('button').forEach(b => b.disabled = false); }
  }
  return { open, reset };
}
