# Aristo messaging

The source for every rendered string: landing page, metadata, OG image, and (later) in-app
microcopy. Written in V8.1 (2026-09-28) from the V8.0 / V8.0b decisions: positioning P1, the
name stays Aristo, mark R1 "The Column" (`.claude/docs/decisions.md`). If copy and this file
disagree, fix the copy or change this file first.

## The idea

Aristotle was the personal tutor of Alexander the Great. For most of history, a teacher of your
own was something only royal families could arrange. In 1984 the education researcher Benjamin
Bloom described why that matters: students taught one to one learn more than students taught in
a class, and there have never been enough tutors to go round.

Aristo is an attempt at that tutor for every kid.

The mark carries the second half of the story. Aristotle's school was called the Peripatetic
school after the *peripatos*, the covered walk at the Lyceum where he taught. The column in the
wordmark is that colonnade, with its middle flute lit: the classroom as the lit window.

**How to tell it.** Bloom is an idea, never a number. Do not write "two sigma", "2x", "98th
percentile" or any effect size, and never imply Aristo has been shown to produce Bloom's
result: Aristo has not been studied, and later research finds smaller effects than Bloom's.
Tell the story once, in long-form places (the 150-word description, an about section, the
"idea" section V8.3 plans). Headlines do not name Aristotle, princes or Bloom.

## Positioning line

> **One teacher. One student. Every kid.**

Hero H1 (Archivo wide caps, "Every kid." in the accent), OG image, page title. Three short
sentences, full stops, no em-dash. It is the only place the page may use "kid"; everywhere else
the reader is "you" or "your child".

## Descriptions

**50 words** (store listings, social bios, the footer of a pitch):

> Aristo gives every student in grades 6 to 8 a teacher of their own. In a 3D classroom, an AI
> teacher explains the topic out loud, shows it on the board, and checks it stuck with a quiz on
> the desk. Then Aristo brings each concept back before it fades.

**150 words** (about pages, applications, a press note):

> Aristotle was the personal tutor of Alexander the Great. For most of history, a teacher of
> your own was something only royal families could arrange. In 1984 the education researcher
> Benjamin Bloom described why that matters: students taught one to one learn more than
> students in a class, and there are too few tutors.
>
> Aristo is an attempt at that tutor for every student in grades 6 to 8. An AI teacher in a 3D
> classroom takes each topic through five moves: activate what you know, explain, demonstrate,
> challenge, connect. It shows diagrams made for the lesson, builds a 3D model when a topic has
> a shape, and puts the quiz on your desk. Behind it, a map of concepts sets the order, mastery
> is tracked per concept, and each one comes back just before you would forget it.
> Aristo is an early prototype, and its lessons can be wrong.

**Meta description** (under 160 characters, `layout.tsx`):

> Your own AI teacher for grades 6 to 8. It explains out loud in a 3D classroom, shows it on
> the board, then checks that it stuck.

## Three pillars

Every section, feature and screenshot belongs to one of these. If it fits none, it probably
does not belong on the page.

| Pillar | The claim | Proof (all shipped) | Owns the words |
|---|---|---|---|
| **1. A Teacher of Your Own** | You get a teacher who talks to you alone, at your pace. | A 3D teacher (Jake or MJ) explains out loud, points, and waits for your answer. Lessons are generated for the topic you pick. In a course, Aristo picks up from what you have mastered. | your teacher, one to one, out loud, your pace |
| **2. Taught in Five Moves** | Every lesson is real teaching, and you can see it. | Activate, Explain, Demonstrate, Challenge, Connect. A diagram made for the lesson on the board. A 3D model in the room when a topic has a shape. The quiz lies on your desk. | five moves (or phases), shows, builds, on the board, in the room |
| **3. It Remembers What You Know** | Nothing you learn is left to fade. | Mastery tracked per concept. A map of which concept leads to which sets the order. Reviews scheduled just before you would forget. Pace, depth and examples adjusted from how you answer. | mastery, the map, comes back, before you forget |

## Voice

**Assertive, specific, warm.** A good teacher talking to an 11 to 14 year old, with a parent
reading over their shoulder: sure of what they say, plain about how it works, encouraging
without being cute.

1. **Headlines assert something about the learner.** "You Turn It Over in 3D", not "A new way
   to see science".
2. **No negations as headlines or subheads**, and no "not X, Y" / "X, not Y" constructions
   anywhere in headings. Body copy may say "not" or "no" only to state a fact a reader needs
   (a limit, a data rule, a requirement that is absent).
3. **Specific over general.** Name the move, the object, the count: "five moves", "a quiz on
   your desk", "grades 6 to 8". Never "proven method", "cutting-edge AI".
4. **Plain verbs.** explains, shows, builds, asks, checks, marks, remembers, brings back.
5. **Short.** Headlines 8 words or fewer; a section's body 25 words or fewer
   (`design-taste-frontend` §4.9). One idea per sentence. The one exception is the parents
   cards, which run to about 33 words because honesty rule 7 requires the full list of what is kept.
6. **No em-dashes in rendered copy**, and no en-dash used as a pause. Use a full stop, comma or
   colon. Ranges are written "6 to 8". Code comments are exempt.
7. **No exclamation marks, no emojis, no ✦ or any sparkle glyph**, in copy or as decoration.
8. **Casing.** Archivo wide caps for the hero H1 and the closing line only (CSS
   `text-transform`; the source stays sentence case). Every other heading in Title Case Geist
   (V8.0 decision). Buttons, links, labels and body in sentence case.
9. **Person.** The learner is "you". The parents section speaks to parents about "your child".
   Aristo is "Aristo" or "it"; the teacher is "your teacher" (or Jake / MJ in product).
10. **Say AI plainly, once, early.** The first screen says "AI teacher" in the subtext. It is
    never the headline and never apologised for.
11. **One register.** No technical mono labels on the landing page ("seg 3/5", "BKT", "FSRS").
    Say "comes back before you forget", not "spaced repetition".

**Before and after**, from the page as it stood before V8.1:

| Before | After | Why |
|---|---|---|
| A teacher who actually teaches you | One teacher. One student. Every kid. | "actually" is defensive; P1 was chosen |
| Built like a tutor, not like a search box | Your Tutor Keeps Up With You | definition by negation |
| Adapts, without labelling you | Paced by Your Answers | negation; says what it does instead |
| See the thing itself, not a picture of it | You Turn It Over in 3D | negation |
| A map, not a playlist | A Map of What Leads to What | negation |
| Go and meet your teacher | Your Teacher Is Ready | assertion; closing line |

## Words to avoid

| Avoid | Why | Say instead |
|---|---|---|
| learning style(s), visual learner, "adapts to your style" | learning styles were rejected (FSLSM); the claim is false for Aristo | adjusts pace, depth and examples from how you answer |
| personalised / tailored learning journey, experience | empty | a lesson on the topic you pick |
| unlock, empower, elevate, transform, revolutionise, supercharge, unleash, level up | filler verbs | the plain verb for what happens |
| magic, magical, effortless, seamless, delightful | claims a feeling instead of a fact | say what happens |
| cutting-edge, next-gen, state of the art, smart, "AI-powered" as a headline | commodity-AI signal | describe the behaviour |
| genius, brilliant, world-class, masterclass | flattery | none |
| actually, really, truly, simply, just | intensifiers and minimisers | cut them |
| journey, dive into, embark, explore the world of | filler | cut |
| replaces teachers, better than a tutor, as good as a private tutor, guaranteed, results | unproven and unkind to teachers | none |
| trusted by, students love, thousands of, join N learners | no users are claimed | none |
| Aristotle-level, learn like a prince, royal, philosopher | the story is told once, never used as flattery | none |
| segment, BKT, FSRS, knowledge graph, spaced repetition (on the landing page) | jargon | step, mastery, the map, comes back before you forget |
| immersive | overused, says nothing | in a 3D classroom |
| ✦ and other sparkles, emojis | the AI-feature glyph (V8 critique, point 5) | the column mark |

## Honesty rules

These come from the V8 guardrails and bind every string, screenshot and asset.

1. **No invented proof.** No testimonials, user or lesson counts, school or press logos,
   ratings, awards or statistics that are not real and sourced. If none exist, the section does
   not exist.
2. **Bloom as an idea, never a number** (see "The idea"). Never imply Aristo reaches his
   result.
3. **Say what it is.** An early prototype for grades 6 to 8; lessons are generated by AI and can
   be wrong; something to learn alongside, not a source to cite. This stays on the landing page
   and is not softened.
4. **The teacher is an animated character**, voiced by text to speech. Never imply a person is
   behind it.
5. **Examples are labelled.** Product shots are real captures of `/demo`. Anything mocked,
   staged or edited says "Example".
6. **Claim only what ships.** Planned work (Whisper, OpenAI TTS, anything in `.claude/plans/`)
   is never described as a feature. Browser-dependent features are offered with their
   fallback: "answer out loud, or type it" (speech input needs the browser's speech
   recognition).
7. **Data claims match the schema, and change with it in the same PR.** What is kept today
   (checked 2026-09-28 against `supabase/migrations/`): the account (email, name, approval
   status), mastery per concept and course progress, quiz answers, misconceptions the lessons
   picked up, per-lesson time and button use, a learning profile (expertise, pace, depth,
   example preference, engagement) inferred from those, and a log of AI requests with their
   cost. The pre-V8.1 line "We track learning, not behaviour ... That is the list" was
   incomplete and is replaced.
8. **Adaptivity is behavioural**: pace, depth, examples and expertise inferred from answers.
   Never learning styles.
9. **Time claims are measured.** "About five minutes" for the demo comes from the real demo;
   re-measure whenever the demo lesson changes.
10. **No fake urgency or scarcity**: no waitlists, countdowns or "limited spots".
11. **"Built by one person, in the open"** is true (the repo `x-HmZ/aristo-ai` is public). If
    either half stops being true, the line goes.

## Landing copy deck (for Phase 2 to apply)

Proposed with the mark, for Hmz's approval before the Sonnet pass applies it. Headings are
written in Title Case (V8.0 rule); the hero and closing lines render in wide caps.

**Nav:** How it works · What it does · For parents · Sign in · **Try a lesson**

**Hero**
- Eyebrow: Grades 6 to 8
- H1: One teacher. One student. *Every kid.* (accent on "Every kid.")
- Subtext: Your own AI teacher explains the topic you pick out loud, shows it on the board,
  then checks that it stuck.
- Buttons: **Try a lesson** · Create an account
- Shot frame label: Aristo · Lesson: Volcanoes
- Shot chip: Demonstrate, step 3 of 5

**Capability strip:** Explained out loud · Shown on the board · Quizzed at your desk ·
Brought back before you forget

**How it works**
- H2: Pick It, Hear It, See It, Keep It
- 1 · Pick What You Want to Learn: Type any topic, or follow a course Aristo maps out for you.
  In a course, it picks up from what you have already mastered.
- 2 · Your Teacher Explains It Out Loud: Every lesson moves through five phases. The board
  shows a diagram made for that lesson, in step with the words. (Phase pills unchanged.)
- 3 · You Turn It Over in 3D: When a topic has a shape, Aristo builds a 3D model and stands it
  in the room. Turn it, zoom in, read its labels.
- 4 · You Answer. It Comes Back Later: The quiz lies on your desk. Aristo marks each concept,
  spots the ones you half-know, and brings them back before you would forget.

**What it does**
- H2: Your Tutor Keeps Up With You
- Paced by Your Answers: Aristo reads how you answer: how fast, how deep, how many examples
  you need. The next lesson changes its pace, depth and examples to match.
- Models Made for Your Lesson: Topics with a shape get a 3D model, generated for the lesson and
  placed in the classroom.
- Spoken, and Listening: Every step is spoken, with the teacher's mouth moving to the words.
  Answer the challenge out loud, or type it.
- A Map of What Leads to What: Concepts are linked by what each one builds on, so Aristo
  teaches them in an order that holds together.
- Reviews Timed to Your Memory: Each concept comes back on its own schedule, just before the
  point you would lose it.
- Progress You Can Read: Mastery per concept, every quiz answer and what is due next, on one
  dashboard.

**For parents**
- Eyebrow: For parents
- H2: What Aristo Is, and What It Keeps
- Body: Aristo is an early prototype for grades 6 to 8. Its lessons are generated by AI and can
  be wrong. Learn alongside it, and check anything you would cite.
- Every Account Is Approved by Hand: A new account waits for an administrator to approve it.
  Lessons start only after that.
- Everything We Keep, Listed: Email and name, mastery and quiz answers, mistakes the lessons
  picked up, time and clicks per lesson, the pace that suits your child, and a log of AI
  requests.
- The Microphone Waits for Your Child: It turns on only when your child chooses to speak an
  answer. Aristo uses no camera or location, shows no ads, and sells nothing.

**Closing band**
- H2 (wide caps): Your Teacher Is Ready
- Body: About five minutes, in your browser, with nothing to sign up for or install.
- Button: **Try a lesson**

**Footer:** A 3D AI teacher for grades 6 to 8. Built by one person, in the open. · Product:
Try a lesson, Sign in, Create an account · Get in touch

**Metadata** (`src/app/layout.tsx`)
- title: `Aristo | One teacher. One student. Every kid.`
- description: the meta description above
- openGraph: same title; description "Your own AI teacher for grades 6 to 8, in a 3D
  classroom."; url `https://aristo-ai-ten.vercel.app`; image from `opengraph-image.tsx`
- keywords: AI tutor, grades 6 to 8, middle school, 3D classroom, mastery learning
- authors: drop "Aristo Team" (there is no team); use Hmz's name or omit the field

**OG image** (1200 x 630, dark): the wordmark top left, the positioning line in Archivo wide
caps, "Your own AI teacher, grades 6 to 8" beneath it, the full column large on the right.
