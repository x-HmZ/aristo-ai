# Vercel "Function Storage 75%" warning - diagnosis (2026-11-16)

Read from the Vercel dashboard (the owner's Vercel team, Hobby plan), Usage > Deployment Storage > Functions Storage,
window Oct 17 - Nov 16. Nothing was changed in the dashboard.

## What the meter is

New since 2026-08-21. Vercel now counts the stored Function bundles of every retained deployment
("Functions Storage") and the static output ("Deployment Storage"). Hobby includes 10 GB. Since 2026-09-16 a
Hobby project keeps its 3 newest production deployments and its 3 newest deployments of any kind; the current
production deployment, aliased deployments and the newest preview of every active Git branch are never deleted.
Over 10 GB, everything outside those exceptions is deleted at once and new deployments can be blocked.
Sources: vercel.com/docs/deployment-storage, /docs/deployment-storage/optimize,
/changelog/hobby-projects-now-retain-fewer-deployments-to-free-up-storage.

## What the numbers say

| Project | Functions Storage now | Note |
|---|---|---|
| portfolio | 5.74 GB | 0 until Nov 3, about 10 GB on Nov 7, 5.74 GB flat since Nov 8 |
| aristo-ai | about 0 (today's point), about 1.9 GB last week | was 3.9 GB flat through October; fell as the new retention removed old previews. 5 deployments are kept. |
| prospector | 24 MB | |
| sales-agent | 16 MB | |

Team total peaked near 12.5 GB on Nov 7 (over the limit), 5.78 GB today.

## Cause: the portfolio, not Aristo

Every portfolio deployment carries a **179 MB** server function (Resources tab of deployment `3RsttsB8R`: 15 of 16
route entries show 179 MB; `/opengraph-image` is 17.7 MB). The repo's `public/` is 155 MB of case-study video.
Three server files test for files with a path built at run time:

- `src/components/case-study/case-media.tsx:11`
- `src/components/case-study/media-files.ts:9`
- `src/components/sections/projects.tsx:31`

`existsSync(path.join(process.cwd(), 'public', src))` - the tracer cannot know which file is meant, so it packs the
whole `public/` folder into the function. Between Nov 4 and Nov 7 about 30 preview deployments were pushed
(`feat/portfolio-routes` plus five `claude/*` and four `cloud/*` branches): 30 x 179 MB is the 5.7 GB.
Each of the 11 remote branches also pins its newest preview for as long as the branch exists (about 2 GB that
retention will never remove).

## Fix (portfolio repo, not this one)

1. Stop reading `public/` at run time: a small prebuild script writes the list of public media to a generated
   module, and `inPublic()` becomes a Set lookup. Add `outputFileTracingExcludes: { '*': ['public/**'] }` as a
   guard. Expected function size: about 15-20 MB (a tenth).
2. Delete the merged `claude/*` and `cloud/*` remote branches; each one holds a 179 MB preview.
3. Optional: Project Settings > Build and Deployment > Deployment Retention Policy, shortest Pre-Production period.
4. Check: Resources tab of the next preview shows the smaller function; Usage falls over the following days
   (daily maximum per project, so the drop shows a day late).

## Aristo's side

- Local production build: all traced server files together are about 50 MB; 20 MB of that is `sharp`, imported only
  by `src/app/opengraph-image.tsx`. Low priority: render the OG image at build time or drop sharp there.
- 38 local branches; the remote ones each pin a preview. Deleting merged remote branches is in the dead-code
  findings.
- **Hobby is for non-commercial use.** Fine for a free beta at most; the moment Aristo takes money it needs Pro
  (20 USD/month) or another host. See payments-research.md, part D.
