# Fitness Tracker

Dark-mode personal food, workout, body metrics, analytics and photo tracker.

## Free-first architecture
- GitHub Pages: static website hosting.
- Supabase Free: Auth, PostgreSQL and private Storage.
- Manual export: JSON and CSV from the Backup page.

Free-plan quotas and inactivity/pause rules can change. Check the current Supabase pricing page before relying on long-term availability. No paid services are required by this starter, but free tiers are not unlimited.

## Setup
1. Create a Supabase project.
2. Open **SQL Editor** and run all of `supabase-schema.sql`.
3. In Supabase **Project Settings > API**, copy the Project URL and the publishable key (or legacy anon key).
4. Edit `app.js` and replace `YOUR_SUPABASE_PROJECT_URL` and `YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY`.
5. In Supabase **Authentication > URL Configuration**, add your GitHub Pages URL to Site URL and Redirect URLs.
6. Commit `index.html`, `styles.css`, `app.js`, and `supabase-schema.sql` to your GitHub repository.
7. Enable GitHub Pages from **Settings > Pages**, deploy from the `main` branch and `/ (root)`.
8. Open the published site, sign up, and verify email if confirmation is enabled.

## Security
- Never put the Supabase `service_role` / secret key in browser code.
- The publishable/anon key is designed for client use only when Row Level Security is enabled.
- Keep the `fitness-photos` bucket private. Do not make it public.
- This starter includes RLS policies so users can access only rows with their own `user_id`.
- Before public launch, review Supabase Auth settings and test with a second account.

## Current starter scope
Food, workout session, body metrics, private photo upload, dashboard totals and manual JSON/CSV export are wired to Supabase. Detailed exercise-set entry, signed private image previews, profile targets, full charts and spreadsheet export are next implementation steps.
