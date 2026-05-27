# Nextio Photo Competition

One repo. One Vercel deployment. One URL.

```
your-domain.vercel.app/              →  index.html      (the form)
your-domain.vercel.app/api/submit    →  api/submit.js   (the secure proxy)
```

The browser only ever talks to `/api/submit` on the same origin. The bearer
token lives in Vercel's secret store and is attached server-side before the
request is forwarded to fotorivals. It never reaches the browser.

```
  Browser  ──(no token)──▶  /api/submit  ──(Authorization: Bearer …)──▶  fotorivals
```

---

## Deploy to Vercel (one-time, ~2 minutes)

### 1. Push this folder to GitHub

```bash
git init
git add .
git commit -m "Nextio photo competition"
# create an empty repo at github.com/<you>/<repo>, then:
git remote add origin https://github.com/<you>/<repo>.git
git branch -M main
git push -u origin main
```

### 2. Import the repo into Vercel

1. Go to **https://vercel.com/new**.
2. Pick the GitHub repo.
3. Vercel auto-detects this as a static site with a serverless function in `/api`. **Leave every setting on its default.**
4. Click **Deploy**.

The first deploy will succeed but the form will return an error on submit
until you do step 3 — that's expected.

### 3. Add your bearer token

In the Vercel dashboard:

**Project → Settings → Environment Variables → Add new**

| Key                 | Value                                  | Environments               |
| ------------------- | -------------------------------------- | -------------------------- |
| `FOTORIVALS_TOKEN`  | *paste your real bearer token here*    | Production, Preview, Dev   |

Save. Then **Deployments → click the latest → ⋯ menu → Redeploy** so the
function picks up the new env var.

### 4. (Optional) Custom domain

**Project → Settings → Domains** → add e.g. `register.next.io` and follow
the DNS instructions Vercel gives you.

Done. Your URL is live.

---

## Local development

You only need this if you want to test changes before pushing.

```bash
npm i -g vercel        # one-time
vercel link            # links this folder to your Vercel project
vercel env pull        # pulls FOTORIVALS_TOKEN from Vercel into .env.local
vercel dev             # http://localhost:3000
```

That's it — `vercel dev` runs both `index.html` and the `/api/submit`
function exactly the way production will.

---

## How the token stays safe

1. The token only lives in **Vercel's secret store** (set in the dashboard,
   step 3 above). It is never in this repo and never in the bundle shipped
   to the browser.
2. The function in `api/submit.js` reads `process.env.FOTORIVALS_TOKEN`
   server-side and attaches it as `Authorization: Bearer <token>` when it
   calls fotorivals.
3. The function returns only a safe, normalized response to the client.
   Upstream errors are logged server-side (visible in Vercel's function
   logs), not surfaced raw.
4. **Never** create a `NEXT_PUBLIC_*` or any other build-time public env
   var for this token — those get inlined into client JS and leak.

---

## Payload contract

Frontend → `/api/submit`:

```json
{
  "email":        "jane@example.com",
  "firstName":    "Jane",
  "lastName":     "Doe",
  "ticketNumber": "NXT-2026-0428"
}
```

`/api/submit` → fotorivals (with `Authorization: Bearer <token>` header):

```json
{
  "email":     "jane@example.com",
  "firstName": "Jane",
  "lastName":  "Doe",
  "token":     "NXT-2026-0428"
}
```

> If fotorivals actually expects the field as `ticketNumber` (not `token`),
> change the one line in `api/submit.js` where `upstreamBody` is built.

---

## Files

| File              | Purpose                                                |
| ----------------- | ------------------------------------------------------ |
| `index.html`      | The registration form (frontend)                       |
| `api/submit.js`   | Vercel serverless function — the secure proxy          |
| `vercel.json`     | Project config (clean URLs)                            |
| `package.json`    | Project metadata + Node engine pin                     |
| `.env.example`    | Template for local dev only (real values via Vercel)   |
| `.gitignore`      | Keeps `.env` and `node_modules/` out of git            |
