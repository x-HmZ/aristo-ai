/**
 * Demo topic registry — consumed by DemoClient's topic picker and /demo
 * lesson playback. Every lesson + asset here is frozen static content
 * (see scripts/generate-demo-content.ts); nothing in this module or its
 * imports triggers a network call.
 */
import type { LessonPayload } from "@/lib/agents/teaching";
import type { QuizQuestion }  from "@/lib/agents/assessment";

import { lesson as volcanoLesson, quiz as volcanoQuiz } from "./volcano-eruption";
import { lesson as heartLesson, quiz as heartQuiz } from "./heart";

export interface DemoTopic {
  slug:   string;
  title:  string;
  blurb:  string;
  emoji:  string;
  lesson: LessonPayload;
  quiz:   QuizQuestion[];
}

export const DEMO_TOPICS: DemoTopic[] = [
  {
    slug:   "volcano-eruption",
    title:  "How Volcanoes Erupt",
    blurb:  "Magma, gas pressure, and the moment a mountain lets go.",
    emoji:  "🌋",
    lesson: volcanoLesson,
    quiz:   volcanoQuiz,
  },
  {
    slug:   "heart",
    title:  "How the Heart Pumps Blood",
    blurb:  "Four chambers, two pumps, and why blood only flows one way.",
    emoji:  "🫀",
    lesson: heartLesson,
    quiz:   heartQuiz,
  },
];

/**
 * A demo topic's slug MUST equal its lesson's concept_id.
 *
 * useLessonPlayback resolves demo narration as
 * `/demo/${lesson.concept_id}/${segmentId}.mp3`, so the concept id is what
 * names the asset folder. The first two topics happened to satisfy this by
 * coincidence, which hid the coupling until a topic was added whose concept id
 * ("human-heart") differed from its folder ("heart"): every mp3 404d, the
 * lesson raced through all fifteen segments in seconds, and the avatar had no
 * audio to drive lip sync from.
 *
 * Checked at module load so a mismatch is impossible to ship quietly.
 */
for (const t of DEMO_TOPICS) {
  if (t.slug !== t.lesson.concept_id) {
    throw new Error(
      `Demo topic "${t.slug}" has concept_id "${t.lesson.concept_id}". ` +
      "These must match: demo audio is served from /demo/<concept_id>/.",
    );
  }
}

export function getDemoTopic(slug: string): DemoTopic | undefined {
  return DEMO_TOPICS.find((t) => t.slug === slug);
}
