# SKY Lee Social Wall

A read-only social wall for Simon K. Y. Lee Hall, HKU, with a minimalist layout and subtle hall blue accents. Students browse SKYers, search shared interests, filter fields of study, and open contact details. Profiles are uploaded and published by hall staff; there is no student submission form or browser-local preview flow.

Live site: https://thisisan.github.io/common-ground-hall/

## Reviewed profiles

The September 28, 2026 snapshot contains 26 profiles and 21 matched pictures. Raven retains his profile with an initial instead of a picture, as requested. See [RESIDENT-IMPORT.md](RESIDENT-IMPORT.md). Registration sheets and private identifiers are never bundled. Source-sheet changes require a reviewed import and deployment; they do not sync automatically.

## Build and verify

```sh
npm ci
npm run build:pages
npm test
SITE_URL=https://thisisan.github.io/common-ground-hall/ node scripts/check-live.mjs
```

GitHub Pages serves `docs/` on `main`. Publish the reviewed source and regenerated `docs/` to `thisisan/common-ground-hall`. `npm start` serves the local `dist/` build on port 4173.

## Backend and analytics status

The live site currently serves the reviewed snapshot. It does not collect visitor analytics. omg.dev deployment requires restoring the hosting account connection, which currently returns `Session refresh failed (400): session not found`.

Backend/admin modules remain in the repository for the next deployment, but are not connected to the public wall. The intended backend will allow only hall staff to upload/manage profiles and will provide aggregate visits, page views, referral sources, profile opens and contact interactions. The removed public join, avatar and setup tools are not part of the visitor interface.

## Assets

The Manrope font is bundled under its SIL Open Font License (`assets/Manrope-OFL.txt`). Existing optional avatar assets retain their upstream notices: Notionists by Zoish via DiceBear (CC0), and Avatartion by Wilmer Terrero (MIT, `vendor/avatartion/LICENSE.txt`). The site is not affiliated with Notion.
