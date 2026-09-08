import { cleanAvatar } from './avatar-schema.js';
export class ProfileValidationError extends Error { constructor(message) { super(message); this.name = 'ProfileValidationError'; } }
export function socialURL(value, type) {
  value = String(value || '').trim(); if (!value) return '';
  if (value.length > 700) throw new ProfileValidationError('Social links must be 700 characters or fewer.');
  let url; try { url = new URL(value); } catch { throw new ProfileValidationError(`Enter a full HTTPS ${type === 'xhs' ? 'XHS' : 'LinkedIn'} profile link.`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new ProfileValidationError('Social links must use HTTPS without a password or custom port.');
  const host = url.hostname.toLowerCase();
  const valid = type === 'xhs'
    ? ((['xiaohongshu.com', 'www.xiaohongshu.com'].includes(host) && /^\/user\/profile\/[A-Za-z0-9]+\/?$/.test(url.pathname)) || (['xhslink.com', 'www.xhslink.com'].includes(host) && /^\/[A-Za-z0-9/]+$/.test(url.pathname)))
    : (['linkedin.com', 'www.linkedin.com'].includes(host) && /^\/in\/[^/]+\/?$/.test(url.pathname));
  if (!valid) throw new ProfileValidationError(`Use a ${type === 'xhs' ? 'Xiaohongshu profile or xhslink.com share' : 'LinkedIn /in/ profile'} link.`);
  url.hash = ''; return url.href;
}
export function validateSubmission(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ProfileValidationError('Please fill in your profile.');
  const profile = {};
  for (const [key, max] of Object.entries({ name: 60, curriculum: 80, intro: 180, help: 140, meet: 140 })) {
    const value = typeof input[key] === 'string' ? input[key].trim() : '';
    if (!value || value.length > max) throw new ProfileValidationError(`${({ name: 'Name', curriculum: 'Course', intro: 'Introduction', help: 'I can help with', meet: 'I want to meet' })[key]} is required and must be ${max} characters or fewer.`);
    profile[key] = value;
  }
  if (!['Arts & Design', 'Business', 'Engineering', 'Science', 'Other'].includes(input.category)) throw new ProfileValidationError('Choose a curriculum group.');
  if (!['Year 1', 'Year 2', 'Year 3', 'Year 4+', 'Postgraduate'].includes(input.year)) throw new ProfileValidationError('Choose your year of study.');
  if (input.consent !== true) throw new ProfileValidationError('Please agree to share your profile on the hall wall.');
  profile.category = input.category; profile.year = input.year; profile.consent = true;
  const handle = String(input.handle || '').trim().replace(/^@/, '');
  if (handle && !/^[A-Za-z0-9._]{1,30}$/.test(handle)) throw new ProfileValidationError('Enter a valid Instagram handle.');
  profile.handle = handle;
  profile.xhs = socialURL(input.xhs, 'xhs'); profile.linkedin = socialURL(input.linkedin, 'linkedin');
  try { profile.avatarConfig = cleanAvatar(input.avatarConfig); } catch (error) { throw new ProfileValidationError(error.message); }
  profile.avatar = Number.isInteger(input.avatar) && input.avatar >= 0 && input.avatar < 16 ? input.avatar : 0;
  return profile;
}
