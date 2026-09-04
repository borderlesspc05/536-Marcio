# CotaCondo

Plataforma SaaS de cotações para condomínios.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS 4
- **Firebase** (projeto `marcio-ab7d9`): Storage + Security Rules (Spark)
- Persistência bootstrap: Prisma + SQLite (Auth JWT local; Firebase Auth depois)
- Poppins + assets em `/public/brand`
- **Deploy do app:** Vercel (plano free) — **não** usamos Firebase App Hosting / Blaze

## Setup local

```bash
cp .env.example .env
# Preencha as variáveis NEXT_PUBLIC_FIREBASE_* (já no .env do time)
npm install
npm run db:setup   # bootstrap local
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

### Contas demo (bootstrap local)

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
- `npm run db:setup` — push schema local + seed
- `npm run seed:firebase-auth` — cria/sincroniza usuários demo no Firebase Auth (senha `123456`)
- `npm run build` — build de produção
- `npm run smoke:dia-02` / `npm run smoke:dia-03`
- `npm run jobs:compliance-expire` — marca docs vencidos como `em_atraso` (sem Cloud Functions)

### Pagamentos Asaas

O adapter Asaas cria clientes por `organizationId`, assinaturas mensais para
planos e cobranças avulsas para adicionais. Em desenvolvimento, mantenha
`PAYMENT_PROVIDER=sandbox` para não gerar cobranças reais.

Em produção, configure `PAYMENT_PROVIDER=asaas`,
`ASAAS_ENVIRONMENT=production`, `ASAAS_PRODUCTION_API_KEY` e
`ASAAS_WEBHOOK_TOKEN`. Após publicar uma URL HTTPS, rode
`npm run setup:asaas-webhook` para registrar
`/api/webhooks/asaas`. O CPF/CNPJ da organização é obrigatório.

## Deploy (Spark-compatible)

Guia completo: [`doc/deploy-firebase.md`](doc/deploy-firebase.md)

### App Next.js → Vercel

1. Conecte o repositório na Vercel.
2. Configure as env vars (`.env.example`): `AUTH_SECRET`, `DATABASE_URL`, Firebase `NEXT_PUBLIC_*`, opcionalmente `FIREBASE_SERVICE_ACCOUNT_JSON`.
3. Em produção com Vercel, prefira Postgres (`DATABASE_URL`) no lugar de SQLite file.
4. Build command: `npm run build`.

### Firebase (Spark) — rules + Storage + landing estática

```bash
npm run firebase:deploy
# ou:
npx firebase-tools@latest deploy --only firestore:rules,storage,hosting --project marcio-ab7d9
```

- `firebase.json` **não** usa `frameworksBackend` (exige Blaze).
- Hosting Firebase serve `hosting-static/` (LP completa: home + `/fornecedores`).
- CTAs de cadastro/login/checkout apontam para o app na Vercel (`hosting-static/js/config.js` → `appUrl`).
- Anexos: Firebase Storage via Admin SDK se houver service account; senão `/uploads` local.
- URL do Hosting: https://marcio-ab7d9.web.app

## Documentação

Ver pasta [`/doc`](./doc), especialmente `documentation.md` e os `dia-0X.md`.
