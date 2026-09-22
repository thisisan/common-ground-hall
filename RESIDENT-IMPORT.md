# SKY Lee Hall resident snapshot

Updated 22 September 2026 from the organizer's registration spreadsheet and
Profile Pictures folder. The deployed wall includes 23 resident profiles and
19 matched uploaded pictures. It is a published snapshot, not an automatic
Google Sheets sync. Refresh wall reloads the published version when no live
backend or Apps Script feed is configured.

`assets/resident-profiles.json` includes only preferred names, field/year of
study, personal introductions, contributions, people they want to meet, and
the contact information residents chose to share. Responses are preserved in
full; cards show a short preview and the profile dialog shows the entire text.
The two numeric study fields remain as submitted rather than guessing courses.
Registration email, room/student numbers, legal names, timestamps, signatures,
and feedback are not imported. All 23 source rows had a populated consent field.

Pictures were matched by the submitted name and upload filename, including
accent normalization and the Chinese name for Stella. The matched images are
resized WebP copies embedded in `assets/resident-photos.json`, so visitors do
not need Drive access. Missing uploads use initials:

- Super Yello Duck
- Rebecca
- Franklin
- Dorothy

Four other files in the folder had no corresponding spreadsheet entry and were
not published. The unmatched Li upload was not assigned to Rebecca Zhang.

To update, review the organizer's latest submissions, edit only the wall fields
in the profile JSON, and add matched images under each stable resident ID in the
photo JSON. Keep source spreadsheets outside this repository. Run
`npm run build:pages` and `npm test`, then publish the rebuilt `docs/index.html`.

The existing backend, moderation, social editor, and Google Form/feed setup
remain available. Without a submission endpoint, the join form explicitly
offers a browser-only preview; it does not claim to publish a resident.
