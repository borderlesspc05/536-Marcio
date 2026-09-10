# CotaCondo — domain context

Vocabulary for architecture and product. Prefer these names over file/class names.

## Entities / flows

- **Cotação** — solicitation for bids (quotation); statuses include aberta, em_negociacao, aprovada.
- **Franchise** — monthly quota of cotações / proposals tied to the active plan.
- **Opportunity** — supplier-facing invite to a Cotação.
- **Compliance** — supplier document review (upload / review / expire).
- **Checkout** — payment session that activates or changes a plan (or category addon).
- **Domain Event** — persisted fact (`quotation.created`, `checkout.paid`, …) that may notify/email.
- **Session** — app JWT cookie after Firebase Auth (or limited local approver path).
- **Capability** — plan feature + role/org type that must pass before an action runs.
- **PaymentProvider** — seam for Asaas vs sandbox checkout creation/webhooks.

## Platform constraints (Spark)

- Firebase **Spark** (free): Auth, Firestore, Hosting static LP, Storage rules. No App Hosting / `frameworksBackend` (Blaze).
- App Next.js runs on **Vercel**; Admin SDK on the server uses a service account JSON.
- Firestore persistence today is Prisma-shaped (`firestoreDb`); `$transaction` is **not** atomic — do not assume multi-doc rollback.
- Prefer Admin SDK queries on Vercel over Cloud Functions until Blaze.

## Auth story

1. Firebase Auth REST signs in (Identity Toolkit + `NEXT_PUBLIC_FIREBASE_API_KEY`).
2. Firebase Admin + Firestore load the user profile (required for `/app`).
3. App issues `cotacondo_session` JWT (`AUTH_SECRET`).
4. Parallel: local password only for **external_approver** / service-client portal when Firebase sign-in fails or portal login.
