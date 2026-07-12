# Aristo AI — Design Generation Prompt

> Paste this into Claude (artifact mode / frontend-design) to generate a production-grade visual design for the app. Adjust the "Screens to design" section to focus the output.

---

## What I'm building

**Aristo AI** is an immersive AI tutoring web app for middle-school students (grades 6–8). A 3D avatar teacher lives in a real-time scene; when teaching a tangible topic (an organ, a planet, a molecule, a machine), a generated 3D model appears in the scene next to the avatar and the teacher narrates and annotates it. The student progresses through structured 5-phase lessons, takes quizzes, and the system tracks mastery per concept with spaced repetition.

This is **not** a chat app with a 3D gimmick. The 3D scene is the canvas; the UI floats over it as soft glassmorphism panels. Every screen should feel like part of the same lesson environment — not a switch between unrelated views.

## Target user

Middle-school students. Bright but not childish. Modern but not corporate. Think "an AI tutor a 12-year-old would actually want to use" — friendly, inviting, a bit magical, never patronising.

## Visual direction (lock these in)

- **Palette:** pastel orange `#F97B2F` (primary), warm cream `#FFF5EC` and off-white `#FFF0E4` (surfaces), deep cocoa `#3D2110` (primary text), soft taupe `#8B6E5A` (secondary text), warm tan `#B8957A` / `#E8D5BC` (borders, dividers). Highlight gradient: `#F97B2F → #FBA962`. Subtle peach glow shadows: `rgba(249, 123, 47, 0.18–0.35)`.
- **Surface treatment:** glassmorphism — `bg-white/40` to `bg-white/80` with `backdrop-blur-xl`, `border border-white/40–60`, soft peach-tinted shadows. Panels are rounded-2xl. The 3D scene shows through.
- **Typography:** clean modern sans (Inter / Geist / Manrope). Tight tracking on headings. Comfortable reading rhythm in body text — students will read full paragraphs.
- **Iconography:** sparkle `✦` is the brand mark. Otherwise minimal line icons. Avoid emoji-heavy UI.
- **Motion:** gentle fade-and-rise (6–8px) for entrances, subtle floating animation on the 3D model, smooth 200–300ms transitions, no bouncy/cartoon easing. The scene should always feel calm.
- **Tone:** warm, curious, a little wondrous. Not gamified with XP bars and streaks-as-reward. Mastery and progress are shown honestly, like a thoughtful learning record.

## Layout system

- The app is **full-screen, single-window**. The R3F 3D scene fills the entire background (`absolute inset-0`).
- A right-side floating panel (≈400px wide, full vertical) is the primary content surface — chat / lesson / quiz / dashboard live here.
- Top bar floats over the scene: brand mark on the left; on the right, a glass pill containing (in order) reviews-due chip → Progress button → Map button → user avatar + name → Sign out.
- Overlays (mode picker, course map, dashboard, review session, onboarding) take over the screen as full-bleed glassmorphism layers — the scene is still faintly visible behind.

## Core screens to design

For each, produce a high-fidelity component / page mockup. **Treat each as a real production view** — populated with realistic, age-appropriate content, not Lorem Ipsum.

### 1. Learn shell — course mode, mid-lesson
- 3D scene with teacher avatar (a friendly stylised character) on the left and a generated 3D model (e.g. a heart, a volcano, a Saturn-with-rings) floating beside them
- Top nav bar (with "3 due" reviews chip glowing)
- Right panel showing the current 5-phase lesson card. Phases are: **Activate** (connects to prior knowledge) → **Explain** (analogy + formal explanation + key insight) → **Demonstrate** (worked example with optional code) → **Challenge** (Socratic question with hint and reveal) → **Connect** (links forward). One phase visible at a time with a soft phase indicator (5 dots / segmented progress) and "Explain more" button.
- Bottom of right panel: "I'm ready — take the quiz" CTA when all phases are read

### 2. Learn shell — free explore mode
- Same 3D scene + nav
- Right panel is a chat surface. User messages are pastel-orange filled bubbles right-aligned; Aristo replies are white glass cards left-aligned with a tiny `✦ ARISTO` label, containing a structured response (Definition / Explanation / Example / Fun fact).
- Bottom: input row with mic button (orange when active, pulsing), text field, send button

### 3. Mode picker overlay
- Two big choice cards: "Free explore — ask Aristo about anything" and "Take a course — structured path through a topic"
- Below the course card: a list of published courses (title + short description + estimated hours + a small concept-count badge) and a "Generate a custom course" affordance
- Background: scene visible through heavy blur

### 4. Course map (knowledge graph)
- A visual graph of concept nodes connected by prerequisite edges
- Node colour encodes mastery: grey (untouched) → soft orange (in progress) → deep orange (mastered ≥0.7) → muted green tint (mastered ≥0.9)
- Hover/tap a node → small popover with concept name, mastery %, last reviewed date, "Start lesson" button
- Top: course title + breadcrumb back to mode picker; bottom: legend explaining mastery colours

### 5. Quiz view
- Full right panel takes over as the quiz surface. Question count "Question 2 of 4" + soft progress bar at top.
- Render any of these question types beautifully:
  - **multiple_choice** — 4 stacked option pills, large tap targets, selected state with peach glow ring
  - **true_false** — two big side-by-side cards
  - **fill_blank** — sentence with an inline pill input
  - **short_answer** — multi-line textarea with character hint
  - **code_completion** — monospace code block with a highlighted blank line
  - **code_debugging** — buggy code block above an editor for the corrected version
  - **ordering** — drag-to-reorder list with grab handles
  - **matching** — two columns; drag-line connects left terms to right definitions
- After answering: feedback card slides in — green check or amber cross, the explanation, and a "Next question" button

### 6. Quiz result + advance
- Score badge ("3 / 4"), one-line encouraging summary
- Concept mastery delta (e.g. "Mastery 0.62 → 0.78")
- Two CTAs: "Continue to next concept" (primary) or "Finish course" (when last topic)

### 7. Dashboard overlay (Progress)
- Header: streak (days), total minutes learned, concepts mastered count
- Section: **Mastery distribution** — small donut or stacked bar (untouched / learning / mastered)
- Section: **Weakest concepts** — top 3–5 cards with concept name, current mastery bar, "Review now" button
- Section: **Learner profile badges** — small pills showing inferred profile values (e.g. "moderate pace", "concrete examples", "weakest at Apply")
- Section: **Recent activity** — last few lessons + scores, last review session

### 8. Daily review session
- Compact card layout focused on one question at a time, no distractions
- Top: "Review · 4 of 7" with a calm progress bar; subtitle "Concepts due today"
- Same question renderers as quiz, but visually quieter — this is recall reinforcement, not assessment
- Soft "End session early" link bottom-left

### 9. Onboarding (first login)
- Three-step flow with a soft progress indicator
- Step 1: name confirmation + grade level
- Step 2: pick a domain to start with (chips: Biology, Physics, Chemistry, Math, History, Programming, Geography)
- Step 3: a single calibration question to seed expertise level ("Pick the answer that feels closest to how you think about [domain]")
- Big primary "Let's go" CTA on the final step

### 10. Sign-in / Sign-up
- Centered glass card on a soft peach gradient
- Brand mark + tagline
- Email + password fields, Google OAuth button, link between sign-in and sign-up

## Components I want explicit designs for

- The **5-phase lesson card** (one design per phase — they share a frame but each phase has a unique micro-visual: Activate = bridge motif, Explain = analogy/formal split, Demonstrate = worked example with optional code, Challenge = question + hint reveal, Connect = forward arrow to next concept)
- The **floating top nav pill** (default state, with reviews-due chip, with course map button)
- The **3D scene HUD** — a tiny "Generating 3D model…" status badge that appears bottom-left during fal.ai generation, with a thin progress bar
- The **mic button** (idle / listening pulsing / disabled)
- The **mastery pill** (used in dashboard + course map): bar with current value, label, optional delta
- The **concept node** for the course map (untouched, learning, mastered, in-progress states)
- The **toast / inline feedback** for correct / incorrect answers

## Constraints to respect

- The 3D scene is always behind the UI — designs must read clearly over a varied photographic-ish backdrop. Use enough surface opacity / blur so text never becomes unreadable when the avatar moves.
- Right panel is fixed at ~400px wide on desktop. Design for that width as the primary surface; show a mobile-stacked variant where the panel becomes a bottom sheet and the 3D scene fills the top half.
- The lesson is read sequentially — the 5 phases are a journey, not a tabbed reference. Phase navigation should feel like turning pages, not clicking tabs.
- No XP / levels / coins. Mastery is shown as a probability (0.00–1.00) translated into "learning" / "getting it" / "mastered" bands, not as a score-out-of-100.
- Voice is a first-class affordance, not a corner button — when listening, the mic state is visually obvious. When the teacher is speaking, the avatar should look like it's talking (mouth animation handled in 3D, but the UI may show a soft "Aristo is speaking…" indicator).

## Inspiration / mood references

- Linear's calm, confident surface treatment
- Apple's Vision Pro UI glassmorphism
- Arc browser's playful but adult orange-warm palette
- Khan Academy's pedagogical seriousness, but more visually alive
- The way Duolingo handles encouragement — without the cartoon noise

## Output I want

1. A short design rationale (one paragraph: how the system holds together)
2. A typography + colour token sheet (Tailwind-ready)
3. High-fidelity React + Tailwind components for each screen above, using shadcn/ui primitives where natural (Button, Card, Input, Dialog, Sheet, Progress, Separator, Badge)
4. For the 5-phase lesson card and the course map, also include the empty / loading / error states
5. Real, age-appropriate content in every mockup — no Lorem Ipsum

Please prioritise visual cohesion and pedagogical clarity over flashy effects. Every pixel should feel like it earned its place.
