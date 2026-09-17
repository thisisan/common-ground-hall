// Generic social account support.
//
// A profile carries `socials`: an ordered list of { platform, value } entries.
// `value` is stored normalized — a bare handle for handle platforms, a full
// HTTPS href for link platforms. Legacy `handle` / `xhs` / `linkedin` fields
// are still read on input and mirrored on output so older feeds, saved rows
// and the Apps Script path keep working.

export class SocialValidationError extends Error {
  constructor(message) { super(message); this.name = 'SocialValidationError'; }
}

export const MAX_SOCIALS = 5;
const MAX_VALUE = 700;

// kind: 'handle' → user types a username; 'url' → user pastes a profile link.
export const SOCIAL_PLATFORMS = {
  instagram: {
    label: 'Instagram', short: 'IG', kind: 'handle',
    pattern: /^[A-Za-z0-9._]{1,30}$/, placeholder: '@yourhandle',
    href: handle => `https://www.instagram.com/${encodeURIComponent(handle)}/`
  },
  tiktok: {
    label: 'TikTok', short: 'TikTok', kind: 'handle',
    pattern: /^[A-Za-z0-9._]{1,24}$/, placeholder: '@yourhandle',
    href: handle => `https://www.tiktok.com/@${encodeURIComponent(handle)}`
  },
  x: {
    label: 'X / Twitter', short: 'X', kind: 'handle',
    pattern: /^[A-Za-z0-9_]{1,15}$/, placeholder: '@yourhandle',
    href: handle => `https://x.com/${encodeURIComponent(handle)}`
  },
  threads: {
    label: 'Threads', short: 'Threads', kind: 'handle',
    pattern: /^[A-Za-z0-9._]{1,30}$/, placeholder: '@yourhandle',
    href: handle => `https://www.threads.net/@${encodeURIComponent(handle)}`
  },
  snapchat: {
    label: 'Snapchat', short: 'Snap', kind: 'handle',
    pattern: /^[A-Za-z0-9._-]{3,15}$/, placeholder: 'yourhandle',
    href: handle => `https://www.snapchat.com/add/${encodeURIComponent(handle)}`
  },
  telegram: {
    label: 'Telegram', short: 'TG', kind: 'handle',
    pattern: /^[A-Za-z0-9_]{5,32}$/, placeholder: '@yourhandle',
    href: handle => `https://t.me/${encodeURIComponent(handle)}`
  },
  discord: {
    label: 'Discord', short: 'Discord', kind: 'handle',
    pattern: /^[A-Za-z0-9._]{2,32}$/, placeholder: 'yourname',
    href: null // username only — nothing reliable to link to
  },
  wechat: {
    label: 'WeChat / 微信', short: '微信', kind: 'handle',
    pattern: /^[A-Za-z][A-Za-z0-9_-]{5,19}$/, placeholder: 'WeChat ID',
    href: null
  },
  xhs: {
    label: 'XHS / 小红书', short: '小红书', kind: 'url',
    placeholder: 'https://www.xiaohongshu.com/user/profile/…',
    hosts: ['xiaohongshu.com', 'www.xiaohongshu.com', 'xhslink.com', 'www.xhslink.com'],
    path: url => (['xhslink.com', 'www.xhslink.com'].includes(url.hostname.toLowerCase())
      ? /^\/[A-Za-z0-9/]+$/.test(url.pathname)
      : /^\/user\/profile\/[A-Za-z0-9]+\/?$/.test(url.pathname)),
    hint: 'Use a Xiaohongshu profile or xhslink.com share link.'
  },
  linkedin: {
    label: 'LinkedIn', short: 'in', kind: 'url',
    placeholder: 'https://www.linkedin.com/in/yourname',
    hosts: ['linkedin.com', 'www.linkedin.com'],
    path: url => /^\/in\/[^/]+\/?$/.test(url.pathname),
    hint: 'Use a LinkedIn /in/ profile link.'
  },
  facebook: {
    label: 'Facebook', short: 'FB', kind: 'url',
    placeholder: 'https://www.facebook.com/yourname',
    hosts: ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.com', 'www.fb.com'],
    path: url => url.pathname.length > 1,
    hint: 'Use a Facebook profile or page link.'
  },
  youtube: {
    label: 'YouTube', short: 'YT', kind: 'url',
    placeholder: 'https://www.youtube.com/@yourchannel',
    hosts: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'],
    path: url => url.pathname.length > 1,
    hint: 'Use a YouTube channel link.'
  },
  website: {
    label: 'Website', short: 'Web', kind: 'url',
    placeholder: 'https://your-site.com',
    hosts: null, // any HTTPS host
    path: () => true,
    hint: 'Use a full HTTPS link.'
  }
};

export const PLATFORM_KEYS = Object.keys(SOCIAL_PLATFORMS);
const LEGACY_FIELDS = [['handle', 'instagram'], ['xhs', 'xhs'], ['linkedin', 'linkedin']];

export function platformLabel(platform) { return SOCIAL_PLATFORMS[platform]?.label || platform; }

/** Public link for an entry, or '' when the platform has no linkable profile. */
export function socialHref(entry) {
  const spec = SOCIAL_PLATFORMS[entry?.platform];
  if (!spec || !entry.value) return '';
  if (spec.kind === 'url') return entry.value;
  return spec.href ? spec.href(entry.value) : '';
}

/** Display text for a chip — @handle for handles, the platform name for links. */
export function socialText(entry) {
  const spec = SOCIAL_PLATFORMS[entry?.platform];
  if (!spec) return '';
  return spec.kind === 'handle' ? `@${entry.value}` : spec.label;
}

/** Validate and normalize one { platform, value } pair. Throws on bad input. */
export function cleanSocial(platform, rawValue) {
  const spec = SOCIAL_PLATFORMS[platform];
  if (!spec) throw new SocialValidationError('Choose a social platform from the list.');
  let value = String(rawValue ?? '').trim();
  if (!value) return null;
  if (value.length > MAX_VALUE) throw new SocialValidationError(`${spec.label} entries must be ${MAX_VALUE} characters or fewer.`);

  if (spec.kind === 'handle') {
    value = value.replace(/^@+/, '');
    // Accept a pasted profile link for handle platforms by taking the last path part.
    if (/^https?:\/\//i.test(value)) {
      try {
        const url = new URL(value);
        value = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '').replace(/^@+/, '');
      } catch { /* fall through to the pattern check */ }
    }
    if (!spec.pattern.test(value)) throw new SocialValidationError(`Enter a valid ${spec.label} username.`);
    return { platform, value };
  }

  let url;
  try { url = new URL(value); } catch { throw new SocialValidationError(`Enter a full HTTPS ${spec.label} link.`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new SocialValidationError('Social links must use HTTPS without a password or custom port.');
  }
  const host = url.hostname.toLowerCase();
  if (spec.hosts && !spec.hosts.includes(host)) throw new SocialValidationError(spec.hint || `Use a ${spec.label} link.`);
  if (!spec.path(url)) throw new SocialValidationError(spec.hint || `Use a ${spec.label} link.`);
  url.hash = '';
  return { platform, value: url.href };
}

/**
 * Build the canonical socials list from either a `socials` array or the legacy
 * handle/xhs/linkedin fields. `strict` throws on bad values (form submission);
 * otherwise bad entries are dropped (untrusted feed data).
 */
export function cleanSocials(input, { strict = true } = {}) {
  const raw = [];
  if (Array.isArray(input?.socials)) {
    for (const entry of input.socials) {
      if (entry && typeof entry === 'object') raw.push([entry.platform, entry.value]);
    }
  }
  // Legacy fields only fill platforms the socials array did not already set.
  for (const [field, platform] of LEGACY_FIELDS) {
    if (typeof input?.[field] === 'string' && input[field].trim() && !raw.some(([p]) => p === platform)) {
      raw.push([platform, input[field]]);
    }
  }

  const socials = [];
  const seen = new Set();
  for (const [platform, value] of raw) {
    let entry;
    try { entry = cleanSocial(platform, value); }
    catch (error) { if (strict) throw error; continue; }
    if (!entry || seen.has(entry.platform)) {
      if (entry && seen.has(entry.platform) && strict) {
        throw new SocialValidationError(`You already added a ${platformLabel(entry.platform)} account.`);
      }
      continue;
    }
    seen.add(entry.platform);
    socials.push(entry);
    if (socials.length > MAX_SOCIALS) {
      if (strict) throw new SocialValidationError(`Please share at most ${MAX_SOCIALS} social accounts.`);
      break;
    }
  }
  return socials.slice(0, MAX_SOCIALS);
}

/** Mirror the canonical list back onto the legacy fields for older consumers. */
export function legacyMirror(socials) {
  const find = platform => socials.find(entry => entry.platform === platform)?.value || '';
  return { handle: find('instagram'), xhs: find('xhs'), linkedin: find('linkedin') };
}
