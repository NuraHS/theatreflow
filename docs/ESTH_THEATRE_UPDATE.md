# ESTH theatre configuration update

The defaults and new-install setup now contain 10 theatres:

- St Helier A2 Theatres: CEPOD Theatre 1, Theatre 2, Trauma Theatre 3.
- B4 Theatres: Theatre 1, Theatre 2.
- Epsom Main Theatres: Theatre 1, Theatre 2, Theatre 3, Theatre 4, Theatre 5.

Obstetric theatres are excluded. Default recovery area names follow each suite;
these are provisional labels, and recovery capacities are unspecified in new installations.

## Existing Supabase database

Apply `supabase/migrations/0018_esth_theatre_locations.sql` using the Supabase SQL
editor or the project's normal migration process. Do not rerun the full setup
script against an existing database.

The migration renames St James' to Epsom Main, Atkinson Morley to A2, and Gynae
to B4. It preserves IDs, patient references, existing recovery capacities and
user assignments. Review existing assignments because they will now refer to the
renamed suites. The former Gynae Theatre 3 is made inactive, not deleted; historical
patient references are retained. This migration is intended for the original
seeded configuration and should be reviewed first if locations were customised.

## Code deployment

Commit and push the code changes to the GitHub branch used by Vercel, then verify
that the deployment succeeds. Database migrations are a separate step; there is
no migration runner in the app's build script.

After both steps, check the patient creation dropdown, Live Board, dashboard
location filter and administrator access assignments. Expect 3 suites and 10 active
theatres. Neither the migration nor deployment has been executed by this change.
