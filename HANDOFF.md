# ShreeRam Milks — handoff for a new chat (updated 2026-10-11)

Read this first, then `admin/AGENTS.md`, `admin/WIRING-PLAN.md` and `admin/specs.md`. It contains no secrets.
The same file is kept at `D:\ShreeRam Milks\HANDOFF.md`.

## How to talk to the owner
- The owner is **not technical**. Very simple words, short steps, analogies. No code unless asked. Don't ask many questions; give a recommendation and say what you'll do.
- **The owner runs every SQL themself in pgAdmin.** Never run SQL or anything that creates, changes or deletes database data. Write the SQL into `Backend/migrations/` (wrapped in `BEGIN … COMMIT`, with `GRANT … TO shreeram_app` for every new table) and explain it simply. Read-only checks are fine.
- Never print or repeat secrets. Never read `Backend/.env.local`. Secrets shared in chat earlier (database, S3 access key, Gmail app password) **must be rotated before launch**.
- Be honest about what is and isn't verified. Say when something was not tested on the phone.

## Project map (`D:\ShreeRam Milks`)
| Folder | What | Port |
|---|---|---|
| `Frontend` | Customer app, Expo / React Native, English + Gujarati. Rules: `Frontend/AGENTS.md`, `agent-coding-rules.md` | Expo |
| `admin` | Admin panel, Next.js 16 (read `node_modules/next/dist/docs` before using Next APIs). Rules: `admin/AGENTS.md` | **3000** |
| `Backend` | Express 5 + TypeScript + Postgres on AWS RDS (`shreeram_dev`), S3 `shreeram-media-dev` | **4000** |
| `start-servers.ps1` | Starts all three; writes the PC's network address into `Frontend/.env.local` | |

Docs (kept in `admin/`, copies in `Frontend/` where noted): `PERFORMANCE-AND-AWS.md` (+Frontend, Backend copies), `STORE-COMPLIANCE.md` (+Frontend), `WIRING-PLAN.md` (the full map of what is left), `specs.md` (business rules v0.2, owner-approved).

## What is real (saved in the database, tested)
Backend modules: `auth` (admin), `audit`, `media` (S3 presigned uploads, SVG icon safety check), `banners`, `onboarding`, `app-settings`, `help` (topics + FAQs), `policies` (versioned, + public web pages `/legal/:type`).
Admin pages that are real: Banners (tabs per type), Onboarding, App Settings (tabs), Help Center (FAQs), Legal & Policies. **The other 22 admin pages still use browser mock data.**
Phone app reads from the backend: Home banners (slideshow), Onboarding carousel, App settings (support channels, maintenance and update gates, feature switches), Help, Support, Policies. **26 screens still use sample data** (list in `WIRING-PLAN.md`). `Report an issue` is built but honestly says "not connected" until customer sign-in exists.
Public endpoints are cached 30 s in memory and with `Cache-Control` (`src/http/ttl-cache.ts`, `public-cache.ts`); admin writes clear the cache.

## Migrations (all run by the owner in pgAdmin, in order)
`0001` admin auth + banners · `0002` media assets · `0003` grants for media · `0004` banner labels, SVG icons, onboarding · `0005` app settings · `0006` help + policies · **`0007` master data (just run: categories, trial plans, subscription rules, delivery slots, cut-off rules + conditions, service areas + PINs + PIN slots, fulfilment profiles, with database triggers)**.
The owner applied them by hand, so the `npm run migrate` runner's history table is not filled: **do not run the runner.**

## Decisions (see `specs.md` and `WIRING-PLAN.md` for detail)
- One admin does everything (no staff role, no delivery-partner app); marks deliveries done in the admin.
- **Prepaid** = pay first for everything (products, trials, subscriptions, any future rule) in the app through **PhonePe**; server calculates price. **Credit** customers are set by the admin, have a credit limit that **blocks** orders above it, get a payment request as an in-app banner + notification with a **Pay now** button (PhonePe). Admin marks cash/UPI/bank as received. **Refunds are never sent by the system** (admin does it in PhonePe and records it). No invoices/GST. No existing customers to import.
- **No maps** (cost). Delivery eligibility is by PIN code. Pan-India/shipping products accept any valid PIN. Optional: import the free India PIN directory once (license must be checked; the data.gov.in file is from 2019) for city/state autofill and state-wide areas. No geocoding API.
- **Order tracking** = honest status steps (Confirmed → Scheduled → Out for delivery → Delivered); admin needs an "out for delivery" step. No live map.
- One order = one fulfilment profile, so a cart mixing milk and ghee becomes two orders.
- Customer sign-in: phone + SMS code, own tables (not Cognito). Google sign-in on Android only; **no Sign in with Apple** (iPhone uses the phone code only, Apple rule 4.8). The owner has MSG91 credentials with a small free balance; DLT registration status is unknown. Integrate SMS later; in development print the code in the backend window. Add per-phone/per-device limits on codes.
- Push notifications: Expo Push (free). SMS only for sign-in codes. No Agora.
- AWS: S3 done; production uses an IAM role (no keys), RDS private + encrypted (DevOps to confirm), Secrets Manager, CloudFront, SES (replaces Gmail), EventBridge for the daily job.

## Progress update (backend master data, step 1 done)
Backend modules now built and tested (all under `Backend/src/modules/`, admin-only routes, none public yet):
`delivery-slots`, `cutoff-rules`, `service-areas` (+ PIN codes: list/search/filter/paginate, add, edit, **bulk add** at `/:id/pins/bulk`), `fulfilment-profiles`, `categories`, `trial-plans`, `subscription-rules`. Shared rules live in `modules/master-data/` (`shared.ts`; `simple-records.ts` + `simple-records-pg.ts` serve the three plain lists).
Switching off an in-use record: server answers 409 `IN_USE` with what uses it; the admin repeats with `confirmInUse: true`. `GET /:id/usage` shows the list. Changing an area away from PIN-code with PINs: 409 `PIN_REMOVAL_NEEDS_CONFIRMATION`, repeat with `confirmRemovePins: true`.
Usage lists for categories / trial plans / subscription rules / fulfilment profiles are empty until the products table exists: **wire them in the products step.**
Backend `npm run check`: 164 tests pass. **Next: step 3 (delivery brain), then step 4 (rewire the 7 admin pages).**

Delivery brain built: `GET /public/delivery/check?pin=&profileId=` (`Backend/src/modules/delivery-brain`, India-time rules in `rules.ts`). Migration `0008` (empty `pin_directory` table) is run; the directory data is NOT imported yet (needs owner's yes to download + license check).
Admin pages now real: Trial Plans, Subscription Rules, Delivery Slots, Service Areas (+ PINs, paste many), Cut-off Rules, Fulfilment Profiles (`admin/features/configuration/` = `api.ts`, `components/`, `form-values.ts`). **Categories is NOT rewired yet on purpose**: banners and products still use the mock category ids; rewire it in the products step together with the banner category picker.
The old `features/configuration/mock-store.ts` + `mock-repository.ts` + `types.ts` are KEPT because mock Products, Orders, Deliveries, Subscriptions, Trials and Production Planning still read them (their ids are mock ids, not the real ones). Delete them when those pages are wired.
Backend check: 182 tests pass. Admin: typecheck, lint, build clean; 195 tests pass. Not yet tried in a browser against the real backend.

Products batch built (migration `0009` run by the owner): backend `modules/products` (admin CRUD, status switch with readiness check, public `/public/products`, `/public/products/:id`, `/public/categories`), plus real usage lists (products) for categories, trial plans, subscription rules and fulfilment profiles. Product pictures upload with purpose `product` (2 MB, jpeg/png/webp).
Admin now real: **Products** (list, 7-step form, detail; images uploaded in the form) and **Categories**; Banners' category/product picker now reads the real lists (`features/banners/links.ts`). Still mock: Media Library page, Quality Reports, Offers, and every page that reads the old mock products or categories (Orders, Deliveries, Subscriptions, Trials, Production Planning). Kept for them: `features/products/{types,service,mock-repository}.ts`, `features/categories/{service,mock-repository,schema}.ts`, `features/configuration/mock-*.ts`.
Phone now real: Home products, Products, Search (server search, debounced), Product details (sizes, images, real per-product delivery check against the PIN saved on the Location screen; buying is blocked only when the PIN is known not to be served). Cart still holds the old one-price `Product`; a cart line is one size (`src/lib/catalogCart.ts` maps it). Not wired: Delivery slot screen (needs the cart/checkout phase), banner taps to products.
Checks: backend 208 tests; admin typecheck, lint, build clean, 202 tests; phone typecheck, lint, English/Gujarati keys clean. Nothing tried yet on a phone or in a browser against the real backend.

## Owner decisions 2026-10-12
Media Library: **not needed** (each feature uploads its own pictures; do not build it). Quality Reports: **not needed now** (future). Offers: **last**, built separately (phase 11 in `WIRING-PLAN.md`), wired with product pricing. Next phase: Phase 3, customers and sign-in (MSG91 server route).

## Current step: master data (delivery setup + categories), then products
`0007` is run. **Next, in this order:**
1. **Backend modules** (same pattern as `modules/banners` and `modules/help`: schema, repository, service, routes, tests with fakes in `tests/fakes.ts`): delivery slots → cut-off rules (one condition per slot) → service areas with PINs (+ allowed slots per PIN, paginated PIN list, bulk add, PIN lookup) → fulfilment profiles → trial plans, subscription rules, categories.
2. Rules to port exactly from `admin/features/configuration/` (mock-repository/mock-store): name required and unique; a profile needs an **active** area; local delivery ⇒ PIN-code area; shipping ⇒ state/pan-India area; shipping profile has no cut-off rule and is not in production planning; slot end after start; deactivating a slot/area/cut-off/profile shows what uses it and **the server rechecks**; changing an area away from PIN-code with PINs asks for confirmation. Use `withTransaction` (`src/db/transaction.ts`) for multi-row writes.
3. **The "delivery brain"** service (India time, `Asia/Kolkata`): is this PIN served, which slots, earliest delivery given the cut-off. Test day boundaries, previous-day and same-day cut-offs, midnight.
4. Admin: rewire the 7 master pages (pattern: `api.ts`, load in `useEffect` with a `reloadKey`, delete the mock repository). Server-side pagination for PINs; add "paste many PINs". Remove mock helpers once nothing uses them.
5. Phone: Location screen (replace the dummy map with PIN entry + server check), Delivery slot screen with real slots and earliest date.
6. Then **Products** (variants, prices, purchase methods, content, images from Media Library, references to trial plans / subscription rules / one fulfilment profile), Media Library (PDF support for quality reports, `application/pdf`, 10 MB), Quality Reports, Offers rules; then phone Home products, Products, Product details, Search. Then phases 3–10 in `WIRING-PLAN.md`.
After each batch: give the owner a step-by-step check with copy-paste test data (English + Gujarati), say what to restart, update `WIRING-PLAN.md` and `STORE-COMPLIANCE.md`.

## Checks (last known good)
Backend `npm run check` (typecheck, lint, tests): **123 tests pass**. Admin `npm run typecheck`, `lint`, `npm test`: **187 pass**. Frontend `npx tsc --noEmit` and `npm run lint`: clean; English and Gujarati text keys match (script in earlier chats: compare keys of `src/locales/en.json` and `gu.json`). Nothing new was verified on a phone this session except banners and onboarding earlier.

## Gotchas
- Backend `npm install` quirk: if vitest says "Cannot find native binding", delete `node_modules` and `package-lock.json`, reinstall.
- Windows: use Python scripts (write to the scratchpad, run with `python`) for multi-line edits; bash heredocs with apostrophes break. Preserve CRLF when editing. The Edit/Write tools need a Read of an existing file first.
- Phone ↔ PC: same Wi-Fi; Windows Firewall rule "ShreeRam API 4000" was added and Node's block rules disabled. Admin runs on **3000** (S3 CORS allows it; 3002 is not allowed).
- The mock **Media Library** still reads the mock onboarding service and quality-report/product mocks; remove those mocks when Media/Products are wired.
- Not yet shown in the app: after-hours message, delivery promise line, the Offers and Quality-report switches (no UI yet); banner tap (waits for real products); notification bell still opens Settings.
- Leftover test file in the dev bucket: `banners/test/…`.

## Open items for the owner / DevOps
RDS encryption, private network and backups confirmed; rotate all shared credentials; Google Cloud OAuth setup; PhonePe merchant sandbox credentials; MSG91 DLT registration (documents in chat: PAN, GST, ID, address proof, authorisation letter; MSG91 DLT premium support ₹1,500 + GST); hosting target (ECS / App Runner / EC2); iPhone at launch or Android first.

## Fixing the live Android app without a new Play Store build (OTA updates)
Only for any coding agent who picks this up later. The owner is not technical: do the work, explain it in plain words.

**Where it lives:** `Frontend/` (Expo app). `app.json` has `runtimeVersion: appVersion` and the Expo update URL; `app.config.js` picks the update channel from `$env:APP_CHANNEL`. Full detail: `Frontend/STORE-COMPLIANCE.md`, section D, "Over-the-air updates".

**An OTA update can change** JavaScript, screens, text, styles and images inside the app. **It cannot change** native code: new permissions, new native packages, app icon or name, Firebase or Google sign-in settings, or the Expo SDK. Those need a new build (new AAB, higher `versionCode`) uploaded to Play.

**To ship a fix:**
1. Fix the code in `Frontend/` and test it. Do not change `version` in `app.json`. A different `version` makes a different runtime and the live app would not receive the update.
2. Publish to the `preview` channel first: `npx eas-cli@latest update --channel preview --message "what changed"`. Open the tester build, check the Settings screen shows the new update id, and test the fix.
3. Then publish the same to `production`: `npx eas-cli@latest update --channel production --message "what changed"`.
4. Phones fetch the update on the next app open and apply it on the open after that, so tell the owner "close and open the app twice".

**To undo a bad update:** publish the previous good code again to the same channel (`eas update:rollback` also exists). Never leave a broken update live.

**Rules:**
- The Play Store build must have been made with the `production` channel (or none set). A build made with `preview` will never receive production updates.
- Keep `shreeram-upload.jks` and its password safe. Every new Play build must be signed with it.
- Do not use an OTA update to change what the app does in a way Google or Apple would see as a different app (new payment methods, new data collection). Those need the store forms updated and, for new data, a new build.
- A closed-test or production release on Play does not need a new build for a JavaScript-only fix, so Play does not see or review OTA updates.

## Starter message for the new chat
"Read D:\ShreeRam Milks\admin\HANDOFF.md, then continue with step 1 of 'Current step': build the backend for delivery slots, cut-off rules, service areas with PINs, fulfilment profiles, trial plans, subscription rules and categories. Migration 0007 is already run."
