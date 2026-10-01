/**
 * Every string the V8.3 landing renders beyond the copy deck in `.claude/docs/brand/messaging.md`, and the excerpts
 * of the heart demo lesson it shows as real output.
 *
 * The lesson excerpts are copies, not imports: importing `src/data/demo/heart.ts` would put the whole lesson in the
 * landing's first load. `content.test.ts` pins each excerpt to the lesson verbatim, so they cannot drift. They keep
 * the lesson's own em-dashes (Hmz, V8.3: shown as generated, since they are labelled real output).
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
  /** Under Jake on the live path: how to play with him. */
  hint: "He follows your pointer. Tap him to say hi.",
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

/** The heart demo lesson's topic, as generated. */
export const TOPIC = "How the Heart Pumps Blood";

/** The ideas the lesson is built from: labels from its own output (model_annotations, key insight, text). */
export const IDEAS = [
  { id: "pumps", label: "Two pumps in one", x: 0.5, y: 0.1, depth: 0.2 },
  { id: "ra", label: "Right atrium", x: 0.14, y: 0.34, depth: 0.6 },
  { id: "la", label: "Left atrium", x: 0.86, y: 0.3, depth: 0.5 },
  { id: "rv", label: "Right ventricle", x: 0.2, y: 0.72, depth: 0.9 },
  { id: "lv", label: "Left ventricle", x: 0.8, y: 0.7, depth: 0.8 },
  { id: "valves", label: "Valves", x: 0.5, y: 0.52, depth: 0.35 },
  { id: "aorta", label: "Aorta", x: 0.62, y: 0.92, depth: 1 },
] as const;
/** Links in teaching order: what each idea builds on. */
export const IDEA_LINKS: readonly [string, string][] = [
  ["pumps", "ra"], ["pumps", "la"], ["ra", "rv"], ["la", "lv"], ["valves", "rv"], ["valves", "lv"], ["lv", "aorta"],
];

export interface Move {
  phase: "activate" | "explain" | "demonstrate" | "challenge" | "connect";
  name: string;
  icon: LucideIcon;
  /** What the move does, in plain words. */
  does: string;
  segment: string;
  /** The segment's text, verbatim. */
  line: string;
  /** Its first sentence, verbatim (the lesson cards). */
  first: string;
}

// Icons are the classroom phase rail's (brand-system.md, "Classroom (V8.4a)").
export const MOVES: readonly Move[] = [
  {
    phase: "activate", name: "Activate", icon: History, segment: "seg_001",
    does: "It starts from something you already know.",
    line: "Put two fingers on your wrist or neck right now — that thump-thump you feel is a machine that's been running non-stop since before you were born, without ever taking a break.",
    first: "Put two fingers on your wrist or neck right now — that thump-thump you feel is a machine that's been running non-stop since before you were born, without ever taking a break.",
  },
  {
    phase: "explain", name: "Explain", icon: AudioLines, segment: "seg_004",
    does: "It explains the idea, then gives you a way to picture it.",
    line: "Picture a house with two apartments stacked side by side, sharing a wall but never mixing their water systems. The right side of your heart is one apartment, the left side is the other — each has its own upstairs room and downstairs room.",
    first: "Picture a house with two apartments stacked side by side, sharing a wall but never mixing their water systems.",
  },
  {
    phase: "demonstrate", name: "Demonstrate", icon: Presentation, segment: "seg_009",
    does: "It works through an example on the board, step by step.",
    line: "Look at the diagram: blood low on oxygen flows into the right atrium first — that's the receiving room on the right. From there it drops down through a one-way valve into the right ventricle just below it.",
    first: "Look at the diagram: blood low on oxygen flows into the right atrium first — that's the receiving room on the right.",
  },
  {
    phase: "challenge", name: "Challenge", icon: Target, segment: "seg_013",
    does: "It puts a question on your desk and waits for your answer.",
    line: "Here's a thought experiment: imagine one of the heart's one-way valves gets damaged and doesn't close all the way anymore. What do you think would happen to the heart's pumping efficiency, and why?",
    first: "Here's a thought experiment: imagine one of the heart's one-way valves gets damaged and doesn't close all the way anymore.",
  },
  {
    phase: "connect", name: "Connect", icon: Waypoints, segment: "seg_015",
    does: "It ties the idea to what you know and what comes next.",
    line: "So now you know the heart's real secret: it's two pumps in one, moving blood in a continuous one-way loop through your lungs and body, kept flowing correctly by valves acting as one-way doors. Next, you're ready to explore how blood vessels — arteries, veins, and capillaries — actually deliver that blood to every single cell.",
    first: "So now you know the heart's real secret: it's two pumps in one, moving blood in a continuous one-way loop through your lungs and body, kept flowing correctly by valves acting as one-way doors.",
  },
];

/** The challenge as the lesson asks it on the desk (challenge.question, verbatim). */
export const CHALLENGE_QUESTION =
  "If one of the heart's one-way valves gets damaged and doesn't close all the way, what happens to the heart's pumping efficiency, and why?";

export const HOW = {
  title: "From a Question to a Lesson",
  realLabel: "Real output from the heart demo lesson. The transitions between the steps are an illustration.",
  steps: [
    { name: "You ask", caption: "You Ask. It Starts Thinking." },
    { name: "The ideas", caption: "It Finds the Ideas Inside." },
    { name: "Five moves", caption: "It Writes a Lesson in Five Moves." },
    { name: "The diagram", caption: "It Draws a Diagram for the Lesson." },
    { name: "The model", caption: "It Builds a Model You Can Turn." },
    { name: "The lesson", caption: "Your Teacher Begins." },
  ],
} as const;

/**
 * It Finds the Ideas Inside (V8.3b): the volcano demo lesson's topic and the ideas it was built from, its own words.
 * `first`: what it builds on (the lesson's prerequisites, and its analogy). x and y place each in the board panel (%).
 */
export const IDEAS_COPY = {
  title: "It Finds the Ideas Inside",
  line: "Pick any topic. Your teacher works out the ideas it is made of, and what you need to know first.",
  topic: "How Volcanoes Erupt",
  thinking: "Finding the ideas",
  legend: "Rings of light: what it builds on.",
  real: "Real output from the volcano demo lesson: its topic, and the ideas it found.",
  ideas: [
    { id: "heat", label: "Heat causing materials to rise", x: 30, y: 21, first: true },
    { id: "soda", label: "A shaken soda bottle", x: 76, y: 25, first: true },
    { id: "magma", label: "Magma", x: 18, y: 39, first: false },
    { id: "gas", label: "Gas pressure and expansion", x: 75, y: 48, first: true },
    { id: "chamber", label: "Magma chamber", x: 49, y: 64, first: false },
    { id: "vent", label: "Central vent", x: 22, y: 80, first: false },
    { id: "lava", label: "Erupting lava", x: 52, y: 85, first: false },
    { id: "viscosity", label: "Viscosity", x: 80, y: 75, first: false },
  ],
  links: [["heat", "magma"], ["soda", "gas"], ["magma", "chamber"], ["gas", "chamber"], ["chamber", "vent"], ["vent", "lava"], ["viscosity", "lava"]],
  /** The idea his pointing lands on. */
  aim: "chamber",
} as const;

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
 * says so. x and y place each on the board's spine (%); its words sit to its right.
 */
export const MOVES_COPY = {
  title: "One Lesson, Five Moves",
  line: "Every lesson is real teaching, and you can see it.",
  label: "The volcano demo lesson's five moves, summarised. The gestures are the ones your teacher makes at each move.",
  topic: "How Volcanoes Erupt",
  board: {
    known: [
      { label: "Trapped gas pushes out", x: 14, y: 16 },
      { label: "Hot things rise", x: 14, y: 26 },
    ],
    idea: { label: "Pressure builds underground", tag: "Like a shaken soda bottle", x: 14, y: 39 },
    steps: [
      { label: "Magma fills the chamber", x: 14, y: 52 },
      { label: "Forced up the vent", x: 14, y: 61 },
      { label: "Out as lava", x: 14, y: 70 },
    ],
    question: { label: "Why does one explode and one ooze?", answer: "Thick magma traps the gas", x: 14, y: 81 },
    next: { label: "Next: types of volcanoes", x: 14, y: 93 },
  },
} as const;

export const MAP_COPY = {
  title: "It Remembers What You Know",
  line: "Every concept comes back just before you would forget it, and the next lesson starts from what you have mastered.",
  label: "Example learner. The map is a real course's concepts; the progress is illustrative.",
  curveTitle: "One Concept, Three Weeks",
  curveLine: "Each review lifts it back up, and it fades more slowly after each one.",
} as const;

export const CLOSE = {
  title: "Your teacher is ready",
  line: "About five minutes, in your browser, with nothing to sign up for or install.",
} as const;
