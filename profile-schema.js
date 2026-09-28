import { cleanAvatar } from './avatar-schema.js';
import { cleanSocials, legacyMirror, SocialValidationError } from './social-schema.js';
export class ProfileValidationError extends Error { constructor(message) { super(message); this.name = 'ProfileValidationError'; } }
export function validateSubmission(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ProfileValidationError('Please fill in your profile.');
  const profile = {};
  for (const [key, max] of Object.entries({ name: 60, curriculum: 80, intro: 3000, help: 3000, meet: 3000 })) {
    const value = typeof input[key] === 'string' ? input[key].trim() : '';
    if (!value || value.length > max) throw new ProfileValidationError(`${({ name: 'Name', curriculum: 'Course', intro: 'Introduction', help: 'I can help with', meet: 'I want to meet' })[key]} is required and must be ${max} characters or fewer.`);
    profile[key] = value;
  }
  if (!['Arts & Design', 'Business', 'Engineering', 'Science', 'Medic', 'Law', 'Others'].includes(input.category)) throw new ProfileValidationError('Choose a curriculum group.');
  if (!['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 4+', 'Postgraduate'].includes(input.year)) throw new ProfileValidationError('Choose your year of study.');
  if (input.consent !== true) throw new ProfileValidationError('Please agree to share your profile on the hall wall.');
  profile.category = input.category; profile.year = input.year; profile.consent = true;
  // Social accounts are free-form across platforms; legacy handle/xhs/linkedin
  // fields are folded in and mirrored back out for older feeds and saved rows.
  try { profile.socials = cleanSocials(input, { strict: true }); }
  catch (error) { throw error instanceof SocialValidationError ? new ProfileValidationError(error.message) : error; }
  Object.assign(profile, legacyMirror(profile.socials));
  try { profile.avatarConfig = cleanAvatar(input.avatarConfig); } catch (error) { throw new ProfileValidationError(error.message); }
  profile.avatar = Number.isInteger(input.avatar) && input.avatar >= 0 && input.avatar < 16 ? input.avatar : 0;
  profile.contact = typeof input.contact === 'string' ? input.contact.trim() : '';
  if (profile.contact.length > 3000) throw new ProfileValidationError('Contact details must be 3000 characters or fewer.');
  profile.photo = typeof input.photo === 'string' ? input.photo : '';
  if (profile.photo && (profile.photo.length > 700000 || !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(profile.photo))) throw new ProfileValidationError('Use a PNG, JPEG or WebP picture under 500 KB.');
  profile.imported = true;
  return profile;
}
