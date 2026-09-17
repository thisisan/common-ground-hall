import { SOCIAL_PLATFORMS, PLATFORM_KEYS, MAX_SOCIALS } from './social-schema.js';

const optionsHTML = PLATFORM_KEYS
  .map(key => `<option value="${key}">${SOCIAL_PLATFORMS[key].label}</option>`)
  .join('');

/**
 * Repeating "platform + account" editor shared by the join form and the admin
 * review form. Values are read straight from the DOM, so no hidden form state
 * has to be kept in sync.
 *
 * @returns {{ getValues: () => Array<{platform: string, value: string}>, setValues: (list: Array) => void }}
 */
export function mountSocialInput(container, initial = []) {
  container.classList.add('social-input');
  container.innerHTML = `<div class="social-rows"></div><button type="button" class="text-button social-add">+ Add another account</button><span class="field-note">Optional. Add up to ${MAX_SOCIALS} accounts — pick a platform, then enter your username or paste your profile link.</span>`;
  const rows = container.querySelector('.social-rows');
  const addButton = container.querySelector('.social-add');

  const usedPlatforms = except => new Set(
    [...rows.querySelectorAll('.social-row')]
      .filter(row => row !== except)
      .map(row => row.querySelector('.social-platform').value)
  );

  function nextFreePlatform() {
    const used = usedPlatforms(null);
    return PLATFORM_KEYS.find(key => !used.has(key)) || PLATFORM_KEYS[0];
  }

  // Keep each row's dropdown from offering a platform another row already uses.
  function syncOptions() {
    for (const row of rows.querySelectorAll('.social-row')) {
      const select = row.querySelector('.social-platform');
      const used = usedPlatforms(row);
      for (const option of select.options) option.disabled = used.has(option.value) && option.value !== select.value;
    }
    const count = rows.querySelectorAll('.social-row').length;
    addButton.hidden = count >= Math.min(MAX_SOCIALS, PLATFORM_KEYS.length);
    for (const button of rows.querySelectorAll('.social-remove')) button.hidden = count <= 1;
  }

  function applyPlaceholder(row) {
    const spec = SOCIAL_PLATFORMS[row.querySelector('.social-platform').value];
    const input = row.querySelector('.social-value');
    input.placeholder = spec?.placeholder || '';
    input.setAttribute('aria-label', `${spec?.label || 'Social'} account`);
  }

  function addRow(platform, value = '') {
    const row = document.createElement('div');
    row.className = 'social-row';
    row.innerHTML = `<select class="social-platform" aria-label="Social platform">${optionsHTML}</select><input class="social-value" type="text" maxlength="700" autocomplete="off"><button type="button" class="social-remove" aria-label="Remove this account">×</button>`;
    row.querySelector('.social-platform').value = platform;
    row.querySelector('.social-value').value = value;
    rows.append(row);
    applyPlaceholder(row);
    syncOptions();
    return row;
  }

  rows.addEventListener('change', event => {
    if (!event.target.classList.contains('social-platform')) return;
    applyPlaceholder(event.target.closest('.social-row'));
    syncOptions();
  });
  rows.addEventListener('click', event => {
    const button = event.target.closest('.social-remove');
    if (!button) return;
    button.closest('.social-row').remove();
    if (!rows.querySelector('.social-row')) addRow(nextFreePlatform());
    syncOptions();
  });
  addButton.addEventListener('click', () => {
    const row = addRow(nextFreePlatform());
    row.querySelector('.social-value').focus();
  });

  function setValues(list) {
    rows.replaceChildren();
    const entries = (Array.isArray(list) ? list : []).filter(entry => entry && SOCIAL_PLATFORMS[entry.platform]).slice(0, MAX_SOCIALS);
    if (!entries.length) addRow(PLATFORM_KEYS[0]);
    else for (const entry of entries) addRow(entry.platform, entry.value || '');
    syncOptions();
  }

  function getValues() {
    return [...rows.querySelectorAll('.social-row')]
      .map(row => ({ platform: row.querySelector('.social-platform').value, value: row.querySelector('.social-value').value.trim() }))
      .filter(entry => entry.value);
  }

  setValues(initial);
  return { getValues, setValues };
}
