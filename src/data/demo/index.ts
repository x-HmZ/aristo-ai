/**
 * Demo topic registry — consumed by DemoClient's topic picker and /demo
 * lesson playback. Every lesson + asset here is frozen static content
 * (see scripts/generate-demo-content.ts); nothing in this module or its
 * imports triggers a network call.
 */
import type { LessonPayload } from "@/lib/agents/teaching";
import type { QuizQuestion }  from "@/lib/agents/assessment";

import { lesson as volcanoLesson, quiz as volcanoQuiz } from "./volcano-eruption";
import { lesson as blackHoleLesson, quiz as blackHoleQuiz } from "./black-holes";

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
    slug:   "black-holes",
    title:  "What Is a Black Hole",
    blurb:  "Collapsing stars, extreme gravity, and the point of no return.",
    emoji:  "🕳️",
    lesson: blackHoleLesson,
    quiz:   blackHoleQuiz,
  },
];

export function getDemoTopic(slug: string): DemoTopic | undefined {
  return DEMO_TOPICS.find((t) => t.slug === slug);
}
