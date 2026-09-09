/**
 * FROZEN DEMO CONTENT — generated once by scripts/generate-demo-content.ts.
 * Do not hand-edit; regenerate via the script if the source concept changes.
 * Served with zero Anthropic/fal.ai calls at runtime (public/demo/black-holes/...).
 */
import type { LessonPayload } from "@/lib/agents/teaching";
import type { QuizQuestion }  from "@/lib/agents/assessment";

export const lesson: LessonPayload = {
  "concept_id": "black-holes",
  "concept_name": "What Is a Black Hole",
  "phases": {
    "activate": {
      "content": "We connect the extreme gravity of a black hole to the everyday, familiar experience of gravity pulling objects down to Earth. The learner already intuitively understands that mass creates a pull — a black hole is simply that same pull turned up to its most extreme possible level.",
      "segment_ids": [
        "seg_001",
        "seg_002"
      ],
      "prerequisites_referenced": [
        "everyday experience of gravity/falling objects"
      ]
    },
    "explain": {
      "analogy": "Squeezing an entire mountain down to the size of a marble — the mass is all still there, just packed into a much smaller space, making gravity at its surface incredibly intense.",
      "formal_explanation": "A black hole forms when a massive star runs out of nuclear fuel and can no longer resist its own gravity, causing its core to collapse into an extremely small, dense point called a singularity. Around the singularity is the event horizon: the boundary where escape velocity equals the speed of light. Since nothing can travel faster than light, nothing that crosses the event horizon — not even light itself — can ever escape.",
      "key_insight": "A black hole isn't empty space or a vacuum cleaner — it's ordinary matter crushed to extreme density, and its gravity is only extreme very close to that dense core (inside the event horizon).",
      "segment_ids": [
        "seg_003",
        "seg_004",
        "seg_005",
        "seg_006",
        "seg_007"
      ]
    },
    "demonstrate": {
      "example_description": "Tracing the full life-to-death journey of a massive star (about 20 solar masses) as it collapses into a black hole, showing exactly where mass, gravity, and the event horizon come from.",
      "step_by_step": [
        "The star fuses lighter elements into heavier ones in layered shells, ending with an iron core that cannot fuse further.",
        "Without outward fusion pressure, gravity instantly wins and the core collapses in under a second.",
        "The outer layers rebound off the collapsed core in a supernova explosion.",
        "If the remaining core is more than about 3 solar masses, collapse continues past the neutron star stage into a black hole.",
        "The result is a singularity (all mass crushed to a point) surrounded by an event horizon (the light-trapping boundary)."
      ],
      "narration_pre_visual": "Let's trace the full journey of a massive star turning into a black hole, from its final moments of fusion to the invisible boundary it leaves behind.",
      "visual_walkthrough": "Look at the layered star in the image — each shell fused a different element, and now the iron core in the center can't produce any more outward pressure. That core collapse is the very first step toward forming a black hole.",
      "segment_ids": [
        "seg_008",
        "seg_009",
        "seg_010",
        "seg_011",
        "seg_012"
      ]
    },
    "challenge": {
      "question": "If a black hole formed from our Sun tomorrow with the exact same mass, would Earth get sucked into it, or would Earth's orbit stay exactly the same as it is now?",
      "hint": "Think about what actually determines the strength of gravity pulling on Earth — is it the Sun's size, or something else?",
      "answer": "Earth's orbit stays exactly the same, because gravity depends on mass and distance, not on how spread out that mass is. At Earth's distance, a black hole with the Sun's mass pulls exactly as hard as the Sun does now — it's only very close to the tiny collapsed core that gravity becomes extreme. This directly disproves the 'cosmic vacuum cleaner' misconception.",
      "segment_ids": [
        "seg_013",
        "seg_014"
      ]
    },
    "connect": {
      "content": "Understanding that black holes are collapsed matter with an inescapable boundary (not empty holes or vacuum cleaners) is the foundation for understanding how astronomers actually detect them — not by seeing the black hole itself, but by observing its gravitational effects on nearby stars, gas, and light.",
      "next_concept": "How scientists detect and image black holes indirectly (e.g., accretion disks, gravitational lensing, the Event Horizon Telescope)",
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
      "text": "Have you ever dropped a ball and wondered why it always falls back down instead of floating away? That's gravity, and you already understand it better than you think.",
      "gesture": "explaining"
    },
    {
      "id": "seg_002",
      "phase": "activate",
      "role": "narrate",
      "text": "Every object with mass pulls on every other object — the Earth pulls on you, the Sun pulls on the Earth. A black hole is just gravity taken to its most extreme possible limit."
    },
    {
      "id": "seg_003",
      "phase": "explain",
      "role": "narrate",
      "text": "Imagine squeezing an entire mountain down into the size of a marble. The mountain's mass doesn't disappear — it's just packed into a much tinier space, so its gravity right at the surface becomes unbelievably strong.",
      "gesture": "explaining"
    },
    {
      "id": "seg_004",
      "phase": "explain",
      "role": "narrate",
      "text": "A black hole forms the same way, but with a dying massive star instead of a mountain. When a star many times heavier than our Sun runs out of fuel, it can no longer push back against its own gravity, and it collapses inward on itself.",
      "visual": {
        "prompt": "Side-by-side sequence: massive star with glowing core, then core collapsing inward, then tiny ultra-dense point remaining, arrows showing inward collapse, space background, educational diagram style.",
        "style": "process_flow",
        "callouts": [
          "Massive star (fuel running out)",
          "Core collapses inward",
          "Extremely dense remnant forms"
        ],
        "persists_to_next": true,
        "imageUrl": "/demo/black-holes/seg_004.png"
      },
      "gesture": "pointing"
    },
    {
      "id": "seg_005",
      "phase": "explain",
      "role": "narrate",
      "text": "All that stellar mass gets crushed into a single point of essentially zero size, called the singularity. Around it, gravity becomes so strong that space itself behaves differently.",
      "gesture": "pointing"
    },
    {
      "id": "seg_006",
      "phase": "explain",
      "role": "narrate",
      "text": "To escape any gravity, you need a certain speed — that's called escape velocity. Rockets escape Earth at about 11 kilometers per second, but near a black hole, escape velocity exceeds the speed of light itself — and nothing, not even light, can go that fast.",
      "visual": {
        "prompt": "Comparison diagram: rocket leaving Earth labeled 'escape velocity 11 km/s', versus light ray trying to leave black hole boundary labeled 'escape velocity > speed of light', arrows failing to exit near black hole.",
        "style": "comparison",
        "callouts": [
          "Earth: 11 km/s escape speed",
          "Black hole: faster than light needed"
        ],
        "imageUrl": "/demo/black-holes/seg_006.png"
      },
      "gesture": "explaining"
    },
    {
      "id": "seg_007",
      "phase": "explain",
      "role": "narrate",
      "text": "The boundary where escape velocity exactly equals the speed of light is called the event horizon. It's not a physical wall — it's an invisible line of no return. Cross it, and there is no path back out, even for light."
    },
    {
      "id": "seg_008",
      "phase": "demonstrate",
      "role": "narrate",
      "text": "Let's walk through the life story of a real black hole candidate, step by step, to see exactly how mass, gravity, and the event horizon connect."
    },
    {
      "id": "seg_009",
      "phase": "demonstrate",
      "role": "demo_step",
      "text": "Start with a star about 20 times the mass of our Sun. Look at the diagram: its core is fusing heavier and heavier elements until it hits iron, which can't release more energy through fusion.",
      "visual": {
        "prompt": "Cutaway diagram of massive star's layered core (onion-like shells: hydrogen, helium, carbon, iron core at center), labeled layers, arrow pointing to iron core, educational cross-section style.",
        "style": "diagram",
        "callouts": [
          "Outer hydrogen shell",
          "Inner fusion layers",
          "Iron core (fusion stops)"
        ],
        "persists_to_next": true,
        "imageUrl": "/demo/black-holes/seg_009.png"
      },
      "gesture": "pointing"
    },
    {
      "id": "seg_010",
      "phase": "demonstrate",
      "role": "demo_step",
      "text": "Without fusion pushing outward, gravity wins instantly. The core collapses in less than a second, and the outer layers slam inward then rebound in a massive explosion called a supernova."
    },
    {
      "id": "seg_011",
      "phase": "demonstrate",
      "role": "demo_step",
      "text": "If the leftover core is heavy enough — roughly more than about 3 times our Sun's mass — nothing can stop the collapse. It shrinks past being a neutron star and keeps going, forming a black hole with a singularity at its center and an event horizon around it."
    },
    {
      "id": "seg_012",
      "phase": "demonstrate",
      "role": "narrate",
      "text": "Notice what didn't happen: no matter was destroyed, and no 'hole' was punched into space. All that stellar mass is still there — just compressed into an incredibly small, dense point, wrapped in a boundary that traps light."
    },
    {
      "id": "seg_013",
      "phase": "challenge",
      "role": "challenge_setup",
      "text": "Here's something to think about: if a black hole formed from our Sun tomorrow with the exact same mass, would Earth get sucked into it, or would Earth's orbit stay exactly the same as it is now?"
    },
    {
      "id": "seg_014",
      "phase": "challenge",
      "role": "challenge_reveal",
      "text": "Earth's orbit would stay exactly the same! Gravity depends on mass and distance, not on how spread out that mass is. Since the black hole would have the same mass as the Sun at the same distance, Earth would keep orbiting normally — it's only if you got extremely close to the tiny collapsed core that gravity would become deadly. This is exactly why black holes aren't cosmic vacuum cleaners reaching out to suck up everything around them."
    },
    {
      "id": "seg_015",
      "phase": "connect",
      "role": "transition",
      "text": "So a black hole isn't an empty hole or a cosmic vacuum — it's leftover matter from a dead star, crushed to extreme density, wrapped in an event horizon you could never directly see, since no light escapes to show it to you. What we actually observe are the effects on nearby matter and light — which is exactly what you'll explore next when we look at how scientists actually detect and 'photograph' black holes."
    }
  ],
  "metadata": {
    "estimated_read_time_minutes": 6,
    "bloom_level_taught": "Understand",
    "depth_level": "moderate",
    "should_generate_model": true,
    "model_image_prompt": "Educational cross-section diagram of a black hole: labeled singularity at center, event horizon boundary circle around it, accretion disk of glowing matter swirling outside, light rays bending near the horizon and failing to escape, labeled arrows, clean white background, poster style diagram.",
    "model_3d_prompt": "A black hole with a glowing swirling accretion disk of orange and yellow hot gas surrounding a dark spherical core, warped light ring around the dark sphere, realistic, isolated, centered, black background",
    "model_annotations": [
      {
        "label": "Singularity",
        "bias": "front"
      },
      {
        "label": "Event horizon",
        "bias": "front"
      },
      {
        "label": "Accretion disk",
        "bias": "right"
      },
      {
        "label": "Bent light ring",
        "bias": "top"
      }
    ],
    "model_callouts": [
      "At the very center is the singularity — all the star's mass crushed into a tiny point.",
      "The dark sphere around it is the event horizon, the point of no return where not even light escapes.",
      "The glowing swirl is the accretion disk — matter spiraling in, heating up, and glowing brightly before it crosses the horizon.",
      "That bright ring near the top is light itself being bent by the black hole's intense gravity."
    ],
    "demo_model_url": "/demo/black-holes/model.glb"
  }
};

export const quiz: QuizQuestion[] = [
  {
    "id": "black-holes-q1",
    "concept_id": "black-holes",
    "question_type": "multiple_choice",
    "bloom_level": "understand",
    "question": "What is the boundary around a black hole called, beyond which nothing — not even light — can escape?",
    "options": [
      "Singularity",
      "Event horizon",
      "Accretion disk",
      "Photon sphere"
    ],
    "correct_answer": "Event horizon",
    "explanation_correct": "The event horizon is the invisible boundary marking the point of no return — once anything crosses it, the black hole's gravity is too strong to escape, even for light.",
    "explanation_wrong": {
      "Singularity": "The singularity is the infinitely dense point at the very center, not the outer boundary.",
      "Accretion disk": "The accretion disk is the swirling disk of gas and dust orbiting outside the black hole, not the point of no return.",
      "Photon sphere": "The photon sphere is a region where light can orbit the black hole, but it isn't the point of no return."
    },
    "difficulty": 0.4
  },
  {
    "id": "black-holes-q2",
    "concept_id": "black-holes",
    "question_type": "true_false",
    "bloom_level": "remember",
    "question": "A black hole forms when a very massive star runs out of fuel and collapses under its own gravity.",
    "options": [
      "True",
      "False"
    ],
    "correct_answer": "True",
    "explanation_correct": "When a massive star exhausts its nuclear fuel, it can no longer support itself against gravity, and its core collapses to form a black hole.",
    "difficulty": 0.3
  }
];
