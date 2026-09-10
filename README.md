# CotaCondo

Plataforma SaaS de cotações para condomínios.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS 4
- **Firebase** (projeto `marcio-ab7d9`), plano **Spark** (grátis): Auth, Firestore, Hosting (LP), Security Rules
- Persistência do app: **Firestore via Admin SDK** (`src/lib/firebase/firestore-db.ts`) — sem Prisma/SQLite em runtime
- Sessão da área `/app`: JWT local (`AUTH_SECRET`) após Firebase Auth
- Poppins + assets em `/public/brand`
- **Deploy do app:** Vercel — **não** usamos Firebase App Hosting / Blaze

## Setup local

```bash
cp .env.example .env.local
# NEXT_PUBLIC_FIREBASE_* + FIREBASE_SERVICE_ACCOUNT_JSON (ou GOOGLE_APPLICATION_CREDENTIALS)
npm install
npm run db:setup   # seed Firestore + Firebase Auth demo
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

Glossário de domínio: [`CONTEXT.md`](./CONTEXT.md). Deploy Spark: [`doc/deploy-firebase.md`](doc/deploy-firebase.md).

### Contas demo

Senha: `123456` (Firebase Auth)

| E-mail | Perfil |
|--------|--------|
| admin@cotacondo.com.br | Master Admin |
| masterservice@demo.cotacondo.com.br | Master Service |
| sindico@demo.cotacondo.com.br | Síndico |
| fornecedor@demo.cotacondo.com.br | Fornecedor |
| adm.master@demo.cotacondo.com.br | Adm Master |
| adm.operacional@demo.cotacondo.com.br | Adm Operacional |

## Scripts

- `npm run dev` — desenvolvimento
- `npm run lint` / `npm run typecheck`
- `npm run db:setup` — seed Firestore + Auth demo
- `npm run seed:firebase-auth` — sincroniza usuários demo (senha `123456`)
- `npm run build` — build de produção
- `npm run smoke:dia-02` / `npm run smoke:dia-03`
- `npm run jobs:compliance-expire` — marca docs vencidos (sem Cloud Functions; Spark OK)

### Pagamentos Asaas

Em desenvolvimento: `PAYMENT_PROVIDER=sandbox`.  
Produção: `PAYMENT_PROVIDER=asaas`, chaves e `ASAAS_WEBHOOK_TOKEN`. Depois: `npm run setup:asaas-webhook`.

## Deploy (Spark)

| Camada | Onde |
|--------|------|
| Landing | Firebase Hosting → `hosting-static/` |
| App Next (`/app`, API, login) | Vercel |
| Auth / Firestore / Rules | Firebase Spark |

```bash
# Landing + rules (conta Google com acesso a marcio-ab7d9)
npm run firebase:deploy

# App
npx vercel --prod
```

Env obrigatórias na Vercel: `AUTH_SECRET`, `NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_SERVICE_ACCOUNT_JSON` (JSON do Admin do projeto **marcio-ab7d9**).

`firebase.json` **não** usa `frameworksBackend` (exige Blaze). Enquanto estivermos no Spark, o Next permanece na Vercel.

## Documentação

Ver [`/doc`](./doc), `documentation.md` e `dia-0X.md`. O guia antigo Prisma (`doc/deploy-vercel-prisma.md`) está **obsoleto**.
