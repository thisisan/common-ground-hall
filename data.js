export const categories = ['Arts & Design', 'Business', 'Engineering', 'Science', 'Other'];
export const sampleProfiles = [
  { id: 'demo-1', name: 'Alex Chan', curriculum: 'Architecture', category: 'Arts & Design', year: 'Year 2', intro: 'Sketchbook always in hand. Usually hunting down the best milk tea.', help: 'Sketching, Adobe tools & late-night model making.', meet: 'Creative souls and weekend café explorers.', handle: 'alex.sketches', avatar: 0 },
  { id: 'demo-2', name: 'Sophie Wong', curriculum: 'Business Administration', category: 'Business', year: 'Year 1', intro: 'New to hall life. Big on good food and even better conversations.', help: 'Presentations, baking & finding a good deal.', meet: 'Dinner buddies and people to try new things with.', handle: 'sophiew.jpg', avatar: 1 },
  { id: 'demo-3', name: 'Marcus Lee', curriculum: 'Computer Science', category: 'Engineering', year: 'Year 3', intro: 'Building little things on the internet. Terrible at keeping plants alive.', help: 'Coding, fixing your laptop & board game rules.', meet: 'Hackathon teammates and casual gamers.', handle: 'marcus.builds', avatar: 2 },
  { id: 'demo-4', name: 'Emma Lau', curriculum: 'Psychology', category: 'Science', year: 'Year 2', intro: 'A good listener with an endless reading list and a matcha habit.', help: 'Research, essay feedback & a listening ear.', meet: 'Book lovers and people up for a sunset walk.', handle: 'emmalau', avatar: 3 },
  { id: 'demo-5', name: 'Ryan Cheung', curriculum: 'Mechanical Engineering', category: 'Engineering', year: 'Year 1', intro: 'Early-morning runner. Always up for a spontaneous adventure.', help: 'Maths, bike repairs & getting out of bed for a run.', meet: 'Running buddies and weekend hikers.', handle: 'ryan.outside', avatar: 4 },
  { id: 'demo-6', name: 'Chloe Ng', curriculum: 'Visual Arts', category: 'Arts & Design', year: 'Year 3', intro: 'Collecting little moments on film. My room is basically a mini gallery.', help: 'Photography, poster design & creative projects.', meet: 'Art lovers, music people and fellow makers.', handle: 'chloe.onfilm', avatar: 5 },
  { id: 'demo-7', name: 'Daniel Ho', curriculum: 'Economics & Finance', category: 'Business', year: 'Year 2', intro: 'Basketball after class, cooking after basketball. Come grab a plate.', help: 'Excel, meal prep & your free-throw technique.', meet: 'Pickup basketball players and kitchen companions.', handle: 'danielho', avatar: 6 },
  { id: 'demo-8', name: 'Tiffany Lam', curriculum: 'Biological Sciences', category: 'Science', year: 'Year 1', intro: 'Plant parent, animal lover, and your future karaoke duet partner.', help: 'Biology notes, plant care & a confidence boost.', meet: 'Study buddies and fellow karaoke enthusiasts.', handle: 'tiff.lam', avatar: 7 },
  { id: 'demo-9', name: 'Jamie Yip', curriculum: 'English & Linguistics', category: 'Other', year: 'Year 4+', intro: 'Here for poetry, tiny gigs, and conversations that go past midnight.', help: 'Proofreading, public speaking & guitar chords.', meet: 'Writers, musicians and open-mic companions.', handle: 'jamie.words', avatar: 8 },
  { id: 'demo-10', name: 'Maya Patel', curriculum: 'Medicine', category: 'Science', year: 'Year 2', intro: 'Making time for yoga between lectures. I make a pretty great chai.', help: 'Study planning, biology & easy vegetarian meals.', meet: 'Yoga buddies and anyone missing home cooking.', handle: 'maya.p', avatar: 9 },
  { id: 'demo-11', name: 'Ethan Yu', curriculum: 'Civil Engineering', category: 'Engineering', year: 'Year 3', intro: 'A football fan who takes the scenic route everywhere.', help: 'Physics, travel planning & a five-a-side match.', meet: 'Football teammates and spontaneous explorers.', handle: 'ethanyu', avatar: 10 },
  { id: 'demo-12', name: 'Olivia Cheng', curriculum: 'Law', category: 'Other', year: 'Postgraduate', intro: 'A puzzle person with a soft spot for old movies and spicy noodles.', help: 'Debate prep, essay structure & crossword clues.', meet: 'Film-night friends and board game regulars.', handle: 'olivia.cheng', avatar: 11 }
];

export function normalizeProfiles(payload) {
  if (!payload || payload.error || !Array.isArray(payload.profiles)) throw new Error('The feed did not return a valid profiles list.');
  const ids = new Set();
  return payload.profiles.map((profile, index) => {
    if (!profile || typeof profile !== 'object' || typeof profile.name !== 'string' || !profile.name.trim()) throw new Error('A profile is missing its name.');
    const clean = {};
    for (const [key, max] of Object.entries({ name: 60, curriculum: 80, year: 30, intro: 180, help: 140, meet: 140, handle: 31 })) {
      clean[key] = typeof profile[key] === 'string' ? profile[key].trim().slice(0, max) : '';
    }
    clean.id = String(profile.id || `row-${index}`).slice(0, 100);
    if (ids.has(clean.id)) throw new Error('The feed contains duplicate profile IDs.');
    ids.add(clean.id);
    clean.category = categories.includes(profile.category) ? profile.category : 'Other';
    clean.avatar = Number.isInteger(Number(profile.avatar)) && Number(profile.avatar) >= 0 ? Number(profile.avatar) % 16 : index % 16;
    clean.handle = clean.handle.replace(/^@/, '');
    if (!/^[A-Za-z0-9._]{1,30}$/.test(clean.handle)) clean.handle = '';
    return clean;
  });
}

export function validateSettings(settings) {
  const result = { hallName: String(settings.hallName || 'Common Ground').trim().slice(0, 60), feedUrl: '', formUrl: '' };
  for (const key of ['feedUrl', 'formUrl']) {
    const value = String(settings[key] || '').trim();
    if (!value) continue;
    let url;
    try { url = new URL(value); } catch { throw new Error(`Please enter a valid ${key === 'feedUrl' ? 'Apps Script' : 'Google Form'} URL.`); }
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use an HTTPS link without embedded credentials.');
    if (key === 'feedUrl' && !(url.hostname === 'script.google.com' && /^\/macros\/s\/[^/]+\/exec$/.test(url.pathname))) throw new Error('The feed link should be the deployed Apps Script URL ending in /exec.');
    if (key === 'formUrl' && !(url.hostname === 'forms.gle' || (url.hostname === 'docs.google.com' && url.pathname.startsWith('/forms/')))) throw new Error('Use a Google Forms link from docs.google.com/forms or forms.gle.');
    result[key] = url.href;
  }
  return result;
}
