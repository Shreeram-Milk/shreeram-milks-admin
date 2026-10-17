# WIRING-PLAN.md — From today to a finished, fully wired app

> Built from an audit of the real code on 2026-10-11: every admin page, every phone screen, and every backend module.
> Nothing here is guessed. Where the code does not tell us (business rules, vendor choices) it is marked **DECISION**.
> Update the status column as phases finish. Same file lives in `admin/` (keep `Frontend/` copy identical if you add one).

---

## 1. Where we are today (facts)

**Backend** (`Backend/src/modules`): admin login, audit log, media (S3 uploads), banners, onboarding, app settings, help (topics + questions), policies (+ public legal pages). **There is nothing yet for customers, products, orders, payments, subscriptions, deliveries, support tickets or notifications.**

**Admin: 5 of 27 sidebar pages are real** (saved in the database). The other **22 still save only in the browser** (mock data):

| Real (5) | Still mock (22) |
|---|---|
| Banners · Help Center · Legal & Policies · Onboarding · App Settings | Media Library *(dropped)* · Quality Reports *(dropped for now)* · Offers *(last, phase 11)* · Customers · Credit Accounts · Prepaid Adjustments · Orders · Subscriptions · Trials · Deliveries · Production Planning · Support (tickets) · Notification Templates · Broadcasts. The **Dashboard** is built from these, so it is mock too. |

**Phone app: 32 screens.**
- **Backend-driven (5):** Onboarding, Help, Support, Policies, Policy details. Home reads only its banners from the backend.
- **Still sample or local data (26):** Home (products, next delivery, greeting, address), Products, Product details, Search, Cart, Checkout address, Checkout review, Checkout payment, Order success, Orders, Order tracking, Subscriptions, Subscription manage, Subscription vacation, Delivery calendar, Delivery slot, Delivery addresses, Delivery address form, Doorstep instructions, Location, Sign-in, Verify (the 4-digit code is not checked), Edit profile, Profile, Report an issue, Settings.
- **Local on purpose (1):** Language.

**Not in the repo:** `specs.md` and `DESIGN.md` (both referenced by `AGENTS.md`). The business rules for orders, payments and subscriptions are therefore not written down anywhere. See section 4.

---

## 2. The phases, in the order they must be built

## 2a. Status and decisions (updated 2026-10-12)

**Done:** Phase 0, Phase 2 (except the two leftovers below) and Phase 1 (Categories and Products, admin and phone).
**Leftovers of Phase 2:** (1) the national PIN directory import (the table `pin_directory` exists and is empty; waiting for the owner to download the official CSV from data.gov.in, then `npm run import-pins`); (2) the phone's Delivery slot screen, which needs the cart and checkout (Phase 4). Also still open: the phone's subscription picker does not use the admin's Subscription Rules yet (Phase 6).
**Next phase: Phase 3 (customers and sign-in).** MSG91: server route (our backend sends and checks the code), the widget only as a fallback.

**Owner decisions, 2026-10-12:**
- **Media Library: not needed.** Each feature uploads its own pictures in its own form (banners, onboarding, products already do). The Media Library admin page and its mock stay untouched and unused; do not build it.
- **Quality Reports: not needed now.** Not a feature for this release; may be added in the future. The phone's quality-report screen and the "show quality reports" switch stay as they are, and nothing is built for them.
- **Offers: last, and built separately.** It is wired together with product pricing and orders, so it is now the final phase (Phase 11), after everything else.
- **Ship abroad** is a later phase (Google Geocoding or no lookup; see the chat notes), not part of this release.

---


Each phase finishes with: SQL for you to run, backend + tests, admin wired, phone screens wired, sample data removed for that area.

| # | Phase | Admin pages made real | Phone screens made real | New external service | Depends on |
|---|---|---|---|---|---|
| 0 | **Done**: foundation, banners, onboarding, app settings, help, policies | 5 | 5 | AWS S3, Gmail SMTP | — |
| 1 | **Catalogue** *(done 2026-10-12)* | Categories, Products (variants, prices, purchase methods; pictures uploaded in the product form). **Dropped:** Media Library (not needed), Quality Reports (not now), Offers (moved to phase 11) | Home products, Products, Product details, Search | S3, CloudFront later | 0 |
| 2 | **Delivery setup** | Service Areas (PIN rules), Delivery Slots, Cut-off Rules, Fulfilment Profiles, Trial Plans, Subscription Rules | Location, Delivery slot, product availability by PIN | none. **Decided: no maps.** Service areas work by PIN code and a typed address. | 1 |
| 3 | **Customers and sign-in** | Customers (create, edit, status, type), account deletion | Sign-in, Verify, Edit profile, Profile, Delivery addresses, Address form, Doorstep instructions, Settings | **SMS OTP provider** (you are getting one), **Google Sign-In** (you are getting it). **Decided: no Sign in with Apple** | 2 |
| 4 | **Cart and orders** | Orders (list, detail, cancel) | Cart, Checkout address, Checkout review, Order success, Orders, Order tracking | none | 1, 2, 3 |
| 5 | **Money: PhonePe payments, prepaid adjustments, credit ledger, payment requests** | Credit Accounts (ledger, **new: request a payment, mark cash/UPI received**), Prepaid Adjustments, payment records | Checkout payment (PhonePe), **new: "payment requested" banner with Pay now** | **PhonePe Payment Gateway** (decided). Scope depends on the payment model. | 4 |
| 6 | **Subscriptions and deliveries** | Subscriptions, Trials, Deliveries, Production Planning | Subscriptions, Subscription manage, Vacation, Delivery calendar, Home "next delivery" | **Daily scheduler** (AWS EventBridge) | 4, 5 |
| 7 | **Support and notifications** | Support (tickets), Notification Templates, Broadcasts | Report an issue (real submit), notification bell and list | **Push (Expo Push + FCM + APNs)**: free. SMS (same vendor as phase 3) only where a text message is really needed. | 3, 6 |
| 8 | **Dashboard and reports** | Dashboard from real data | Home summary | none | 4–7 |
| 9 | **No dummy data left, store rules** | Remove all mock repositories and the `lib/mock-*` helpers | Remove `mock-data/` and the "sample mode" fallback; reviewer demo account; account deletion; privacy and deletion web pages | none | all |
| 10 | **Go-live on AWS** | — | EAS release builds | **AWS**: ECS/App Runner + load balancer, RDS private, CloudFront, Secrets Manager, SES, CloudWatch | all |
| 11 | **Offers (last, separate build)** | Offers: rules (percent or flat, optional code, minimum order, dates, who it applies to) and redemption, wired with product pricing and order totals (the server recalculates every total) | Offers list, code entry at checkout, the "show offers" switch | none | 4, 5 (needs real products, orders and payments) |

**Rule for every phase:** the business logic (prices, cut-offs, eligibility, credit, refunds) lives only on the backend; the app and admin send requests and show results. Money is stored as whole paise. Each step that creates tables gives you SQL first, and nothing is run for you.

---

## 3. External services, with the decisions made (updated 2026-10-11)

| Service | Used for | Phase | Decision and what we need |
|---|---|---|---|
| **SMS OTP provider** | The sign-in code; later any delivery text messages | 3 | **You are getting one.** It must be an India SMS provider with DLT registration. From it we need: API key, sender ID, and the approved DLT template ID for the sign-in code. The code is written so the provider can be swapped. (SMS costs money per message; email is a different thing, see SES below.) |
| **Google Sign-In** | "Continue with Google" | 3 | **You are getting it.** Google Cloud project, consent screen, OAuth client IDs (Android and web), and the app's signing fingerprint (SHA-1) from the Android build. |
| **Sign in with Apple** | — | — | **Not used.** Consequence for iPhone: see the note below. |
| **PhonePe Payment Gateway** | Taking online payments, refunds | 5 | **Decided.** Flow from PhonePe's docs: our backend gets an access token and creates an order; the app opens PhonePe's checkout using PhonePe's React Native SDK; our backend then confirms the result from PhonePe's signed webhook (with the order-status API as a back-up) before crediting a wallet or confirming an order. Needs PhonePe merchant credentials for sandbox first, then production, kept in Secrets Manager. **No refund API is used**: the admin refunds from the PhonePe dashboard by hand and records it. Refund webhooks, if PhonePe sends any, are only logged. |
| **Push notifications** | Order and delivery updates | 7 | **Free.** Expo's push service has no fee (a rate limit of 600 per second per project), and the Android (FCM) and iPhone (APNs) delivery behind it are free. Needs a Firebase project (for Android) and, only if iPhone is shipped, the Apple push key. |
| **Agora** | — | — | **Not needed.** Agora provides voice, video, live streaming and chat. Order and delivery notifications do not need it. Revisit only if you later want live chat with support. |
| **AWS S3** | Pictures and PDFs | done | Already set up. Catalogue pictures and quality-report PDFs use the same bucket. |
| **AWS CloudFront, SES, Secrets Manager, CloudWatch, EventBridge Scheduler** | Fast picture delivery, email, secrets, logs, the daily job | 6 and 10 | Part of the go-live set. SES replaces the Gmail login-email setup. |
| **Maps** | — | — | **Not used.** Too costly for this scale. Delivery eligibility uses PIN code; customers type their address. |
| **Crash reporting** (for example Sentry) | Finding crashes early | 10 | Optional. |

**iPhone note (Apple rule 4.8, see STORE-COMPLIANCE A5):** an app that offers Google login must also offer an equivalent privacy-friendly login. We are not using Sign in with Apple, so the plan is: **Google sign-in appears on Android only; iPhone customers sign in with the phone code only** (an app that uses only its own sign-in system is exempt). If you later want Google on iPhone, Sign in with Apple has to be added first.

**Native add-ons (PhonePe, Google sign-in, push) need a new Android build**, not just a reload.

---

## 4. Business decisions

**Settled (recorded in `specs.md`, version 0.2):** prepaid means pay first for everything (products, trials, subscriptions, any future rule), in the app only, through PhonePe, with the server calculating the price; credit customers are chosen by the admin, have a credit limit, can be sent a payment request that shows as a banner in the app, and the admin can mark cash or other payments as received (no outside service); **refunds are done by the admin in PhonePe, never by the system**; there are no existing customers to import; one admin marks deliveries done; no invoices or GST for now; no maps; no Sign in with Apple; SMS provider and Google credentials coming from the owner.

Also settled: **orders above a credit customer's limit are blocked**, and payment requests appear as an in-app banner and notification with a **Pay now** button that opens PhonePe (no SMS or WhatsApp link).

**Still open:**
1. iPhone at launch? (Google login stays off iPhone.)
2. Hosting target (ECS Fargate, App Runner or EC2): DevOps.

---

## 5. How each phase is built (same steps every time)

1. I write the **SQL file** (safe, wrapped in a transaction, with permissions for the app user). **You run it** in pgAdmin.
2. I build the **backend**: validation, rules, authorization, audit, tests. Public reads are cached 30 seconds; private data is never cached.
3. I rewire the **admin page** to the backend and delete its mock repository.
4. I rewire the **phone screens** and delete their sample data.
5. I run typecheck, lint and tests, then give you a **step-by-step check** with copy-paste test data.
6. I update this file and `STORE-COMPLIANCE.md`.

## 6. Shortest path to something customers can use

Phases **1 → 2 → 3 → 4** give: browse products, sign in, add an address, and place an order that appears in the admin. With a decision on payments (cash or credit customers first) this is the smallest useful release. Payments (5), subscriptions (6) and notifications (7) then complete the product. Phases 9–10 are mandatory before any store submission.
