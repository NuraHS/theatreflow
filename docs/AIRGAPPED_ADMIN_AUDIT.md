# Theatreflow administration and offline support audit

Reviewed 25 October 2026 against the USB-delivered, Trust-hosted installation model.
The Vercel site is a hosted demonstration. It is not an airgapped installation.

## Findings and corrections in this change

- Theatre configuration is read from `theatre_suites`, `theatres` and
  `recovery_areas` in the configured Supabase database when those queries succeed.
  Built-in ESTH defaults are fallback data. Reconnecting to an old database
  exposes its old names; login itself does not choose a different theatre list.
- Apply migration 0018 to rename the original locations, retaining identifiers,
  patient references and access assignments. Apply 0019 after it to permit
  unavailable incident counts in snapshots. Neither migration runs on deployment.
- Role enforcement defaults off unless explicitly set to true. This permits
  unauthenticated bootstrap access to administration; it is not a separate demo
  database. Real sessions are now recognised even when enforcement is disabled.
- Supabase's invalid_credentials error precedes the management-profile check.
  It does not establish which of the email, password, account or project is wrong.
  A healthy Auth admin API check does not prove a specific user's password works.
- Users and access now checks whether each profile links to an Auth account in
  this installation, whether its email matches, email confirmation and sign-in
  ban status. It does not test or export passwords. There is no new password
  reset endpoint or automated change to credentials.
- Incident queries preserve unavailable counts as null rather than false zeroes.
  Migration 0019 permits those values in stored snapshots. Older snapshot count
  columns cannot establish whether a zero meant a failed query; historical exports
  omit those ambiguous count columns.
- Migration status compares the latest recorded version to the app's expected
  version (0019). A newer or older version is flagged for review, not certified as
  compatible. This does not inspect the complete schema or verify migration checksums.
- The header's unconditional green 'Realtime ready' badge was removed. It had no
  measured subscription status behind it. An end-to-end realtime check remains work.
- Support bundles now exclude incident free text, maintenance notes, migration
  names, user identities and historical details JSON. Regex-only redaction could
  not guarantee removal of names or secrets in those fields. Attach reviewed
  technical reproduction notes separately when needed.
- Collection failures in exports are explicitly marked unavailable, not represented
  as empty histories. Exports contain up to the newest 500 incidents, snapshots and
  maintenance events; they are a bounded technical view, not a complete event archive.

## Recommended admin sections

| Area | Purpose | Evidence and limits |
| --- | --- | --- |
| Installation overview | Identify the exact installation and software | Release, build ID when configured, runtime, cloud/local mode, database configuration source and role-enforcement state. A stable installation ID and signed release manifest are still needed. |
| Users and access | Manage local management accounts | Auth-account linkage, role, active state, suite/specialty assignments. Local password recovery and forced password changes need a defined workflow. |
| Current health | Find the component needing attention | Read connectivity and latency, available database metrics, configured data-volume capacity, authentication API response, incident-register readability. No clinical-table content is exported. |
| Backup and recovery | Establish whether data can be recovered | Last recorded success and its age are useful but do not verify backup files, integrity or restorability. Automated backups and restore-test evidence are still needed. |
| Diagnostics and history | Establish what changed before a fault | Manually recorded snapshots and technical incidents. The current app is not a persistent background monitor or a complete process-log collector. |
| Support export | Give the supplier bounded technical evidence | Current structured checks, release metadata and structured histories, with collection failures marked. No automatic upload is performed. |
| Updates and recovery | Apply and verify offline patches | Not implemented: signed package verification, compatibility checks, backup before change, migration execution, rollback and post-update validation. |

## Meaning of existing measurements

- Application healthy: this request executed. It does not prove every workflow works.
- Uptime and memory: this Node process only. On Vercel, process restarts are normal;
  these values do not measure whole-server uptime, RAM, CPU or disk health.
- Database healthy: a small workflows-table read succeeded. This is not a database
  write test, complete schema verification or an end-to-end patient-workflow test.
- Database size/connections: optional metrics returned by the database function.
  Unavailable metrics remain unavailable rather than being replaced with estimates.
- Authentication healthy: the server's Auth administration request succeeded.
  It does not prove browser sessions, individual passwords or assigned roles work.
- Storage: capacity of the explicitly configured on-premises mounted data volume.
  The volume must actually correspond to the data being monitored. Vercel disk
  is not Supabase capacity and is not used for this check.
- Backups: successful events recorded by Theatreflow, with 36/48-hour age thresholds.
  These are existing fixed thresholds, not a Trust-approved backup policy. Future
  timestamps are treated as unknown. No backup or restore test is run by this check.
- Migration: latest recorded migration versus expected version, not full schema proof.
- Certificate: configured expiry, not a measured TLS handshake. Cloud-managed expiry
  is unknown to this app. Local certificate renewal and actual endpoint checks remain work.
- Incidents: entries in the technical register, not an automatically captured fault total.
- Healthy / Warning / Critical / Unknown: passed specific check / needs attention /
  failed important check / insufficient evidence. Unknown does not mean zero or healthy.

## Monitoring execution today

Opening the admin pages runs checks. They refresh every 30 seconds while open;
health endpoints also run checks when requested. Reading health does not persist
snapshots. Record snapshot explicitly saves a report in the installation database.
No operating-system service, scheduler or persistent background collector is included.
If the app or database is completely unavailable, an in-app logger cannot reliably
record that outage; an independent local collector and local spool are required.

## Airgapped installation work still required

1. Package the app runtime and all required Supabase services locally, with images,
   assets, dependencies and release manifest staged before the USB enters the Trust.
   Validate installation and operation with internet disabled. The current repo has
   no complete USB installer or offline deployment/upgrade orchestration.
2. Define internal URLs, local HTTPS, persistent database and backup volumes, startup
   services and local administrator bootstrap. Browser Supabase URLs use NEXT_PUBLIC
   variables and are built into the application, so packaging must handle each
   installation's endpoint rather than assuming an environment change rewrites a build.
3. Resolve clinical-screen authentication requirements. Enabling role enforcement
   still leaves Patients, Live Board and Dashboards publicly viewable in the current
   access model. Restricted network deployment alone does not change that behaviour.
4. Run a local monitoring service on a fixed schedule, with bounded timeouts, retention,
   failure/recovery events, clock checks and disk reserve. Capture structured API
   error codes, component names, durations and technical correlation IDs without
   patient payloads. Spool locally when the database is down, and import buffered
   records when it recovers. Production operational pages should fail visibly on
   database failure rather than silently mixing synthetic fallback with real data.
5. Automate backups to a separate approved location and record restore-test results.
   Agree thresholds, retention and escalation ownership with Trust IT.
6. Produce a signed offline patch manifest with release/build, schema compatibility,
   hashes, verification key, prerequisites, migration plan and rollback instructions.
   Test successful installation, interrupted installation and restoration before release.
7. Rehearse the support loop: reproduce fault → preserve evidence → export → Trust
   review → supplier analysis → verified patch → backup → install → recheck → retain
   before/after audit. No connection back to a supplier should be necessary.

These steps are a delivery roadmap, not capabilities already present in the app.

## Immediate hosted-demo steps

1. Apply 0018_esth_theatre_locations.sql followed by 0019_monitoring_unknown_counts.sql
   in the Supabase database used by Vercel. Do not rerun the full setup script.
2. Deploy the code changes. Inspect Users and access for the affected account's new
   authentication-link status. If linked but its password is rejected, recover the
   password through that installation's authentication administrator. Do not create
   a duplicate profile or disable checks to make a failed login appear successful.
3. Verify a genuine administrator login, then enable THEATREFLOW_ENFORCE_ROLE_PERMISSIONS
   and redeploy. Do not enable enforcement before verifying the account.
4. Check the configuration source, active 3-suite/10-theatre count, expected migration,
   manual snapshot recording and structured support export. Public clinical viewing
   remains a separate access-design decision.
