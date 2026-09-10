# Deploy Firebase — CotaCondo

Projeto Firebase: **`marcio-ab7d9`** · plano **Spark (grátis)** até haver Blaze pago

## Arquitetura (Spark)

| Camada | Onde | URL |
|--------|------|-----|
| Landing estática (marketing) | Firebase Hosting | https://marcio-ab7d9.web.app |
| App Next.js (login, `/app`, API) | Vercel | https://536-marcio.vercel.app |
| Auth / Firestore / Rules | Firebase Spark | Console `marcio-ab7d9` |

> **Spark vs Blaze:** App Hosting / `frameworksBackend` / vários Cloud Functions exigem **Blaze**. Enquanto estivermos no Spark: Next na Vercel; Firebase = Auth + Firestore + Hosting LP + rules. Sem Cloud Functions de produção.

> Conta CLI: o deploy de Hosting exige login Google **com IAM no projeto `marcio-ab7d9`**. Sem acesso, só a Vercel atualiza o app.

CTAs da landing apontam para a app via `hosting-static/js/config.js` → `appUrl`.

---

## Pré-requisitos

```bash
npm install -g firebase-tools
# ou use npx firebase-tools@latest

firebase login
firebase use marcio-ab7d9
```

Confirme o projeto em `.firebaserc` (`default: marcio-ab7d9`).

---

## Deploy

### Tudo (rules + hosting — sem Storage)

```bash
npm run firebase:deploy
```

Equivalente:

```bash
npx firebase-tools@latest deploy --only firestore:rules,hosting --project marcio-ab7d9
```

> Este projeto **não usa Firebase Storage**. Anexos ficam em fallback local/`/uploads` ou outro provider.

### Só landing

```bash
npm run firebase:deploy:hosting
```

### Só regras Firestore

```bash
npm run firebase:deploy:rules
```

---

## O que é publicado

| Alvo | Origem |
|------|--------|
| Hosting | pasta `hosting-static/` |
| Firestore Rules | `firestore.rules` |
| Storage Rules | `storage.rules` |

Arquivo de config: `firebase.json`

---

## Pós-deploy (checklist)

1. Abrir https://marcio-ab7d9.web.app e validar a landing
2. Clicar em **Acesse / Cadastro** → deve ir para `https://536-marcio.vercel.app`
3. Firebase Console → Authentication → Settings → **Authorized domains**:
   - `marcio-ab7d9.web.app`
   - `marcio-ab7d9.firebaseapp.com`
   - `536-marcio.vercel.app`
   - domínio customizado (quando houver)
4. Se alterou `appUrl` em `hosting-static/js/config.js`, redeployar só hosting

---

## Domínio customizado (opcional)

No Firebase Console → Hosting → **Add custom domain**:

1. Informe o domínio (ex.: `cotacondo.com.br` ou `www.cotacondo.com.br`)
2. Adicione os registros DNS indicados (A/TXT)
3. Aguarde SSL (pode levar até 24h)
4. Atualize `appUrl` se a app Next também tiver domínio próprio

---

## App Next na Vercel (é aqui que ficam as atualizações do `/app`)

O deploy Firebase **não** atualiza Dashboard, Cotações, Calendário, Aprovador etc.
Essas telas rodam na **Vercel**:

| URL | O que é |
|-----|---------|
| https://marcio-ab7d9.web.app | Landing estática (Firebase) |
| https://536-marcio.vercel.app | App Next completa |

Env na Vercel (obrigatório): `AUTH_SECRET`, `NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_SERVICE_ACCOUNT_JSON` do Admin **marcio-ab7d9** (não de outro projeto).

Para publicar as mudanças do app:

```bash
# Conta Vercel dona do projeto cotacondo-marcio (ex.: bordelesslucas)
npx vercel login
npx vercel link   # projeto: cotacondo-marcio
npx vercel --prod --yes
# ou: npm run deploy:app
```

Se o GitHub estiver conectado ao projeto Vercel, um `git push` na `main` também dispara o deploy.

---

## Troubleshooting

| Problema | Ação |
|----------|------|
| `Permission denied` / não logado | `firebase login` e `firebase use marcio-ab7d9` |
| Landing abre mas login falha | Authorized domains no Firebase Auth |
| CTA aponta URL errada | Editar `hosting-static/js/config.js` e `npm run firebase:deploy:hosting` |
| Erro ao usar frameworks/Next no Hosting | Esperado no Spark — use Vercel para o Next |
