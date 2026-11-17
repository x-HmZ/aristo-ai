# Personal data breach runbook

Status: DRAFT for the owner. One page to follow under stress. Not legal advice.

## To complete

- [ ] Name a backup person who can act if the owner is unreachable.
- [ ] Check the current notification route and form on dsb.gv.at and paste the link here.
- [ ] Decide who writes to affected parents (template below) and from which address.
- [ ] Keep an incident log file outside the repository.

## The rule

A personal data breach is a security incident that destroys, loses, alters or exposes personal data, or gives someone
unauthorised access (a leaked service key, a wrongly open database policy, a misdirected email, a lost laptop with a session).

- Notify the supervisory authority (Datenschutzbehoerde, dsb.gv.at) **within 72 hours of becoming aware**, unless the breach is
  unlikely to risk people's rights and freedoms (GDPR Art 33). If you cannot give all details in time, notify what you know
  and add the rest later.
- Tell the affected people (the parents) **without undue delay** when the risk is high (Art 34). Children's data counts as
  higher risk by default.
- Record every breach, including those you do not report, with facts, effects and actions (Art 33(5)).
- Processors must tell you without undue delay; their notice starts your clock when you become aware.

## Steps

1. **Contain (first hour).** Rotate the exposed secret (Supabase service role key, Anthropic, OpenAI, fal, ElevenLabs, Resend,
   Paddle keys in Vercel), revoke sessions, close the open policy or route, take the feature offline if needed. Do not delete
   evidence: keep logs.
2. **Write down the time you became aware** and what you know: what, when, how many people, which data, whether children are
   among them.
3. **Assess the risk**: could identity, learning records or typed text be used to harm someone? Was data encrypted or only
   unreadable to the attacker? Is it still exposed?
4. **Notify the DSB within 72 hours** with: nature of the breach and approximate number of people and records; the contact
   address (the one in the imprint); likely consequences; measures taken or planned.
5. **Notify affected parents** if risk is high: plain words, what happened, what data, what you did, what they can do (change
   password), how to reach you.
6. **Notify providers** if their systems are involved, and Anthropic or another AI provider if its terms ask for it.
7. **Fix and learn**: root cause, a regression test or check, update `records-of-processing.md` and the DPIA.

## Parent message (template)

Subject: A security incident at Aristo

On [date] we found that [what happened]. It affected [data] of [number or "some"] accounts, including [your child's]. We
[what was done]. You do not need to do anything / Please [action]. We have told the data protection authority. Questions:
[contact address].

## Log entry fields

Date and time aware, who found it, description, data and people affected, children involved (yes/no), containment actions,
risk assessment, DSB notified (when, reference), parents notified (when), providers notified, root cause, follow-ups.
