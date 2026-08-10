# Theatreflow administrator authentication

This guide explains how the Admin login works, how to create the first administrator, and how an administrator creates further users.

## How Admin login works

When role enforcement is enabled, the navigation bar shows **Admin login** unless the current signed-in account has an active `administrator` profile. Selecting it opens the administrator login dialog. In local demonstration mode the entry remains labelled **Admin login** so the bootstrap flow is always available.

The login has several independent checks:

1. Supabase Auth checks the email address and password.
2. Theatreflow reads the matching row in `public.profiles`.
3. The profile must be active and its role must be `administrator`.
4. The Admin dashboard and each underlying admin page run their own server-side permission check.
5. Supabase row-level security policies protect the administrative database tables.

A successful login opens `/admin`. The dashboard contains links to:

- **Users and access** — `/admin/users`
- **System health** — `/admin/system-health`
- **Diagnostics** — `/admin/diagnostics`

The dialog is only the entry point. It does not bypass page permissions or database policies.

## Required configuration

Apply the database migrations through `0011_clinical_lead_specialty_access.sql`. Migration `0009_system_health_monitoring.sql` must be applied before `0010`, and `0010` must be applied before `0011`.

Set these values in the server's `.env.local` file:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-instance
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
THEATREFLOW_ENFORCE_ROLE_PERMISSIONS=false
```

The service-role key is required to create authentication accounts from **Users and access**. It must remain server-side. Never rename it with a `NEXT_PUBLIC_` prefix, put it in browser code, or include it in a support bundle.

For an offline trust installation, the Supabase URL should point to the trust's local Supabase service rather than an internet-hosted service.

## Create the first administrator

The first account is bootstrapped while role enforcement is off:

1. Confirm `THEATREFLOW_ENFORCE_ROLE_PERMISSIONS=false` and restart Theatreflow.
2. Select **Admin login** in the navigation bar.
3. Select **Open demo Admin dashboard**.
4. Open **Users and access**.
5. Select **New user**.
6. Enter the administrator's full name, job title and email address.
7. Enter a temporary password containing at least 12 characters.
8. Select the **Administrator** role. Suite and theatre assignments are optional because administrators have global access.
9. Select **Create account**.
10. Return to **Admin login** and verify that the new email and password open the Admin dashboard.
11. Change `.env.local` to `THEATREFLOW_ENFORCE_ROLE_PERMISSIONS=true` and restart Theatreflow.
12. Sign in again and confirm access to all three Admin dashboard areas.

Do not enable role enforcement until the first administrator login has been tested. Otherwise, there may be no authorised account able to manage the installation.

## Create additional administrator users

After role enforcement is enabled:

1. Sign in through **Admin login** with an existing administrator account.
2. Open **Users and access** from the Admin dashboard.
3. Select **New user**.
4. Enter the user's details and a temporary password of at least 12 characters.
5. Select **Administrator** as the role.
6. Select **Create account**.
7. Give the credentials to the intended user through the trust's approved secure channel.
8. Ask the new administrator to test their login promptly.

The password is handled by Supabase Auth and is not stored in `public.profiles`. Theatreflow stores the user's name, role, active status and location assignments in the profile and access tables.

## Create management users

Use the same **New user** form and choose one of the supported privileged roles: Administrator, Theatre Manager, Clinical Lead, Service Manager or Divisional Leadership. Routine theatre and recovery staff use the public Patients, Live Board and Dashboards views and do not require individual accounts.

Theatre Manager, Service Manager and Divisional Leadership accounts can be assigned to theatre suites and individual theatres. The assignment control groups theatres beneath their suite names. Clinical Lead accounts are assigned to specialties instead; their patient, dashboard, report and insight data is filtered to those specialties across theatre suites.

## Disable access

Open the user's card in **Users and access**, clear **Account active**, and save. An inactive profile cannot pass Theatreflow's page-level permission checks. Do not delete audit history when a staff member leaves; deactivate the account so historical records remain attributable.

## If the first administrator cannot log in

Check the following in order:

1. The three Supabase environment values are present and the app was restarted after they changed.
2. Migrations `0009`, `0010` and `0011` completed successfully.
3. The user exists in Supabase Auth.
4. A row with the same user ID exists in `public.profiles`.
5. The profile has `role = 'administrator'` and `active = true`.
6. The browser is using the correct local Theatreflow installation.

If role enforcement was enabled before a working administrator was created, temporarily set `THEATREFLOW_ENFORCE_ROLE_PERMISSIONS=false`, restart the app, complete the bootstrap steps above, test the account, then re-enable enforcement.
