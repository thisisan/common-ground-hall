# omg.dev deployment

Public wall: https://skyleesocialwall.omgs.app/

Staff dashboard: https://skyleesocialwall.omgs.app/?admin=1

The existing GitHub Pages site uses the same backend through `config.json`. The public wall loads published profiles when opened; staff changes appear when a visitor reloads. There is no public submission form. Staff sign in to add profiles, upload/remove pictures, edit full responses and contact links, publish/unpublish, and delete profiles.

## Storage and access

`GET /api/hall` returns published profiles. `POST /api/hall` supports staff sign-in and profile management, plus limited public analytics events. Staff creation and all management/reporting actions require a server-verified session. Tokens last eight hours and are stored hashed in SQLite; the browser keeps its token in tab-scoped sessionStorage. Password changes invalidate existing sessions. Updates require a current row version to prevent overwriting concurrent edits. Deletion requires typing DELETE.

The reviewed 26-profile snapshot seeds the database once, within a transaction. Redeployments preserve edits and deletions; the initial seed is never reapplied. SQLite lives at `.vibes/data.db`, persisted by omg.dev. Private tables are not exposed as generic CRUD collections. `schema.ts` has a separate user-scoped marker to ensure persistent database deployment.

## Analytics

The staff dashboard shows the last 30 days of visits, page views, profile opens, contact-details opens, contact-link clicks and traffic source groups (direct, Google, Instagram, Facebook, Threads, HKU, other). A visit is activity from a random browser-tab identifier, ending after 30 minutes of inactivity; it is not a unique-person count. Contact clicks do not prove someone sent a message.

Events contain only event type, a source group and the random session identifier. No resident IDs, names, contact values, search text, referrer paths, IP addresses or user-agent strings are stored by this analytics implementation. The server hashes session IDs and uses expiring session/rate-limit rows; daily aggregate counters are retained for 366 days. Do Not Track and Global Privacy Control suppress analytics. Staff dashboard activity is excluded. The hosting platform may maintain its own operational logs independently.

## Deploy changes

1. Preserve `.omg/project.json`; deploy into this existing app rather than creating another.
2. Run `npm ci`, `npm run build:backend`, `npm run test:backend`, and `npm test` for relevant changes.
3. Use the runtime `omg_deploy` tool with this folder. If pending, poll `omg_deploy_status` instead of starting another deploy.
4. Verify the live public feed, staff sign-in, browser tracking and persistence before reporting deployment complete.
5. For GitHub Pages, run `npm run build:pages`, commit source and `docs/`, then push to `thisisan/common-ground-hall` main. Verify the published build.

`vite-plus` is pinned to 0.3.0 with Vite 7.3.6, the pair verified by the hosted build. Newer Vite Plus versions require an alias migration; do not unpin it without validating the production builder.

## Staff access and runtime settings

The generated staff password is in the ignored `.omg/admin-access.txt`; its salted scrypt hash is in ignored `.env.local`. Neither is committed or sent to the public client. Deliver the password privately to the organizer.

Runtime settings are `HALL_ADMIN_PASSWORD_HASH` and `HALL_ALLOWED_ORIGINS`. The latter must include BOTH `https://thisisan.github.io` and `https://skyleesocialwall.omgs.app`: the hosting proxy rewrites the internal request origin. Setting environment values requires redeployment to take effect. Use the omg.dev app dashboard or the Cloud environment API; never put secrets into `config.json`.

The Computer's Cloud OAuth authorization was restored through the shared browser. A website login alone does not renew its hosting session: complete Cloud authorization and verify `omg_whoami` before deploying.
