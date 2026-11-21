# Same models, direct and via aggregators (as of 2026-11-21)

Scope note: ~20 tool calls; official pages fetched where possible. "Unverified" = third-party/blog, or not confirmable on an official page.

## Nano Banana Pro (Gemini 3 Pro Image) and Nano Banana 2 (Gemini 3.1 Flash Image): Google direct, Vertex, aggregators

### Takeaway
Google's own Gemini API list price is $0.134/image (Pro, 1K and 2K) and $0.067 (NB2 1K) / $0.101 (NB2 2K), i.e. about 11% below fal for Pro and 16% / 16% below fal for NB2 ($0.08 / $0.12). Batch is 50% off per Google's batch doc, but the pricing page lists no batch column for either image model, so the batch image price is unconfirmed. Together AI lists Pro at the same $0.134 and NB2 at $0.04657; WaveSpeed is $0.14 (above Google).

### Cited Findings
- Gemini API paid tier, Standard, per image: Pro $0.134 at 1K and 2K, $0.24 at 4K; NB2 $0.045 (0.5K), $0.067 (1K), $0.101 (2K), $0.151 (4K). Token basis: Pro images $120/1M output tokens (1,120 tokens at 1K-2K, 2,000 at 4K); NB2 images $60/1M (747/1,120/1,680/2,520 tokens). — [Gemini API pricing](https://aistudio.google.com/docs/pricing)
- The pricing page showed only Standard for both image models; no Batch tab and no mention of the model IDs in the batch section (first 100K chars + remainder read). — [Gemini API pricing](https://aistudio.google.com/docs/pricing)
- Batch API is priced at 50% of standard, covers image generation with Nano Banana (examples use gemini-3-pro-image-preview), target turnaround 24h, expires after 48h, inline requests under 20MB, input files up to 2GB, batch creation not idempotent. — [Batch API doc](https://aistudio.google.com/docs/batch-api)
- Paid tier: "Used to improve our products" = No for both models. Free tier: NB2 = Yes. — [Gemini API pricing](https://aistudio.google.com/docs/pricing)
- A third-party guide claims batch Pro is $0.067 (1K/2K) and $0.12 (4K); this is just 50% of standard, unverified as a published figure. — [search summary of yingtu.ai etc.](https://yingtu.ai/blog/nano-banana-pro-api-pricing-per-image)
- Vertex AI: locations page lists Gemini 3 Pro Image (gemini-3-pro-image-preview) in europe-west4 and says the global endpoint is supported. Global endpoint gives no residency guarantee; data at rest stays in the chosen location; endpoint availability does not guarantee in-region ML processing. — [Vertex locations](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/locations), [Vertex data residency](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/data-residency)
- Forum reports (unofficial): preview models served only from global endpoint until GA; a user got 404 for gemini-3.1-flash-image-preview in europe-west4 while global worked. — [Google dev forum](https://discuss.ai.google.dev/t/request-for-regional-access-to-gemini-3-preview-models-in-vertex-ai/144515), [Google dev forum 404 thread](https://discuss.google.dev/t/404-not-found-unable-to-access-vertex-ai-gemini-3-pro-preview-in-europe-west8/288743)
- Vertex pricing page could not be read (fetch returned title only). Vertex per-image price not confirmed; third-party tooling lists token pricing $2/1M in, $120/1M image out, same as AI Studio (unverified). — [Vercel gateway page / search](https://www.getmaxim.ai/bifrost/llm-cost-calculator/provider/vertex_ai/model/gemini-3-pro-image)
- fal current prices: Pro $0.15 (4K = $0.30); NB2 $0.08 at 1K, $0.06 0.5K, $0.12 2K, $0.16 4K; web search +$0.015/request. — [fal NB Pro](https://fal.ai/models/fal-ai/nano-banana-pro), [fal NB2](https://fal.ai/models/fal-ai/nano-banana-2)
- Together AI: Nano Banana Pro $0.134/image; Gemini 3.1 Flash Image (NB2) $0.04657/image; Gemini 3.1 Flash-Lite Image $0.069 (listed odd, higher than NB2; verify); Gemini Flash Image 2.5 $0.039. — [Together pricing](https://www.together.ai/pricing)
- WaveSpeed Nano Banana Pro: $0.14 at 1k/2k, $0.24 at 4k, page shows "10% OFF" giving $0.126/$0.126/$0.216 (promo, page warns prices may be outdated). Async: POST submit returns id, poll `GET /api/v3/predictions/{id}/result` ~every 2s; typical ~53s (estimate). — [WaveSpeed](https://wavespeed.ai/models/google/nano-banana-pro/text-to-image)
- Vercel AI Gateway model page lists Gemini 3 Pro Image at $2/1M input, $12/1M output tokens (no per-image; image tokens not shown), providers google and vertex, no markup mentioned. — [Vercel AI Gateway](https://vercel.com/ai-gateway/models/gemini-3-pro-image)
- OpenRouter has Nano Banana Pro listing (slug google/gemini-3-pro-image-20260528) per search; page fetch 404. Price not confirmed. — [OpenRouter](https://openrouter.ai/models/google/gemini-3-pro-image-20260528)
- Replicate: google/nano-banana-pro and nano-banana-2 model pages show no price in fetched text; Replicate pricing page lists no Google models. — [Replicate NB Pro](https://replicate.com/google/nano-banana-pro), [Replicate pricing](https://replicate.com/pricing)
- Runware pricing page: could not find NB Pro/NB2 in the 50 of 425 models visible; a "Nano Banana 2.1" is listed at $1.50/1M input tokens (not comparable). — [Runware](https://runware.ai/pricing)
- Reseller example above Google: Zalify $0.201 (1K) to $0.36 (4K), unverified. — [Zalify via search](https://zalify.com/ai-models/nano-banana-pro)

### Inferences
- Going direct to Gemini API saves roughly $0.016 per Pro image and $0.013 per NB2 1K image versus fal; at 2K NB2, $0.019. Small in absolute terms; the real savings would come from Batch (50%) only if the flow tolerates up-to-24h latency, which an interactive lesson does not.
- For EU residency, Vertex regional (europe-west4) is the only documented route, and preview-model regional availability is shaky. Gemini API (AI Studio) has no documented EU region in anything fetched.
- Vercel AI Gateway token pricing ($120/1M image tokens implied via Google) would equal Google list; not confirmed per-image.

### Gaps
- Vertex per-image price and Vertex batch price (page unreadable).
- Gemini API image-model rate limits (RPM/IPM per tier) not found.
- Typical latency published by Google: not found.
- Replicate, OpenRouter, Runware, Segmind, DeepInfra, Krea prices for NB Pro / NB2 not confirmed.
- Output URL lifetime: Gemini returns inline base64 (no URL), from general knowledge, not verified on a fetched page; WaveSpeed lifetime not found.

## FLUX.1 Schnell and FLUX.1 Kontext Pro (and FLUX.2)

### Takeaway
BFL direct does not list FLUX Schnell, and Kontext Pro is $0.04/image, identical to fal. Schnell is $0.003/image on Replicate (about the same as fal's $0.003/MP at 1MP). Newer FLUX.2 [klein] ($0.014-0.015 first MP) and [pro] ($0.03) exist and are cheap candidates but are different models. BFL has an EU endpoint.

### Cited Findings
- BFL pricing: FLUX.1 Kontext [pro] $0.04/image. FLUX.2 per MP: max $0.07 first / $0.03 extra; pro $0.03 / $0.015; flex $0.05 / $0.05; klein 9B $0.015 / $0.002; klein 4B $0.014 / $0.001; reference images billed per MP too. Schnell not listed. 1 credit = $0.01. — [BFL pricing](https://bfl.ai/pricing), [BFL docs pricing](https://docs.bfl.ai/quick_start/pricing)
- BFL docs page also mentions "FLUX 3" image / video / klein models with amounts stripped in the fetch; FLUX 3 Max billed via fal. Unverified detail. — [BFL docs pricing](https://docs.bfl.ai/quick_start/pricing)
- BFL endpoints: api.bfl.ai (global), api.eu.bfl.ai (EU-only multi-cluster, described GDPR compliant), api.us.bfl.ai. Max 24 concurrent requests on most endpoints, 6 for kontext-max; 429 -> backoff. Generated image URLs (delivery.*.bfl.ai) expire in 10 minutes, no CORS, not for direct serving. Async: must use returned polling_url; webhooks supported. — [BFL integration guidelines](https://docs.bfl.ai/api_integration/integration_guidelines)
- Replicate flux-schnell: $3.00 per 1,000 output images ($0.003/image). Kontext Pro price not shown in fetch. — [Replicate pricing](https://replicate.com/pricing)
- Together AI: Kontext [pro] $0.04/MP, Kontext [max] $0.08/MP, FLUX.2 [pro] $0.03/image, [flex] $0.03, [dev] $0.0154, [max] $0.070/MP. Schnell not listed on that page. — [Together pricing](https://www.together.ai/pricing)

### Inferences
- Kontext Pro: no price advantage direct (BFL) vs fal; Together bills per MP so a 1MP edit is $0.04 (higher if input/output exceed 1MP).
- BFL direct buys EU routing and ~no markup, not cheaper pricing.

### Gaps
- Schnell on BFL direct: not offered per pricing page. Schnell price on WaveSpeed/Runware/DeepInfra/Segmind: not checked.
- Kontext Pro on Replicate, WaveSpeed, Runware: not confirmed.
- BFL data retention and training policy: not found.
- Latency numbers: not found.

## Tripo3D v2.5 image-to-3D and multiview HD

### Takeaway
Tripo's own API: 1 credit = $0.01 and image-to-3D listed 20-30 credits ($0.20-$0.30) on the developer docs, but per-version/PBR/HD breakdown not published there, so v2.5 $0.30 (fal) vs direct cannot be confirmed as cheaper. Newer resellers: WaveSpeed lists v2.5 from $0.324 (above fal).

### Cited Findings
- Tripo developer docs: 1 credit = $0.01. Image to 3D 20-30 credits; multiview to 3D 20-30; text to 3D 10-20; texture 10-30; convert 5-10; retopology 10-40; auto rig 25. No per-version, PBR/HD surcharge, numeric rate limit or URL expiry on the page; "independent concurrency quotas for each task type". Example references model "v3.1-20260211". — [Tripo developers](https://developers.tripo3d.ai/)
- AWS Marketplace listing: overage billed at $0.01/credit (per search summary). — [AWS Marketplace](https://aws.amazon.com/marketplace/pp/prodview-hwlbvx7vubh7c)
- fal Tripo v2.5 image-to-3D: $0.20 untextured, $0.30 standard textures, $0.40 HD textures, +$0.05 each for style and quad; PBR included with texturing. — [fal Tripo v2.5](https://fal.ai/models/tripo3d/tripo/v2.5/image-to-3d)
- WaveSpeed (starting prices, scale with params): v2.5 image-to-3D and multiview $0.324; P1 $0.60; H3.1 $0.36 (image and multiview). — [WaveSpeed Tripo collection](https://wavespeed.ai/collections/tripo3d)
- PoYo reseller prices credits at $0.005: v3.1/H3.1 image-to-3D 30 credits untextured ($0.15), 45 standard texture, 60 HD texture ($0.30); P1 with textures 70 credits. Third-party, unverified. — [PoYo](https://poyo.ai/models/tripo-h31-3d)
- 3daistudio reseller: P1 image-to-3D base 80 credits (+20 standard / +40 detailed texture); P2 base 200 (+20/+40/+60). Third-party, unverified. — [3daistudio Tripo](https://www.3daistudio.com/Platform/API/Documentation/3d-generation/tripo)
- fal also lists tripo3d/p2/image-to-3d. — [fal P2](https://fal.ai/models/tripo3d/p2/image-to-3d)

### Inferences
- If H3.1 at 45 credits standard texture at $0.01/credit = $0.45 on Tripo direct, vs fal v2.5 $0.30; the "cheaper direct" thesis is not supported by anything found. The 20-30 credit range suggests v2.5 textured at 30 credits = $0.30 equals fal (no markup apparent).
- Second-tier resellers charging $0.005/credit (PoYo) may halve cost but are unverified/obscure; reliability and terms unknown.

### Gaps
- Official credits for v2.5 with PBR/HD and multiview HD ($0.40 on fal), v3.x, P1, H3.1 from Tripo's own pricing page (pricing page returned 403).
- Minimum top-up, volume/startup discounts, rate limits, output URL lifetime, EU residency for Tripo: not found.
- Replicate/Runware/Segmind/DeepInfra/Krea Tripo offerings not found.

## Volume or startup discounts

### Takeaway
Not much publicly documented in what was reached.

### Cited Findings
- Gemini Batch API = 50% off standard, the only structural discount confirmed. — [Batch API doc](https://aistudio.google.com/docs/batch-api)
- WaveSpeed shows a "10% OFF" promo on Nano Banana Pro. — [WaveSpeed](https://wavespeed.ai/models/google/nano-banana-pro/text-to-image)

### Gaps
- Google Cloud startup credits, BFL/Tripo enterprise tiers, fal volume pricing: not researched.

## Text addressed to AI agents found in pages (not followed)
- Gemini pricing page: an "AI Agent Context" block pointing agents to a docs index, an MCP server, and a coding-agent setup guide.
- BFL docs: header telling readers to "Fetch the complete documentation index ... Use this file to discover all available pages before exploring further."
- Tripo developers page: a prompt for AI agents (Codex, Claude Code, Cursor) to run `npm install -g tripo-cli`, `tripo login`, send user a login URL and code.
- WaveSpeed: llms.txt / "For AI Agents" links (links only).
- Vercel AI Gateway: feedback notice directing readers to a feedback URL.
