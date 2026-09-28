# SKY Lee Social Wall

A read-only social wall for Simon K. Y. Lee Hall, HKU, with a minimalist layout and subtle hall blue accents. Students browse SKYers, search shared interests, filter fields of study, and open contact details. Profiles are uploaded and published by hall staff; there is no student submission form or browser-local preview flow.

Live site: https://thisisan.github.io/common-ground-hall/

## Reviewed profiles

The September 28, 2026 snapshot contains 26 profiles and 21 matched pictures. Raven retains his profile with an initial instead of a picture, as requested. See [RESIDENT-IMPORT.md](RESIDENT-IMPORT.md). Registration sheets and private identifiers are never bundled. Source-sheet changes do not sync automatically. Staff can maintain profiles through the dashboard; a source-sheet refresh requires a reviewed import.

## Build and verify

```sh
npm ci
npm run build:pages
npm test
SITE_URL=https://thisisan.github.io/common-ground-hall/ node scripts/check-live.mjs
```

GitHub Pages serves `docs/` on `main`. Publish the reviewed source and regenerated `docs/` to `thisisan/common-ground-hall`. `npm start` serves the local `dist/` build on port 4173.

## Backend and staff dashboard

omg.dev wall: https://skyleesocialwall.omgs.app/

Staff dashboard: https://skyleesocialwall.omgs.app/?admin=1

Both public addresses use the same persistent backend. Staff can add profiles, upload/remove pictures, edit details, publish/unpublish and delete. Students can only browse published profiles. The initial reviewed snapshot seeds the database once; later deployments preserve staff changes.

The staff dashboard reports aggregate visits, page views, source groups, profile opens and contact interactions. It does not collect resident names, profile IDs, contact details or searches. Analytics respect Do Not Track and Global Privacy Control. See [DEPLOY-OMG.md](DEPLOY-OMG.md) for deployment, private staff access, storage and metric definitions.

## Assets

The Manrope font is bundled under its SIL Open Font License (`assets/Manrope-OFL.txt`). Existing optional avatar assets retain their upstream notices: Notionists by Zoish via DiceBear (CC0), and Avatartion by Wilmer Terrero (MIT, `vendor/avatartion/LICENSE.txt`). The site is not affiliated with Notion.
