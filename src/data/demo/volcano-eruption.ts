/**
 * FROZEN DEMO CONTENT — generated once by scripts/generate-demo-content.ts.
 * Do not hand-edit; regenerate via the script if the source concept changes.
 * Served with zero Anthropic/fal.ai calls at runtime (public/demo/volcano-eruption/...).
 */
import type { LessonPayload } from "@/lib/agents/teaching";
import type { QuizQuestion }  from "@/lib/agents/assessment";

export const lesson: LessonPayload = {
  "concept_id": "volcano-eruption",
  "concept_name": "How Volcanoes Erupt",
  "phases": {
    "activate": {
      "content": "We connect the eruption process to something familiar: a shaken soda bottle. Both involve dissolved gas under pressure seeking release, and heat causing material to rise above denser surroundings.",
      "prerequisites_referenced": [
        "gas pressure and expansion",
        "heat causing materials to rise"
      ],
      "segment_ids": [
        "seg_001",
        "seg_002"
      ]
    },
    "explain": {
      "analogy": "Magma rising and building gas pressure is just like a shaken soda bottle: dissolved gas forms bubbles under pressure, and once it finds an opening, it rushes out.",
      "formal_explanation": "Magma is molten rock formed deep in Earth's crust and mantle by heat and pressure. Being less dense than solid rock, it rises and pools in an underground magma chamber. Dissolved gases (like water vapor and CO2) form bubbles in the magma, increasing internal pressure over time.",
      "key_insight": "An eruption is not random — it's the physical result of gas pressure building in the magma chamber until it overcomes resistance and escapes through a vent.",
      "segment_ids": [
        "seg_003",
        "seg_004",
        "seg_005",
        "seg_006"
      ]
    },
    "demonstrate": {
      "example_description": "A step-by-step walkthrough of an eruption: magma collects in the chamber, pressure builds from rising magma and gas bubbles, magma is forced up the vent, becomes lava at the surface, and the eruption style (explosive vs. effusive) depends on magma thickness and gas content.",
      "step_by_step": [
        "Magma and dissolved gas accumulate in the magma chamber.",
        "Gas bubbles form and pressure increases as more magma rises from below.",
        "Pressure eventually forces magma up through the narrow vent.",
        "Magma becomes lava once it reaches the surface — same substance, new name.",
        "Eruption style (explosive vs. oozing) depends on magma viscosity and trapped gas."
      ],
      "narration_pre_visual": "Let's walk through an actual eruption from start to finish, step by step, so you can see exactly how pressure turns into an explosion or a flow.",
      "visual_walkthrough": "Look at the cross-section: the magma chamber sits at the bottom, filled with molten rock and gas bubbles. A narrow vent connects it to the crater at the surface. Notice how the bubbles are shown rising through the vent — that's the pressure finding its escape route, eventually breaking out as lava at the top.",
      "segment_ids": [
        "seg_007",
        "seg_008",
        "seg_009",
        "seg_010",
        "seg_011",
        "seg_012"
      ]
    },
    "challenge": {
      "question": "Two volcanoes have the exact same amount of pressure built up in their magma chambers. One erupts violently and explosively. The other just quietly oozes lava for days. What's the likely difference between them, and why?",
      "hint": "Think about the soda bottle analogy — does it matter if the liquid is thin and watery versus thick and syrupy?",
      "answer": "The difference is the thickness (viscosity) of the magma and how well gas can escape it. Thick, sticky magma traps gas bubbles until pressure bursts violently through, causing an explosive eruption. Thin, runny magma lets gas escape gradually, so it flows out more calmly as lava, even with similar pressure.",
      "segment_ids": [
        "seg_013",
        "seg_014"
      ]
    },
    "connect": {
      "content": "Understanding magma, pressure, and vents gives you the core mechanism behind every eruption — the engine driving the process, regardless of how violent or gentle it looks on the surface.",
      "next_concept": "Types of volcanoes and their eruption styles (shield, composite/stratovolcano, cinder cone)",
      "segment_ids": [
        "seg_015"
      ]
    }
  },
  "segments": [
    {
      "id": "seg_001",
      "phase": "activate",
      "role": "hook",
      "text": "You've probably shaken a soda bottle and watched it explode when you opened the cap — that fizzy pressure trying to escape is closer to a volcanic eruption than you might think.",
      "gesture": "explaining"
    },
    {
      "id": "seg_002",
      "phase": "activate",
      "role": "narrate",
      "text": "You already know that gases expand and push outward when they're trapped, and that hot things tend to rise above cooler, denser things. Volcanoes use both of those exact ideas, just underground and on a massive scale.",
      "gesture": "explaining"
    },
    {
      "id": "seg_003",
      "phase": "explain",
      "role": "narrate",
      "text": "Picture the soda bottle again: dissolved gas is trapped in the liquid under pressure. Shake it, and bubbles form and push upward, desperate to escape. Deep inside Earth, molten rock plays the role of that liquid, and dissolved gases play the role of the fizz.",
      "gesture": "explaining"
    },
    {
      "id": "seg_004",
      "phase": "explain",
      "role": "narrate",
      "text": "Formally: magma is molten rock beneath Earth's surface, formed when heat and pressure deep in the crust and upper mantle melt solid rock. It's less dense than the solid rock around it, so it slowly rises and collects in a magma chamber — an underground reservoir.",
      "visual": {
        "prompt": "Simple diagram of Earth's crust layer with solid rock, a pocket melting into magma due to heat, arrows showing magma rising and collecting into a magma chamber below a volcano.",
        "style": "diagram",
        "callouts": [
          "Solid rock",
          "Melting zone",
          "Rising magma",
          "Magma chamber"
        ],
        "persists_to_next": true,
        "imageUrl": "/demo/volcano-eruption/seg_004.png"
      },
      "gesture": "pointing"
    },
    {
      "id": "seg_005",
      "phase": "explain",
      "role": "callout",
      "text": "As magma sits in that chamber, dissolved gases inside it — mostly water vapor and carbon dioxide — start to form bubbles, just like the soda. The magma chamber can't expand forever, so pressure builds.",
      "gesture": "pointing"
    },
    {
      "id": "seg_006",
      "phase": "explain",
      "role": "narrate",
      "text": "Here's the key insight: an eruption isn't a mountain randomly deciding to 'blow its top.' It's a direct, physical consequence of built-up pressure finally finding a weak point — a crack or vent — to escape through.",
      "gesture": "explaining"
    },
    {
      "id": "seg_007",
      "phase": "demonstrate",
      "role": "narrate",
      "text": "Let's walk through an actual eruption from start to finish, step by step, so you can see exactly how pressure turns into an explosion or a flow.",
      "gesture": "thinking"
    },
    {
      "id": "seg_008",
      "phase": "demonstrate",
      "role": "demo_step",
      "text": "Take a look at this cross-section. At the bottom is the magma chamber, filling up with molten rock and dissolved gas. Above it is a narrow passage called the vent, which connects the chamber to the surface.",
      "visual": {
        "prompt": "Cross-section of volcano showing magma chamber at bottom, connected by a narrow vent up to the crater opening at the surface, gas bubbles depicted rising through the vent.",
        "style": "diagram",
        "callouts": [
          "Magma chamber",
          "Vent",
          "Crater"
        ],
        "persists_to_next": true,
        "imageUrl": "/demo/volcano-eruption/seg_008.png"
      },
      "gesture": "pointing"
    },
    {
      "id": "seg_009",
      "phase": "demonstrate",
      "role": "demo_step",
      "text": "As more magma rises from below and gas bubbles keep forming, pressure inside the chamber climbs. Eventually it overcomes the weight of the rock above it, and magma is forced up through the vent.",
      "gesture": "pointing"
    },
    {
      "id": "seg_010",
      "phase": "demonstrate",
      "role": "demo_step",
      "text": "Once magma reaches open air, we give it a new name: lava. It's the exact same molten rock — the name just changes depending on whether it's underground or on the surface, the same way 'ice' becomes 'water' once it melts, but it's still H2O.",
      "gesture": "explaining"
    },
    {
      "id": "seg_011",
      "phase": "demonstrate",
      "role": "demo_step",
      "text": "Whether the eruption is a violent explosion or a slow, oozing flow depends mostly on how thick the magma is and how much gas it holds. Thick, gas-rich magma traps bubbles until they burst violently — like shaking that soda hard. Thin, runny magma lets gas escape gently, so it flows more like honey pouring out.",
      "gesture": "explaining"
    },
    {
      "id": "seg_012",
      "phase": "demonstrate",
      "role": "narrate",
      "text": "That's why not all volcanoes erupt explosively — many, like the ones in Hawaii, ooze rivers of runny lava for weeks without a single explosion.",
      "gesture": "explaining"
    },
    {
      "id": "seg_013",
      "phase": "challenge",
      "role": "challenge_setup",
      "text": "Here's something to think about: two volcanoes have the exact same amount of pressure built up in their magma chambers. One erupts violently and explosively. The other just quietly oozes lava for days. What's the likely difference between them, and why?",
      "gesture": "thinking"
    },
    {
      "id": "seg_014",
      "phase": "challenge",
      "role": "challenge_reveal",
      "text": "The difference is likely the thickness (viscosity) of the magma and how much gas is trapped inside it. Thick, sticky magma traps gas bubbles like a lid on a shaken bottle — pressure builds until it bursts violently. Thin, runny magma lets gas bubbles rise and escape smoothly, so the same amount of pressure just releases gradually instead of all at once.",
      "gesture": "explaining"
    },
    {
      "id": "seg_015",
      "phase": "connect",
      "role": "transition",
      "text": "Now you understand the real engine behind an eruption: magma rising, gas building pressure, and that pressure finding release through a vent. This is the foundation for understanding why some volcanoes are gentle giants and others are catastrophic — which is exactly what we'll explore next, looking at different types of volcanoes and their eruption styles.",
      "gesture": "explaining"
    }
  ],
  "metadata": {
    "estimated_read_time_minutes": 6,
    "bloom_level_taught": "Understand",
    "depth_level": "moderate",
    "should_generate_model": true,
    "model_image_prompt": "Cross-section diagram of a volcano showing labeled magma chamber underground, narrow vent rising to the surface, layers of crust rock around the chamber, arrows showing gas bubbles rising through magma, and lava erupting from the top crater. Educational textbook style, labeled parts, white background.",
    "model_3d_prompt": "Cross-section of a volcano cone, rocky brown and gray exterior, glowing red-orange magma chamber visible inside, narrow central vent filled with molten rock, isolated, centered, white background, realistic geological model",
    "model_annotations": [
      {
        "label": "Crater/Vent opening",
        "bias": "top"
      },
      {
        "label": "Central vent",
        "bias": "front"
      },
      {
        "label": "Magma chamber",
        "bias": "bottom"
      },
      {
        "label": "Surrounding crust",
        "bias": "left"
      },
      {
        "label": "Erupting lava",
        "bias": "top"
      },
      {
        "label": "Side vent",
        "bias": "right"
      }
    ],
    "model_callouts": [
      "Down here at the bottom is the magma chamber — the underground pool where molten rock and gas collect.",
      "This narrow tube is the vent, the pathway magma travels through to reach the surface.",
      "At the top, you can see molten rock erupting out as lava once it breaks through the crater.",
      "Some volcanoes even have side vents, letting pressure escape from the flanks instead of just the top."
    ],
    "demo_model_url": "/demo/volcano-eruption/model.glb"
  }
};

export const quiz: QuizQuestion[] = [
  {
    "id": "volcano-eruption-q1",
    "concept_id": "volcano-eruption",
    "question_type": "multiple_choice",
    "bloom_level": "remember",
    "question": "What is molten rock called before it reaches Earth's surface?",
    "options": [
      "Lava",
      "Magma",
      "Ash",
      "Pumice"
    ],
    "correct_answer": "Magma",
    "explanation_correct": "Molten rock is called magma while it's still underground; it's only called lava once it erupts onto the surface.",
    "explanation_wrong": {
      "Lava": "Lava is the name for the same molten rock after it erupts onto the surface, not before.",
      "Ash": "Ash is fine volcanic debris ejected during an eruption, not the molten rock itself.",
      "Pumice": "Pumice is a lightweight volcanic rock formed from cooled, gas-filled lava."
    },
    "difficulty": 0.3
  },
  {
    "id": "volcano-eruption-q2",
    "concept_id": "volcano-eruption",
    "question_type": "true_false",
    "bloom_level": "understand",
    "question": "A build-up of gas pressure inside a volcano is one of the main reasons it erupts.",
    "options": [
      "True",
      "False"
    ],
    "correct_answer": "True",
    "explanation_correct": "As magma rises, dissolved gases expand and build pressure; when that pressure overcomes the rock sealing the vent, it triggers an eruption.",
    "difficulty": 0.4
  }
];
