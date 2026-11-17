# Record of processing activities (GDPR Art 30)

Status: DRAFT prepared from the code and `.claude/plans/launch/findings/compliance.md` (3.1, 3.2). Not legal advice. The
owner reviews and signs off. Art 30(5) does not exempt this service (processing is not occasional and involves children).

## To complete

- [ ] Controller name, address and contact (from the imprint settings: `NEXT_PUBLIC_OPERATOR_*`, `NEXT_PUBLIC_CONTACT_EMAIL`).
- [ ] Supabase project region and Vercel function region (not discoverable from the repo).
- [ ] Confirm each processor's data processing agreement is accepted (see `processors.md`).
- [ ] Confirm the retention periods are the ones actually enforced (see `retention-schedule.md`; no deletion job exists yet).
- [ ] Re-check against the account, age and consent features built in parallel (learner profiles, consents).
- [ ] Review once a year, and whenever a purpose, a processor or a data category changes.

## Controller

The individual named in the imprint (no company, no data protection officer, no representative needed for the EU).
Supervisory authority: Datenschutzbehoerde, Vienna.

## Activities

| # | Activity | Purpose | Data subjects | Data categories | Basis (Art 6) | Recipients | Third-country transfer | Retention |
|---|----------|---------|---------------|-----------------|---------------|------------|------------------------|-----------|
| 1 | Accounts and sign-in | Run the account | Parents, guardians, self-learners (16+) | Email, password hash, name or nickname, goal, daily minutes, approval status | Contract (b) | Supabase, Resend, Vercel | Possible (US providers) | Until deletion; 24 months inactive |
| 2 | Lessons and quizzes | Teach, score, schedule reviews | Children, learners | Concept mastery, review schedule, quiz answers incl. free text, feedback, misconceptions, course progress | Contract (b) | Supabase, Anthropic (text only), OpenAI (concept text only) | US | Until deletion; free-text answers 12 months |
| 3 | Learning profile | Adjust pace, depth, example style by fixed rules | Children, learners | Time per lesson part, clicks, accuracy; resulting four settings | Contract (b); parent can switch off | Supabase | Possible | Until deletion |
| 4 | Session logs | Compute the profile, diagnose | Children, learners | Time and click counts per lesson | Contract (b) / legitimate interest (f) | Supabase | Possible | 12 months |
| 5 | AI generation | Write lessons, pictures, models, narration | Learners (via topic text) | Concept or topic text, learner level bands, typed answers | Contract (b) | Anthropic, fal.ai, ElevenLabs | US | Provider-held, see processors.md |
| 6 | Cost and abuse control | Cap spend, detect abuse | All users | User id, feature, token counts, cost, request topic (to be removed), timestamps | Legitimate interest (f) | Supabase | Possible | 90 days target |
| 7 | Administrator audit log | Accountability for admin actions | Users acted on, admins | Actor email, target id, IP, user agent, before-values | Legitimate interest (f) | Supabase | Possible | 12 months target |
| 8 | Email | Sign-in confirmation, approval notices, admin notice | Account holders | Email, name | Contract (b) / (f) | Resend | US | Provider logs |
| 9 | Voice input (optional) | Let a learner speak an answer | Learners | Audio goes browser to browser vendor (Google in Chrome); the service receives text only. If server speech recognition is on: audio to OpenAI for transcription | Consent (a) of the parent for children | Browser vendor; OpenAI only if server mode | US | Not stored by the service |
| 10 | Custom teacher (optional) | Build a 3D avatar from photos | Learners | Face photos in the Avaturn window; resulting avatar URL stored | Consent (a) | Avaturn | Unknown | Until deletion |
| 11 | Payments (when offered) | Sell paid plans | Parents | Billing identity held by the payment provider; subscription status here | Contract (b), legal obligation (c) | Paddle | Possible | Tax law period |
| 12 | Hosting and logs | Serve the site | All visitors | IP, request logs | Legitimate interest (f) | Vercel, Supabase | Possible | Provider defaults |

## Technical and organisational measures

Row-level security on per-learner tables; service-role access limited to the operator through admin routes; no analytics or
tracking; encrypted transport; names and emails never sent to AI providers; breach procedure in `breach-runbook.md`.
Known gaps to close are listed in `findings/compliance.md` section 8 (no read audit for admins, no MFA visible for admin).
