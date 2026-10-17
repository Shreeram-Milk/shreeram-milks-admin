# FEATURE-STATUS.md — what is connected, what is not, and what "complete" still needs

> Checked against the real code on 2026-10-12 (backend routes, admin `api.ts` files, phone services).
> Legend: ✅ real (saved in the database and shown in the other app) · 🟡 partly · ❌ sample data only · ➖ dropped or parked.
> The plan and order of work live in `WIRING-PLAN.md`; this file is the scoreboard.

**Score today (2026-10-13):** admin 14 of 27 pages real · phone 16 of 32 screens real · backend routes for customers, sign-in and addresses added · 250 backend tests, 202 admin tests.

---

## 1. Feature by feature: admin ↔ database ↔ phone

How data flows for every ✅ row: **admin form → backend (checks and saves) → database → public endpoint → phone service (checks the answer again) → hook → screen.**

### Content
| Feature | Admin page | Database tables | Backend API | Phone screen | Status |
|---|---|---|---|---|---|
| Banners | Content → Banners (a tab per type) | `banners`, `media_assets` | `/admin/banners`, `/public/banners` | Home banner slideshow | ✅ · 🟡 tapping a banner does not open its product or category yet |
| Onboarding slides | Content → Onboarding | `onboarding_slides` | `/admin/onboarding`, `/public/onboarding` | Onboarding | ✅ |
| App settings | Content → App Settings | `app_settings` | `/admin/app-settings`, `/public/app-settings` | Support contacts, maintenance and update gates, feature switches | ✅ · 🟡 after-hours message, delivery promise line and the Offers switch have no phone UI yet |
| Help questions | Content → Help Center | `help_topics`, `faqs` | `/admin/help`, `/public/help` | Help, Support | ✅ |
| Legal and policies | Content → Legal & Policies | `policy_documents` (versioned) | `/admin/policies`, `/public/policies`, `/legal/:type` | Policies, Policy details | ✅ |

### Catalogue
| Feature | Admin page | Database tables | Backend API | Phone screen | Status |
|---|---|---|---|---|---|
| Categories | Master Data → Categories | `categories` | `/admin/categories`, `/public/categories` | Category chips on Home, Products, Search | ✅ |
| Products (variants, prices, pictures, purchase methods) | Catalog → Products (7-step form) | `products`, `product_variants`, `product_gallery_images`, `product_trial_plans`, `product_subscription_rules` | `/admin/products`, `/public/products`, `/public/products/:id` | Home, Products, Search, Product details | ✅ · 🟡 the cart still holds the old one-price item (one cart line per size) |
| Product pictures | inside the product form | `media_assets` (purpose `product`) | `/admin/media` (upload link, then confirm) | shown through short-lived links | ✅ |

### Delivery setup
| Feature | Admin page | Database tables | Backend API | Phone screen | Status |
|---|---|---|---|---|---|
| Delivery slots | Operations → Delivery Slots | `delivery_slots` | `/admin/delivery-slots` | slots shown through the delivery check | ✅ |
| Delivery areas and PIN codes (add, paste many) | Operations → Delivery Areas | `service_areas`, `service_area_pins`, `service_area_pin_slots` | `/admin/service-areas` (+ `/pins`, `/pins/bulk`) | Location, Product details | ✅ |
| Cut-off rules | Operations → Cut-off Rules | `cutoff_rules`, `cutoff_conditions` | `/admin/cutoff-rules` | earliest dates in the delivery check | ✅ |
| (Removed) Fulfilment profiles | – | – | – | Delivery method, area, cut-off and production choice now live on each product (migration `0014`) | ✅ |
| Trial plans | Configuration → Trial Plans | `trial_plans` | `/admin/trial-plans` | trial options on the product page | ✅ |
| Subscription rules | Configuration → Subscription Rules | `subscription_rules` | `/admin/subscription-rules` | – | 🟡 admin only: the phone's subscription picker is still fixed (daily, alternate, custom) |
| Delivery check (the "delivery brain") | – | reads the tables above | `/public/delivery/check?pin&productId`, `/public/delivery/check-pin` | Location, Product details | ✅ · ❌ the Delivery slot screen waits for the cart |
| National PIN directory (for "Add from city") | inside a service area | `pin_directory` (**empty**) | `/admin/pin-directory` | – | 🟡 built, data not loaded (GeoNames download pending) |

### Customers (built 2026-10-13, needs testing on a real phone)
| Feature | Admin page | Database tables | Backend API | Phone screen | Status |
|---|---|---|---|---|---|
| Sign-up and sign-in (one flow, phone code) | – | `customers`, `customer_sign_in_codes`, `customer_sessions` | `/customer/auth/*`, `/customer/me` | Sign-in, Verify, Tell us about you, Profile, Edit profile, Settings (sign out, delete account) | ✅ · 🟡 code is printed in the backend window until a provider is connected |
| Customers | Manage → Customers (search, filters, edit, block) | same | `/admin/customers` | – | ✅ · other admin pages still show sample customers |
| Addresses and doorstep instructions | – | `customer_addresses`, `customer_doorstep_instructions` | `/customer/addresses`, `/customer/doorstep-instructions` | Location, Delivery slot (step 2), Delivery addresses, Address form, Doorstep instructions, Home location | ✅ |

### Support and the website (built 2026-10-13, needs testing; run migration 0012 first)
| Feature | Admin page | Database tables | Backend API | Phone / site | Status |
|---|---|---|---|---|---|
| Support tickets | Operations → Support Tickets (list, conversation, reply, status, take/release) | `support_tickets`, `support_ticket_messages` | `/customer/support/tickets`, `/admin/support-tickets` | Report an issue, My reports (list and thread with replies) | ✅ once 0012 is run · 🟡 customers see replies only by opening My reports until push notifications exist · order links come with orders |
| Account deletion on the web | – | uses customers | `/customer/auth/*`, `DELETE /customer/me` | **Website project** `website/` on port 3001: `/account-deletion` | ✅ tested in a real browser |

### Not built yet (admin page and phone screens are both sample data)
| Feature | Admin page | Phone screens | Needs |
|---|---|---|---|
| Google sign-in, real SMS/WhatsApp code delivery | – | Sign-in | Provider decision (MSG91 DLT or WhatsApp OTP); until then the code prints in the backend window |
| Cart and orders | Orders (`/admin/orders`) | Cart, Checkout address, Checkout review (price, window, payment from the server), Order success, My Orders, Order tracking with cancel | `orders`, `order_items`, `order_status_history`; `/customer/orders`, `/customer/orders/quote` ✅ (needs testing) |
| Payments | Payments inside Orders and Credit Accounts | – | `payments`, `payment_events`; 🟡 online payment is a marked test payment in development until PhonePe is connected |
| Credit customers | Credit Accounts (limit, ledger, record payment, adjustments, payment requests), Prepaid Adjustments (refunds to send, credit), "Not available on credit" on products | Pay now card and "you owe" line on Home | `credit_ledger_entries`, `payment_requests`, `refunds`, `prepaid_adjustments` ✅ (needs testing) |
| Subscriptions and trials | Subscriptions, Trials | Subscriptions, Manage, Vacation | `subscriptions`, `subscription_deliveries` |
| Production planning | Production Planning (`/admin/production-planning`): pieces and "to make" per delivery window, from orders | – | `/admin/production-planning` ✅ (needs testing) |
| Deliveries | Deliveries | Delivery calendar, Home "next delivery" | `deliveries`, daily job (🟡 sample data until the subscriptions step) |
| Support tickets | Support | Report an issue | `support_tickets`, `ticket_messages` |
| Notifications | Notification Templates, Broadcasts | notification list and bell | `notifications`, `push_tokens` · Expo Push + Firebase |
| Dashboard | Dashboard | Home summary | all of the above |
| Offers | Offers | offers and code entry | **last, built separately, with product pricing** |
| Media Library, Quality Reports | – | – | ➖ dropped for now |

---

## 2. How data is fetched (API fetch layer)

**Phone → backend today (all reads):**
| Screen | Request | Kept for |
|---|---|---|
| Home | `GET /public/banners` · `GET /public/products?category=` · `GET /public/categories` | banners 30 s on the server; products 60 s on the phone |
| Products, Search | `GET /public/products?category=&search=&pageSize=100` (Search waits 300 ms after typing) | 60 s |
| Product details | `GET /public/products/:id` · `GET /public/delivery/check?pin=&profileId=` | product 60 s; delivery answer 60 s (it depends on the time of day) |
| Location | `GET /public/delivery/check-pin?pin=` | 60 s |
| Onboarding | `GET /public/onboarding` | 30 s |
| Help, Support | `GET /public/help`, `GET /public/app-settings` | 30 s |
| Policies | `GET /public/policies`, `/legal/:type` | 30 s |

**How it is built:** screen → hook (TanStack Query: cache, retry, loading and error states) → service (checks every field of the answer, drops a malformed record instead of crashing) → `apiClient.apiGet` (10-second timeout, errors turned into stable codes). With no `EXPO_PUBLIC_API_URL`, the phone uses bundled sample data so development still works.

**Admin → backend:** every call goes through `apiRequest` (cookie sign-in, one error format). Lists are loaded a page at a time with search and filters applied on the server; pick-lists use `/all` endpoints.

**Missing in the phone's fetch layer (needed before any private data):**
- `apiGet` only reads. It has **no POST, PUT, PATCH or DELETE**, which sign-in, orders, payments, addresses and tickets all need.
- There is **no customer session**: no sign-in token or cookie handling, no automatic sign-out when it expires, no refresh.
- No way to send an **idempotency key** (so a double tap cannot create two orders or two payments).
- No offline handling beyond "retry" (fine for browsing; checkout needs a clear "no connection" state).

---

## 3. What must be finished before we call the product complete

### A. Customers and sign-in
- [ ] Customer tables, sign-in codes (hashed, expiring, limited tries per phone and per device)
- [ ] SMS sending through MSG91 (DLT template approved) · code printed in the backend window in development
- [ ] Google sign-in on Android; iPhone uses the phone code only
- [ ] Phone sessions, sign-out, account deletion (store rule)
- [ ] Admin Customers page: create, edit, status, customer type (prepaid or credit)
- [ ] Phone: Sign-in, Verify (real check), Edit profile, Profile, Settings
- [ ] Addresses and doorstep instructions saved per customer; the address's PIN checked by the delivery brain

### B. Cart, orders and the server-side delivery check
- [ ] The server **re-checks delivery eligibility when an order is placed** (the phone's blocked buttons are only a convenience)
- [ ] The server calculates every price, total and delivery date; the phone's numbers are never trusted
- [ ] One order per delivery rules card (a cart with milk and ghee becomes two orders)
- [ ] Orders, order items, status steps; cancel rules
- [ ] Phone: Cart, Checkout address, Delivery slot screen (real slots and dates), Checkout review, Order success, Orders list
- [ ] Admin Orders page: list, detail, cancel

### C. Payments and credit
- [x] PhonePe (sandbox): payment created by the backend, PhonePe's own screen opened in the app (SDK, needs `npx expo run:android`), confirmed by PhonePe's status API, the signed webhook and a 2-minute background check; never from the phone's word. Built and tested by automated tests and one real sandbox call; waiting for the owner's phone test
- [x] Prepaid: order is created only after PhonePe confirms the payment; confirming twice (phone, webhook, background check) creates one order; wrong amount or a refused order becomes a refund item (migration 0016)
- [ ] Credit customers: limit that blocks orders above it, "Pay now" banner and notification
- [x] Admin: Credit Accounts (ledger, request payment, mark cash or UPI received), Prepaid Adjustments, Online Payments (history, PhonePe references, Check with PhonePe)
- [ ] Refunds are never sent by the system: admin refunds in PhonePe and records it

### D. Subscriptions, trials and deliveries
- [ ] Subscriptions and trials created from the product page, using the admin's Subscription Rules and Trial Plans
- [ ] Pause, skip, vacation; schedule generation in India time
- [ ] The daily job (AWS EventBridge) that creates tomorrow's deliveries
- [ ] Admin: Subscriptions, Trials, Deliveries, Production Planning (from real data)
- [ ] Phone: Subscriptions, Manage, Vacation, Delivery calendar, Home "next delivery"

### E. Support and notifications
- [ ] Support tickets: customer submits, admin replies and closes
- [ ] Push notifications (Expo Push, free; Firebase project for Android)
- [ ] Admin: Notification Templates and Broadcasts; phone notification list and bell

### F. Admin finishing
- [ ] Dashboard from real data
- [ ] Remove every old mock repository and the sample-data fallback in the phone
- [ ] Hide or remove the dropped pages (Media Library, Quality Reports); Offers last

### G. Store rules and launch
- [ ] Privacy and account-deletion web pages, reviewer demo account, health-claim review of staff-written text
- [ ] AWS: hosting, private encrypted RDS with backups, CloudFront, Secrets Manager, SES email, logs
- [ ] Rotate every secret that was shared in chat (database, S3, Gmail)
- [ ] Release builds (EAS) for Android, then iPhone if needed
- [ ] Attribution line for GeoNames if its data is used (CC BY 4.0)

### H. Always, in every bundle
- [ ] Tests for money, cut-offs, delivery checks, authorisation and every status change
- [ ] Try it on a real phone and a real browser against the real backend (nothing from the last three batches has been tried this way yet)

---

## 4. Delivery tracking: what it needs

**Decided:** honest status steps, no live map: **Confirmed → Scheduled → Out for delivery → Delivered.** One admin marks deliveries; there is no delivery-partner app.

| Layer | What must exist |
|---|---|
| Database | `orders`, `order_items`, `deliveries` (date, slot, status, who and when), `delivery_events` (history of each change) |
| Rules (server) | Legal status moves only (for example Scheduled → Out for delivery → Delivered, or → Missed); the admin cannot skip steps; times in India time |
| Admin | Deliveries page: today's list by slot, area and PIN; mark Out for delivery, Delivered, Missed (single and bulk); an **"Out for delivery" step** (not in the mock yet) |
| API | Customer: `GET /orders/:id` with its delivery timeline. Admin: `PATCH /admin/deliveries/:id/status` with the transition check |
| Phone | Order tracking (the four steps), Delivery calendar, Home "next delivery" |
| Alerts | Push when "Out for delivery" and "Delivered" (Expo Push + Firebase for Android). SMS only if you want it, and only with DLT-approved wording |
| Third party | **None for local delivery.** For pan-India shipping a decision is needed: (1) the admin types a courier name and tracking link by hand (recommended first), or (2) a courier API such as Delhivery or Shiprocket later |
| Not included | Live map and driver location (cost; not planned) |
