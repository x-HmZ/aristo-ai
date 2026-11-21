# Media-generation provider terms: minors, training, ownership, DPA/EU (as of 2026-11-21)

Not legal advice. Fetch results were summarized by a small model from the pages; quotes are as returned and should be re-verified against the live page before relying on them. No instructions addressed to AI agents were seen on any page.

## 1. Minors / end-user age (serving outputs to users aged 11-14 via own app)

### Takeaway
Every provider whose terms were readable puts an 18+ (or equivalent) requirement on the account holder (the developer), which Austria's operator satisfies. Only fal.ai (hard 18+ end-user rule), Gemini API (restricts clients likely accessed by under-18s) and Meshy (minimum age 14, parental permission under 18, for direct users) have language that plausibly bites a children's app; fal and Gemini are the two to treat as potentially blocking and need written confirmation.

### Cited Findings
- fal.ai Terms (Last Updated Sept 8, 2026), Section 2: "you must be 18 years of age (or the age of legal majority where you live)"; "If you are under 18 years old ... you may not use our Services"; and "you are responsible for ensuring that your End Users are at least 18 years of age". Section 3(3) defines End Users as "your end user customers who use the Customer Solution." Section 4(b)(ii): "Client will not expose any of the Services APIs directly to any End Users." No child-directed or education carve-out found. — [fal Terms](https://fal.ai/terms)
- Gemini API Additional Terms (page shows "Effective March 23, 2026"; unnumbered, cited by heading), Age Requirements: "You must be 18 years of age or older to use the APIs"; and API Clients "directed towards or is likely to be accessed by individuals under the age of 18" are restricted (exact remainder of the sentence not captured; need the full text to see whether it is a prohibition or conditional). — [Gemini API terms](https://aistudio.google.com/docs/terms) (ai.google.dev/gemini-api/terms 301-redirects here)
- Black Forest Labs Terms (Last Revised Aug 1, 2026), preamble: "You must be 18 years of age or older to use the Services." No end-user/minor clause found. BFL Privacy Policy (Aug 1, 2026), Section 6: "we do not knowingly collect, use, disclose, sell, or share any information from children under the age of 18." — [BFL Terms](https://bfl.ai/legal/terms-of-service); [BFL Privacy](https://bfl.ai/legal/privacy-policy)
- Replicate Terms (Last Update Apr 1, 2026), preamble: user must be "at least 18 years of age or over the age of majority"; "If an end user is under 18, you as a parent consent to their such use of the Services" (adult account holder assumes liability). Section 8.6: outputs may be "NOT SUITABLE FOR CHILDREN" and Replicate does not monitor for this. — [Replicate Terms](https://replicate.com/terms)
- Meshy Terms (Last Updated Sept 19, 2026), 1.1: "You must be at least 14 years old or the minimum age required in your country"; users under 18 state they have parent/guardian permission. Privacy Policy (Sept 19, 2026): sites not directed to "children under age of 14". Terms count "API calls" as Customer Input. — [Meshy Terms](https://www.meshy.ai/terms-of-use); [Meshy Privacy](https://www.meshy.ai/privacy-policy)
- Hyper3D/Rodin (Deemos) Terms (no revision date shown), preamble: "YOU MUST BE AT LEAST 18 YEARS OLD OR THE MINIMUM AGE REQUIRED IN YOUR COUNTRY"; Section 7 bans use "For the purpose of exploiting, harming or attempting to exploit or harm minors". The terms cover only ChatAvatar and Rodin web services; no API-specific terms on that page. — [Hyper3D Terms](https://hyper3d.ai/legal/terms)
- OpenAI Services Agreement/Business Terms (page shows "Updated Dec 1, 2025; Effective Jan 1, 2026"), Section 3.3(c): customer may not let minors use the Services without parent/guardian consent (no age threshold defined); Section 3.2: customer responsible for End User activity and for obtaining needed consents. Usage Policies (effective Nov 20, 2026): "OpenAI tools must not be used to endanger anyone under 18"; the fetched text did not state an end-user minimum age for API apps. — [OpenAI Business Terms](https://openai.com/policies/business-terms/); [OpenAI Usage Policies](https://openai.com/policies/usage-policies/)
- Tripo: the terms page returned HTTP 403 (also /uk/terms, help article). A search summary (secondary, unverified) says the privacy policy says service not intended for under-13s and terms last updated July 11, 2025. — [Tripo terms](https://www.tripo3d.ai/terms) (not read)
- Higgsfield: not re-verified; relying on caller's note (Terms 2.1 18+, 2.4 restrict under-18 use).

### Inferences
- fal.ai's "End Users at least 18" rule (Section 2) read literally conflicts with serving 11-14-year-olds even through a server-side proxy, even though the "not expose APIs directly" rule (4(b)(ii)) is satisfied. Whether students count as "End Users who use the Customer Solution" when they only see pre-generated output is ambiguous; fal's text offers no carve-out. Get written confirmation or cache/curate outputs so students never trigger generations.
- Gemini's "likely to be accessed by individuals under 18" clause is the most direct child-directed restriction found.
- Replicate and OpenAI contemplate minor end users only with adult/parental consent language, making them the more permissive of the readable ones.

### Gaps
- Tripo full terms (403); Vertex AI-specific terms (Google Cloud terms not fetched; may differ from Gemini API Additional Terms); full text of Gemini under-18 sentence; Higgsfield verification; OpenAI image API specific age rule (none found in fetched text; OpenAI Terms of Use for consumers say 13+ but were not fetched).

## 2. Training on inputs/outputs and opt-out

### Takeaway
Defaults vary: fal.ai's terms do not explicitly state training but let it use "Usage Data ... derived from Customer Input" for AI models; BFL, Meshy (non-Enterprise) and Tripo (free tier, secondary source) train by default with email opt-outs; Gemini paid and OpenAI API do not train.

### Cited Findings
- fal.ai Terms 6(c): Company may use Usage Data "to design, develop, and offer Company products, services, and AI models"; 3(5): Usage Data "may include data based on or derived from Customer Input"; 7(a): Customer Input and Output Content are Customer's Confidential Information. No explicit training statement or opt-out clause found. — [fal Terms](https://fal.ai/terms). Privacy Policy (July 22, 2026) does not mention training. — [fal Privacy](https://fal.ai/privacy)
- fal retention docs: request inputs/outputs JSON kept 90 days by default; send header `X-Fal-Store-IO: 0` or set account default to stop payload storage; logs (30 days) not covered; contact sales to confirm ZDR; page does not say whether data is used for training. — [fal data retention](https://fal.ai/docs/documentation/serverless/data-retention)
- Gemini API: Unpaid Services - Google "uses the content you submit ... and any generated responses to provide, improve" (truncated); Paid Services - "Google doesn't use your prompts ... or responses to improve our products." — [Gemini API terms](https://aistudio.google.com/docs/terms)
- BFL Terms 1.2(e): broad license to "provide, develop, train and improve our technologies"; "you may opt out of Company using your Input and Output to train our Flux models" via legal@blackforestlabs.ai; opt-out is prospective only. Privacy Policy: opt-out by email privacy@blackforestlabs.ai, subject "Training Opt Out". Terms 1.3(n) forbids using Output to train other models. — [BFL Terms](https://bfl.ai/legal/terms-of-service); [BFL Privacy](https://bfl.ai/legal/privacy-policy)
- Replicate Terms 5.2: license to use Customer Data to "train and generate Customer Derivative Models", limited to what is "necessary to provide the Output"; 5.5: may use aggregated anonymized Resultant Data to "improve and enhance the Services." — [Replicate Terms](https://replicate.com/terms)
- Meshy Terms 2.9: may use inputs/outputs "from non-Enterprise Customers to train, validate, test, or improve Services"; "You may opt out of such use by contacting" support@meshy.ai. 2.5: API Customer Output deleted 3 days after generation for non-Enterprise. Privacy policy more softly says "limited selection ... to evaluate and test". — [Meshy Terms](https://www.meshy.ai/terms-of-use); [Meshy Privacy](https://www.meshy.ai/privacy-policy)
- Tripo (secondary, via search summary of Tripo help article, citing Section 5.2): no training on paid users' inputs/outputs; no explicit restriction for free users. — [Tripo commercial-use help](https://www.tripo3d.ai/help/privacy-policy/how-to-use-tripo-models-commercially) (page itself 403; not read)
- Hyper3D Terms Section 5: "We may use Prompts and Output and related information as described in these Agreements", including to "improve our services, and conduct and support research"; no explicit training or opt-out statement. — [Hyper3D Terms](https://hyper3d.ai/legal/terms)
- OpenAI Business Terms 4.2: OpenAI "will not use Customer Content to develop or improve the Services, unless Customer explicitly agrees." — [OpenAI Business Terms](https://openai.com/policies/business-terms/)
- Higgsfield: not verified; caller's note says Terms 4.4 trains on inputs unless Enterprise.

### Inferences
- If free-text student questions can enter a prompt, a provider that trains by default (BFL, Meshy, Tripo free) would ingest them unless opted out; fal's position is ambiguous; Gemini paid, OpenAI API are cleanest.

### Gaps
- Vertex AI data-use terms not fetched (generally governed by Google Cloud terms; unverified here). fal explicit training answer needs sales confirmation. Tripo primary text.

## 3. Output ownership / commercial use

### Cited Findings
- fal.ai: Section 4(c) Company gets no IP rights in Output Content; Section 6(b) Customer owns Customer Input; Output ownership not expressly stated; underlying model licenses (e.g. FLUX Schnell, Tripo) apply separately. — [fal Terms](https://fal.ai/terms)
- Gemini: "Google won't claim ownership over that content." — [Gemini API terms](https://aistudio.google.com/docs/terms)
- BFL 1.2(a): "We claim no ownership rights in and to Your Content." — [BFL Terms](https://bfl.ai/legal/terms-of-service)
- Replicate 5.1: grants "all right, title and interest, if any, in and to Output", subject to third-party model terms. — [Replicate Terms](https://replicate.com/terms)
- Meshy 3.2: free plan - Meshy owns output, CC BY 4.0 with credit; paid plan - customer owns output. — [Meshy Terms](https://www.meshy.ai/terms-of-use)
- Hyper3D 5(a): ChatAvatar default personal-entertainment only, commercial needs purchased License; 5(b) Rodin: "we will not limit your use of such Output"; no copyrightability warranty. — [Hyper3D Terms](https://hyper3d.ai/legal/terms)
- OpenAI 4.1: customer "owns all Output" to the extent law allows. — [OpenAI Business Terms](https://openai.com/policies/business-terms/)
- Tripo: secondary source says free-tier users' Inputs/Outputs rights retained by Tripo; paid get commercial use. Unverified. — [Tripo help](https://www.tripo3d.ai/help/privacy-policy/how-to-use-tripo-models-commercially)

### Gaps
- Vertex AI, Higgsfield not covered; Tripo primary source.

## 4. DPA and EU data residency

### Takeaway
Only fal.ai (incorporated by reference, 6(i)), Meshy (DPA part of the agreement), Gemini paid services, and OpenAI (DPA incorporated, 5.3) clearly reference a DPA; BFL and Replicate terms/privacy do not mention one. No provider read here advertised EU residency in these documents.

### Cited Findings
- fal.ai Terms 6(i): "Company's Data Processing Addendum" is "incorporated by reference"; the page https://fal.ai/dpa returned 404, so the document was not read. Privacy Policy: servers "in the United States and other countries", transfers use contractual clauses, no residency commitment. A third-party router lists fal as US-region with SCCs/DPA available (secondary). fal Enterprise Hub lists SOC 2 (scope unknown). — [fal Terms](https://fal.ai/terms); [fal Privacy](https://fal.ai/privacy); [fal Enterprise Hub](https://fal.ai/enterprise-hub)
- Gemini: paid prompts/responses processed under "Data Processing Addendum for Products Where Google is a Data Processor." EU residency not addressed in the fetched text. — [Gemini API terms](https://aistudio.google.com/docs/terms)
- BFL: Terms 2.1 cite GDPR; no DPA mentioned; privacy relies on SCCs/UK addendum; enterprise content governed by customer agreements. — [BFL Terms](https://bfl.ai/legal/terms-of-service); [BFL Privacy](https://bfl.ai/legal/privacy-policy)
- Replicate: no DPA in Terms; privacy policy not read (incorporated by 12.1). — [Replicate Terms](https://replicate.com/terms)
- Meshy: DPA listed as part of the agreement (Terms preamble); privacy policy has EU/UK representatives and SCCs, no DPA or residency mention. — [Meshy Terms](https://www.meshy.ai/terms-of-use); [Meshy Privacy](https://www.meshy.ai/privacy-policy)
- OpenAI Business Terms 5.3: DPA "incorporated by this reference"; EEA customers under Irish law; a separate OpenAI page announces European data residency (not fetched, in search results only). — [OpenAI Business Terms](https://openai.com/policies/business-terms/); [OpenAI EU residency](https://openai.com/index/introducing-data-residency-in-europe/)

### Gaps
- Whether any DPA is self-serve/signable (vs automatic incorporation) not determined for any provider; fal DPA text unread; Tripo, Hyper3D (privacy page not read), Replicate privacy, Vertex AI EU regions, Higgsfield all unverified.
