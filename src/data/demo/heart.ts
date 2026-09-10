/**
 * FROZEN DEMO CONTENT — generated once by scripts/generate-demo-heart.ts.
 * Do not hand-edit; regenerate via the script if the source concept changes.
 * Served with zero Anthropic/fal.ai calls at runtime (public/demo/heart/...).
 *
 * The 3D model and the teaching image were produced by the 2026-09-09 pipeline
 * eval, not by this script — it makes no fal calls at all.
 */
import type { LessonPayload } from "@/lib/agents/teaching";
import type { QuizQuestion }  from "@/lib/agents/assessment";

export const lesson: LessonPayload = {
  "concept_id": "human-heart",
  "concept_name": "How the Heart Pumps Blood",
  "phases": {
    "activate": {
      "content": "We connect the heart to something familiar — a mechanical pump moving liquid through a hose — then reveal the surprising twist that it's actually two pumps in one, working side by side.",
      "prerequisites_referenced": [
        "everyday understanding of pumps and pulses"
      ],
      "segment_ids": [
        "seg_001",
        "seg_002",
        "seg_003"
      ]
    },
    "explain": {
      "analogy": "The heart is like a two-apartment house sharing one wall — each apartment (left and right side) has its own receiving room (atrium) upstairs and pumping room (ventricle) downstairs, and one-way swinging doors (valves) control traffic between them.",
      "formal_explanation": "The heart has four chambers: two atria (right and left) that receive incoming blood, and two ventricles (right and left) that pump blood out. The right side sends low-oxygen blood to the lungs; the left side sends oxygen-rich blood to the body. Valves between chambers ensure one-directional flow.",
      "key_insight": "The heart is really two separate pumps working in sync, not one single pump — and valves are the reason blood never flows backward.",
      "segment_ids": [
        "seg_004",
        "seg_005",
        "seg_006",
        "seg_007"
      ]
    },
    "demonstrate": {
      "example_description": "Tracing a single drop of blood through the full circulatory loop, from returning low on oxygen to being pumped back out full of oxygen.",
      "step_by_step": [
        "Low-oxygen blood enters the right atrium.",
        "It passes through a valve into the right ventricle.",
        "The right ventricle pumps it to the lungs, where it picks up oxygen (the heart does not oxygenate blood itself).",
        "Oxygen-rich blood returns to the left atrium.",
        "It passes through a valve into the left ventricle.",
        "The left ventricle pumps it out through the aorta to the entire body."
      ],
      "narration_pre_visual": "Let's follow one drop of blood on its complete journey through both sides of the heart, so you can see the two-pump system in action.",
      "visual_walkthrough": "Look at the diagram — the blue arrows show low-oxygen blood entering the right atrium, dropping into the right ventricle, and heading to the lungs. Then the red arrows show fresh oxygenated blood coming back into the left atrium, dropping into the thick-walled left ventricle, and blasting out through the aorta labeled at the top to reach your whole body.",
      "segment_ids": [
        "seg_008",
        "seg_009",
        "seg_010",
        "seg_011",
        "seg_012"
      ]
    },
    "challenge": {
      "question": "If one of the heart's one-way valves gets damaged and doesn't close all the way, what happens to the heart's pumping efficiency, and why?",
      "hint": "Think about what a swinging door that doesn't latch shut would do to traffic flow — some of it would go backward.",
      "answer": "Blood would leak backward through the faulty valve every time the chamber contracts, meaning less blood moves forward per beat. The heart compensates by working harder and beating more, which over time can wear out the heart muscle — this is the real medical condition called valve regurgitation.",
      "segment_ids": [
        "seg_013",
        "seg_014"
      ]
    },
    "connect": {
      "content": "You now understand the heart as two pumps working together, moving blood in a one-way loop through the lungs and body thanks to its valves. This foundation — chambers, valves, and the two-loop system — is exactly what you need before learning how blood vessels distribute that blood to every cell in the body.",
      "next_concept": "Blood vessels: arteries, veins, and capillaries",
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
      "text": "Put two fingers on your wrist or neck right now — that thump-thump you feel is a machine that's been running non-stop since before you were born, without ever taking a break.",
      "gesture": "explaining"
    },
    {
      "id": "seg_002",
      "phase": "activate",
      "role": "narrate",
      "text": "You already know a pump moves liquid from one place to another — think of a water pump pushing water through a hose. Your heart does exactly that, except the liquid is blood and the hose is your entire body.",
      "gesture": "explaining"
    },
    {
      "id": "seg_003",
      "phase": "activate",
      "role": "narrate",
      "text": "Here's the twist most people don't expect: your heart isn't one pump. It's actually two pumps, sitting side by side, doing two completely different jobs at the same time."
    },
    {
      "id": "seg_004",
      "phase": "explain",
      "role": "narrate",
      "text": "Picture a house with two apartments stacked side by side, sharing a wall but never mixing their water systems. The right side of your heart is one apartment, the left side is the other — each has its own upstairs room and downstairs room.",
      "gesture": "explaining"
    },
    {
      "id": "seg_005",
      "phase": "explain",
      "role": "narrate",
      "text": "Formally: the heart has four chambers. The top two are called atria — they're the receiving rooms that collect incoming blood. The bottom two are ventricles — they're the powerful pumping rooms that push blood back out.",
      "visual": {
        "prompt": "Simple labeled diagram of the four heart chambers as two stacked rooms on each side: right atrium and right ventricle on one side, left atrium and left ventricle on the other, arrows showing blood entering top and exiting bottom",
        "style": "diagram",
        "callouts": [
          "Right atrium",
          "Right ventricle",
          "Left atrium",
          "Left ventricle"
        ],
        "persists_to_next": true,
        "imageUrl": "/demo/heart/teaching.jpg"
      },
      "gesture": "pointing"
    },
    {
      "id": "seg_006",
      "phase": "explain",
      "role": "narrate",
      "text": "The right pump handles blood that's low on oxygen — it sends that blood to the lungs. The left pump handles blood that just came back full of fresh oxygen — it sends that blood out to the rest of your body. Two separate loops, one heart.",
      "gesture": "pointing"
    },
    {
      "id": "seg_007",
      "phase": "explain",
      "role": "narrate",
      "text": "One more key part: valves. Think of valves like one-way swinging doors — they let blood pass through in one direction, then slam shut so it can't flow backward. That's why blood never sloshes the wrong way inside your heart."
    },
    {
      "id": "seg_008",
      "phase": "demonstrate",
      "role": "narrate",
      "text": "Let's trace one drop of blood on its full round trip, starting the moment it arrives back at the heart tired and low on oxygen."
    },
    {
      "id": "seg_009",
      "phase": "demonstrate",
      "role": "demo_step",
      "text": "Look at the diagram: blood low on oxygen flows into the right atrium first — that's the receiving room on the right. From there it drops down through a one-way valve into the right ventricle just below it.",
      "visual": {
        "prompt": "Cross-section of the heart with blue arrows showing low-oxygen blood entering right atrium, passing through valve into right ventricle, then exiting toward lungs via pulmonary artery, labels visible",
        "style": "process_flow",
        "callouts": [
          "Right atrium",
          "Right ventricle",
          "To lungs"
        ],
        "persists_to_next": true
      },
      "gesture": "pointing"
    },
    {
      "id": "seg_010",
      "phase": "demonstrate",
      "role": "demo_step",
      "text": "The right ventricle squeezes and pushes that blood out to the lungs. This is where the heart's job actually ends for oxygen — the heart itself never adds oxygen. The lungs do that part, loading the blood with fresh oxygen.",
      "gesture": "pointing"
    },
    {
      "id": "seg_011",
      "phase": "demonstrate",
      "role": "demo_step",
      "text": "Now newly oxygenated blood comes back into the left atrium, drops through another valve into the left ventricle — the strongest chamber of all — and gets blasted out through a big artery called the aorta to every part of your body.",
      "visual": {
        "prompt": "Cross-section of the heart with red arrows showing oxygen-rich blood entering left atrium, passing through valve into left ventricle, then exiting through the aorta labeled clearly at the top, thick muscular wall shown on left ventricle",
        "style": "process_flow",
        "callouts": [
          "Left atrium",
          "Left ventricle",
          "Aorta"
        ]
      },
      "gesture": "pointing"
    },
    {
      "id": "seg_012",
      "phase": "demonstrate",
      "role": "narrate",
      "text": "Notice why the left ventricle has much thicker, stronger muscle than the right — it has to push blood all the way to your toes and fingertips, while the right ventricle only has to push blood a short distance to the nearby lungs."
    },
    {
      "id": "seg_013",
      "phase": "challenge",
      "role": "challenge_setup",
      "text": "Here's a thought experiment: imagine one of the heart's one-way valves gets damaged and doesn't close all the way anymore. What do you think would happen to the heart's pumping efficiency, and why?"
    },
    {
      "id": "seg_014",
      "phase": "challenge",
      "role": "challenge_reveal",
      "text": "Some blood would leak backward every time the chamber squeezes, instead of moving forward. The heart would have to work harder and pump more times to deliver the same amount of blood forward — which is exactly what happens in a real condition called valve regurgitation, and over time it exhausts the heart muscle."
    },
    {
      "id": "seg_015",
      "phase": "connect",
      "role": "transition",
      "text": "So now you know the heart's real secret: it's two pumps in one, moving blood in a continuous one-way loop through your lungs and body, kept flowing correctly by valves acting as one-way doors. Next, you're ready to explore how blood vessels — arteries, veins, and capillaries — actually deliver that blood to every single cell."
    }
  ],
  "metadata": {
    "estimated_read_time_minutes": 6,
    "bloom_level_taught": "Understand",
    "depth_level": "moderate",
    "should_generate_model": true,
    "model_image_prompt": "Educational cross-section diagram of the human heart, four chambers labeled (right atrium, right ventricle, left atrium, left ventricle), arrows showing blood flow direction through valves, aorta and pulmonary artery labeled, blue arrows for deoxygenated blood and red arrows for oxygenated blood, clean white background, medical illustration style",
    "model_3d_prompt": "human heart, anatomically accurate, red muscle tissue texture, realistic organic shape, isolated on white background, centered, no labels",
    "model_needs_multiview": true,
    "model_annotations": [
      {
        "label": "Right atrium",
        "bias": "right"
      },
      {
        "label": "Right ventricle",
        "bias": "right"
      },
      {
        "label": "Left atrium",
        "bias": "left"
      },
      {
        "label": "Left ventricle",
        "bias": "left"
      },
      {
        "label": "Aorta",
        "bias": "top"
      },
      {
        "label": "Pulmonary artery",
        "bias": "top"
      }
    ],
    "model_callouts": [
      "Here on the right side, blood low on oxygen enters the right atrium and gets pushed to the lungs.",
      "The left ventricle, here on the left, is the thickest chamber — it has to pump blood to your whole body.",
      "The aorta at the top is the big pipe that carries fresh blood out to everywhere you have tissue."
    ],
    "demo_model_url": "/demo/heart/model.glb"
  }
};

export const quiz: QuizQuestion[] = [
  {
    "id": "heart-q1",
    "concept_id": "human-heart",
    "question_type": "multiple_choice",
    "bloom_level": "remember",
    "question": "Which chamber pushes blood out to the rest of the body?",
    "options": [
      "Left ventricle",
      "Right atrium",
      "Left atrium",
      "Right ventricle"
    ],
    "correct_answer": "Left ventricle",
    "explanation_correct": "The left ventricle has the thickest muscle because it has to push blood all the way around the body through the aorta.",
    "explanation_wrong": {
      "Right atrium": "The right atrium receives blood coming back from the body; it does not push it out again.",
      "Left atrium": "The left atrium receives blood returning from the lungs and passes it down to the left ventricle.",
      "Right ventricle": "The right ventricle pumps blood to the lungs, not to the rest of the body."
    },
    "difficulty": 0.35
  },
  {
    "id": "heart-q2",
    "concept_id": "human-heart",
    "question_type": "true_false",
    "bloom_level": "understand",
    "question": "The valves in the heart are what stop blood flowing backwards.",
    "options": [
      "True",
      "False"
    ],
    "correct_answer": "True",
    "explanation_correct": "Each valve opens one way only. When the pressure behind it drops, it snaps shut, which is what makes blood travel in a single direction and what you hear as a heartbeat.",
    "difficulty": 0.4
  }
];
