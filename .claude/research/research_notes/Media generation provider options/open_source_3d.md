# Open-source / open-weight image-to-3D as a replacement for paid Tripo3D v2.5 (as of 2026-11-21)

Baseline: Tripo3D v2.5 at $0.30/model, textured PBR GLB, ~78 s, internal eval 4/5. Operator and users are in Austria/EU. Research budget was about 15 tool calls; several models were not verified (see Gaps).

## Which open models are serious, and how do they compare in quality, textures and hardware?

### Takeaway
TRELLIS.2 (Microsoft, MIT) is the only strong open model that is both textured/PBR and clean on licence for an EU operator. Hunyuan3D has better quality but its licence excludes the EU. Open models are consistently described as behind the best closed generators (Hunyuan 3.1, Tripo 3.x, Rodin).

### Cited Findings
- TRELLIS.2-4B: image-to-3D, 4B params, 512^3 to 1536^3, outputs a mesh with PBR materials, including transparency/translucency; the card warns raw meshes can have small holes or minor topology discontinuities, and the model is unaligned so style can vary — [HF model card search result](https://huggingface.co/microsoft/TRELLIS.2-4B/blob/main/README.md)
- TRELLIS.2 repo: code and model under MIT; needs at least 24 GB GPU memory; verified on A100/H100, Linux only; H100 times about 3 s (512^3), 17 s (1024^3), 60 s (1536^3); outputs PBR GLB (base colour, roughness, metallic, opacity; exported OPAQUE by default); example uses 4096 textures — [GitHub microsoft/TRELLIS.2](https://github.com/microsoft/TRELLIS.2)
- TRELLIS.2 dependency caveat: the original pipeline depends on NVIDIA nvdiffrast/nvdiffrec, which "fall under the NVIDIA Source Code License and are limited to non-commercial research and evaluation"; the ComfyUI integration removed those dependencies. Article says TRELLIS.2 code/weights MIT. Also says closed generators (Hunyuan 3D, Tripo, Rodin) "still produce better results than Trellis.2 and Pixal3D" — [ComfyUI blog, 2026-08-31](https://blog.comfy.org/p/trellis2-and-pixal3d-are-now-native)
- Replicate deployment of TRELLIS.2 notes use must follow licences of DINOv3 and BRIA RMBG-2.0 (background removal) — [Replicate fishwowater/trellis2](https://replicate.com/fishwowater/trellis2)
- Pixal3D (newer, SIGGRAPH 2026) builds on TRELLIS.2 backbone/VAEs/DINOv3, same PBR set, reportedly better image alignment; licence not stated in the source — [ComfyUI blog](https://blog.comfy.org/p/trellis2-and-pixal3d-are-now-native)
- Hunyuan3D 2.1 (open, 13 Jun 2025): weights and training code; PBR (albedo, metallic, roughness); VRAM 10 GB shape, 21 GB texture, 29 GB both — [Hunyuan3D-2.1 README](https://raw.githubusercontent.com/Tencent-Hunyuan/Hunyuan3D-2.1/main/README.md), [arXiv 2506.15442](https://arxiv.org/abs/2506.15442)
- Hunyuan3D 2.5: only a technical report (23 Jun 2025) found; no source confirming open weights. Hunyuan 3.x / 3.1 Pro (10B, 1536 voxel, optional PBR) appears as a commercial/API listing; no evidence of open weights — [Scenario guide, Oct 2026](https://help.scenario.com/articles/1263568892-comparing-generative-3d-models)
- Step1X-3D (StepFun): two stages, geometry (VAE-DiT) plus texture synthesis; full open release of models/training code; authors claim it surpasses open-source and is comparable to proprietary (author claim). Licence Apache 2.0 per a SourceForge mirror only — [arXiv 2505.07747](https://arxiv.org/html/2505.07747v1), [SourceForge mirror](https://sourceforge.net/projects/step1x-3d.mirror/)
- TripoSG (VAST, 1.5B rectified flow): shape/geometry only (no texture mentioned), at least 8 GB VRAM, repo MIT, weights licence not stated on the page; TripoSG-scribble Apr 2025; no TripoSF on the page — [GitHub VAST-AI-Research/TripoSG](https://github.com/VAST-AI-Research/TripoSG)
- SAM 3D Objects (Meta): reconstructs geometry and texture from a single image with Gaussian splat (.ply) and GLB mesh output; multi-object output; selectable via text, points or boxes. Whether the GLB is textured is not explicit on fal's page — [fal sam-3/3d-objects](https://fal.ai/models/fal-ai/sam-3/3d-objects), [Meta](https://ai.meta.com/sam3d/)
- Stable Fast 3D / SPAR3D: Stability AI Community Licence, free commercial use under $1M annual revenue, Enterprise Licence above that — [Stability news](https://stability.ai/news/stable-point-aware-3d), [HF stable-fast-3d](https://huggingface.co/stabilityai/stable-fast-3d)
- Scenario guide (Oct 2026) says Tripo 2.5 "stops working on December 1, 2026" on that platform and recommends Tripo 3.1; this is Scenario's catalogue, not necessarily Tripo's own API, but worth checking against the app's v2.5 dependency — [Scenario](https://help.scenario.com/articles/1263568892-comparing-generative-3d-models)

### Inferences
- Rough quality ordering for a textured pipeline: closed (Hunyuan 3.1 Pro, Tripo 3.x, Rodin) > TRELLIS.2 ~ Hunyuan 2.1 > older open models. Relative to Tripo v2.5 (an older generation), TRELLIS.2 at 1024^3 is plausibly comparable, but this is unverified; the app's own 4/5 eval is the only reliable test.
- TripoSG and (probably) Direct3D-S2 / Hi3DGen are geometry-first, so they would need a separate texturing step; not a drop-in replacement.
- The nvdiffrast/nvdiffrec non-commercial caveat is a real licence risk for the official TRELLIS.2 GLB-export path; a hosted API (fal, Replicate) shifts that question to the provider, but what they do was not verified.

### Gaps
- Hi3DGen, Direct3D-S2, PartCrafter, TripoSF: no licence, quality or texture data found. Not verified.
- Quality head-to-head of TRELLIS.2 vs Tripo v2.5 specifically: not found.
- Any other 2026 open releases beyond Pixal3D and a May 2026 paper "AssetGen" (arXiv 2605.26137, weights release not evidenced): not explored.
- Step1X-3D licence confirmed only by a mirror site; TripoSG weights licence not confirmed.

## Licence terms: commercial use, thresholds, territory

### Takeaway
Hunyuan3D licences (2.0 verified verbatim; 2.1 and later share the Tencent pattern but only 2.0 was verified) do not apply in the EU, so they are unusable for an Austrian operator and EU users. TRELLIS.2 (MIT) and Step1X-3D (Apache 2.0, mirror-sourced) are clean; SAM 3D, Stability models have custom licences with no EU exclusion.

### Cited Findings
- Hunyuan 3D 2.0 licence, verbatim: "THIS LICENSE AGREEMENT DOES NOT APPLY IN THE EUROPEAN UNION, UNITED KINGDOM AND SOUTH KOREA"; Territory (s.1(l)): "the worldwide territory, excluding the territory of the European Union, United Kingdom and South Korea"; use outside the Territory is "unlicensed and unauthorized under this Agreement" (per search summary) — [HF LICENSE](https://huggingface.co/tencent/Hunyuan3D-2/blob/main/LICENSE), [Wind River licence list](https://open.windriver.com/info/uni-license-list/licenses/tencent-hunyuan-3d-2.0-cla.html)
- Hunyuan 2.0 commercial threshold (s.4): a separate licence is required if products have "greater than 1 million monthly active users in the preceding calendar month"; s.5(b): you "must not use the Tencent Hunyuan 3D 2.0 Works or any Output or results ... to improve any other AI model" — [HF LICENSE](https://huggingface.co/tencent/Hunyuan3D-2/blob/main/LICENSE)
- Hunyuan3D-Omni summary (secondary source): same EU/UK/KR exclusion — [DeepWiki](https://deepwiki.com/Tencent-Hunyuan/Hunyuan3D-Omni/6.1-licensing-and-legal). Hunyuan 2.1 licence text itself was not fetched (README has no licence mention).
- TRELLIS.2: MIT (code and model); see dependency caveat above — [GitHub](https://github.com/microsoft/TRELLIS.2)
- SAM 3D Objects "SAM Licence": "a non-exclusive, worldwide, non-transferable and royalty-free limited license"; no clause directly addressing commercial use; only geographic limit is trade controls: "You are not the target of Trade Controls and your use of SAM Materials must comply with Trade Controls" (s.1b.v); bans military/nuclear/espionage uses, reverse engineering, requires attribution in publications and a copy of the agreement on redistribution — [GitHub LICENSE](https://github.com/facebookresearch/sam-3d-objects/blob/main/LICENSE)
- Stability Community Licence: free for under $1M annual revenue, Enterprise Licence above — [Stability](https://stability.ai/news/stable-point-aware-3d). The SF3D README wording is contradictory with the licence text per a discussion thread; the licence text governs.
- TripoSG repo MIT — [GitHub](https://github.com/VAST-AI-Research/TripoSG)

### Inferences
- Hunyuan3D open weights are a non-starter for self-hosting by an EU operator, and probably also when run via a US host for EU users, since the licence says it does not apply in the EU at all. fal's hosted Hunyuan is a different matter (fal's terms, not checked).
- Not legal advice; the app should confirm with a lawyer if relying on any custom licence.

### Gaps
- Hunyuan 2.1/2.5 licence text verbatim, and whether Tencent grants EU terms via hunyuan3d@tencent.com: not checked.
- Hi3DGen, Direct3D-S2, PartCrafter licences: not checked.

## Pay-per-call hosted options and prices

### Takeaway
Hosted TRELLIS.2 on fal costs about the same as Tripo v2.5 ($0.30 at 1024p); Replicate's community TRELLIS.2 is about $0.09 per run. fal's SAM 3 3D Objects is $0.02. Hosted Hunyuan is available on fal but carries the licence question.

### Cited Findings
- fal-ai/trellis-2: $0.25 at 512p, $0.30 at 1024p, $0.35 at 1536p; GLB output; commercial-use tag — [fal](https://fal.ai/models/fal-ai/trellis-2)
- fal-ai/sam-3/3d-objects: $0.02 per generation; splat .ply + GLB — [fal](https://fal.ai/models/fal-ai/sam-3/3d-objects)
- fal Hunyuan: v2 $0.16; Rapid v3.1 $0.225 (+$0.15 for PBR); Pro $0.375; v3 add-ons $0.15 each (multiview, face count); part splitting $0.45, smart retopology $0.75 (from search summary of fal pages; one third-party blurb says $0.017 for v2, treated as unreliable) — [fal Hunyuan3D v3.1 rapid](https://fal.ai/models/fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d), [fal 3D docs](https://fal.ai/docs/model-api-reference/3d-api/trellis)
- fal original TRELLIS docs list $0.02 per unit (usage-based) — [fal docs](https://fal.ai/docs/model-api-reference/3d-api/trellis); the fal 3D overview page itself lists no prices — [fal](https://fal.ai/docs/model-api-reference/3d-api/overview)
- Replicate fishwowater/trellis2: about $0.089 per run (11 per $1), A100 80GB, typically under 64 s, optional video render can be disabled to cut cost; "Initial setup on Replicate takes 4-8 minutes" (community model, not official Microsoft) — [Replicate](https://replicate.com/fishwowater/trellis2). A search snippet cited about $0.82 for the same model; the fetched page says $0.089, so the page value is used.
- Replicate firtoz/trellis (original TRELLIS, image-large): outputs textured GLB; price not extracted — [Replicate](https://replicate.com/firtoz/trellis)
- WaveSpeed: not searched.

### Inferences
- fal TRELLIS.2 at $0.30 is not a saving versus Tripo v2.5; the saving comes only from Replicate community model (~$0.09) or self-hosting, at the price of running a third-party community deployment.
- Replicate public models pay for cold boots in latency (not billed to you for public models, normally), but community models may be evicted; this is a reliability risk (not verified).

### Gaps
- WaveSpeed prices, Hugging Face Inference Endpoints, RunPod Serverless prices: not retrieved.
- fal's Tripo v2.5/v3 current price for a like-for-like check: not retrieved.

## Serverless GPU self-hosting cost (Modal etc.) and operational burden

### Takeaway
At tens to a few hundred generations a month, GPU compute is cents per model on Modal, and idle cost is zero when scaled to zero; the real cost is the solo developer's time (CUDA-heavy build with FlexGEMM, CuMesh, nvdiffrast; 24 GB+ GPU; Linux only; cold starts).

### Cited Findings
- Modal per-second rates: H100 $0.001097/s (~$3.95/h), A100 80GB $0.000694/s (~$2.50/h), A100 40GB $0.000583/s, L40S $0.000542/s (~$1.95/h); per-second billing, scale to zero — [Spheron summary of Modal pricing](https://www.spheron.network/blog/modal-gpu-pricing-2026-per-second-billing/), [Modal pricing](https://modal.com/pricing?trk=public_post-text)
- Cold-start billing is described inconsistently (one source says warm-up not billed, another says container alive time is billed); container boot about 1 s but model load is separate; Modal GPU memory snapshots are Alpha — same sources above. No Modal-published cold-start benchmark found.
- Replicate A40 rate cited as $0.000725/s (unverified internal copy) — [Replicate pricing result](https://internal.replicate.com/pricing)
- TRELLIS.2 needs 24 GB GPU; tested on A100/H100 only — [GitHub](https://github.com/microsoft/TRELLIS.2)
- ComfyUI says TRELLIS.2 "runs on consumer hardware" after removing NVIDIA-licensed dependencies (no VRAM figure) — [ComfyUI blog](https://blog.comfy.org/p/trellis2-and-pixal3d-are-now-native)

### Inferences (author's arithmetic, not sourced figures)
- TRELLIS.2 1024^3 about 17 s on H100 plus preprocessing and GLB baking, call it 30 s: 30 x $0.001097 = about $0.033; on A100 80GB perhaps 45 s = about $0.03; at 1536^3 (60 s on H100) about $0.07 plus baking.
- Cold start (loading 4B weights, DINOv3, RMBG, compiling extensions) plausibly 30-120 s billed once per cold container: about $0.03-0.13 extra for a cold request. With heavily cached, sporadic usage almost every request is cold, so realistic cost is about $0.06-0.15 per model, versus $0.30 for Tripo. At 200 models/month that is $12-30 versus $60.
- Monthly saving is therefore tens of dollars, which does not obviously justify the engineering time unless the goal is licence independence or price risk. Modal free monthly credits (not verified here) could cover this volume.
- Vercel pattern: route handler calls Modal web endpoint (or queue + polling/webhook), store GLB in Supabase storage. Function timeouts and long cold starts require async job + callback.

### Gaps
- RunPod Serverless and HF Inference Endpoints pricing and idle behaviour: not retrieved.
- Measured TRELLIS.2 timings on L40S/A100; real cold-start duration: not found.

## 3D Arena / benchmark standing

### Takeaway
No reliable current head-to-head ranking of open models vs Tripo v2.5/v3 was found; the live Hugging Face 3D Arena was not read.

### Cited Findings
- Aug 2026 Top 3D AI arena (186,939 votes): Tripo AI v3.1 first (Elo 1042, 88.6% win rate), then Hitem3D v2.0 (1025), Sloyd AI v3, N4D-2.5, Triverse 3.0, Rodin Gen 2.5, Hitem3D v2.1, Meshy 6; Hunyuan and TRELLIS do not appear in that table — [Sloyd](https://www.sloyd.ai/blog/ai-3d-model-generator-rankings)
- Pixazo (undated marketing site, conflicts with the above) ranks Hunyuan3D-2.5 at 1325, TRELLIS 1290, Meshy 5 1280 — [Pixazo](https://www.pixazo.ai/leaderboard/ai-3d-model-generation)
- Arena author (HF post, older): TRELLIS second for render quality and second for topology; Hunyuan3D-2.1 later added — [3D Arena paper](https://arxiv.org/abs/2506.18787), [HF post](https://huggingface.co/posts/dylanebert/577211626996199)
- Scenario recommends Hunyuan 3.1 Pro, Rodin 2.5 or Hitem3D 3.0 for realism, Tripo 3.1 for game-ready meshes — [Scenario](https://help.scenario.com/articles/1263568892-comparing-generative-3d-models)

### Inferences
- Tripo has moved on to 3.x, so v2.5 is the weaker baseline now; if Tripo 2.5 is retired, price/quality comparison should be against Tripo 3.1.

### Gaps
- Live 3D Arena Elo for TRELLIS.2, Hunyuan 2.1, Step1X-3D, SAM 3D: not retrieved (sites render dynamically).

## Instruction-like text on pages
None encountered that was addressed to AI agents.
