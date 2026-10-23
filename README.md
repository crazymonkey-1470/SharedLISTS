# Our Shared Lists

A mobile-first web app for a household: shared lists (one per store or chore — "ShopRite", "House to-dos") and a shared calendar. Everyone sees each other's changes live. Installable to a phone home screen.

- **Lists** — tabs with open-item counts, big tap targets, unchecked items first and checked ones under "Done", "Added by <name>" on every item, "Clear checked", rename/delete with an in-page confirm.
- **Calendar** — "Upcoming" (next 30 days, the default on phones) and a month grid with dots; all-day or timed events; daily/weekly/monthly/yearly repeats with an optional end date; notes; an attached list shown as a chip that opens it.
- **Household** — magic-link sign-in, invite links (copy/share/revoke), member removal, light/dark themes.

**Stack:** Vite + React + TypeScript, Tailwind CSS, `@supabase/supabase-js` v2, react-router. Static build — no server of your own. Hosted on Cloudflare Pages.

---

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. **Run the migration.** Open **SQL Editor → New query**, paste the whole of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) and click **Run**.
   (With the Supabase CLI instead: `supabase link --project-ref <ref>` then `supabase db push`.)
   It creates the tables, Row Level Security policies, the `create_household` / `accept_invite` functions, and adds `lists`, `items` and `events` to Realtime.
3. **Auth URLs.** Go to **Authentication → URL Configuration**:
   - **Site URL:** your app's address, e.g. `https://our-shared-lists.pages.dev` (use your custom domain if you add one).
   - **Redirect URLs** — add each of:
     - `https://our-shared-lists.pages.dev/**`
     - `http://localhost:5173/**` (local development)
     - `https://*.our-shared-lists.pages.dev/**` (optional: Cloudflare preview deployments)
     - your custom domain followed by `/**`, if you use one

   The `/**` matters: the magic link brings people back to the exact page they started on (e.g. `/join/<token>` for invites). Any URL not on this list falls back to the Site URL.
4. **Email sending (important).** Supabase's built-in mailer is only for testing: it is heavily rate-limited and only delivers to members of your Supabase organization's team. Before inviting the family, set up custom SMTP under **Authentication → Emails → SMTP Settings** (Resend, Postmark, SendGrid, Amazon SES, etc.).
5. **Optional — add a sign-in code to the emails.** iPhone home-screen apps don't share storage with Safari, so a link tapped in Mail signs you in to Safari rather than the installed app. The sign-in screen therefore also accepts the code from the email. To include it, edit **Authentication → Emails → Templates** for both **Magic Link** and **Confirm signup** and add a line such as:
   ```html
   <p>Or enter this code in the app: <strong>{{ .Token }}</strong></p>
   ```
6. **Keys.** From **Project Settings → API Keys** (or **Data API**), copy the **Project URL** and the **anon / publishable** key. (Never use the `service_role` / secret key in this app.)

Email sign-in is enabled by default under **Authentication → Sign In / Providers → Email**; leave it on.

## 2. Run it locally

Requires Node 22+.

```bash
cp .env.example .env      # then fill in the two values from step 1.6
npm install
npm run dev               # http://localhost:5173
```

`.env` is git-ignored; never commit it.

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check (`tsc`) then build to `dist/` |
| `npm run preview` | Serve the production build locally |

## 3. Deploy to Cloudflare Pages

1. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**, and pick this repository.
2. Build settings:
   - **Production branch:** `main`
   - **Framework preset:** None (or "React (Vite)")
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. **Environment variables** (add to both Production and Preview):
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon / publishable key

   The repo's `.node-version` selects Node 22. These values are baked in at build time, so **redeploy** after changing them.
4. **Save and Deploy.** Then put the resulting `*.pages.dev` address (or your custom domain) into Supabase's Site URL and Redirect URLs (step 1.3).

Routing: the app is a single-page app and the build deliberately has **no `404.html`**, so Pages serves `index.html` for every path (`/lists/…`, `/join/…`). Don't add a `404.html` or a catch-all `_redirects` rule. `public/_headers` sets long-lived caching for the hashed files in `/assets/`.

## 4. First run

1. Open the app, enter your email, tap the link (or type the code).
2. Enter your name, then name your household ("The Jobsons").
3. **Settings (gear icon) → Create invite link** — it's copied to your clipboard (or use Share). Links work for 7 days or until revoked, and can be used by several people.
4. Each person opens the link, signs in with their own email, enters their name and lands on your lists — they skip creating a household.

**Add to home screen:** iPhone — open in Safari, Share → *Add to Home Screen*. Android — Chrome menu → *Install app*. When signing in from the installed iPhone app, use the code from the email (see step 1.5).

---

## How it works

- **Data & security** — every table has Row Level Security. `is_member(household_id)` (a `SECURITY DEFINER` helper) gates lists, items and events; only owners can read/create/revoke invites, rename the household or remove members; you can read the profiles of people who share a household with you. Households and memberships are only created through `create_household()` and `accept_invite()`. Items and events reference `(list_id, household_id)` together, so nothing can be attached to another household's list.
- **Live sync** — the app subscribes to Supabase Realtime changes for the household's lists, items and events. Every change is applied optimistically and rolled back with a message if the server rejects it. The app re-syncs after reconnecting or returning to the foreground.
- **Times** — timed events are stored in UTC and shown in each viewer's local time zone. All-day events are stored at UTC midnight of their date and read as a plain date, so a birthday stays on the same day everywhere.
- **Repeats** — a repeating event is a single row; occurrences are expanded in the browser for the visible date range (weekly events keep their local time across daylight-saving changes; monthly-on-the-31st skips shorter months; Feb 29 repeats in leap years). Editing or deleting a repeating event changes the whole series.
- **Offline shell** — `public/sw.js` caches the app shell and build assets so the installed app opens without a connection. Supabase requests are never cached.

## Project layout

```
supabase/migrations/0001_init.sql   schema, RLS, RPCs, realtime
public/                             manifest, icons, service worker, _headers
src/lib/                            supabase client, dates, recurrence, helpers
src/state/                          auth, household and data (realtime + optimistic) providers
src/pages/                          sign in, onboarding, join, lists, calendar, settings
src/components/                     app shell, event sheet, UI primitives
```

## Troubleshooting

- **The magic link opens the wrong site or the home page** — add the exact origin with `/**` to Supabase Redirect URLs (step 1.3).
- **"Email rate limit exceeded" or emails never arrive** — configure custom SMTP (step 1.4).
- **"Supabase isn't configured" screen** — `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` were missing at build time; set them and rebuild/redeploy.
- **Other people's changes don't appear live** — check **Database → Publications → supabase_realtime** includes `lists`, `items` and `events` (the migration adds them).
- **"Couldn't join: This invite link has expired/been revoked"** — create a new link in Settings.
