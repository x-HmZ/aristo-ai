# Commercial image-to-3D API landscape (as of 2026-11-21) vs Tripo3D v2.5

Scope note: roughly 15 tool calls. Covered in depth: Tripo, Meshy, Rodin, Hunyuan3D, Seed3D, Hi3D. NOT researched (no evidence collected): CSM.ai, Sudo AI, Stability SPAR3D/SF3D, Luma Genie, Kaedim, Zoo, Alibaba, Google, Sloyd pricing. The official Hugging Face 3D Arena table could not be retrieved (dynamic page). No instructions addressed to AI agents were found on any fetched page.

## Which providers exist now, and what is newest?

### Takeaway
The field has moved well past Tripo v2.5. Tripo H3.1 (v3.1-20260211) is the current Tripo flagship and is on fal.ai at the SAME $0.30 as the v2.5 baseline for standard-textured PBR. Meshy 7.1, Rodin Gen 2.5, Hunyuan 3D v3.1, ByteDance Seed3D 2.0 and Hi3D 3.0 are the other live commercial contenders.

### Cited Findings
- Tripo H3.1 (v3.1-20260211): text, single-image and multiview input, PBR by default, quad output, smart low-poly; v3.0-20250812 and v2.5-20250123 remain available — [Tripo v3.1 docs](https://developers.tripo3d.com/en/models/v3-1)
- Tripo P1 face range is 48 to 20,000 (low-poly line) — [Tripo P1 via search snippet](https://developers.tripo3d.com/en/models/p1); fal also lists Tripo P2 (`tripo3d/p2/image-to-3d`) — [fal search result](https://fal.ai/models/tripo3d/p2/image-to-3d). Not investigated further.
- Meshy API models: meshy-7.1 (latest), meshy-7, meshy-6, meshy-6-lite, meshy-t2/t2.5, plus texture models meshy-n1 / meshy-6-lite / meshy-7 — [Meshy API pricing](https://docs.meshy.ai/en/api/pricing)
- Hyper3D Rodin on fal: v2, v2.5, v2.5 Fast, plus text-to-3D variants — [fal Rodin v2.5](https://fal.ai/models/fal-ai/hyper3d/rodin/v2.5/llms.txt)
- Hunyuan 3D v3.1 Rapid and Pro on fal (Tencent); Tencent Cloud sells it as "Hunyuan 3D Global" with Express and Professional editions — [fal Hunyuan 3.1 Pro docs](https://fal.ai/docs/model-api-reference/3d-api/hunyuan-3d-v3.1-pro), [search summary of Tencent pages](https://www.tencentcloud.com/document/product/1281/74121)
- ByteDance Seed3D 2.0 released, API live on Volcano Engine — [ByteDance Seed blog](https://seed.bytedance.com/blog/seed3d-2-0-released-higher-precision-and-greater-usability)
- Other 2026 entrants appearing on the arena board: Hi3D v3.0 (Twinkle3D), Lychee Gen 2, YVO3D 2.5, Alpha3D 5, VARCO 3D 2.0, N4D-2.5, Sloyd AI v3, Triverse 3.0, TRELLIS.2 (Microsoft, open weights), Pixal3D, Wonder3D, SAM 3D — [Top3D.AI leaderboard](https://www.top3d.ai/leaderboard)

### Inferences
- The v2.5 baseline is a generation behind its own vendor; at fal's price the upgrade to H3.1 is free for the standard tier.

### Gaps
- Stability, Luma, CSM, Kaedim, Sudo, Zoo, 3D AI Studio, Alibaba, Google: not checked; status unknown.

## Independent quality evidence: who tops the rankings?

### Takeaway
Only evidence found is Top3D.AI blind-vote ELO (a small aggregator, per-model votes mostly 300-1000) plus one vendor paper. Both put Tripo v3.1 first for textured quality. Evidence is thin and not from an independent academic benchmark; treat as moderate-to-low confidence.

### Cited Findings
- Top3D.AI Season 11 (Sep 2026) TEXTURED board, 9,848 votes: 1 Tripo v3.1 (1094), 2 Rodin Gen 2.5 (1066), 3 Meshy 7.1 (1057), 4 Hi3D v3.0 (1053), 5 Meshy 7 (1050), 6 Sloyd v3 (1050), 7 Hunyuan 3D v3.1 (1046), 13 Seed3D v2.0 (1022), 18 TRELLIS.2 (973) — [Top3D.AI Season 11](https://www.top3d.ai/leaderboard/seasons/sep-26)
- Same season GEOMETRY board, 3,434 votes: 1 Tripo v3.1 (1146, 84.7% win rate), 2 Hi3D v3.0 (1127), 3 Meshy 7 (1122), 6 Hunyuan v3.1 (1079), 14 Rodin Gen 2.5 (999) — [Top3D.AI Season 11](https://www.top3d.ai/leaderboard/seasons/sep-26)
- Top3D.AI overall board, "Nov 26 Live": Tripo v3.1 1135, Hi3D v3.0 1108, Meshy 7.1 1107, Meshy 7 1105, Hunyuan v3.1 1093, Seed3D v2.0 1092, Rodin Gen 2.5 986 (rank 12), Meshy 6 981 — [Top3D.AI leaderboard](https://www.top3d.ai/leaderboard)
- Rodin Gen 2.5 ranks 2nd on textured but 14th on geometry in the same season, i.e. the boards are inconsistent for it — [Season 11](https://www.top3d.ai/leaderboard/seasons/sep-26)
- Top3D.AI does not state whether prompts are text or image, and discloses no vendor affiliation; its own page header showed "0 votes cast" — [Top3D.AI](https://www.top3d.ai/leaderboard)
- Hi3D 3.0 vendor paper (own evaluation, 33 inputs, rater count not given): automatic metrics Hi3D 3.0 > Tripo 3.1 > Meshy 7 > Rodin 2.5 on completeness/aesthetics; blind study says Hi3D 3.0 same-or-better than Tripo 3.1 in 79.5% structure and 88.1% detail. Paper states it is a vendor report and the Meshy 7 vs Hi3D detail gap is within variance — [arXiv 2610.11685](https://arxiv.org/html/2610.11685v1)
- Aggregator listicles disagree (Crafiq puts Tripo H3.1 first then Hunyuan 3.1, with inconsistent dates; BuildMVPFast Nov 2026 puts Meshy 7.1 first; Pixazo tiers Hunyuan and Rodin top). LOW confidence, affiliate-style — [search result summary](https://www.top3d.ai/leaderboard/seasons/sep-26), [Crafiq](https://crafiq.ai/rankings/3d), [BuildMVPFast](https://www.buildmvpfast.com/articles/best-llms-2026-guide/3d-modeling-ai), [Pixazo](https://www.pixazo.ai/leaderboard/ai-3d-model-generation)
- Academic benchmarks exist (Hi3DEval arXiv 2508.05609, 3DGen-Bench arXiv 2503.21745, DB-3DME arXiv 2606.10142) but results were not read for current commercial models — [Hi3DEval](https://arxiv.org/pdf/2508.05609), [DB-3DME](https://arxiv.org/pdf/2606.10142)

### Inferences
- Tripo v3.1 being top on both Top3D boards, with the highest win rates among well-sampled models, is the best available signal that Tripo's own newer model is the strongest, not a rival vendor. Gap to Meshy 7.1/Rodin 2.5 is small (about 30-40 ELO) given vote counts.
- No evidence found that any provider clearly beats Tripo's current line for textured quality.

### Gaps
- Official HF 3D Arena (3d-arena/3d-arena) standings: page did not render; unknown. Its published paper is arXiv 2506.18787 (June 2025, older).
- No peer-reviewed 2026 head-to-head of Tripo v2.5 vs v3.1 specifically.

## Price, texture/PBR, mesh controls, multiview, latency

### Takeaway
Tripo H3.1 on fal is $0.30 textured PBR (same as baseline); Hunyuan 3.1 Rapid is cheaper ($0.225, +$0.15 PBR = $0.375); Rodin $0.40 base; Meshy about $0.55-0.65 by the author's conversion; Seed3D about $0.35 via a reseller. All output GLB with PBR.

### Cited Findings
- Tripo H3.1 on fal: $0.20 no texture, $0.30 standard texture, $0.40 detailed texture, +$0.20 detailed geometry, +$0.05 quad; `face_limit` 1,000-2,000,000; `pbr` default true; GLB (FBX if quad); `auto_size`; latency not stated — [fal Tripo H3.1](https://fal.ai/models/tripo3d/h3.1/image-to-3d/llms.txt)
- Tripo native: image-to-3D 20/30/40/50 credits (none/standard/detailed/8K), 1 credit = CNY 0.07 (about $0.01); multiview native at same price; about 40 s untextured, about 120 s textured; faces up to 2M, quad up to 150k — [Tripo v3.1 docs](https://developers.tripo3d.com/en/models/v3-1)
- Meshy API credits: image-to-3D meshy-7.1/meshy-6 20 mesh-only, 30 with 2K/4K texture, 35 with 8K; multi-image same; meshy-6-lite 5/15; ultra geometry +5 — [Meshy API pricing](https://docs.meshy.ai/en/api/pricing)
- Meshy plans (EUR): Pro EUR 19 for 1,000 credits; Premium EUR 38 for 3,000; Ultra EUR 95 for 8,000; API requires Pro or above — [Meshy pricing](https://www.meshy.ai/pricing)
- Rodin v2.5 on fal: $0.40 per generation, HighPack +$0.80; up to 5 input images; material PBR/Shaded/All/None; triangle meshes 2K-2M (Auto 500k at Medium/High); output glb/usdz/fbx/obj/stl; latency not stated — [fal Rodin v2.5](https://fal.ai/models/fal-ai/hyper3d/rodin/v2.5/llms.txt)
- Hunyuan 3D v3.1 on fal: Rapid $0.225, Pro $0.375, `enable_pbr` default false (+$0.15 per search summary); `face_count` 40k-1.5M default 500k; front plus back/left/right (and top/bottom etc.) views; GLB always; latency not stated — [fal Hunyuan 3.1 Pro docs](https://fal.ai/docs/model-api-reference/3d-api/hunyuan-3d-v3.1-pro), [search summary](https://fal.ai/models/fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d)
- Tencent Cloud direct: Professional image-to-3D 20 credits per call at $0.02/credit postpaid (about $0.40), 35 credits with LowPoly+PBR; Express 15 credits — [Tencent Cloud docs via search](https://www.tencentcloud.com/document/product/1284/75281). Version mapping to 3.1 unconfirmed.
- Seed3D 2.0: $0.353 per generation on Atlas Cloud (reseller); official Volcengine price not found — [Atlas Cloud](https://www.atlascloud.ai/vi/models/bytedance/seed3d-v2.0/image-to-3d)
- Hi3D 3.0: no API or price found in the paper — [arXiv 2610.11685](https://arxiv.org/html/2610.11685v1)

### Inferences
- Meshy USD estimate (author's arithmetic, not sourced): EUR 19/1,000 credits = EUR 0.019/credit, so 30 credits is about EUR 0.57 (roughly $0.60-0.65 at current FX; no USD page retrieved). Roughly double Tripo.
- Tripo v2.5 -> H3.1 same standard price on fal, so no cost penalty to test H3.1 (confirm v2.5's current fal price, which was given in the brief as $0.30).
- Latency is undocumented on fal for all; only Tripo native (about 120 s textured) is sourced.

### Gaps
- Official USD pricing for Meshy credit packs, Seed3D, Tripo direct USD/credit (tripo3d.ai pricing returned 403).
- Measured latency for Rodin, Hunyuan, Meshy, Seed3D.

## Weaknesses for small/organic/scientific objects (internal structure, thin parts, transparency)

### Takeaway
Little object-class-specific evidence exists. Findings are about fine detail and inscriptions, not anatomy; transparency and internal cavities are untested in anything found.

### Cited Findings
- In the Hi3D 3.0 vendor paper, Tripo 3.1 misshaped lettering, had the highest inscription hallucination rate (32.0%), and cut away a medal's inner field; Rodin 2.5 dropped scene content (returned only a stag) and returned blank plates for engravings; Meshy 7 added a plinth not in the input and truncated a bust — [arXiv 2610.11685](https://arxiv.org/html/2610.11685v1)
- Hunyuan 3.1 `Geometry` mode gives untextured mesh; Tripo `texture_alignment` can follow the original image or the geometry — [fal docs](https://fal.ai/docs/model-api-reference/3d-api/hunyuan-3d-v3.1-pro), [fal Tripo H3.1](https://fal.ai/models/tripo3d/h3.1/image-to-3d/llms.txt)
- Rodin `use_original_alpha` preserves input transparency and `texture_delight` removes baked highlights — [fal Rodin v2.5](https://fal.ai/models/fal-ai/hyper3d/rodin/v2.5/llms.txt)

### Inferences
- Single-view models cannot create real internal structure (heart chambers, cell organelles); expect a surface shell. Multiview input (Tripo, Rodin up to 5, Hunyuan up to 8) and a clean white-background render mitigate back-side guessing for planets/volcanoes but not interiors.
- Rodin's scene-dropping and Meshy's added plinth are relevant risks for "volcano on a base" style sources.

### Gaps
- No evidence on cell/organ, transparent-membrane or thin-part performance for any provider; only an in-house test on the 4 target objects would settle it.

## Overall ranking for this use case (author's synthesis, moderate confidence)
1. Tripo H3.1 on fal, $0.30 PBR, top of Top3D textured and geometry boards; worth an A/B against v2.5 on the 4 objects (cheap).
2. Meshy 7.1: close behind on boards, about 2x price, strong multi-image support, API needs Pro plan.
3. Rodin Gen 2.5: 2nd on textured, weak on geometry board; $0.40, up to 2M tris.
4. Hunyuan 3.1 Pro/Rapid: cheaper ($0.225-0.375), mid-table, rich multiview.
5. Hi3D 3.0, Seed3D 2.0: promising but API/price evidence thin.
