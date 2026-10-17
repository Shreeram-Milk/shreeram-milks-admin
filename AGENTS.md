# AGENTS.md — ShreeRam Milks Admin Engineering Constitution

> **Purpose**
>
> This file defines the engineering standard for all current and future code written in the ShreeRam Milks Admin repository.
>
> Every coding agent, developer, reviewer, or automation tool working in this repository must read this file before creating, editing, refactoring, or deleting application code.
>
> The goal is to keep the application fast, secure, maintainable, predictable, and easy to scale without over-engineering.

---

# 0. PRIORITY OF INSTRUCTIONS

The project is governed by these documents:

1. **AGENTS.md** — engineering architecture, code quality, performance, security, frontend/backend boundaries, data integrity.
2. **DESIGN.md** — visual design system, layout, spacing, forms, tables, dialogs, responsive behavior, interaction style.
3. **specs.md** — business features, workflows, entities, domain behavior.
4. **PERFORMANCE-AND-AWS.md** — speed, compression, caching, pictures, AWS and scaling standards.
5. **STORE-COMPLIANCE.md** — App Store and Google Play rules for what the admin lets staff publish (health claims, policies, deletion, privacy).
6. Existing implementation.

If there is a conflict:

1. Security, financial integrity, and data integrity rules in this file win.
2. Explicit business rules in `specs.md` win over assumptions.
3. `DESIGN.md` controls visual and interaction behavior.
4. Existing code is followed only when it is already correct.

Never silently guess an important business rule.

---

# 1. CORE ENGINEERING PHILOSOPHY

Build the **simplest correct architecture** that:

- is secure;
- is strongly typed;
- is fast;
- keeps UI, business logic, and persistence separate;
- avoids unnecessary client-side work;
- avoids duplicate network/database operations;
- remains understandable by another senior developer;
- supports normal product growth without a rewrite.

Do not optimize for hypothetical millions of users.

Do not create enterprise infrastructure without a real requirement.

However, never use project size as an excuse for:

- weak validation;
- mixed architecture;
- poor authorization;
- unsafe money handling;
- duplicate financial operations;
- unbounded data fetching;
- slow forms;
- giant client components;
- insecure APIs;
- tightly coupled frontend/backend code.

---

# 2. NON-NEGOTIABLE TECHNOLOGY

Follow the repository's existing stack.

Expected frontend foundation:

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Radix UI
- lucide-react
- react-hook-form
- Zod
- `@hookform/resolvers`
- Sonner
- date-fns

Use the existing backend/database/auth/storage/payment stack already established by the project.

Do not introduce competing libraries unless:

1. the capability does not already exist;
2. the dependency solves a real current requirement;
3. it is maintained;
4. it does not duplicate existing functionality;
5. implementing without it would be materially worse.

---

# 3. REQUIRED APPLICATION LAYERS

The application must conceptually follow:

```text
UI / React
    ↓
Application Boundary
(Server Action / Route Handler / direct server service call)
    ↓
Validation + Authorization
    ↓
Service / Domain Logic
    ↓
Repository / Data Access
    ↓
Database / External Integration
```

Dependencies flow downward.

Never place database or domain rules directly inside React components.

Never make database code depend on UI code.

Important business rules must remain usable independently of React.

---

# 4. FEATURE-ORIENTED PROJECT STRUCTURE

Prefer feature-local organization.

Example:

```text
src/
├── app/
│   └── dashboard/
│       ├── products/
│       ├── orders/
│       ├── customers/
│       ├── subscriptions/
│       ├── service-areas/
│       ├── delivery-slots/
│       ├── cutoff-rules/
│       ├── fulfilment-profiles/
│       └── settings/
│
├── features/
│   ├── products/
│   │   ├── components/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── types/
│   │   └── utils/
│   ├── subscriptions/
│   ├── customers/
│   ├── orders/
│   └── operations/
│
├── components/
│   ├── ui/
│   ├── shared/
│   └── layout/
│
├── server/
│   ├── auth/
│   ├── services/
│   ├── repositories/
│   └── integrations/
│
├── lib/
├── hooks/
├── schemas/
├── types/
└── constants/
```

Follow the repository's existing equivalent structure when already established.

Do not create giant catch-all files such as:

```text
utils.ts
types.ts
api.ts
actions.ts
helpers.ts
```

containing unrelated responsibilities.

---

# 5. ATOMIC COMPONENT ENGINEERING

Components must be split by meaningful responsibility, not arbitrary line count.

## 5.1 Shared primitives

Create/reuse shared components for genuinely repeated patterns such as:

- PageHeader
- Breadcrumbs
- DataTable
- TableToolbar
- SearchInput
- Pagination
- StatusBadge
- EmptyState
- ErrorState
- Skeleton
- FormField
- FormSection
- SaveBar
- ConfirmDialog
- DependencyWarning
- MultiSelect
- Date/Time inputs
- Drawer/Sheet wrappers

Do not duplicate the same pattern inside multiple features.

## 5.2 Feature components

Feature-specific behavior belongs near the feature.

Examples:

```text
features/service-areas/components/ServiceAreaForm.tsx
features/service-areas/components/PincodeTable.tsx
features/cutoff-rules/components/CutoffConditionEditor.tsx
features/products/components/ProductSellingOptions.tsx
```

Do not move feature-specific code into global shared components prematurely.

## 5.3 Component size

A component should have one primary responsibility.

A page should orchestrate a screen.

A component should not simultaneously:

- fetch several unrelated datasets;
- contain large validation logic;
- calculate domain rules;
- mutate the database;
- render hundreds of lines of unrelated UI;
- own multiple unrelated forms.

Break large components into meaningful subcomponents.

Do not create useless wrapper components for trivial markup.

---

# 6. SERVER COMPONENTS BY DEFAULT

Every component remains a Server Component unless browser interactivity requires otherwise.

Use `"use client"` only when required for:

- event handlers;
- local interactive state;
- browser APIs;
- React client hooks;
- Radix/shadcn interactive primitives;
- client-side forms;
- drag/drop or similar interactions.

Do not put `"use client"` at route/page/layout level merely because one child is interactive.

Move the client boundary as low as possible.

Preferred:

```text
Server Page
├── server-loaded header/summary
├── server-loaded table/content
└── Small Client Component
    └── form/filter/dialog interaction
```

Avoid turning a complete route into a client-rendered app unnecessarily.

---

# 7. SERVER-FIRST INITIAL DATA LOADING

Initial route data should normally load on the server.

Avoid:

```text
Render empty page
→ useEffect
→ fetch API
→ spinner
→ render data
```

when the server can load the data before render.

Prefer:

```text
Request
→ server loads required data
→ page renders/streams
→ interactive islands hydrate
```

Client-side fetching is appropriate for:

- live search;
- interactive filters requiring rapid refresh;
- incremental actions;
- background refresh;
- client-only workflows.

Do not use client fetching by default.

---

# 8. FAST FORM ARCHITECTURE

Forms must remain fast even when they become large.

Use:

- `react-hook-form`
- Zod
- `zodResolver`

## 8.1 Avoid giant reactive forms

Do not subscribe the entire form to every field.

Avoid unnecessary `watch()` across the whole form.

Prefer:

- `useWatch` only for the fields actually needed;
- isolated field components;
- memoized expensive derived calculations;
- field arrays only where genuinely required;
- lazy/deferred loading for heavy option datasets.

## 8.2 Large forms

Large forms should use a dedicated route inside the persistent admin shell.

Do not place a large product/customer/subscription form inside a modal.

For very large forms:

- split into logical sections;
- keep client state local to each relevant section;
- avoid mounting expensive sections that are not currently needed;
- preload only data required for the first usable screen;
- load secondary datasets only when needed;
- use server-rendered initial data;
- keep the save bar visible;
- protect unsaved changes.

## 8.3 Form loading performance

Do not fetch every possible dropdown dataset on initial page load.

Example:

Product Create should not automatically fetch:

- every customer;
- every historical order;
- every delivery record;
- every inactive configuration;
- unrelated catalog records.

Fetch only the minimum required for the current form.

For searchable selects:

- use bounded server search;
- debounce requests;
- cancel/ignore stale responses;
- never load thousands of options into the browser.

---

# 9. FORM MUTATION LIFECYCLE

Every important form mutation follows:

```text
User submits
↓
Client validation
↓
Disable duplicate submission
↓
Server authentication
↓
Server authorization
↓
Server validation
↓
Service/business rules
↓
Repository/database operation
↓
Transaction if required
↓
Success
↓
Targeted revalidation/refresh
↓
UI update
↓
Success feedback
```

On failure:

- preserve relevant user input;
- surface a meaningful error;
- never fake success;
- never swallow exceptions.

Normal saves do not need confirmation.

Destructive/consequential actions do.

---

# 10. VALIDATION

All external input is untrusted.

Validate:

- forms;
- Server Actions;
- Route Handler bodies;
- route parameters;
- query parameters;
- file metadata;
- webhook payloads;
- external integration responses where appropriate.

Use Zod for application validation.

Client validation improves UX.

Server validation guarantees correctness.

Client validation never replaces server validation.

Normalize input at boundaries.

Do not scatter trimming/normalization throughout React components.

---

# 11. TYPESCRIPT

Strict TypeScript is mandatory.

MUST:

- type component props;
- type public function inputs/outputs;
- type API contracts;
- narrow `unknown`;
- use controlled unions/enums;
- model meaningful states explicitly.

MUST NOT:

- introduce unnecessary `any`;
- use `as any` to silence errors;
- routinely use `@ts-ignore`;
- use unsafe casts instead of fixing the type.

Prefer:

```ts
type DeliveryMethod = "local_delivery" | "shipping";
```

over arbitrary strings.

---

# 12. BUSINESS LOGIC LOCATION

Important business rules belong in service/domain logic.

Examples:

- delivery eligibility;
- PIN eligibility;
- cutoff calculations;
- subscription schedule generation;
- subscription pause/resume behavior;
- trial eligibility;
- credit eligibility;
- order pricing;
- refund/adjustment rules;
- production quantity calculations;
- product availability.

Do not duplicate these rules across:

- React components;
- route handlers;
- server actions;
- background integrations.

There must be one authoritative implementation.

---

# 13. REPOSITORY / DATA ACCESS LAYER

Database access must remain centralized.

Examples:

```text
findProductById
listProducts
createProductRecord
updateProductRecord
listActiveSubscriptions
getServiceAreaById
listDeliveriesForDate
```

Repositories:

- perform persistence/query operations;
- select only required columns;
- implement efficient query shapes.

Repositories must not:

- contain React;
- decide UI behavior;
- implement unrelated workflows.

---

# 14. SERVICE LAYER

Services coordinate domain behavior.

Example:

```text
pauseSubscription()
↓
authorize
↓
validate state transition
↓
calculate affected deliveries
↓
apply credit/extension rules
↓
perform transaction
↓
return result
```

Complex workflows must not live directly inside route handlers or React components.

---

# 15. DATABASE QUERY PERFORMANCE

Every query should answer:

> What is the minimum data required for this operation?

Avoid `SELECT *` behavior when the UI needs only a few fields.

Avoid N+1 queries.

Prefer:

- joins;
- includes;
- batching;
- aggregate queries;
- purpose-built queries.

Potentially growing collections must be paginated.

Examples:

- customers;
- orders;
- subscriptions;
- deliveries;
- credit history;
- products;
- service-area PINs.

Simple server-side offset pagination is acceptable unless data scale proves otherwise.

Never fetch the full dataset just because today's dataset is small.

---

# 16. API AND NETWORK EFFICIENCY

Avoid duplicate requests.

Bad:

```text
Component A → fetch customer
Component B → fetch same customer
Component C → fetch same customer
```

Prefer loading related required information together.

Do not make one HTTP request per dashboard KPI.

Debounce server-backed search.

Do not poll by default.

Prefer:

- server rendering;
- revalidation after mutation;
- explicit refresh;
- navigation refresh.

Use polling only when the feature truly requires near-real-time refresh.

---

# 17. CLIENT BUNDLE PERFORMANCE

Keep browser JavaScript small.

Prefer Server Components.

Do not import heavy libraries into client components without reason.

Do not install multiple packages for the same purpose.

Lazy-load genuinely heavy client-only functionality.

Avoid importing entire utility libraries when a small function is enough.

Do not create giant client components that hydrate hundreds of controls at once unnecessarily.

---

# 18. LOADING PERFORMANCE

Every data-driven screen must support loading without blocking unrelated content.

Use:

- route-level loading where appropriate;
- Suspense boundaries for isolated server sections;
- table skeletons;
- button-level pending states;
- local loading states.

Do not block the entire screen because one small section is loading.

Avoid layout shifts.

Use skeletons where the final shape is known.

---

# 19. CACHING

Caching must be intentional.

Classify data approximately:

## Semi-static

Examples:

- configuration;
- categories;
- trial plans;
- delivery slots;
- stable settings.

Caching may be appropriate.

## Dynamic

Examples:

- orders;
- deliveries;
- subscriptions;
- credit balances;
- production planning.

Prefer fresh data.

## Sensitive/user-specific

Never incorrectly share cached sensitive data.

After mutations, revalidate only the affected data when practical.

Do not invalidate the entire application after every save.

Correctness always wins over caching.

---

# 20. URL STATE

Use URL search parameters for meaningful list state such as:

```text
/orders?status=pending&page=2&search=patel
```

Use URL state for:

- search;
- filters;
- sorting;
- pagination;
- shareable list views.

Do not put every temporary interaction state into the URL.

Validate query parameters before use.

---

# 21. STATE MANAGEMENT

Use the smallest correct state scope.

Priority:

1. server state on the server;
2. URL state for shareable filters;
3. local component state;
4. context for genuine shared client state;
5. global state library only when clearly justified.

Do not copy authoritative database state into multiple client stores.

Do not introduce Redux/Zustand merely because the application has multiple pages.

---

# 22. MONEY

Financial integrity is mandatory.

Store authoritative INR values as integer paise unless the established payment/database system uses an equally safe representation.

Example:

```text
₹125.50
→ 12550 paise
```

Never use floating-point money calculations for authoritative values.

Never trust browser-calculated totals.

The server must calculate or verify:

- order totals;
- discounts;
- taxes;
- credits;
- refunds;
- outstanding balances;
- payment amounts.

---

# 23. DATABASE TRANSACTIONS

Use transactions whenever multiple writes must succeed or fail together.

Mandatory examples:

```text
create order
+ create order items
+ consume credit
```

```text
cancel prepaid delivery
+ create customer credit
+ update subscription balance
```

```text
record payment
+ update ledger
+ update outstanding balance
```

Partial financial completion is not acceptable.

Keep transactions focused and short.

---

# 24. IDEMPOTENCY

Payment and webhook processing must be safe when retried.

Protect against:

- duplicate orders;
- duplicate payments;
- duplicate credit consumption;
- duplicate refunds;
- duplicate webhook processing.

Use suitable mechanisms such as:

- provider event IDs;
- payment IDs;
- unique database constraints;
- idempotency keys;
- transactional checks;
- processed-event records.

Do not build a generic distributed idempotency platform unless needed.

---

# 25. AUTHENTICATION AND AUTHORIZATION

Authentication answers:

> Who is the user?

Authorization answers:

> Can this user perform this action?

Both must be enforced server-side.

Never treat the following as security controls:

- hidden buttons;
- disabled controls;
- client route guards;
- client-provided roles.

Every protected server mutation must independently verify authorization.

---

# 26. SECURITY RULES

Security is mandatory.

## Secrets

Never expose:

- database credentials;
- payment secrets;
- private keys;
- authentication secrets;
- service-role credentials

to the browser.

Use environment variables / platform secret configuration.

## Input

Never trust request data.

Validate on the server.

## Database

Use parameterized ORM/query mechanisms.

Never construct SQL from raw user strings.

## Mass assignment

Never blindly spread request input into database writes.

Bad:

```ts
db.user.update({ data: requestBody })
```

Explicitly select allowed fields.

## XSS

Avoid arbitrary HTML rendering.

Avoid `dangerouslySetInnerHTML`.

If unavoidable, sanitize correctly.

## Files

Validate:

- MIME/type;
- size;
- authorization;
- destination;
- storage behavior.

Do not trust file extensions alone.

## Payments/webhooks

Verify payment status server-side.

Verify webhook signatures with the provider's official mechanism.

Never trust a browser claim that payment succeeded.

---

# 27. DESTRUCTIVE ACTIONS

Consequential actions require explicit confirmation.

Examples:

- delete;
- deactivate a referenced configuration;
- cancel subscription;
- revoke credit;
- refund;
- destructive status changes.

Confirmation must explain consequences.

Bad:

```text
Are you sure?
```

Good:

```text
Deactivate "Morning"?

This delivery slot is used by:
- 12 service-area PIN rules
- 1 cutoff profile

Existing references will remain visible as inactive.
```

The server must independently recheck dependencies before mutation.

---

# 28. DEPENDENCY SAFETY

Before destructive operations check dependent records.

Examples:

```text
product
→ subscriptions / orders

delivery slot
→ service areas / cutoff rules

service area
→ fulfilment profiles

cutoff rule
→ fulfilment profiles

customer
→ subscriptions / orders / credit

subscription
→ pending deliveries / financial history
```

Do not knowingly create orphaned or logically invalid data.

Where historical data matters, prefer deactivation/soft deletion over physical deletion.

Never delete financial history.

---

# 29. STATUS TRANSITIONS

Use controlled status values.

Validate transitions.

Example:

```text
pending → delivered
pending → cancelled
```

Do not permit impossible transitions just because the database accepts them.

Domain services decide legal transitions.

---

# 30. TIME AND TIMEZONE

Store timestamps consistently.

All delivery and cutoff calculations must use the explicitly defined business timezone.

Never rely accidentally on the server machine's local timezone.

Date/time logic must be tested around:

- day boundaries;
- previous-day cutoff;
- same-day cutoff;
- timezone conversion;
- DST if ever applicable to configured regions.

---

# 31. SEARCH

Server-backed search must:

- be debounced;
- return bounded results;
- use indexed/searchable fields where practical;
- handle empty queries intentionally;
- avoid loading all records into the browser;
- avoid stale responses replacing newer searches.

Searchable selects must load sensible result windows.

---

# 32. FORMS: SERVER VS CLIENT RESPONSIBILITY

Client is responsible for:

- interaction;
- local form state;
- immediate validation UX;
- field visibility;
- pending indicators.

Server is authoritative for:

- permissions;
- eligibility;
- prices;
- discounts;
- totals;
- credit balances;
- subscription state transitions;
- delivery eligibility;
- cutoff validity;
- destructive dependency checks.

The client requests.

The server decides.

---

# 33. EXTERNAL SERVICES

External providers must be isolated.

Example:

```text
server/integrations/payment/
server/integrations/storage/
server/integrations/email/
server/integrations/sms/
```

React components must not contain provider SDK logic.

Handle realistic provider failure states.

Do not create generic retry infrastructure for every integration without need.

---

# 34. IMAGE / MEDIA PERFORMANCE

Use optimized image rendering where appropriate.

Do not ship full-resolution assets for tiny thumbnails.

Provide dimensions when practical.

Validate uploads.

Lazy-load heavy media.

Do not preload video unnecessarily.

---

# 35. RESPONSIVE AND ACCESSIBLE CODE

Accessibility is part of correctness.

All interactive controls must:

- be keyboard reachable;
- have accessible labels;
- show focus state;
- use semantic HTML;
- associate validation errors with inputs;
- preserve dialog focus correctly;
- not rely on color alone.

Use Radix/shadcn primitives correctly instead of reimplementing accessibility behavior.

---

# 36. ERROR HANDLING

Distinguish:

- validation errors;
- authentication errors;
- authorization errors;
- not found;
- business conflicts;
- provider failures;
- unexpected server errors.

Users receive understandable errors.

Never expose:

- stack traces;
- SQL errors;
- secrets;
- provider credentials;
- internal implementation details.

Never swallow exceptions.

---

# 37. EMPTY / ERROR / LOADING STATES

Every data-driven screen must handle:

- loading;
- empty;
- no search results;
- recoverable error;
- unexpected error.

Empty data is not an error.

Provide a useful next action where appropriate.

---

# 38. OPTIMISTIC UPDATES

Use optimistic updates only when:

- action is simple;
- rollback is straightforward;
- failure risk is low;
- UX benefit is meaningful.

Suitable example:

```text
simple non-financial active/inactive toggle
```

Do NOT optimistically finalize:

- payments;
- refunds;
- credit consumption;
- order creation;
- destructive dependency-sensitive actions;
- complex subscription transitions.

Server authority always wins.

---

# 39. BACKGROUND WORK

Do not introduce queues/workers merely for future-proofing.

Normal operations should use straightforward server requests where reasonable.

Background processing becomes justified for real needs such as:

- mass notifications;
- very large exports;
- expensive report generation;
- long imports;
- long-running provider synchronization.

If introduced later, it must include:

- idempotency;
- retry safety;
- failure handling;
- basic observability.

---

# 40. OBSERVABILITY

For the current project scale, basic platform/server logging is sufficient.

Do not introduce an enterprise observability stack unless needed.

Log enough to diagnose unexpected failures.

Never log:

- passwords;
- auth tokens;
- payment secrets;
- private keys;
- sensitive card/payment data.

Remove temporary debug logs before completion.

---

# 41. TESTING PRIORITY

Testing effort should match risk.

Highest priority:

- money calculations;
- credit calculations;
- payment processing;
- webhook idempotency;
- cutoff logic;
- subscription transitions;
- delivery scheduling;
- authorization;
- destructive dependency checks;
- transactional financial workflows.

Medium priority:

- validation schemas;
- service functions;
- repository behavior;
- critical API contracts.

UI:

Test critical business flows and form behavior.

Do not create tests merely to inflate coverage percentage.

---

# 42. PERFORMANCE ANTI-PATTERNS — FORBIDDEN

Do not:

- fetch identical data repeatedly without reason;
- fetch full tables for dropdowns;
- fetch all records and filter client-side when DB filtering is appropriate;
- query inside loops;
- create one API request per dashboard stat;
- over-fetch large records;
- poll without need;
- refetch the entire application after tiny mutations;
- ship large payloads when a DTO can be small;
- convert server-renderable routes into client-only routes;
- mount every heavy form section immediately;
- import large libraries for trivial functionality;
- render thousands of list items without pagination/windowing;
- duplicate server data in multiple client stores.

---

# 43. PERFORMANCE BUDGET MINDSET

Every meaningful feature should be reviewed for:

- initial JS cost;
- number of server requests;
- number of DB queries;
- payload size;
- number of hydrated client components;
- unnecessary re-renders;
- unbounded lists;
- heavy images/media;
- duplicate queries;
- sequential independent server operations.

Do not micro-optimize trivial code.

Fix obvious structural inefficiencies first.

---

# 44. PARALLEL DATA LOADING

Independent server operations may run concurrently.

Prefer:

```ts
const [a, b, c] = await Promise.all([
  loadA(),
  loadB(),
  loadC(),
])
```

when operations are independent.

Keep dependent work sequential.

Never parallelize financial writes whose order matters.

---

# 45. PAGE AND ROUTE STANDARDS

## List pages

Should normally provide:

- server-side initial data;
- search where needed;
- filters where needed;
- pagination;
- stable sorting;
- loading;
- empty;
- error;
- row actions;
- responsive behavior.

## Detail pages

Load only information needed for the visible experience.

Paginate large histories.

Return proper not-found behavior.

## Create/Edit

Small form:
dialog/sheet if DESIGN.md allows.

Normal CRUD:
sheet or route depending on complexity.

Large/complex form:
dedicated route inside the persistent admin shell.

Do not hide the sidebar/topbar for large admin forms unless specs explicitly require it.

---

# 46. SHREERAM MILKS DOMAIN RULES

The architecture must support without special-case rewrites:

- products with Buy Once only;
- products with Trial;
- products with Subscription;
- products with local PIN-based delivery;
- products with state-level delivery;
- products with Pan-India shipping;
- products with delivery slots;
- products without slots;
- products with cutoff rules;
- products included/excluded from production planning;
- prepaid customers;
- customer-credit accounts;
- paused/skipped deliveries;
- reusable service areas;
- reusable delivery slots;
- reusable cutoff rules;
- reusable fulfilment profiles.

Do not hardcode Milk-specific assumptions into generic product infrastructure.

---

# 47. PRODUCT CAPABILITY DESIGN

Product behavior should be composed from reusable capabilities.

Conceptually:

```text
Product
├── Purchase Methods
│   ├── Buy Once
│   ├── Trial
│   └── Subscription
│
├── Fulfilment Profile
├── Variants
├── Pricing
└── Production Measurement
```

Do not create separate product models for every combination unless domain requirements genuinely require it.

---

# 48. DELIVERY SLOT SCALABILITY

Do not hardcode:

```ts
morning: boolean
evening: boolean
```

Prefer relationship-based data:

```ts
allowedDeliverySlotIds: string[]
```

The business may add another slot later.

UI may currently render Morning and Evening, but the domain must remain extensible.

---

# 49. MOCK-TO-REAL ARCHITECTURE

During frontend-only phases, mock services are acceptable.

UI must call a feature service abstraction.

Example:

```text
UI
↓
feature service
↓
mock repository
```

Later:

```text
UI
↓
feature service
↓
real repository/API
↓
database
```

Do not scatter `localStorage`, mock arrays, or fetch calls directly throughout components.

The storage mechanism should be replaceable without rewriting the screen.

---

# 50. NO PREMATURE ABSTRACTION

Do not create generic frameworks for patterns used once.

Wait for meaningful repetition.

Then consolidate deliberately.

The objective is correct reuse, not maximum abstraction.

---

# 51. NO DEAD CODE

Do not leave:

- unused imports;
- abandoned components;
- commented-out implementations;
- temporary mocks presented as final;
- debug logs;
- stale feature flags;
- obsolete routes;
- unused helpers.

Remove obsolete code after replacements are verified.

---

# 52. TODO RULE

Do not use TODO comments to disguise incomplete required functionality.

A TODO is acceptable only for work explicitly outside the current scope.

Never declare a feature complete while critical behavior remains TODO.

---

# 53. DATABASE MIGRATIONS

Database schema changes must use the project's migration mechanism.

Do not manually modify production schema as an undocumented shortcut.

Expected workflow:

```text
change schema
→ create migration
→ inspect migration
→ test
→ preserve existing data
→ deploy
→ verify
```

Be especially careful with:

- destructive schema changes;
- required fields on existing rows;
- enum changes;
- relationships;
- money representation;
- historical financial data.

---

# 54. ENVIRONMENT CONFIGURATION

Environment-specific values belong in environment/configuration.

Never hardcode:

- production URLs;
- secrets;
- database credentials;
- provider keys.

Validate critical required server environment variables where practical.

Missing critical config should fail clearly.

---

# 55. CODE READABILITY

Prefer:

```text
clear
explicit
predictable
boring
```

over:

```text
clever
compressed
magical
over-abstracted
```

Use descriptive names.

Functions should do one primary job.

Avoid deeply nested ternaries.

Use early returns when they improve clarity.

Comments should explain **why**, not obvious **what**.

---

# 56. NAMING

Prefer domain-specific names.

Good:

```text
getCustomerById
listOrders
validateDeliverySlot
calculateCutoff
createCreditAdjustment
canDeactivateServiceArea
```

Avoid vague names:

```text
handleData
process
manage
helper
doThing
```

unless the local context makes the meaning unmistakable.

---

# 57. COMPLETION CHECKLIST

Before declaring a feature complete, verify:

## Architecture

- Correct layer?
- No duplicate business logic?
- No giant client component?
- Existing primitives reused?
- Feature code remains feature-local?

## Performance

- Server-first initial loading?
- Minimal client hydration?
- No duplicate requests?
- No N+1?
- No over-fetching?
- Lists bounded/paginated?
- Search debounced?
- Heavy form data loaded only when needed?
- Images/media optimized?

## Forms

- React Hook Form?
- Zod?
- Server validation?
- Pending state?
- Duplicate-submit protection?
- Failure preserves input?
- Unsaved changes where appropriate?

## Security

- Authentication?
- Authorization?
- Server-side validation?
- Secrets protected?
- No unsafe mass assignment?
- No XSS risk?
- Upload validation?
- Sensitive values server-authoritative?

## Data integrity

- Foreign/dependency relationships handled?
- Destructive dependencies checked?
- Valid state transitions?
- Transactions used where required?

## Financial integrity

Where relevant:

- integer-safe money?
- authoritative totals server-side?
- transaction used?
- payment verified?
- webhook verified?
- duplicate execution prevented?

## UX

- Loading state?
- Empty state?
- Error state?
- No-results state?
- Pending state?
- Success feedback?
- Destructive confirmation?
- Accessibility?
- Responsive behavior?

## Quality gates

- Typecheck passes?
- Lint passes?
- Relevant tests pass?
- Production build passes?
- No debug code?
- No hidden incomplete implementation?

---

# 58. FINAL ENGINEERING RULE

Every change should look as if it was written by a careful senior engineer who understands:

- React architecture;
- Next.js server/client boundaries;
- database design;
- application security;
- performance;
- financial correctness;
- maintainability;
- user experience.

The preferred solution is:

> **the smallest secure, strongly typed, high-performance architecture that correctly satisfies the current business requirement and can be extended later without rewriting the feature.**

Do not over-engineer.

Do not cut corners on foundations.

Do not trade correctness, security, or maintainability for short-term speed.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
