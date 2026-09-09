/**
 * One-off script: generates the 2 frozen demo lessons for /demo.
 *
 * Loads .env.local manually, then dynamic-imports the project's real
 * generation pipeline (generateLesson, generateInfographic,
 * generate3dSourceImage, generate3dModel) so the demo content goes through
 * the exact same agents/prompts as production. Downloads every produced
 * asset (segment images, one GLB per lesson) into public/demo/<slug>/ and
 * writes frozen LessonPayload + quiz TS modules into src/data/demo/.
 *
 * Run: npx tsx <this file>
 */

import dotenv from "dotenv";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import { pathToFileURL } from "url";

const ROOT = "C:\\Users\\Pc\\Desktop\\Empire\\Artisto\\Aristo 2.0\\Aristo-AI";

dotenv.config({ path: path.join(ROOT, ".env.local") });
process.env.NEXT_PUBLIC_ADAPTIVE_VISUALS = "true";

async function main() {
  const { generateLesson } = await import(
    pathToFileURL(path.join(ROOT, "src/lib/agents/teaching.ts")).href
  );
  const {
    generateInfographic,
    generate3dSourceImage,
    generate3dModel,
  } = await import(pathToFileURL(path.join(ROOT, "src/lib/imagegen/banana.ts")).href);

  const profile = {
    expertise_level:    "beginner" as const,
    pace:               "moderate" as const,
    explanation_depth:  "moderate" as const,
    example_preference: "concrete" as const,
  };

  const concepts = [
    {
      slug: "volcano-eruption",
      concept: {
        id:          "volcano-eruption",
        name:        "How Volcanoes Erupt",
        description: "Why molten rock, gas, and pressure inside Earth cause volcanoes to erupt, and what happens during an eruption.",
        domain:      "earth-science",
        learning_objectives: [
          "Explain how magma forms and rises through Earth's crust",
          "Describe the role of gas pressure in triggering an eruption",
          "Identify the main parts of a volcano and what happens to each during an eruption",
        ],
        key_terms: ["magma", "lava", "magma chamber", "vent", "pressure", "eruption"],
        common_misconceptions: [
          "Volcanoes are just mountains that randomly 'blow their top'",
          "Lava and magma are entirely different substances rather than the same molten rock before/after reaching the surface",
          "All volcanoes erupt explosively",
        ],
      },
      fallback3dPrompt: "erupting volcano, cross-section showing magma chamber, molten lava, realistic textures, isolated, centered, white background",
      quiz: [
        {
          question_type: "multiple_choice" as const,
          bloom_level:   "remember" as const,
          question:      "What is molten rock called before it reaches Earth's surface?",
          options:       ["Lava", "Magma", "Ash", "Pumice"],
          correct_answer: "Magma",
          explanation_correct: "Molten rock is called magma while it's still underground; it's only called lava once it erupts onto the surface.",
          explanation_wrong: {
            "Lava":   "Lava is the name for the same molten rock after it erupts onto the surface, not before.",
            "Ash":    "Ash is fine volcanic debris ejected during an eruption, not the molten rock itself.",
            "Pumice": "Pumice is a lightweight volcanic rock formed from cooled, gas-filled lava.",
          },
          difficulty: 0.3,
        },
        {
          question_type: "true_false" as const,
          bloom_level:   "understand" as const,
          question:      "A build-up of gas pressure inside a volcano is one of the main reasons it erupts.",
          options:       ["True", "False"],
          correct_answer: "True",
          explanation_correct: "As magma rises, dissolved gases expand and build pressure; when that pressure overcomes the rock sealing the vent, it triggers an eruption.",
          difficulty: 0.4,
        },
      ],
    },
    {
      slug: "black-holes",
      concept: {
        id:          "black-holes",
        name:        "What Is a Black Hole",
        description: "How a black hole forms from a collapsing massive star, what makes its gravity so extreme, and what the event horizon means.",
        domain:      "astronomy",
        learning_objectives: [
          "Explain how a black hole forms when a massive star collapses",
          "Describe why gravity near a black hole is so strong that not even light escapes",
          "Understand what the event horizon represents",
        ],
        key_terms: ["gravity", "event horizon", "singularity", "mass", "escape velocity"],
        common_misconceptions: [
          "Black holes are giant vacuum cleaners that suck up everything in the universe",
          "Black holes are empty holes in space rather than extremely dense collapsed matter",
          "You could see a black hole directly like a normal object",
        ],
      },
      fallback3dPrompt: "black hole with glowing swirling accretion disk, deep space, dramatic lighting, realistic, isolated, centered, white background",
      quiz: [
        {
          question_type: "multiple_choice" as const,
          bloom_level:   "understand" as const,
          question:      "What is the boundary around a black hole called, beyond which nothing — not even light — can escape?",
          options:       ["Singularity", "Event horizon", "Accretion disk", "Photon sphere"],
          correct_answer: "Event horizon",
          explanation_correct: "The event horizon is the invisible boundary marking the point of no return — once anything crosses it, the black hole's gravity is too strong to escape, even for light.",
          explanation_wrong: {
            "Singularity":    "The singularity is the infinitely dense point at the very center, not the outer boundary.",
            "Accretion disk": "The accretion disk is the swirling disk of gas and dust orbiting outside the black hole, not the point of no return.",
            "Photon sphere":  "The photon sphere is a region where light can orbit the black hole, but it isn't the point of no return.",
          },
          difficulty: 0.4,
        },
        {
          question_type: "true_false" as const,
          bloom_level:   "remember" as const,
          question:      "A black hole forms when a very massive star runs out of fuel and collapses under its own gravity.",
          options:       ["True", "False"],
          correct_answer: "True",
          explanation_correct: "When a massive star exhausts its nuclear fuel, it can no longer support itself against gravity, and its core collapses to form a black hole.",
          difficulty: 0.3,
        },
      ],
    },
  ];

  for (const { slug, concept, fallback3dPrompt, quiz } of concepts) {
    console.log(`\n=== Generating lesson: ${concept.name} ===`);
    const lesson = await generateLesson(concept, profile, []);
    console.log(`  segments: ${lesson.segments?.length ?? 0}`);

    const outDir = path.join(ROOT, "public", "demo", slug);
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

    // ── Per-segment visuals ────────────────────────────────────────────────
    const segments = lesson.segments ?? [];
    let segIdx = 0;
    for (const seg of segments) {
      if (!seg.visual?.prompt) continue;
      segIdx++;
      console.log(`  [visual ${segIdx}] ${seg.id}: ${seg.visual.prompt.slice(0, 60)}...`);
      try {
        const { imageUrl } = await generateInfographic({
          prompt:   seg.visual.prompt,
          style:    seg.visual.style,
          userId:   null,
          feature:  "demo.segment_visual",
        });
        const res = await fetch(imageUrl);
        const buf = Buffer.from(await res.arrayBuffer());
        const fileName = `${seg.id}.png`;
        writeFileSync(path.join(outDir, fileName), buf);
        seg.visual.imageUrl = `/demo/${slug}/${fileName}`;
        console.log(`    -> saved ${fileName} (${buf.length} bytes)`);
      } catch (err) {
        console.error(`    !! visual failed for ${seg.id}:`, err);
      }
    }

    // ── One 3D model per lesson ─────────────────────────────────────────────
    const prompt3d = lesson.metadata.should_generate_model && lesson.metadata.model_3d_prompt
      ? lesson.metadata.model_3d_prompt
      : fallback3dPrompt;
    console.log(`  [3d] source prompt: ${prompt3d.slice(0, 80)}...`);
    try {
      const fluxUrl = await generate3dSourceImage(prompt3d, null);
      console.log(`    flux source: ${fluxUrl}`);
      const { modelUrl } = await generate3dModel(fluxUrl, null);
      console.log(`    triposr model: ${modelUrl}`);
      const res = await fetch(modelUrl);
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(path.join(outDir, "model.glb"), buf);
      lesson.metadata.demo_model_url = `/demo/${slug}/model.glb`;
      lesson.metadata.should_generate_model = true;
      console.log(`    -> saved model.glb (${buf.length} bytes)`);
    } catch (err) {
      console.error("    !! 3d model generation failed:", err);
    }

    // ── Freeze lesson + quiz to src/data/demo/<slug>.ts ─────────────────────
    const finalizedQuiz = quiz.map((q, i) => ({
      id:         `${slug}-q${i + 1}`,
      concept_id: concept.id,
      ...q,
    }));

    const tsSource = `/**
 * FROZEN DEMO CONTENT — generated once by scripts/generate-demo-content.ts.
 * Do not hand-edit; regenerate via the script if the source concept changes.
 * Served with zero Anthropic/fal.ai calls at runtime (public/demo/${slug}/...).
 */
import type { LessonPayload } from "@/lib/agents/teaching";
import type { QuizQuestion }  from "@/lib/agents/assessment";

export const lesson: LessonPayload = ${JSON.stringify(lesson, null, 2)};

export const quiz: QuizQuestion[] = ${JSON.stringify(finalizedQuiz, null, 2)};
`;
    const outFile = path.join(ROOT, "src", "data", "demo", `${slug}.ts`);
    writeFileSync(outFile, tsSource, "utf8");
    console.log(`  -> wrote ${outFile}`);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
