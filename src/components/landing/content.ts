/**
 * Every string the V8.3b landing renders beyond the copy deck in `.claude/docs/brand/messaging.md`, and the excerpts
 * of the volcano demo lesson it shows as real output (Step Into the Classroom's lines).
 *
 * The lesson excerpts are copies, not imports: importing `src/data/demo/volcano-eruption.ts` would put the whole
 * lesson in the landing's first load. `content.test.ts` pins each excerpt to the lesson verbatim, so they cannot drift.
 */
import { AudioLines, History, Presentation, Target, Waypoints, type LucideIcon } from "lucide-react";

/** The nav's section links, in page order (mockup E). */
export const NAV_LINKS = [
  { id: "how", label: "How it works" },
  { id: "map", label: "The map" },
  { id: "immersive", label: "Immersive" },
  { id: "parents", label: "For parents" },
] as const;

export const HERO = {
  eyebrow: "Grades 6 to 8",
  lines: ["One teacher.", "One student.", "Every kid."],
  sub: "Your own AI teacher explains the topic you pick out loud, shows it on the board, then checks that it stuck.",
  /** Under the teacher on the live path: how to play along. */
  hint: "Your teacher follows your pointer. Tap to say hi.",
  /** The teacher chooser (V8.3c): its label, and what each choice says to a screen reader. */
  choose: "Your teacher",
} as const;

export const IDEA = {
  title: "A Teacher of Your Own",
  beats: [
    "Aristotle was the personal tutor of Alexander the Great. For most of history, a teacher of your own was for royal families.",
    "In 1984 the researcher Benjamin Bloom described why it matters: students taught one to one learn more. There have never been enough tutors.",
    "Aristo is an attempt at that tutor for every student.",
  ],
  /** Each beat's marker (the story's own dates; Aristotle tutored Alexander from 343 BC). */
  marks: ["343 BC", "1984", "Today"],
  /** Under the column (messaging.md, the idea: the mark carries the second half of the story). */
  mark: "Our mark is the colonnade where Aristotle taught, its middle flute lit.",
} as const;

export interface Move {
  phase: "activate" | "explain" | "demonstrate" | "challenge" | "connect";
  name: string;
  icon: LucideIcon;
  /** What the move does, in plain words. */
  does: string;
}

// Icons are the classroom phase rail's (brand-system.md, "Classroom (V8.4a)").
export const MOVES: readonly Move[] = [
  { phase: "activate", name: "Activate", icon: History, does: "It starts from something you already know." },
  { phase: "explain", name: "Explain", icon: AudioLines, does: "It explains the idea, then gives you a way to picture it." },
  { phase: "demonstrate", name: "Demonstrate", icon: Presentation, does: "It works through an example on the board, step by step." },
  { phase: "challenge", name: "Challenge", icon: Target, does: "It puts a question on your desk and waits for your answer." },
  { phase: "connect", name: "Connect", icon: Waypoints, does: "It ties the idea to what you know and what comes next." },
];

/** It Draws a Diagram for the Lesson (V8.3b, the volcano lesson's cross-section). */
export const PICTURE_COPY = {
  title: "It Draws a Diagram for the Lesson",
  line: "Each lesson gets a picture drawn for its topic, and your teacher talks you through it on the board.",
  real: "The picture is real output from the volcano demo lesson. Its drawing-in is an illustration.",
} as const;

/** It Builds a Model You Can Turn (mockup E). */
export const MODEL_COPY = {
  title: "It Builds a Model You Can Turn",
  line: "When a topic has a shape, the lesson's picture becomes a 3D model in the room.",
  turn: "Drag it to turn it.",
  real: "The picture and the model are real output from the heart demo lesson. The build between them is an illustration.",
} as const;

/**
 * One Lesson, Five Moves (V8.3b): the moves in plain words (messaging.md), and the volcano demo lesson built up on the
 * classroom's display, one move at a time. The board's words are our short summaries of what each move of that lesson
 * holds (its prerequisites, key insight and analogy, steps, challenge and next concept), not its lines; the label
 * says so. Each group sits under the name of the move that set it there (MovesBoard BOARD_GROUPS).
 */
export const MOVES_COPY = {
  title: "One Lesson, Five Moves",
  line: "Every lesson is real teaching, and you can see it.",
  label: "The volcano demo lesson's five moves, summarised. The gestures are the ones your teacher makes at each move.",
  topic: "How Volcanoes Erupt",
  board: {
    known: [{ label: "Trapped gas pushes out" }, { label: "Hot things rise" }],
    idea: { label: "Pressure builds underground", tag: "Like a shaken soda bottle" },
    steps: [{ label: "Magma fills the chamber" }, { label: "Forced up the vent" }, { label: "Out as lava" }],
    question: { label: "Why does one explode and one ooze?", answer: "Thick magma traps the gas" },
    next: { label: "Types of volcanoes" },
  },
} as const;

/**
 * It Remembers What You Know (V8.3b): one concept's memory over three weeks on a paper card, its review points tapped
 * by Jake, then the real course map on the classroom's display. The curve's labels are plain words (mockup E); the
 * concept is one of the map's, and the learner is an example (the label says so).
 */
export const MAP_COPY = {
  title: "It Remembers What You Know",
  line: "Every concept comes back just before you would forget it, and the next lesson starts from what you have mastered.",
  label: "Example learner. The map is a real course's concepts; the progress is illustrative.",
  curveTitle: "One Concept, Three Weeks",
  curveLine: "Each review lifts it back up, and it fades more slowly after each one.",
  /** The curve's concept: one of the map's (kg-snapshot.json), so the two tell one story. */
  concept: "Variables and Assignment",
  marks: { learn: "You learn it", fade: "It starts to fade", back: "It comes back" },
  axis: ["Today", "1 week", "2 weeks", "3 weeks"],
  mapTitle: "Your Map",
  /** Around the course's own title (kg-snapshot.json), its subtitle dropped. */
  mapLine: ["The first 20 concepts of a real course,", "with an example learner's progress."],
  conceptMark: "The concept on the card above",
  legend: { done: "Mastered", next: "Next lesson:", later: "Not yet" },
} as const;

export const CLOSE = {
  title: "Your teacher is ready",
  line: "About five minutes, in your browser, with nothing to sign up for or install.",
} as const;

/**
 * Step Into the Classroom (V8.3b, "Immersive"; the brain lesson since V8.3c): the product's room, the brain demo
 * lesson taught in it while the camera tours it (stage/room.ts). `lines` are three of the lesson's own sentences,
 * verbatim (content.test.ts pins them), in the order of room.ts ROOM_T.lines.
 */
export const ROOM_COPY = {
  title: "Step Into the Classroom",
  /** Live, where the reader can drag to look around; on the stills, without that. */
  line: "Everything above, together in one room. Look around while your teacher teaches how the brain is organised.",
  lineStill: "Everything above, together in one room, where your teacher teaches how the brain is organised.",
  shots: ["Your teacher", "The board", "The model", "Your desk"],
  lines: [
    "Picture your brain as a house with four main rooms on the top floor, plus a basement.",
    "The top floor rooms are called lobes, and the basement houses the parts that keep you alive and steady without you ever noticing.",
    "Below and behind the cerebrum sit the cerebellum and the brainstem.",
  ],
  real: "Live 3D, the product's own classroom. The lesson, its picture and its model are real output from the brain demo lesson; the tour and the model's labels are an illustration.",
} as const;

/**
 * For Parents (messaging.md, "For parents"): the one place the page speaks to the adult. Its three promises run to
 * about 33 words each (messaging rule 5's exception: honesty rule 7 needs the full list of what is kept).
 */
export const PARENTS_COPY = {
  eyebrow: "For parents",
  title: "What Aristo Is, and What It Keeps",
  line: "Aristo is an early prototype for grades 6 to 8. Its lessons are generated by AI and can be wrong. Learn alongside it, and check anything you would cite.",
  promises: [
    {
      title: "Every Account Is Approved by Hand",
      body: "A new account waits for an administrator to approve it. Lessons start only after that.",
    },
    {
      title: "Everything We Keep, Listed",
      body: "Email, name and goal; mastery and quiz answers; mistakes the lessons picked up; time and clicks per lesson; the pace that suits your child; and a log of AI requests.",
    },
    {
      title: "The Microphone Waits for Your Child",
      body: "It turns on only when your child chooses to speak an answer, and speech to text is the browser's own. Aristo uses no camera or location, shows no ads, and sells nothing.",
    },
  ],
} as const;
