# Processors and recipients

Status: DRAFT. Links are the providers' usual data processing pages as I know them; none was opened in this session, so
check each one. Not legal advice.

## To complete

- [ ] Open each link, accept or sign the data processing terms, and note the date in the "Signed" column.
- [ ] Check each US provider on https://www.dataprivacyframework.gov (certified or not) and record it.
- [ ] Supabase project region; Vercel functions region (`vercel.json` has none; consider `"regions": ["fra1"]`).
- [ ] Ask ElevenLabs and fal.ai in writing whether a child-directed product is permitted; opt out of training where offered.
- [ ] Ask Anthropic for the current API retention period and keep a copy of the data processing terms.
- [ ] Avaturn terms were not reviewed (LICENSES.md notes a 404): review or drop the custom teacher.
- [ ] Keep `src/app/(legal)/privacy/page.tsx` section 5 in step with this list.

| Provider | Role | Personal data received | DPA / terms (verify) | Transfer basis | Signed |
|----------|------|------------------------|----------------------|----------------|--------|
| Supabase | Database, auth, storage | All stored data | https://supabase.com/legal/dpa | Region to confirm; DPF or SCCs if US | |
| Vercel | Hosting, logs | Requests, IP | https://vercel.com/legal/dpa | DPF or SCCs | |
| Anthropic | Lesson and answer generation | Topic text, level bands, typed answers; no name or email | https://www.anthropic.com/legal/data-processing-addendum | DPF or SCCs; confirm | |
| OpenAI | Embeddings; optional speech to text | Concept text; audio only if server speech mode on | https://openai.com/policies/data-processing-addendum | DPF or SCCs | |
| fal.ai | Images and 3D models | Prompt text derived from topics | Legal menu at https://fal.ai (DPA link unconfirmed) | SCCs or derogation per its policy | |
| ElevenLabs | Narration voice | Lesson sentences | https://elevenlabs.io/dpa | SCCs per its EEA terms | |
| Resend | Email delivery | Email, name, message text | https://resend.com/legal/dpa | DPF or SCCs | |
| Avaturn | Custom teacher (optional) | Face photos | Not reviewed | Unknown | |
| Paddle | Payments (not offered yet) | Billing identity | https://www.paddle.com/legal/data-processing-addendum | Per its terms | |
| Google (browser speech) | Not a processor of this service | Audio, only in Chrome with voice on | n/a | n/a | Disclosed in privacy policy |

If the EU-US Data Privacy Framework is invalidated (appeal C-703/25 P pending per the findings), fall back on the SCCs in
each DPA and record a short transfer impact note per US provider.
