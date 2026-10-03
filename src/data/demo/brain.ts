/**
 * FROZEN DEMO CONTENT — generated once by scripts/generate-demo-brain.ts (V8.3c).
 * Do not hand-edit; regenerate via the script if the source concept changes.
 * Served with zero Anthropic/fal.ai calls at runtime (public/demo/brain/...).
 *
 * The 3D model is the Tripo3D v2.5 output of the V8.3c eval's FLUX source `brain-1`, not made by this script.
 */
import type { LessonPayload } from "@/lib/agents/teaching";
import type { QuizQuestion }  from "@/lib/agents/assessment";

export const lesson: LessonPayload = {
  "concept_id": "brain",
  "concept_name": "How Your Brain Is Organised",
  "phases": {
    "activate": {
      "content": "We connect brain organization to something intuitive: a house with different rooms for different purposes. The learner has no prior neuroscience knowledge, so we ground the whole lesson in the familiar idea of specialized spaces working together in one building.",
      "segment_ids": [
        "seg_001",
        "seg_002"
      ],
      "prerequisites_referenced": [
        "Understanding that a house has specialized rooms for different purposes"
      ]
    },
    "explain": {
      "analogy": "The brain is like a house: four lobes are rooms on the top floor (office, sensor room, sound/memory room, home theater), while the cerebellum and brainstem are in the basement running balance and life-support systems.",
      "formal_explanation": "The cerebrum, the brain's large outer structure, is divided into four lobes: the frontal lobe (planning, decision-making, self-control), the parietal lobe (touch and spatial sense), the temporal lobe (hearing and memory), and the occipital lobe (vision). Below the cerebrum, the cerebellum coordinates movement and balance, and the brainstem controls automatic functions like heartbeat, breathing, and sleep cycles.",
      "key_insight": "Each brain region is specialized for a particular job, but none of them work in isolation — they constantly communicate to produce everyday behavior, and nearly all regions are used regularly, debunking the '10 percent' myth.",
      "segment_ids": [
        "seg_003",
        "seg_004",
        "seg_005",
        "seg_006",
        "seg_007",
        "seg_008"
      ]
    },
    "demonstrate": {
      "example_description": "Catching a tossed ball as an everyday task that requires multiple brain regions working together in real time.",
      "step_by_step": [
        "Light from the ball enters the eyes; the occipital lobe processes the visual image.",
        "The parietal lobe calculates the ball's position relative to the hand.",
        "The frontal lobe decides how and when to move the arm.",
        "The cerebellum fine-tunes the timing and smoothness of the catching motion.",
        "The brainstem continuously maintains heartbeat and breathing throughout, unnoticed."
      ],
      "narration_pre_visual": "Let's see these brain rooms actually working together, not alone, using something simple: catching a ball someone tosses to you.",
      "visual_walkthrough": "Look at the diagram — you can see the arrows tracing the path from the eyes to the occipital lobe at the back of the brain, where the image of the ball gets processed first. From there, information routes to the parietal lobe for spatial judgment and the frontal lobe for the decision to move, all before the cerebellum smooths out the final motion.",
      "segment_ids": [
        "seg_009",
        "seg_010",
        "seg_011",
        "seg_012",
        "seg_013"
      ]
    },
    "challenge": {
      "question": "If someone suffered damage to only their occipital lobe, could they still plan a conversation, feel someone tap their shoulder, or dance to a beat? What does your answer tell you about how specialized, yet connected, brain regions are?",
      "hint": "Think about which lobe or structure is responsible for each of those three abilities, and whether any of them require vision.",
      "answer": "Yes, they could still do all three — planning uses the frontal lobe, touch uses the parietal lobe, and dancing to a beat relies heavily on the cerebellum, none of which are the occipital lobe. However, the person would lose or struggle with vision itself, and any task that depends on combining vision with those abilities (like catching a thrown ball) would be impaired. This shows brain regions are specialized for distinct jobs, but they're also deeply interconnected for complex tasks.",
      "segment_ids": [
        "seg_014",
        "seg_015"
      ]
    },
    "connect": {
      "content": "Understanding the brain's four lobes, cerebellum, and brainstem gives you a map for everything from sports injuries to strokes to everyday multitasking — and clears up popular myths like the 10 percent brain or rigid left-brain/right-brain personalities.",
      "next_concept": "A deeper look at the frontal lobe's role in decision-making and impulse control",
      "segment_ids": [
        "seg_016"
      ]
    }
  },
  "segments": [
    {
      "id": "seg_001",
      "phase": "activate",
      "role": "hook",
      "text": "Right now, you're reading these words, balancing in your chair, and breathing without even thinking about it — your brain is doing all of that at once, using different teams of cells for each job.",
      "gesture": "explaining"
    },
    {
      "id": "seg_002",
      "phase": "activate",
      "role": "narrate",
      "text": "You already know a house has different rooms for different purposes — a kitchen for cooking, a bedroom for sleeping. Your brain is organized the same way: it's divided into regions, each specialized for a different kind of job.",
      "gesture": "explaining"
    },
    {
      "id": "seg_003",
      "phase": "explain",
      "role": "narrate",
      "text": "Picture your brain as a house with four main rooms on the top floor, plus a basement. The top floor rooms are called lobes, and the basement houses the parts that keep you alive and steady without you ever noticing.",
      "gesture": "explaining"
    },
    {
      "id": "seg_004",
      "phase": "explain",
      "role": "narrate",
      "text": "Formally, the brain's outer, wrinkly layer — the cerebrum — is split into four lobes: frontal, parietal, temporal, and occipital. Below and behind the cerebrum sit the cerebellum and the brainstem.",
      "visual": {
        "prompt": "Simple labeled side-view diagram of the brain divided into four colored regions: frontal lobe (blue, front), parietal lobe (green, top), temporal lobe (yellow, side), occipital lobe (red, back), with cerebellum and brainstem labeled below, clean infographic style",
        "style": "diagram",
        "callouts": [
          "Frontal lobe",
          "Parietal lobe",
          "Temporal lobe",
          "Occipital lobe",
          "Cerebellum",
          "Brainstem"
        ],
        "persists_to_next": true,
        "imageUrl": "/demo/brain/seg_004.png"
      },
      "gesture": "pointing"
    },
    {
      "id": "seg_005",
      "phase": "explain",
      "role": "narrate",
      "text": "The frontal lobe, right behind your forehead, is like the house's office — it handles planning, decisions, and self-control. The parietal lobe, on top, is like a sensor room — it processes touch, and helps you sense where your body is in space.",
      "gesture": "pointing"
    },
    {
      "id": "seg_006",
      "phase": "explain",
      "role": "narrate",
      "text": "The temporal lobe, near your ears, is the sound and memory room — it handles hearing and helps store memories. The occipital lobe, at the very back, is the home theater — almost everything you see gets processed there.",
      "gesture": "pointing"
    },
    {
      "id": "seg_007",
      "phase": "explain",
      "role": "narrate",
      "text": "Downstairs in the basement, the cerebellum is like a balance coach — it fine-tunes your movements and keeps you steady. The brainstem is the building's utility system — it automatically runs your heartbeat, breathing, and sleep cycles, no instructions needed.",
      "gesture": "pointing"
    },
    {
      "id": "seg_008",
      "phase": "explain",
      "role": "callout",
      "text": "Here's an important myth-buster: you don't use just 10 percent of your brain. Brain scans show almost all regions are active over the course of a normal day — you need every room in the house."
    },
    {
      "id": "seg_009",
      "phase": "demonstrate",
      "role": "narrate",
      "text": "Let's see these rooms actually working together, not alone, using something simple: catching a ball someone tosses to you.",
      "gesture": "explaining"
    },
    {
      "id": "seg_010",
      "phase": "demonstrate",
      "role": "demo_step",
      "text": "First, light bounces off the ball into your eyes, and your occipital lobe at the back of your brain processes the image, figuring out the ball's shape and movement.",
      "visual": {
        "prompt": "Diagram of a person catching a ball, with arrows from eyes to occipital lobe (back of brain) labeled 'vision processed here', simple process-flow style illustration",
        "style": "process_flow",
        "callouts": [
          "Eyes see ball",
          "Occipital lobe: processes image"
        ],
        "persists_to_next": true
      },
      "gesture": "pointing"
    },
    {
      "id": "seg_011",
      "phase": "demonstrate",
      "role": "demo_step",
      "text": "Next, your parietal lobe calculates where the ball is in space relative to your hand, and your frontal lobe decides how and when to move your arm to catch it.",
      "gesture": "pointing"
    },
    {
      "id": "seg_012",
      "phase": "demonstrate",
      "role": "demo_step",
      "text": "Then your cerebellum steps in to fine-tune the timing and smoothness of your arm and hand movements, so your fingers close at exactly the right moment. Meanwhile, your brainstem has been quietly keeping your heart pumping and lungs breathing through the entire catch, without you ever thinking about it.",
      "gesture": "pointing"
    },
    {
      "id": "seg_013",
      "phase": "demonstrate",
      "role": "narrate",
      "text": "Notice that no single lobe caught that ball alone — vision, spatial sense, decision-making, and movement coordination all fired together in a fraction of a second. This is why the idea that brain parts work 'completely on their own' is a myth; they're constantly passing information back and forth."
    },
    {
      "id": "seg_014",
      "phase": "challenge",
      "role": "challenge_setup",
      "text": "Here's a question to chew on: if someone suffered damage to only their occipital lobe, could they still plan a conversation, feel someone tap their shoulder, or dance to a beat? What does your answer tell you about how specialized, yet connected, these brain regions are?",
      "gesture": "thinking"
    },
    {
      "id": "seg_015",
      "phase": "challenge",
      "role": "challenge_reveal",
      "text": "Yes to all three — because planning uses the frontal lobe, touch uses the parietal lobe, and rhythm and balance rely on the cerebellum, none of which are occipital. But that person would likely lose or struggle with vision, since the occipital lobe is specialized for that one job. This shows the brain's parts are specialized AND interdependent at the same time — damage one room, and only that room's main function is directly lost, but tasks relying on teamwork with it will be affected too."
    },
    {
      "id": "seg_016",
      "phase": "connect",
      "role": "transition",
      "text": "So remember: four lobes for thinking, sensing, hearing, and seeing, plus a cerebellum for coordination and a brainstem for keeping you alive — all working as one connected team, never in isolation, and never using just 10 percent. Next, we'll zoom into the frontal lobe itself and explore how it handles decision-making and impulse control in even more detail."
    }
  ],
  "metadata": {
    "estimated_read_time_minutes": 7,
    "bloom_level_taught": "Understand",
    "depth_level": "moderate",
    "should_generate_model": true,
    "model_image_prompt": "Side view of the human brain, labeled diagram showing frontal lobe, parietal lobe, temporal lobe, occipital lobe, cerebellum, and brainstem in distinct colors, arrows pointing to each labeled region, educational textbook style, white background",
    "model_3d_prompt": "Anatomical model of the human brain with each lobe a different solid colour: frontal lobe blue, parietal lobe yellow, temporal lobe green, occipital lobe red, cerebellum purple, brainstem grey, glossy plastic school model, three-quarter side view",
    "model_needs_multiview": true,
    "model_annotations": [
      {
        "label": "Frontal lobe",
        "bias": "front"
      },
      {
        "label": "Parietal lobe",
        "bias": "top"
      },
      {
        "label": "Occipital lobe",
        "bias": "back"
      },
      {
        "label": "Temporal lobe",
        "bias": "left"
      },
      {
        "label": "Cerebellum",
        "bias": "bottom"
      },
      {
        "label": "Brainstem",
        "bias": "bottom"
      }
    ],
    "model_callouts": [
      "Up front is the frontal lobe — your planning and decision-making center.",
      "On top sits the parietal lobe, handling touch and spatial sense.",
      "At the back, the occipital lobe processes everything you see.",
      "Down low, the cerebellum fine-tunes balance and movement, and the brainstem keeps your heart and lungs running automatically."
    ],
    "demo_model_url": "/demo/brain/model.glb"
  }
};

export const quiz: QuizQuestion[] = [
  {
    "id": "brain-q1",
    "concept_id": "brain",
    "question_type": "multiple_choice",
    "bloom_level": "remember",
    "question": "Which part of the brain helps you keep your balance when you ride a bike?",
    "options": [
      "Cerebellum",
      "Frontal lobe",
      "Occipital lobe",
      "Temporal lobe"
    ],
    "correct_answer": "Cerebellum",
    "explanation_correct": "The cerebellum, at the back under the cerebrum, coordinates your muscles so your movements stay smooth and balanced.",
    "explanation_wrong": {
      "Frontal lobe": "The frontal lobe plans and decides what to do, but the cerebellum keeps the movement balanced.",
      "Occipital lobe": "The occipital lobe, at the very back, makes sense of what your eyes see.",
      "Temporal lobe": "The temporal lobe, at the sides, handles hearing and memory."
    },
    "difficulty": 0.35
  },
  {
    "id": "brain-q2",
    "concept_id": "brain",
    "question_type": "true_false",
    "bloom_level": "understand",
    "question": "You use only about 10 percent of your brain.",
    "options": [
      "True",
      "False"
    ],
    "correct_answer": "False",
    "explanation_correct": "Brain scans show activity all over the brain across a day. Different parts are busier at different times, but none of it sits unused.",
    "difficulty": 0.4
  }
];
