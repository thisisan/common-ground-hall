import profiles from './assets/resident-profiles.json';
import photos from './assets/resident-photos.json';

// Reviewed snapshot of the organizer's registration sheet. Only wall fields
// are included; registration identifiers and consent signatures stay private.
// Keep the original responses intact, including longer introductions.
export const residentProfiles = profiles.map(profile => ({
  ...profile,
  photo: photos[profile.id] || '',
  imported: true
}));
