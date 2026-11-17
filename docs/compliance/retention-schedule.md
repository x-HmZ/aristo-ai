# Retention schedule

Status: DRAFT. These are the PROPOSED periods from `.claude/plans/launch/findings/compliance.md` (7.1). The privacy
policy page states them. No scheduled deletion job exists in the repository today, so until one is built the policy
would promise something the system does not do.

## To complete

- [ ] Owner confirms or changes each period.
- [ ] Build the enforcement (pg_cron or a Vercel cron): inactive accounts, session logs, free-text answers, usage events.
- [ ] Stop storing the typed topic in `usage_events.metadata` (`src/app/api/teach/route.ts`).
- [ ] Scrub the deleted user's name from `admin_audit_log.diff` on account deletion.
- [ ] Find the Supabase backup window length and write it in the last row.
- [ ] If any period changes, change `src/app/(legal)/privacy/page.tsx` and bump `PRIVACY_VERSION`.
- [ ] COPPA 312.10 expects a written retention policy: this document can serve once enforced.

| Data | Where | Period | Enforced today | Action |
|------|-------|--------|----------------|--------|
| Account (email, name, goal, approval) | `auth.users`, `profiles` | Until deletion | Manual (admin) and self-service once `/account` delete ships | Verify self-service deletes cascade |
| Inactive account | same | 24 months since last sign-in, after a warning email | No | Build job and warning email |
| Learning data (mastery, progress, misconceptions) | `user_concept_mastery`, `user_misconceptions`, `user_course_progress` | Until deletion | Cascades on user delete | none |
| Learning profile | `learner_profiles` | Until deletion | Cascades | none |
| Session logs | `session_logs` | 12 months | No | Build job |
| Quiz attempts: free-text answer | `quiz_attempts.user_answer` | 12 months, then blanked (score kept) | No | Build job |
| AI request record | `usage_events` | 90 days, no topic text | No | Build job, drop topic |
| Admin audit log | `admin_audit_log` | 12 months; name scrubbed on deletion | No | Build job, scrub |
| Custom teacher URL | `learner_profiles.custom_teacher_glb_url` | Until deletion or the user removes it | Cascades | none |
| Provider logs (Vercel, Supabase, Resend) | provider | Provider defaults | n/a | Record the defaults after reading each provider's page |
| Backups | Supabase | Until the backup window expires after deletion | n/a | Record the window |
| Invoices (once payments exist) | payment provider and books | As long as Austrian tax law requires (BAO s.132, 7 years, unconfirmed) | n/a | Confirm with an adviser |
