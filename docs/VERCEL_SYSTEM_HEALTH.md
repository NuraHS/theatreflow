# System health on Vercel and Supabase

Vercel hosts the application; Supabase provides the database and authentication.
The application filesystem is not the Supabase database volume. On Vercel the
storage check now returns unknown capacity with no percentage or progress bar.
Use the Supabase dashboard to inspect database size, file storage and plan limits.
The app automatically detects Vercel, even if an older deployment-mode setting
still says on-premises. On-premises installations can still explicitly monitor
a data volume using THEATREFLOW_STORAGE_PATH.

Database and authentication checks now show curated guidance for rejected
credentials, missing database schema, paused projects and network/DNS failures.
Real failed connections remain critical; missing schema is a warning. Failed
checks do not by themselves establish that Supabase is experiencing an outage.
Raw provider errors, project URLs and API keys are not included in this guidance.

If both database and authentication checks fail:

1. Open the Supabase dashboard and check whether the intended project is active.
   If paused, resume it and wait until it is ready.
2. In Vercel, confirm NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and
   SUPABASE_SERVICE_ROLE_KEY refer to that same project. The service-role key must
   remain server-side. Do not put its value in screenshots or chat messages.
3. After environment-variable changes, redeploy the app, then refresh System Health.
4. If the new check reports missing tables, apply the outstanding SQL migrations.

A configured-user count is separate from authentication availability: successful
Auth access with a failed profiles query now produces a warning rather than
claiming the authentication service is down.

Provider-managed backup and HTTPS certificate checks are labelled accordingly.
No recorded backup in Theatreflow does not establish that Supabase has no backup.
Certificate expiry remains unknown unless explicitly configured; provider-managed
does not mean the application has verified the certificate's validity.

Verification: npm run typecheck; npm run lint;
node --test tests/health-diagnostics.test.cjs.
