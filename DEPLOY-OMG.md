# omg.dev backend deployment

The public wall stays at https://thisisan.github.io/common-ground-hall/. The same frontend plus a persistent SQLite API deploys to omg.dev. Public form submissions wait in Pending. Only server-authenticated admins can publish, edit, feature, archive, restore, or permanently delete profiles.

## Current status

Implementation, database tests, browser workflow, and the omg.dev production bundle are verified locally. Hosted backend deployment is pending renewal of the existing omg.dev hosting login (the CLI returned `Session refresh failed (400): invalid refresh token`). No live backend URL is set in `config.json` yet. Until connected, the public website is explicitly a browser-local sample wall.

## Deploy after sign-in

1. On the hosting machine, sign in: `/home/user/.npm-global/bin/omg login`. This is the hosted-app CLI, distinct from `/home/user/.local/bin/omg`, which manages this computer.
2. In the site directory, run `npm ci`, `npm run build:backend`, and `node scripts/create-admin.mjs`. The last command creates a new random admin password in `.omg/admin-access.txt` and its salted scrypt hash in `.env.local`. Both files are ignored by Git. It refuses to overwrite an existing environment file.
3. Run `/home/user/.npm-global/bin/omg deploy --name common-ground-hall-backend`. The returned `.omg/` app link must be preserved and reused for all subsequent deployments; do not repeatedly create new apps. `schema.ts` keeps the runtime database persistent, and `functions/hall.ts` mounts the explicit API.
4. Set the runtime secrets with the hosted CLI. On this machine, its direct entrypoint is `bun /home/user/.omg/apps-cli/0.4.42/dist/omg-bun.mjs env push --file .env.local`. The outer machine CLI does not forward every hosted command. `.env.local` is intentionally excluded from source deployment.
5. Configure the deployed app as public using `/home/user/.npm-global/bin/omg visibility public` so the GitHub site can submit and refresh. Public access exposes only the approved feed and submission endpoint; the admin APIs still require an authenticated session. Visit the exact returned omg.dev management URL for runtime settings.
6. Set `backendUrl` in `config.json` to the exact returned `https://<slug>.omgs.app` origin. Do not include `/api/hall`. Run `npm run build:pages`, commit the updated source and `docs/`, and push to the GitHub repository. On the omg.dev origin, the app automatically uses its same-origin API.
7. Open **Admin board**, sign in using the generated hall admin password, and verify a test submission → publish → wall refresh → archive → refresh. Remove test data afterward.

## Runtime contract

- `GET /api/hall`: approved profiles only, no-store. The wall fetches this only on Refresh wall.
- `GET /api/hall?view=health`: readiness response; no personal data.
- `POST /api/hall`: JSON-encoded body with `Content-Type: text/plain`; avoids a preflight for GitHub Pages. `action` is `submit`, `login`, `logout`, `admin-list`, `update`, `publish`, `archive`, `restore`, or `delete`.
- Submission requires consent, validated profile fields and a random `requestId`. Retries with the same ID do not duplicate a profile.
- Login returns a random, eight-hour admin session. Only a hash of the session is stored in SQLite. Admin calls send it in the POST body (never a URL); it is retained in sessionStorage for that browser tab and backend origin.
- Admin updates require the current row `version`; concurrent/stale edits return 409. Permanent deletion also requires `confirmation: "DELETE"`.
- XHS accepts HTTPS Xiaohongshu profile links or xhslink.com share links. LinkedIn accepts HTTPS `/in/` profiles. Instagram accepts handles. Domain, length and protocol checks also run on the server.
- Custom avatars are validated part selections, never user-provided SVG markup. Avatartion's trusted SVG components are bundled locally.
- SQLite tables `cg_profiles`, `cg_sessions`, `cg_limits`, and `cg_audit` live in `.vibes/data.db`, omg.dev's persistent database path. They are not registered as generic CRUD collections or realtime subscriptions. The schema's separate user-scoped runtime marker ensures database deployment classification without exposing moderation tables.
- Changing `HALL_ADMIN_PASSWORD_HASH` revokes all sessions on their next request. Login is throttled to 20 attempts per 10 minutes; submissions to 120 per hour for the hall. No client-supplied IP headers are trusted for these limits.
- `HALL_ALLOWED_ORIGINS` defaults to `https://thisisan.github.io`; the backend's own origin is also permitted. Admin authorization is enforced independently of CORS.

## Local development

```sh
npm run build
node scripts/create-admin.mjs
bun --env-file=.env.local scripts/serve-backend.ts
```

Open http://localhost:4174. The database is persistent across process restarts. Do not commit `.vibes/`, `.env.local`, `.omg/`, or any database/credentials files.

## Verification

```sh
npm run test:backend
npm test
npm run build:backend
```

The compiled production bundle is also tested without node_modules: public API 200, user-scoped marker 401, private profile/session table paths 404, and new submissions withheld from the public feed. A production deployment and persistence across a real omg.dev redeployment still need a live deployment test after sign-in.
