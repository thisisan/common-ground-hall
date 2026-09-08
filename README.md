# Common Ground — university hall social wall

A separate, responsive website inspired by the supplied profile card: monochrome Notionists avatars, warm paper, pastel portrait panels, and hall-specific introductions. Built as a single HTML file, with no external font, avatar, or JavaScript requests at runtime.

## Hosted site

Public site: https://thisisan.github.io/common-ground-hall/

Source repository: https://github.com/thisisan/common-ground-hall

GitHub Pages serves the committed `docs/` folder on `main`. To publish changes, run `npm ci && npm run build:pages`, commit the updated source and `docs/`, then push to `main`. It uses sample residents until the Google Form and Apps Script setup below is complete. Only the hall site is included in its public repository.

Verify the deployed page with `SITE_URL=https://thisisan.github.io/common-ground-hall/ node scripts/check-live.mjs`. The check exercises the actual hosted site and saves `evidence/hosted-desktop.png`.

## Run it

```sh
cd social-wall
npm ci
npm run build
npm start
```

Open http://localhost:4173. Deploy `dist/index.html` to any static web host. The source `index.html` is a build template; use the built file to preview or publish. This project does not alter the other websites in this repository.

## What works

- Responsive resident wall with course filters and name/skill/interest search.
- Full profile dialog, Instagram links, keyboard controls, and reduced-motion support.
- Sample join form with 16 selectable Notionists avatars, consent, and browser-local persistence. Sample profiles are explicitly labeled and are not shared with other visitors.
- Live join button opens your Google Form, with a real QR code for that form.
- **Refresh wall is the only action that requests the feed.** No fetch on load, settings save, timer, focus, or display-mode entry. Reloading a live wall starts empty until Refresh wall is pressed. Feed failures preserve the currently displayed profiles.
- Refresh reflects approvals, edits, and removals; repeated refreshes do not append duplicates. Changing feeds clears the previous feed's profiles and cancels its pending request.
- Display mode shows four profiles per page (two on smaller screens), rotating every 12 seconds. Pause/Resume and Exit buttons. It cycles the current data only. Reduced-motion preference pauses rotation initially.

## Google Form → Google Sheet → Refresh wall

No webhook, paid integration, or separate database is needed. Google Forms writes to the response Sheet; Apps Script exposes approved rows as JSON when the organizer clicks Refresh wall.

1. Create a Google Form. Add these question titles **exactly**, then connect its Responses tab to a Google Sheet:

| Question title | Type / choices |
| --- | --- |
| Your name | Short answer; required; max 60 characters |
| Your course | Short answer; required; max 80 characters |
| Curriculum group | Dropdown: Arts & Design, Business, Engineering, Science, Other |
| Year of study | Dropdown: Year 1, Year 2, Year 3, Year 4+, Postgraduate |
| I am | Paragraph; required; max 180 characters |
| I can help with | Paragraph; required; max 140 characters |
| I want to meet | Paragraph; required; max 140 characters |
| Find me at | Optional short answer: Instagram handle only (with or without @) |
| Avatar | Optional dropdown, 1–16; see `avatar-picker.html` for the numbered illustrations |
| Consent | Required checkbox with exactly one choice: I agree |

Add description to Consent: “I’m happy for these answers and my Instagram handle to be shown on the hall wall.” Do not include private details such as room numbers in the form. The feed is publicly readable, so only consented, approved profile fields should be included. Optional collected emails remain private and are never returned by this script.

2. In the **response Sheet**, add an `Approved` column at the end and use Insert → Checkbox on its data cells. Only checked rows with consent will be shown. New rows start unapproved. Google Forms supplies the `Timestamp` column; if your Google account uses another language, rename that column to `Timestamp`.
3. In that Sheet, open **Extensions → Apps Script**. Paste `google-apps-script.gs`. Change `RESPONSE_SHEET_NAME` to your exact response-tab name (e.g. `Form Responses 1`).
4. **Deploy → New deployment → Web app**. Execute as **Me**, access **Anyone**. Authorize your script and copy the deployed URL ending in `/exec`. If your university disables anonymous web apps, this setup needs an approved hosting/authentication alternative; do not publish the whole response Sheet as a workaround.
5. Open the wall’s **Wall setup**. Add your hall name, the Google Form’s responder link, and the Apps Script URL. Save. Press **Refresh wall** to load the approved profiles.
6. To make these settings the default for all visitors, put the same three values into `config.json`, rebuild, and host the new `dist/index.html`. Setup settings saved in a browser override these defaults for that browser only.

New entries and edits remain in Sheets until you click Refresh wall. Unchecking Approved removes the profile on the next successful refresh. A disconnected screen keeps its current wall until a refresh succeeds. Do not collect sensitive details: the public feed and wall are meant only for introductions residents agree to share.

**What still needs your real setup:** a hall name, a Google Form/response Sheet, and deployment of the included Apps Script in your Google account. No Google account resources are created by this repository. Live Google connectivity requires those real URLs and should be checked from the hosted wall, including a test submission, approval, and refresh. The transcript's isolated interactive preview cannot access external feeds; download/host the built HTML for Google integration.

## Verification

```sh
npm test
```

Browser coverage checks manual-only fetching, approval updates/removals, failure retention, no duplicates, search, form validation/persistence, responsive layout, keyboard dialogs, and display rotation. Apps Script is tested using a mocked Sheet/ContentService to check that only approved, consented fields are exposed. This does not substitute for a real Google deployment smoke test.

## Assets and references

- Notionists by Zoish, via [DiceBear](https://www.dicebear.com/styles/notionists/), CC0 1.0. Sixteen unmodified generated illustrations are bundled in `assets/avatars.json`; regenerate with `node scripts/avatars.mjs`. Not affiliated with Notion.
- Manrope font: SIL Open Font License, included in `assets/Manrope-OFL.txt`. The Latin variable font is bundled; other scripts use the system fallback.
- QR codes generated locally with `qrcode` (MIT).
- [Google Apps Script web apps](https://developers.google.com/apps-script/guides/web) and [JSON Content Service](https://developers.google.com/apps-script/guides/content).
