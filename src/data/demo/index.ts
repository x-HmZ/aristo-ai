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

export function getDemoTopic(slug: string): DemoTopic | undefined {
  return DEMO_TOPICS.find((t) => t.slug === slug);
}
