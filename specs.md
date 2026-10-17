# specs.md — ShreeRam Milks business rules

> Version 0.2, 2026-10-11. This file records **only rules the owner has stated or that already exist in the admin's data models**.
> Anything not yet decided is listed under "Open questions" and must not be guessed in code (`AGENTS.md`, section 0).
> The owner approves changes to this file. Keep the copy in `Backend/` identical if one is added there.

## 1. Who uses the system
- **One admin** runs the whole business: catalogue, customers, orders, deliveries, payments, support. There is **no office staff role and no delivery-partner app**. Everything is done from the admin panel, and every change is recorded in the audit log.
- **Customers** use the phone app. They sign in with a phone number and a code sent by SMS. Android customers may also use Google. (No Sign in with Apple; iPhone uses the phone code only.)

## 2. Two kinds of customer
The admin sets the type on each customer. It is copied onto every order.

### Prepaid customers
- **Prepaid means pay first, receive after.** This holds for **every kind of purchase**: a normal product, a trial, a subscription, and **any rule the admin creates in future**. Nothing is accepted or delivered until the payment is confirmed.
- Pay **inside the app only**, through the **PhonePe Payment Gateway**. A payment counts only after the server has confirmed it with PhonePe. If the payment fails, the order or subscription is not created.
- **The server works out the price** from what the customer selected: product, variant, quantity, and the dates or duration chosen. The phone never decides a price.
- If a paid delivery is skipped or cancelled, the admin's rules create a **prepaid adjustment**: a carried-forward delivery, an account credit, or a refund owed. (Types and states already exist in the admin.)
- **Refunds are never made by this system.** When money must go back, the admin sends the refund from the **PhonePe dashboard** by hand, then records it here. The system has no code that can send money out, so it can never send a wrong refund by mistake.

### Credit customers (pay later)
- **Only the admin decides** who is a credit customer. A customer cannot become one by themselves.
- Each has a **credit account** with a **monthly** billing cycle. Each delivery adds to what the customer owes (a ledger charge). Payments reduce it.
- The admin can **request a payment** for an amount. The customer then sees it as a **banner in the app**.
- The admin can **mark a payment as received** (cash, UPI, bank transfer or other), for example when the customer paid cash after the request was sent. That adds a payment entry to the ledger and closes the request. **No outside service is needed for this.**
- The ledger is **append-only**: a mistake is fixed with a new adjustment entry, never by editing or deleting an entry. Financial history is never deleted.
- The admin sets a **credit limit** on each account: the most credit that customer may have. **An order that would take the customer above the limit is blocked in the app**, with a clear message.

## 3. Deliveries
- The admin marks each delivery as done in the admin panel.
- Delivery eligibility is by **PIN code** (service areas), slots and cut-off rules set in the admin. There are **no maps**.

## 4. Not in scope now
- Invoices and GST.
- A delivery-partner app.
- Maps and map pinning.

## 5. Money rules (apply everywhere)
- All amounts are stored as whole **paise**. The server calculates and verifies every total, discount and balance; the phone never decides a price.
- Payments are safe to retry: the same payment can never be recorded twice.
- Each order copies the product name, variant and price at the time, so later catalogue edits never change history.

## Open questions
None at the moment.

## Answered
- Prepaid subscriptions, trials and any future rule are all pay-first; price is calculated by the server from the selection (see section 2).
- Refunds are done by the admin in PhonePe, never by this system.
- There are no existing customers or balances to import at launch.
- **Credit limit blocks orders** above the limit.
- **Payment requests** show in the app as a banner and an in-app notification. The customer taps **Pay now**, which opens PhonePe's checkout. **No payment link is sent by SMS or WhatsApp.**
