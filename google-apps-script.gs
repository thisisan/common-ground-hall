/**
 * Common Ground: read-only Google Sheets feed.
 * Paste into Extensions > Apps Script in the Google Form's response Sheet.
 * Change RESPONSE_SHEET_NAME to the exact response-tab name.
 * Deploy as Web app > Execute as Me > Who has access: Anyone.
 * Only approved, consented fields below leave the Sheet. No write endpoint.
 */
const RESPONSE_SHEET_NAME = 'Form Responses 1';

function doGet() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RESPONSE_SHEET_NAME);
    if (!sheet) throw new Error('Response tab not found. Check RESPONSE_SHEET_NAME.');
    const rows = sheet.getDataRange().getValues();
    const headers = rows.shift().map(value => String(value).trim());
    const required = ['Timestamp', 'Your name', 'Your course', 'Curriculum group', 'Year of study', 'I am', 'I can help with', 'I want to meet', 'Consent', 'Approved'];
    if (required.some(header => !headers.includes(header))) throw new Error('Missing required column. Check the setup guide.');
    const index = Object.fromEntries(headers.map((header, i) => [header, i]));
    const profiles = [];
    for (const row of rows) {
      const get = key => index[key] === undefined ? '' : String(row[index[key]] ?? '').trim();
      const approved = get('Approved').toLowerCase();
      const consent = get('Consent').toLowerCase();
      if (!['true', 'yes', 'approved'].includes(approved) || !['i agree', 'yes', 'true'].includes(consent)) continue;
      if (!get('Your name')) continue;
      const timestamp = row[index.Timestamp];
      const stamp = timestamp instanceof Date ? timestamp.toISOString() : String(timestamp);
      const id = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, stamp + '|' + get('Your name'))).replace(/=+$/, '');
      const avatarNumber = Number(get('Avatar'));
      profiles.push({
        id: id,
        name: get('Your name').slice(0, 60),
        curriculum: get('Your course').slice(0, 80),
        category: get('Curriculum group').slice(0, 30),
        year: get('Year of study').slice(0, 30),
        intro: get('I am').slice(0, 180),
        help: get('I can help with').slice(0, 140),
        meet: get('I want to meet').slice(0, 140),
        handle: get('Find me at').slice(0, 31),
        avatar: Number.isInteger(avatarNumber) && avatarNumber >= 1 && avatarNumber <= 16 ? avatarNumber - 1 : Math.abs(id.charCodeAt(0)) % 16
      });
    }
    return jsonResponse({ profiles: profiles, updatedAt: new Date().toISOString() });
  } catch (error) {
    return jsonResponse({ error: error.message });
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
