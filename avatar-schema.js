export const avatarParts = [
  { key: 'head', label: 'Face', prefix: 'faces/Face', count: 8 },
  { key: 'hair', label: 'Hair', prefix: 'hairs/Hair', count: 32 },
  { key: 'eyes', label: 'Eyes', prefix: 'eyes/Eye', count: 6 },
  { key: 'mouth', label: 'Mouth', prefix: 'mouths/Mouth', count: 10 },
  { key: 'outfit', label: 'Outfit', prefix: 'outfits/Outfit', count: 25 },
  { key: 'accessories', label: 'Accessories', prefix: 'accessories/Accessory', count: 18, optional: true },
  { key: 'facialHair', label: 'Facial hair', prefix: 'facial-hair/FacialHair', count: 9, optional: true }
];
export const avatarColors = ['#e3dfef', '#f0e6cf', '#dde6df', '#dce5e9', '#efe2d9', '#ffffff'];
export const defaultAvatar = { head: 1, hair: 1, eyes: 1, mouth: 1, outfit: 1, accessories: 0, facialHair: 0, background: '#e3dfef' };
export function cleanAvatar(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const result = {};
  for (const p of avatarParts) {
    const n = input[p.key];
    if (!Number.isInteger(n) || n < (p.optional ? 0 : 1) || n > p.count) throw new Error(`Choose a valid ${p.label.toLowerCase()} style.`);
    result[p.key] = n;
  }
  if (!avatarColors.includes(input.background)) throw new Error('Choose a valid avatar background.');
  result.background = input.background;
  return result;
}
