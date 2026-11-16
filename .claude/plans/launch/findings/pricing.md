# Aristo AI: plans and pricing (research and design, 2026-11-16)

Desk research only. No code changed, no paid API called, no personal detail used in a query. Every market number carries a URL. Marking: **CONFIRMED** = read on the provider's own page today (2026-11-16). **UNCONFIRMED** = only seen on a third-party site, an app-store crawl, a search snippet, or a forecast; do not quote it to anyone. Unit costs come from `findings/product-cost.md` Part 2 and are in USD; the ElevenLabs rate is still the open parameter `r` (USD per 1,000 characters; base case 0.11, range 0.05 to 0.22, all ASSUMPTION). Currency assumption: 1 EUR = 1.10 USD. EU consumer prices are VAT-inclusive (Austria 20%), US prices are before sales tax; the merchant of record (MoR) adds and remits tax.

---

## 0. One-page summary

**Who pays.** Parents of 10 to 15 year olds are the only segment that can pay within six months with no company and no sales process. They compare against human help (Austria: a Nachhilfe franchise is about 129 to 224 EUR a month, AK survey says families spend 720 EUR per child per year on it) and against cheap apps (Khanmigo 4 USD a month, education-app median 9.99 USD a month). Schools, universities and companies pay per seat but need a contract, a data-processing agreement, an invoice, and (for schools) a legal answer on the EU AI Act. A solo founder with no legal entity cannot honestly sell to them in the next six months, but can run free design-partner pilots.

**Recommended plans (launch order).**

| Plan | Price (monthly / annual) | Status |
|---|---|---|
| Free | 0 | launch (already decided: catalogue replays free, 2 fresh lessons, 15 chat turns, no 3D) |
| **Plus** (parent account, up to 3 learners, parent dashboard) | **10.99 EUR (VAT incl.) or 10.99 USD per month; 99 EUR / 99 USD per year** | **the one plan to launch first** |
| Pro (higher caps, 3 on-demand 3D models) | 19.99 / 199 | later, after three months of usage data |
| Organisation, education seat (min 10 seats) | 5 USD per seat per month on annual billing (60 / 48 / 36 per seat per year by volume) | "contact us" waitlist, free pilots only |
| Organisation, business or university seat (min 5 seats) | 12 USD per seat per month on annual billing (144 per year) | "contact us" |

**Margins (Plus, monthly billing, USD, after the 5% + 0.50 USD fee, 0.20 USD overhead included, voice cached).** Light 84%, typical 66%, heavy at the fair-use cap 21%. Loses money only if a user exceeds about 6 fresh lessons a month on top of the other caps, or if the real voice rate is above about 0.20 USD per 1,000 characters at cap. **Without the server-side audio cache the plan loses money at typical usage**, so the cache is a hard prerequisite.

**Three things to settle before the price is final.** (1) The real ElevenLabs rate. (2) Whether Paddle's standard 5% + 0.50 USD applies to a product priced under 10 USD: Paddle's own page says products under 10 USD should "contact us for bespoke pricing" (CONFIRMED), so Plus is priced above 10 USD on purpose. (3) Whether parents of 11 to 14 year olds want Python at all; the onboarding content is Python while the pitch is school subjects (product-cost.md 1.3). Price tests mean little until that is answered.

**Org plan timing.** Do not open it at launch. Build the org tables and the DPA pack during months 2 to 4, run 2 or 3 free pilots with tutoring centres or small training companies, and sell the first paid seat only after the owner's legal status, a written AI Act scoping opinion, and the quota and audio-cache work are done (realistically month 6 to 9). Part D has the plain version.

---

## Part A. Market evidence

All prices as seen 2026-11-16. "Seen on" gives the page.

### A1. AI tutors and study products

| Product | Price and packaging | Status | URL |
|---|---|---|---|
| Khanmigo, learner and parent | 4 USD/month or 44 USD/year; parent plan same price, links children, shows chat history, moderation alerts | CONFIRMED | https://www.khanmigo.ai/pricing |
| Khanmigo, teachers | Free | CONFIRMED | https://www.khanmigo.ai/pricing |
| Khan Academy Districts (includes Khanmigo features) | Enterprise Starter 10 USD per student per year for 1,000 or fewer student licences; Enterprise above 1,000 by demo, price not listed | CONFIRMED | https://www.khanacademy.org/schools/pricing |
| Khan, Oklahoma 2026-27 | 2 USD (member districts) or 5 USD per non-member district student, limited-time, previous year 3 USD | Official blog, read via search snippet only: treat as CONFIRMED-by-snippet | https://blog.khanacademy.org/oklahoma-districts-invited-to-join-ai-powered-learning-initiative-backed-by-local-philanthropy/ |
| Khan older district partnership | 10 USD per student without Khanmigo, 15 USD with, 250 student minimum, US only | UNCONFIRMED (old post, page 612 days old) | https://blog.khanacademy.org/becoming-a-khan-academy-districts-partner/ |
| Synthesis Tutor (maths, K-5, AI plus game) | Family plan up to 7 children: 29 USD/month or 119 USD/year (about 9.92/month). Starter 119 USD/year; Pro 239 USD/year; Live 480 USD/month with six human-tutor sessions; 7-day trial; schools by contact | CONFIRMED (page fetch). A search snippet claimed 45 USD/month individual and 348 USD/year: conflicts, ignore | https://www.synthesis.com/pricing |
| Duolingo Super family / Max | Super family about 119.99 USD/year (6 users); Max about 29.99/month or 168/year, Max family about 240/year | UNCONFIRMED (resale and guide sites; Duolingo pages fetched showed no price) | https://duolingoguides.com/duolingo-max-family-plan-price/ |
| Brilliant | Provider help page says plans exist (monthly, annual, family up to 6) but states no figure. Third-party: about 24.99/month, about 149.99/year, family about 299.99/year | UNCONFIRMED | https://brilliant.org/help/pricing-and-plans/how-much-does-brilliant-premium-cost/ |
| IXL family | Third-party: 9.95/month or 79/year for one subject, 15.95/129 for two, 19.95/159 for all core, extra child about 4/month. An Irish IXL page title reads "Starting at 9.95 EUR/mo" | UNCONFIRMED (the IXL page itself failed to load) | https://ie.ixl.com/membership/family , https://www.thepricer.org/how-much-does-ixl-cost/ |
| Quizlet Plus | 7.99/month or 35.99/year; Plus Unlimited 9.99/month or 44.99/year | UNCONFIRMED (aggregator checked 2026-09-08) | https://www.mindomax.com/quizlet-plus-cost |
| Photomath Plus / Gauth Plus | Photomath about 59.99 to 69.99/year; Gauth Plus 11.99/month, 99.99/year | UNCONFIRMED | https://www.myengineeringbuddy.com/blog/photomath-reviews-alternatives-pricing-offerings/ |
| Praktika (avatar AI language tutor) | App-store crawl: 1-year plan 99.99 to 139.99 USD; "about 8 USD/month" is marketing | UNCONFIRMED | https://intercom.help/praktika-ai/en/articles/11684862-what-subscription-plans-does-praktika-offer-and-what-is-included-in-the-paid-plan |
| Speak | about 20 USD/month per a comparison blog | UNCONFIRMED | https://speakshark.com/blog/speak-app-pricing-per-month-2026 |
| Outschool (live small-group classes) | Outschool teacher guidance: average about 18 USD per class hour, advice 18 to 21 USD per learner per hour, 1-on-1 minimum 30 USD/hour; a 120 USD/month credit tier exists | UNCONFIRMED (teacher guidance seen via snippet; credit tier from a pricing page snippet) | https://outschool.com/educators/handbook/refining-your-pricing-strategy-confidently-charge-what-youre-worth |

Free general assistants (the "free" anchor a parent can reach today):
- ChatGPT study mode: reported free for logged-in users, announced as available in Free, Plus, Pro, Team. UNCONFIRMED (OpenAI page returned 403; secondary guides). https://www.joinleland.com/library/a/chatgpt-free-for-students
- Gemini: the Gemini app is a core Workspace for Education service at no extra charge, available to students under 18 with stricter policies; admin can switch it off. UNCONFIRMED (Google blog and trade press via snippet). https://blog.google/outreach-initiatives/education/gemini-iste-2025/
- Claude for Education: no public per-seat price; access is through the institution. UNCONFIRMED. https://upcea.edu/ai-companies-roll-out-educational-tools

Read: the free assistants make "an AI you can ask" worth zero. What is left to charge for is structure (the five-phase lesson, mastery, review schedule, narration, a parent view) and trust for children. Khanmigo at 4 USD is the price ceiling anyone will compare against on "AI tutor for a child"; Synthesis at 119 USD/year and IXL at 79 to 159 USD/year show families pay 100 to 160 USD a year for a structured product with a progress view.

### A2. Coding for kids

| Product | Price | Status | URL |
|---|---|---|---|
| Tynker (home) | Quarterly 18 EUR/month (54 EUR per 3 months, listed as 40% off 30); yearly 15 EUR/month (180 EUR/year, 40% off 25); lifetime 468 EUR | CONFIRMED (EUR localised page) | https://www.tynker.com/parents/pricing |
| Codecademy | Plus 14.99 EUR/month annual or 29.99 monthly; Pro 17.99 annual or 35.99 monthly | CONFIRMED (EUR localised page) | https://www.codecademy.com/pricing |
| Mimo | Free, Pro (mobile), Max (web, mobile, AI tutor, certificates); 7-day trial on yearly only; page shows no figure | CONFIRMED structure, price not shown | https://mimo.org/pricing |
| CodeCombat | about 9.99/month or lifetime 99 (one review site; G2 says no price given) | UNCONFIRMED | https://www.myengineeringbuddy.com/blog/?p=2744 |

Read: a parent buying "learn Python" compares with 15 to 18 EUR/month (Tynker, Codecademy), so 10.99 EUR for Plus with tutoring and a parent view is inside the range, not above it.

### A3. Human tutoring (the anchor)

| Market | Figure | Status | URL |
|---|---|---|---|
| Austria, usage | 338,000 pupils (32%) get paid Nachhilfe; average family spend 720 EUR per child per year (down from 800); 144 million EUR total; use is increasingly short bursts before tests | AK Wien Nachhilfebarometer 2026, read through a search summary | https://wien.arbeiterkammer.at/service/presse/Nachhilfebarometer_2026.pdf |
| Austria, hourly | Old AK Vienna survey: private tutors 12 to 33 EUR per hour on average (year unclear) | UNCONFIRMED, old | https://www.vienna.at/nachhilfe-sauteuer-und-wirkt-nicht-immer/2122676 |
| Germany, institutes | Schuelerhilfe is franchised, no central list. Branch sheets: 1-on-1 once a week 129 EUR/month (Luedenscheid, April 2024), 149 to 159 EUR/month (Rathenow 2023, Wetter), small group 3 x 90 min 199 EUR/month, registration fee 49 to 59 EUR | Branch PDFs, dated 2023-24 | https://www.schuelerhilfe.de/fileadmin/Franchisenehmer-Standorte/sascha.schmidt/luedenscheid/A4_Preisliste_Luedenscheid_Apr24.pdf |
| UK | median private tuition 20 GBP/hour in person (FindTutors, about 38,600 listings); most tutors 25 to 45 GBP/hour (listings aggregate); 11+ tutors 28 to 55 GBP | UNCONFIRMED (vendor blogs) | https://www.findtutors.co.uk/blog/tutoring-cost-statistics |
| US | 27 to 55 USD/hour online, 35 to 68 in person for K-12 core (guide, July 2026); big cities 50 to 100 | UNCONFIRMED | https://www.wise.live/blog/?p=3774 |

Read: the parent's real comparison is 129 to 224 EUR a month for an institute, or about 60 EUR a month averaged over the year (720 EUR). A tool at 10.99 EUR is one twelfth to one twentieth of that. Do not claim it replaces a tutor (it does not, and the AI Act and consumer-law wording would suffer); position it as the practice between lessons and the cheap first step.

### A4. School, district, university and corporate seat pricing

| Item | Figure | Status | URL |
|---|---|---|---|
| Khan Districts | 10 USD per student per year starter (above) | CONFIRMED | https://www.khanacademy.org/schools/pricing |
| Generic district classroom software | planning estimate 45 to 95 USD per student per year across all tools (target 60 to 75); adaptive maths vendor list 6 to 15 USD per student per month by enrolment tier; "AI tutoring 5 to 15 USD per student per year" is a vendor marketing claim | UNCONFIRMED (blogs, forecast) | https://www.listedtech.com/blog/average-software-budget/ , https://ibl.ai/blog/ai-cost-math-for-k12-districts-per-seat-vs-usage |
| Eedi (UK maths) | has its own UK price page | not read | https://eedi.com/eedi-math-pricing |
| Corporate learning libraries | Coursera for Business Team 399 USD per user per year (2 to 499 users, varies by source); LinkedIn Learning Teams about 379.88 per user per year (2 to 20 users); Udemy Business Team 360 per user per year (2 to 20 users); aggregator range for Udemy enterprise 240 to 600; multi-year about 15 to 25% lower | UNCONFIRMED (aggregators) | https://trainingcost.com/lms-pricing/coursera-business , https://trainingcost.com/lms-pricing/linkedin-learning , https://trainingcost.com/lms-pricing/udemy-business |
| Austrian public procurement | Direct award for supplies and services up to 140,000 EUR net for classic contracting authorities (value moved into the Bundesvergabegesetz from 1 March 2026; the 2025 value was 143,000) | WKO via search summary | https://www.wko.at/wirtschaftsrecht/highlights-vergaberechtsgesetz-2026 |
| Edtech utilisation | consultancy argues price per active student, not per licence, is what buyers should look at (example 65 USD nominal vs 180 USD per active) | UNCONFIRMED, illustrative | https://www.listedtech.com/blog/average-software-budget/ |

Typical minimums and pilots: Khan publishes a 250-licence minimum in an old post (UNCONFIRMED) and a 1,000-seat Starter ceiling (CONFIRMED). Free or subsidised state pilots exist (a New Hampshire statewide free Khanmigo programme funded to July 2025, per Khan's blog; UNCONFIRMED whether it continues). I found no hard public source for "typical pilot length"; common practice is a one-term free or paid pilot before a school-year licence (general knowledge, not sourced).

The important consequence for Aristo: **a Khan-level school price (10 USD per student per year, or 2 to 5 USD in subsidised states) is below Aristo's own cost at typical usage** (see C5: 10 to 25 USD per seat per year of provider cost). Aristo cannot win schools on price against a nonprofit; it can only win on a niche (Python and open-textbook subjects with a 3D teacher) with pooled usage caps and a price of at least about 36 to 60 USD per seat per year.

### A5. Willingness to pay and subscription benchmarks

| Evidence | Figure | Status | URL |
|---|---|---|---|
| Education category price medians | yearly median 44.99 USD (highest of all categories), monthly median 9.99 USD | RevenueCat 2026 education report, read from the vendor page | https://www.revenuecat.com/state-of-subscription-apps-2026-education |
| Annual share | education is among categories favouring annual plans, 59 to 66% of subscriptions sold (exact education value not shown) | same page | same |
| Funnel | download-to-trial 6.5% median (D30); download-to-paid top categories 2.6 to 2.9% (education exact figure not shown; do not assume 2.9) | same page | same |
| Trials | 50.3% of education trials are 5 to 9 days; over half of trial cancellations happen on day one (all categories) | same page; 9to5mac for the second | https://9to5mac.com/?p=1053652 |
| Annual reactivation | only about 5% of users who cancel an annual plan come back vs about 4x as often for monthly | secondary coverage | https://news.lavx.hu/article/annual-app-subscribers-almost-never-return-after-canceling-new-revenuecat-report-shows |
| Paywall vs freemium | paywalled apps convert about 6x better than freemium, retention near identical | secondary coverage | https://9to5mac.com/?p=1042212 |
| Hard to monetise | education is among the categories hardest for new apps to reach revenue thresholds | secondary coverage | https://9to5mac.com/?p=1042212 |
| Parents and AI | study of 2,000+ parents (US, UK, Canada): willingness to pay for a child's AI subscription rose by over 60% when told more peers use AI; risk warnings did not reduce it | secondhand, check the paper | https://phys.org/archive/06-08-2026/ |

I found **no** credible published figure for family-plan uptake share or free-to-paid conversion specific to children's education apps. Treat any 2 to 5% free-to-paid assumption as a hypothesis to measure, not a fact. Practical reading: price annual plans at about 8 to 9 months of monthly (education buyers already pick annual), expect small conversion, and keep free-user cost near 0.30 USD a month so that a low conversion is survivable.

---

## Part B. Segments

Short form first, detail below.

| Segment | Can pay | Realistic in 6 months without a company |
|---|---|---|
| Parents of 10-15 (EU, US) | Yes, 5 to 15 EUR/month | Yes, via MoR (after the owner's own legal clearance) |
| Self-directed teens (14 to 17) and adults | Low to medium, 5 to 10; a teen rarely owns a card; adults compare with Codecademy, Mimo, free AI | Yes, same plan, secondary |
| Private tutors, small tutoring centres | 5 to 12 per seat, 50 to 300 EUR/month per centre | Pilot only; paid needs org tables and an invoice route |
| Schools, public and private | 10 to 60 per student per year, budget holder is not the teacher | No (as a paid sale). Free pilot with a private school or a teacher yes |
| Universities | per-seat or site licence, long process, Annex III exposure | No |
| Companies | 10 to 15 per seat per month for narrow content; real money needs a bigger catalogue | No for 6 months; maybe a small bootcamp or a friendly firm as a pilot |

### B1. Parents of 10 to 15 year olds
- **Job:** "Help my child keep up and understand, between school and, or instead of, Nachhilfe; show me it is happening."
- **Alternatives:** school homework help, YouTube, free ChatGPT or Gemini, Khanmigo (4 USD), IXL, a human tutor (Austria about 129 to 224 EUR a month at an institute, AK family average 720 EUR per child per year; US 27 to 68 USD an hour).
- **Ability and willingness:** the parent already pays; 720 EUR a year shows the budget exists. They will not pay more than a known app for an unknown brand without a trial. A parent of a 6th to 8th grader will check "is it safe for my child" before price.
- **Buying process:** impulse to 2-week research; trial then card; annual if trust is built. Under 16 the account is the parent's (decision D2) so the parent is the only buyer, which helps: no teen payment problem.
- **Realistic:** yes. Constraint is legal (owner may not sell yet) and content (Python vs school subjects).

### B2. Self-directed teens and adults
- **Job:** learn Python or a topic on my own, with structure and review.
- **Alternatives:** Codecademy (14.99 to 17.99 EUR/month, CONFIRMED), Mimo, Brilliant (UNCONFIRMED about 150/year), free AI assistants, freeCodeCamp.
- **WTP:** low; adults accept 10 to 15 USD a month when there is a certificate or a job outcome, which Aristo does not have. Teens 14+ in Austria can consent to data processing themselves but still rarely pay.
- **Process:** self-serve card.
- **Realistic:** yes, same Plus plan, no extra work, but not a target segment for price setting.

### B3. Private tutors and small tutoring centres
- **Job:** "Give my students practice between sessions and show me who did what; save me preparing worksheets."
- **Alternative:** worksheets, Anton-style free apps, Moodle or Google Classroom, nothing.
- **WTP:** a tutor earning 25 to 40 EUR an hour will pay 5 to 10 EUR per active student per month if it saves one hour of prep a month. A centre with 50 to 300 pupils at 129+ EUR each can afford it; the decision-maker is the owner, who decides in days.
- **Process:** a call, a trial with 3 pupils, invoice or card. No procurement, no tender.
- **Realistic:** the best org-plan customer and the only one a solo founder can win; needs org tables, DPA text and an invoice route (an individual tutor can use the MoR card checkout; a centre will ask for an invoice).

### B4. Schools
- **Job:** the teacher wants differentiated practice and less marking; the school must also prove data protection and avoid any grading by AI.
- **Alternatives:** Khanmigo (free for teachers, 10 USD per student district), IXL, Moodle, Google Gemini inside Workspace for Education at no extra charge (UNCONFIRMED but widely reported), Microsoft Copilot inside existing licences.
- **Ability and willingness:** the budget holder is the school maintainer or district, not the teacher; a teacher can only pilot free. WTP per student is 10 to 60 USD a year for a niche tool and drops fast against a free Gemini and a 10 USD Khanmigo.
- **Buying process:**
  - Austria and Germany (general knowledge, not sourced): the school head and maintainer (Austria: Gemeinde for compulsory schools, Bund for AHS; Germany: Schultraeger and Land) decide; the data protection officer of the Bildungsdirektion or the Land reviews cloud tools; a DPA under GDPR Art. 28 is a precondition (the Austrian ministry's own materials list Art. 28 and Art. 26 agreements and a consent template: https://digitaleslernen.oead.at/fileadmin/Dokumente/digitaleslernen.oead.at/News/Powerpoint_Folien/Folien_Organisatorisch_rechtliche_Rahmenbedingungen_Menzel.pdf). Small buys fall under the direct-award ceiling (140,000 EUR net) but still need quotes, an invoice, and often a Bildungsdirektion approval list. Lead time: one school term to a school year.
  - US and UK (general knowledge): district RFP or pilot, a signed student-data privacy agreement, FERPA and COPPA statements, SSO via Google or Clever, rostering, accessibility (VPAT, WCAG 2.1 AA), purchase order and W-9 or UK equivalents. Lead time: 3 to 9 months, with the budget cycle in spring.
  - Both: accessibility statement, uptime, a named security contact, a security questionnaire.
- **Realistic:** not as a paid sale. A free pilot with a friendly teacher who brings 20 to 30 children under their own parent accounts is fine in the consumer model (no school data processing).

### B5. Universities
- **Job:** supplement for self-paced Python or STEM; Claude for Education, ChatGPT, Gemini already pushed to them for free or at institution price.
- **WTP:** site licence per student per year is low; the process is a tender or a department budget.
- **Realistic:** no. Also the most direct fit to AI Act Annex III 3(b) (see D2).

### B6. Companies
- **Job:** onboarding or upskilling juniors in Python or other open-textbook subjects, with progress reporting.
- **Alternatives:** Coursera Team 399 per user per year, LinkedIn Learning about 380, Udemy Business 360 (all UNCONFIRMED aggregators), Codecademy Pro.
- **WTP:** 10 to 15 USD per seat per month for a narrow library; these suppliers sell thousands of courses, Aristo sells one subject.
- **Process:** manager or L&D budget, security questionnaire, SSO, invoice, 30 to 90 days.
- **Realistic:** no sale in 6 months; one friendly pilot at most.

---

## Part C. Recommended plans

### C1. Plan table

Prices: EUR is VAT-inclusive, USD is before sales tax. "FL" = fresh lesson (generated, not served from cache). Voice is counted in characters; about 3,700 characters is one lesson's narration (measured, product-cost.md 2.1), roughly 4 minutes of speech at 150 words per minute (ASSUMPTION).

| | Free | **Plus (launch)** | Pro (later) | Organisation, education seat | Organisation, business or university seat |
|---|---|---|---|---|---|
| Price per month | 0 | 10.99 EUR / 10.99 USD | 19.99 EUR / 19.99 USD | 5 USD per seat on annual billing | 12 USD per seat on annual billing |
| Price per year | 0 | 99 EUR / 99 USD | 199 EUR / 199 USD | 60 USD per seat (10 to 49 seats), 48 (50 to 199), 36 (200 to 999), 1,000+ contact | 144 USD per seat (5 to 49), 120 (50 to 199), 100 (200+) |
| Minimum | none | none | none | 10 seats (600 USD per year) | 5 seats (720 USD per year) |
| Learner profiles | 1 | up to 3 | up to 5 | one per seat | one per seat |
| Parent or admin view | basic progress | parent dashboard (progress, time, weak concepts, review due) | same | org admin dashboard (C4) | same |
| Catalogue replays | unlimited, cap 30 plays/month | cap 100 plays/month | 150 | 40 per seat per month, pooled | 40, pooled |
| Fresh lessons per month | 2 (reduced form: 3 visuals max, no widget) | 4 | 8 | pooled 0.5 per seat for org-uploaded material | pooled 0.5 per seat |
| Chat turns per month | 15 | 150 | 300 | 100 per seat, pooled | 100 per seat, pooled |
| Voice | catalogue audio from cache; fresh lessons on browser voice | catalogue audio and fresh-lesson narration included (3,700 chars per FL); plus 8,000 characters of chat voice | plus 15,000 characters | catalogue audio cache only plus FL narration inside the pooled allowance | same |
| 3D generation | none (pre-generated catalogue models can be viewed) | none on demand; pre-generated catalogue models viewable | 3 on-demand models per month | none | none |
| Interactive widgets | catalogue only | in fresh lessons | in fresh lessons | catalogue and org lessons | same |

Rules for "fair use": the caps above are hard counters in the product's own units, shown to the user ("2 of 4 custom lessons left"). Over a cap the app does not break: catalogue lessons keep working, fresh generation shows a clear message. A pooled organisation cap means one heavy student cannot ruin the seat economics.

### C2. Arithmetic: Plus

Per account per month. Unit costs (product-cost.md Part 2, USD): fresh lesson before voice 0.55 (average of 0.45 widget shape and 0.85 physical shape with 3D; 3D is not on demand here so the physical shape is about 0.55 without the 0.30 Tripo click), voice 0.41 per FL at r = 0.11 (3.7 x 0.11), so **FL = 0.96**. Cached replay with audio cached = 0.02. Chat turn text = 0.006. Chat voice = 0.11 per 1,000 characters. Overhead (storage, database, email, not in the code) 0.20 per account: ASSUMPTION.

| Usage level | FL | Replays | Chat turns | Chat voice chars | Cost arithmetic | Provider cost |
|---|---|---|---|---|---|---|
| Light | 1 | 10 | 20 | 1,000 | 0.96 + 0.20 + 0.12 + 0.11 + 0.20 | **1.59** |
| Typical | 2 | 25 | 60 | 4,000 | 1.92 + 0.50 + 0.36 + 0.44 + 0.20 | **3.42** |
| Heavy, at the caps | 4 | 100 | 150 | 8,000 | 3.84 + 2.00 + 0.90 + 0.88 + 0.20 | **7.82** |

Revenue after the MoR fee (5% + 0.50 USD per transaction, CONFIRMED https://www.paddle.com/pricing):

| Billing | Net per month | Light margin | Typical margin | Heavy margin |
|---|---|---|---|---|
| 10.99 USD monthly: 10.99 - 0.55 - 0.50 = **9.94** | 9.94 | (9.94 - 1.59)/9.94 = **84%** | (9.94 - 3.42)/9.94 = **66%** | (9.94 - 7.82)/9.94 = **21%** |
| 10.99 EUR monthly, Austrian VAT 20%: ex VAT 9.16 EUR = 10.07 USD; fee on the 12.09 USD charge = 0.60 + 0.50 = 1.10; net **8.97** (fee base on gross is an assumption: unconfirmed whether Paddle charges it on the tax-inclusive total) | 8.97 | 82% | 62% | 13% |
| 99 USD annual: fee 4.95 + 0.50 = 5.45; net 93.55 = **7.80 per month** | 7.80 | 80% | 56% | **-0.3%** |
| 99 EUR annual: ex VAT 82.5 EUR = 90.75 USD; fee on 108.9 USD = 5.95; net 84.80 = **7.07 per month** | 7.07 | 78% | 52% | **-11%** |

Blended (25% light, 60% typical, 15% heavy; ASSUMPTION): cost 0.25 x 1.59 + 0.60 x 3.42 + 0.15 x 7.82 = 3.62; margin on the 9.94 net = **64%**; on the 7.80 annual net = 54%; on EU annual 7.07 = 49%.

**Where Plus loses money (monthly 9.94 net):**
- More than **6 fresh lessons** a month with every other cap full: other cap cost 7.82 - 3.84 = 3.98; (9.94 - 3.98)/0.96 = 6.2. The cap of 4 sits below this.
- Voice rate: cost at cap = 5.30 + 22.8 r (4 FL x (0.55 + 3.7 r) + 2.00 + 0.90 + 8 r + 0.20); equals 9.94 at **r = 0.20 per 1,000 characters**. At r = 0.22 (a 1-credit model) the cap case loses money (about 10.3 vs 9.94). On annual billing the break-even r is about 0.10.
- **No audio cache:** every replay pays 3.7 x 0.11 = 0.41 extra: typical 25 replays add 10.2 and the plan loses money at 25 replays a month. This is the single hard dependency.
- Without the shared cache for catalogue concepts (profile signature fragmenting, product-cost.md B3), "replays" become fresh lessons and everything above fails.

### C3. Arithmetic: Pro (later) and the price-test variants

Pro 19.99 USD per month: net 0.95 x 19.99 - 0.50 = **18.49**. Cost at the Pro caps: light (2 FL, 10 replays, 30 chat, 2k voice chars, no 3D) = 1.92 + 0.20 + 0.18 + 0.22 + 0.20 = 2.72; typical (4 FL, 40 replays, 100 chat, 6k chars, 1 model at 0.41 average of 0.30 and 0.52) = 3.84 + 0.80 + 0.60 + 0.66 + 0.41 + 0.20 = 6.51; at cap (8 FL, 150 replays, 300 chat, 15k chars, 3 models) = 7.68 + 3.00 + 1.80 + 1.65 + 1.23 + 0.20 = 15.56. Margins: **85% / 65% / 16%**. Loses money at more than **11 fresh lessons** with the other caps full ((18.49 - 7.88)/0.96 = 11.05). Do not launch Pro until data shows who hits the Plus caps.

Plus at the three test prices (monthly, USD, net after fee, margins on the same cost levels):

| Price | Net | Light | Typical | Heavy |
|---|---|---|---|---|
| A. 8.99 (EUR 7.99 is the matching test value; under 10 USD so Paddle bespoke pricing may apply, UNCONFIRMED) | 8.04 | 80% | 57% | 3% |
| B. 10.99 | 9.94 | 84% | 66% | 21% |
| C. 14.99 | 13.74 | 88% | 75% | 43% |

### C4. Free plan check

Worst case per user per month about 0.95 USD (product-cost.md 2.6 Design 1, voice pre-rendered), typical about 0.30, light about 0.10 (ASSUMPTION for typical and light). If 3% of free users convert (hypothesis, no benchmark found), one payer carries about 33 free users; at 0.30 a month for 3 months each that is about 30 USD of free-tier cost per payer, repaid by about 5 months of typical Plus margin (6.5 per month: 9.94 - 3.42). Survivable, not generous: do not widen the free caps before conversion is measured.

### C5. Arithmetic: Organisation

Per seat per month, all caps pooled across the organisation. Costs: replay 0.02, chat turn 0.006, FL 0.96, overhead 0.20.

| Usage | Replays | Chat | Org FL per seat | Cost arithmetic | Per month | Per year |
|---|---|---|---|---|---|---|
| Light | 4 | 8 | 0.1 | 0.08 + 0.05 + 0.096 + 0.20 | 0.43 | 5.16 |
| Typical | 12 | 30 | 0.25 | 0.24 + 0.18 + 0.24 + 0.20 | 0.86 | 10.32 |
| At the pooled cap | 40 | 100 | 0.5 | 0.80 + 0.60 + 0.48 + 0.20 | 2.08 | 24.96 |

Revenue per seat per year after the fee at the smallest deal in each tier (fee 5% + 0.50 USD per invoice; **unconfirmed whether Paddle's invoicing uses this rate**: Paddle's page lists invoicing as an extra service with no price, CONFIRMED that it is not in the base rate):

| Tier | Deal | Fee | Net per seat per year | Margin light / typical / at cap |
|---|---|---|---|---|
| Education 10 to 49 seats at 60 | 10 seats = 600 | 30.50 | 56.95 | 91% / 82% / 56% |
| Education 50 to 199 at 48 | 50 seats = 2,400 | 120.50 | 45.59 | 89% / 77% / 45% |
| Education 200 to 999 at 36 | 200 seats = 7,200 | 360.50 | 34.20 | 85% / 70% / 27% |
| Business 5 to 49 at 144 | 5 seats = 720 | 36.50 | 136.70 | 96% / 92% / 82% |

**Where the Organisation plan loses money:** pooled org-generated fresh lessons above about **3.3 per seat per month** at 60 USD, **2.2** at 48, **1.3** at 36 (remaining margin after the other caps, 1.60 per seat per month, divided by 0.96): for example 36 USD tier: net 34.20 / 12 = 2.85, minus 1.60 = 1.25, divided by 0.96 = 1.3. The pooled cap of 0.5 is far below. It also loses money if an organisation pays Khan-level prices: at 10 USD per seat per year the net is below even typical cost (10.32).

Why the school price is not lower: the best published public price (Khan, 10 USD per student per year, CONFIRMED) is a nonprofit subsidy. Aristo's cost per active seat is 5 to 25 USD per year. A school seat below 36 USD is a loss at the pooled cap.

### C6. What "organisation admin" can do, and what stays owner-only

Organisation admin (new role `org_admin`, scoped to one organisation id):
- invite members by email or link, remove or suspend, reassign seats between people, see seats used versus bought;
- assign courses or catalogue tracks to groups or the whole organisation, set due dates;
- see progress: per member activity, time, lessons completed and quiz results; mastery and weak-concept views only if the AI Act scoping in D2 allows it (see below);
- export data (CSV of progress, per-member data export for a data-subject request);
- upload the organisation's own PDFs as course material; they generate lessons visible only inside the organisation, counted against the pooled fresh-lesson allowance; the admin confirms the organisation holds the rights; documents are stored per organisation and removed on request or contract end;
- see its own usage against the pooled caps.

Stays owner-only platform admin (existing `/admin`): global knowledge graph and catalogue editing, lesson cache, moderation queue and misconception data across all users, cost and spend pages, audit log, plan and entitlement overrides, kill switch, provider keys, user suspension across the platform, impersonation. An org admin never sees another organisation, never sees cost data, and by default does not read a learner's free-chat transcript (child-safety and privacy default; make it a contract option, not a default).

### C7. What must be true technically before each plan can be sold

| Plan | Must exist first |
|---|---|
| Free | Entitlement guard (L07) replaces the approval gate; spend guard and attribution (L04); counters idempotent per user, concept and day; catalogue with pre-rendered audio (L08); shared lesson signature for free users; cap messages in the UI; error screens instead of an infinite "Loading your lesson" (A5) |
| **Plus** | All of Free, plus: **server-side audio cache keyed by voice, model and text hash** (B1); quiz cache per concept (B2); per-user ElevenLabs usage logged with its real rate (A4); chat-voice character counter; parent-owned accounts with up to 3 learner profiles and a parent dashboard (L06); self-service cancel, delete and export; Paddle checkout and webhook with `BILLING_ENABLED` off by default (L13); legal pages and consumer withdrawal wording (L09); the real ElevenLabs rate known |
| Pro | Plus, plus on-demand 3D generation behind a counter with visible failures (Tripo 0.30 to 0.52 each), higher quota tiers in the entitlement table |
| Organisation | `organizations`, `memberships` (role: org_admin, member), `seats`, `org_courses`, `org_documents` with row-level security so no row crosses an organisation; org-scoped retrieval (RAG isolation); pooled counters; admin UI (invite, remove, assign, progress, export, PDF upload); DPA template and sub-processor list; invoice route (D4); support process; legal answer on AI Act scoping; an owner who is allowed to sell to businesses |

### C8. Launch recommendation

**Launch one plan: Plus at 10.99 EUR or USD per month, 99 per year, up to 3 learners, parent dashboard.** Reasons: it is the only plan whose buyer, price and payment route exist today; the parent owns the account anyway (D2), so the buyer is also the account owner; it needs no org tables; its margin is 64% blended and 21% at the caps; it sits between Khanmigo (4) and IXL or Codecademy (about 15 to 20) with a parent view and a 3D avatar that neither offers (claim is the owner's product claim, not a benchmark). Keep **Free** as already decided. Everything else is "contact us": Pro, any organisation seat, tutors and centres, schools, universities, companies. Show a single "For schools, tutors and companies: tell us about your group" form that stores a waiting-list entry with consent (L14).

One caveat to settle before launch: Plus sells a niche subject (Python). If the first thing a parent of an 11 to 14 year old finds is Python, willingness to pay will be measured against the wrong promise (product-cost.md 1.3, A7).

### C9. What to test with real parents before fixing a price

Ten parents of 10 to 15 year olds (the plan in L14), 15-minute calls with a working prototype or the demo, no price shown until question 6:
1. What do you pay for the child's learning today (Nachhilfe, apps, books) per month? Anchor to a real figure.
2. What would make you stop paying a tutor and use this instead, or use it between tutor sessions?
3. Is Python what you want, or maths and science? (Decides whether the price test is valid.)
4. Which would you pay for first: a parent dashboard, unlimited replays, new custom lessons, voice, 3D?
5. Would you buy per family or per child?
6. Van Westendorp four questions (too cheap, cheap, getting expensive, too expensive per month), then Gabor-Granger at the three price points below.
7. Monthly or annual; would a 7-day trial or a free allowance convince you? (RevenueCat: annual dominates in education; reactivation after annual cancel is only about 5%, so annual should be offered up front.)
8. Safety: what must be true before you let your child use a voice and chat? What would you do if told "the AI can be wrong"?
9. What do you expect to see in the parent view each week?

Three price points to test (monthly, annual):
- **A:** 7.99 EUR (8.99 USD) a month, 69 EUR (79 USD) a year. Check with Paddle first: under 10 USD may be bespoke.
- **B:** 10.99 EUR / USD a month, 99 a year. The recommended point.
- **C:** 14.99 EUR / USD a month, 139 a year (Synthesis family is 119 USD, IXL all subjects 159 USD, both UNCONFIRMED or CONFIRMED as listed in A1).

Decision rule: pick the highest price at which at least 5 of 10 say "reasonable" and the stated first-month intent stays; discard any price where heavy-user margin turns negative (A at annual).

---

## Part D. What changes when you sell to schools or companies

### D1. Operator becomes data processor
- For a school or company the organisation is the controller and Aristo the processor (GDPR Art. 28). Required: a data-processing agreement (instructions, confidentiality, security measures, sub-processor consent, assistance with data-subject requests, deletion or return at the end, audit rights).
- Sub-processor list, which today is: Supabase (database and auth), Vercel (hosting), Anthropic (lesson and chat generation), OpenAI (embeddings), fal.ai (images and 3D), ElevenLabs (voice), Resend (email). Most are US companies, so transfers need SCCs or an adequacy mechanism; a school data-protection officer will ask for EU hosting and the training opt-outs (compliance.md item 9). Without EU-region processing for the LLM, some Austrian and German schools will say no. Confirm the regions of each processor before promising anything.
- In the consumer product the parent is the controller's counterpart and Aristo is the controller; the consumer terms do not carry over.

### D2. EU AI Act, scoped
The regulation lists as high-risk, in Annex III point 3: "AI systems intended to be used to evaluate learning outcomes, including when those outcomes are used to steer the learning process of natural persons in educational and vocational training institutions at all levels" (point 3(b)); point 3(a) covers systems that determine access, admission or assignment to institutions, 3(c) assessing the appropriate level of education, 3(d) monitoring prohibited behaviour during tests. Text read at https://artificialintelligenceact.eu/annex/3/ (an unofficial reproduction; cross-check on EUR-Lex, Regulation (EU) 2024/1689, https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689 ; the EUR-Lex fetch ended before the annex).

Why the consumer product is a different case: the key phrase is "intended to be used ... in educational and vocational training institutions". Self-study at home with a parent account is not an institution. Once a school or university buys Aristo and its BKT mastery estimates decide what each pupil is taught next and how well they are doing, the system plausibly **is** an AI system "intended to evaluate learning outcomes ... to steer the learning process" in an institution. Intended purpose is set by what the provider states in its instructions, marketing and contract, so the school offer's wording matters as much as the features.

Consequence if high-risk: the provider obligations (risk management system, data governance, technical documentation, logging, transparency to deployers, human oversight, accuracy and robustness, quality management, conformity assessment, EU database registration) apply to the provider, which is Aristo. Application date: the Digital Omnibus moved Annex III stand-alone high-risk systems to **2 December 2027** (from 2 August 2026), per Gibson Dunn and other firms, adoption reported June or July 2026; UNCONFIRMED against the Official Journal. https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/ . A solo founder cannot carry that burden.

The Article 6(3) derogation is not a safe harbour here. It says an Annex III system "shall not be considered to be high-risk" if it does not pose a significant risk and, for example, performs "a narrow procedural task" or "a preparatory task to an assessment" (Art. 6(3), https://artificialintelligenceact.eu/article/6/), but also: an Annex III system "shall always be considered to be high-risk where the AI system performs profiling of natural persons". A per-pupil mastery model with a spaced-repetition schedule looks like profiling of an individual's performance, so rely on scoping out, not on the derogation.

How to scope the school offer to stay out of it (the design intent, to be confirmed by a lawyer; this is not legal advice):
1. **Do not sell to institutions at all in the first phase.** The consumer plan is parent-owned self-study at home; the Organisation plan starts with tutoring centres and companies' self-study, not schools or universities.
2. When schools come, sell a **content and practice tool**: lessons, quizzes and practice for the pupil, with the teacher seeing **activity and completion** (who logged in, which lessons, how long) and **no mastery scores, grades, rankings or predictions** in the teacher view.
3. Write the intended purpose into the contract, terms and landing page: "not for grading, assessment, placement, admission or proctoring; teachers must not use results for those purposes"; disable class-level evaluative labels; keep mastery visible to the learner and parent as formative feedback.
4. Treat the adaptive sequencing (BKT choosing the next concept) as the grey zone: it "steers the learning process". Get a written opinion from an Austrian or EU lawyer on whether sequencing without teacher-visible scores stays outside 3(b) before any school sale.
5. Keep Article 4 (AI literacy of staff) and Article 50 (tell people they talk to an AI) in view regardless: the visible "Jake is an AI" label is already in L09.

### D3. Procurement paperwork
Expect from a school: DPA; list of sub-processors; data location; retention and deletion; security measures summary; accessibility statement (WCAG 2.1 AA; the R3F canvas needs a text alternative and keyboard path); a technical description for the data-protection officer; sometimes a signed data-protection impact assessment input. From a district in the US or UK: the privacy agreement of that state or district, FERPA and COPPA statements, SSO and rostering (Google, Clever, OneRoster), VPAT, purchase order, tax forms. From a company: security questionnaire, SSO (SAML or OIDC), SLA, invoice with a PO number. Not all of this is built; the product does not offer SSO, rostering or an accessibility statement today.

### D4. Invoicing and VAT
- Paddle is the merchant of record for card checkout: it sets tax, collects, remits and handles the buyer relationship.
- For invoiced B2B deals Paddle has a separate Invoicing feature: manual-collection transactions with a business id, purchase order number and payment terms (for example 14 days), payment by wire transfer or Paddle Checkout, and the customer must accept Paddle's buyer terms appended to your own terms. https://developer.paddle.com/build/invoices/create-issue-invoices ; https://www.paddle.com/help/sell/invoicing-tool/which-terms-and-conditions-apply-when-using-paddle-invoicing . CONFIRMED that Paddle's pricing page lists invoicing as an additional service outside the 5% + 0.50 USD base rate with no price shown, so assume a separate quote: https://www.paddle.com/pricing .
- Not found: whether invoices can be issued by an individual (no company) seller, whether Paddle accepts school purchase orders or net-60, and minimum deal size. Ask Paddle in writing before listing an org price. A public school may refuse to pay a foreign MoR, because many procurement rules want the supplier named on the contract; that is a risk to test with the first pilot, not a fact I could source.
- VAT: Paddle as MoR handles consumer VAT. For direct invoices by the owner (outside Paddle) the owner needs a tax registration and invoice rules (Austrian invoice content, reverse charge for EU businesses, small-business exemption thresholds). That is the owner's legal-status question already in `payments-research.md` and cannot be answered here.

### D5. Support expectations
A paid org expects: a named contact and email, a response-time promise (one business day is realistic for a solo founder; 4 hours is not), a status page, an uptime statement, a security contact, onboarding help (importing a list of seats), a deletion and export procedure at contract end, and a stable school-year release freeze. A school will also ask about incident handling within 72 hours (the GDPR breach rule). A one-person operator should offer none of 24x7 support, custom integrations, or uptime guarantees.

### D6. When to open the organisation plan (plain recommendation)
1. **At launch: no.** Put a waitlist form on the site. Offer nothing for sale to organisations.
2. **Months 1 to 3:** run consumer Plus; build the audio cache, quotas and entitlements; read the real cost per user. In parallel, build the organisation tables (C7) and the DPA and sub-processor pack, because they are also useful for parents.
3. **Months 2 to 5:** run **2 or 3 free design-partner pilots** with small tutoring centres or a small training company; no invoice, no school, no university. Test the admin dashboard and the pooled caps.
4. **Open paid org seats only when all of these are true:** the owner has confirmed in writing that he may sell and invoice; Paddle has answered the invoicing questions in writing; a lawyer has confirmed the AI Act scoping for the education offer; audio cache, quotas and org tables are in production; the real voice rate is known so the 36 to 60 USD seat prices are verified. Earliest realistic date: **month 6 to 9**, tutors and small companies first, schools last (spring budget cycle), universities not before the legal scoping is solid.
5. Keep "contact us" pricing for schools until at least one pilot has run, because the 36 to 60 USD seat price is above the 10 USD Khan benchmark and may fail.

---

## Open items not resolved by this research
- ElevenLabs real rate per 1,000 characters (the whole margin table moves linearly with it: break-even r = 0.20 for Plus at cap on monthly billing).
- Whether Paddle's 5% + 0.50 USD applies under 10 USD, to tax-inclusive totals, and to invoices.
- Free-to-paid conversion and family-plan share for children's education apps: no credible public figure found.
- Official-page confirmation for Duolingo, Brilliant, IXL, Quizlet, Photomath, Gauth, Praktika, Speak, Outschool, CodeCombat and the corporate library prices (all UNCONFIRMED above).
- Austrian and German school procurement and DPA rules were read only from general knowledge and one ministry slide deck; verify with a Bildungsdirektion contact before promising anything.
- AI Act Annex III reading needs a lawyer; the Digital Omnibus date needs an Official Journal check.
