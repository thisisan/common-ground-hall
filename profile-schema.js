import { cleanAvatar } from './avatar-schema.js';
import { cleanSocials, legacyMirror, SocialValidationError } from './social-schema.js';
export class ProfileValidationError extends Error { constructor(message) { super(message); this.name = 'ProfileValidationError'; } }
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
  // Social accounts are free-form across platforms; legacy handle/xhs/linkedin
  // fields are folded in and mirrored back out for older feeds and saved rows.
  try { profile.socials = cleanSocials(input, { strict: true }); }
  catch (error) { throw error instanceof SocialValidationError ? new ProfileValidationError(error.message) : error; }
  Object.assign(profile, legacyMirror(profile.socials));
  try { profile.avatarConfig = cleanAvatar(input.avatarConfig); } catch (error) { throw new ProfileValidationError(error.message); }
  profile.avatar = Number.isInteger(input.avatar) && input.avatar >= 0 && input.avatar < 16 ? input.avatar : 0;
  return profile;
}
