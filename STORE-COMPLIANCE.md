# STORE-COMPLIANCE.md — App Store and Google Play checklist

> Lives in `admin/` and `Frontend/` (keep identical). Update the status column as work is done.
> Sources: Apple *App Review Guidelines* (developer.apple.com/app-store/review/guidelines) and Google Play *User Data* help pages (support.google.com/googleplay/android-developer/answer/10144311), read on 2026-10-10.
> **Nothing here guarantees approval.** It is the list of things the stores check, so we find gaps now, not at submission. Re-read the live guidelines before each submission: they change.

Status: ✅ done · 🟡 planned/partly · ❌ missing · 📝 needs a decision from the business

---

## A. Things reviewers reject for most often (fix before submitting)

| # | Rule | What it means for us | Status |
|---|---|---|---|
| A1 | Apple 2.1 — no placeholder or demo content, no crashes, complete app | The app still shows made-up data: greeting "Priya", address "Greenwood Meadows, Villa 4B", fake "Next delivery: Tomorrow, 24 Oct", a dummy map picture, customer name "Priya Sharma". All must be real data (or hidden) before submission. | ❌ |
| A2 | Apple 2.1(a) — **demo account for the reviewer**; backend must be live during review | Sign-in is by SMS code. A reviewer cannot receive our SMS. We need a **test phone number with a fixed code** (enabled only for reviewers), written in the Review Notes. Same for Google sign-in. | ❌ |
| A3 | Apple 5.1.1(v) and Google Play — **in-app account deletion** | Required because customers can create accounts. A delete option must be easy to find in the app (Profile). Google also needs a **web page** for deletion requests, entered in Play Console. Deactivating or freezing does **not** count; user data tied to the account must be deleted. Anything we must keep (invoices, financial history) must be explained in the privacy policy. Our rule "never delete financial history" (AGENTS.md) fits: delete personal details, keep anonymised order and payment records. | ❌ (planned in `docs/01-screen-completion.md`) |
| A4 | Apple 5.1.1(i), Google — **privacy policy link** in the app and in the store listing | Needs a public web page (Google: not a PDF, not editable, not geofenced). Must name the business, say what data we collect, who receives it, how long we keep it, how to delete it, and give a privacy contact. The admin's Policies module holds the text, and the backend serves each published policy as a public web page at `/legal/privacy` (also `/legal/terms` and so on, with `?lang=gu` for Gujarati). The app shows them under Profile → Legal & policies. Still to do: write and publish the real text, and host the API on HTTPS so the link works for the stores. | 🟡 |
| A5 | Apple 4.8 — **Sign in with Apple (or an equivalent)** whenever Google sign-in is offered | Our plan is phone code **plus Google**. Google counts as a third-party login, so we must also offer an option that limits data collected to name and email, lets users hide their email, and does not track. A phone-number code may not meet all three. Easiest fix: add **Sign in with Apple** on iOS. | ✅ Decided: no Sign in with Apple. Google sign-in is shown on Android only; iPhone uses the phone code only (an app using only its own sign-in is exempt). If Google is ever added on iPhone, add Sign in with Apple first. |
| A6 | Production API must use **HTTPS** | Apple blocks plain `http://` by default and so does release Android. The test address `http://192.168.x.x:4000` works in development only. | 🟡 (needs deployment) |
| A7 | Google Play — **target API level** | From **31 Aug 2026**, new apps and updates must target **Android 16 (API 36)** or higher. Check the Expo SDK we use builds to API 36 before we build a release. | 🟡 verify at build time |

## B. Payments

| Rule | What it means for us | Status |
|---|---|---|
| Apple 3.1.3(e), 3.1.1 | Milk and dairy are physical goods used outside the app, so we **must not** use In-App Purchase; use a normal gateway (cards, UPI, Apple Pay). | ✅ by design |
| Google Play payments policy | Play Billing is only for digital goods. Physical goods use any gateway. | ✅ by design |
| Apple 3.1.2 | Applies only to digital subscriptions. **Our "subscriptions" are delivery plans for physical goods**, not digital features. Never describe them as app features or unlocks. | ✅ by wording rule |
| Apple 4.9 (recurring charges, if Apple Pay is used) | Show amount, what is provided, how often, and **how to cancel** before the customer pays. Our pause/cancel flow must be clear. | 🟡 |
| Money safety | Totals and payments verified on the server; webhooks verified and idempotent (`AGENTS.md` 22–24). | 🟡 (when payments are built) |

## C. Privacy and data

| Rule | What it means for us | Status |
|---|---|---|
| Google **Data safety** form and Apple **App Privacy labels** | Both stores ask what we collect, why, and who gets it, including from SDKs. Must match the privacy policy. Expected data: name, phone, email, delivery address, order history, device/push token, crash logs if added. **Card details are handled by the gateway, never stored by us.** | ❌ (fill in at submission) |
| Apple 5.1.1(iii–iv), 5.1.5 — ask only for data the feature needs | Ask for location only when choosing a delivery address. **Manual address entry must work if location is refused.** | 🟡 |
| Apple 5.1.2 — permission, no forced consent | The app must work if the customer says no to notifications or location. No ad tracking is planned, so no tracking prompt is needed. If we ever add ad or analytics SDKs that track, we must add App Tracking Transparency. | ✅ plan |
| Apple 4.5.4 — notifications | The app works without them. **Promotional** notifications need a separate opt-in and an in-app opt-out. Delivery updates are fine as service messages. Never put sensitive details in a notification. | 🟡 (when notifications are built) |
| Apple 1.6 — security | Passwords hashed, TLS, least privilege, no secrets in the app. | ✅ backend design |
| Permission texts | Each permission (location, notifications, camera if ever used) needs a clear one-line reason in both languages. | ❌ (when each is added) |

## D. Content

| Rule | What it means for us | Status |
|---|---|---|
| Apple 1.4.1, 2.3.1 — **health and quality claims must be accurate** | Do **not** write that A2 milk, ghee or any product cures, prevents or treats a disease, or make unproven nutrition claims, in FAQs, banners, product text, notifications or store listing. Quality reports must be real, current lab documents. Anyone editing content in the admin must follow this. | 📝 editorial rule |
| Apple 2.5.2 — no downloaded code | The admin changes **text, pictures and on/off switches only**. App Settings feature flags only show or hide features already in the installed app. **Never add a way to download code or new features.** | ✅ |
| Apple 1.2 — user-generated content | Not triggered: support tickets are private between a customer and us. If we ever add public reviews or comments, we need reporting, blocking and moderation first. | ✅ |
| Apple 2.3 — accurate listing | Screenshots show the real app. No other platforms' names. Name and keywords not stuffed. `supportsTablet` is `true` in `app.json`: if iPad screenshots would look broken, set it to `false` or test on tablet. | 🟡 |
| Age rating / content rating questionnaires | Answer honestly. The app is not for children. | ❌ (at submission) |
| Support URL and contact | Apple 1.5: easy, accurate way to reach us, in the app and the listing. App Settings already holds the support phone, WhatsApp and email. | 🟡 |

## E. Business and legal items (outside the code)

- Developer accounts: Apple Developer Program (yearly fee) and Google Play Console (one-time fee). Register as an **organisation** if possible; Google has extra testing requirements for newly created personal accounts, so check Play Console help before planning dates.
- **FSSAI licence number** of the business, shown in the store listing and in the app (usual requirement for food sellers in India; confirm with your advisor).
- Business name in the store listing must match the name in the privacy policy.
- Refund, cancellation and delivery policies published (the Policies module) and linked in the app.
- GST and invoice rules for online orders (confirm with your accountant).

## F. Before every submission

- [ ] No placeholder text or fake data anywhere (A1)
- [ ] Reviewer demo account works and is in the Review Notes (A2)
- [ ] Account deletion works in the app and on the web (A3)
- [ ] Privacy policy URL live, linked in app and listings (A4)
- [ ] Sign in with Apple or equivalent added if Google sign-in is on (A5)
- [ ] Production API on HTTPS and live during review (A6)
- [ ] Release build targets the required Android API level (A7)
- [ ] Data safety form and App Privacy labels match the policy (C)
- [ ] Permission texts written in English and Gujarati (C)
- [ ] Content checked for health claims (D)
- [ ] Screenshots, icon, description, support URL ready (D)
- [ ] `PERFORMANCE-AND-AWS.md` checklist passes

## G. Rule for coding agents

When adding a feature that **collects data, asks a permission, takes payment, sends a notification, or shows content written by staff**, check the matching rows above and update this file in the same change. Never add placeholder or demo content to a user-facing screen without a note in this file's section A.
