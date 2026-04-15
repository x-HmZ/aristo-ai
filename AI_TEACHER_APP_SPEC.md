# AI Teacher App — Technical Specification & Implementation Guide

> **Purpose of this document:** This is the authoritative specification for the AI Teacher App. Use it as the source of truth when building new features or refactoring existing code. If the current codebase does something differently from what this document describes, the codebase should be changed to match this document — not the other way around.

> **How to use this document:** Read it fully before making changes. Each section describes WHAT the system should do, WHY (the pedagogical reasoning), and HOW (concrete implementation details with code examples). Sections are ordered by dependency — earlier sections are prerequisites for later ones.

---

## Table of Contents

1. [System Overview & Architecture](#1-system-overview--architecture)
2. [Knowledge Graph System](#2-knowledge-graph-system)
3. [Learner Profile System](#3-learner-profile-system)
4. [Teaching Engine](#4-teaching-engine)
5. [Course Builder System](#5-course-builder-system)
6. [Quiz & Assessment System](#6-quiz--assessment-system)
7. [Spaced Repetition Engine](#7-spaced-repetition-engine)
8. [Prompt Templates](#8-prompt-templates)
9. [Database Schema](#9-database-schema)
10. [API Route Structure](#10-api-route-structure)
11. [Frontend Components](#11-frontend-components)
12. [Migration Guide: What to Remove](#12-migration-guide-what-to-remove)

---

## 1. System Overview & Architecture

### 1.1 Core Philosophy

The system follows these non-negotiable principles:

1. **Teach, don't tell.** The AI must use Socratic questioning and scaffolded explanations. It must NEVER dump a wall of text and call it "teaching."
2. **Measure mastery, not completion.** A learner has not "finished" a topic just because they read it. Mastery is a probability score (0.0 to 1.0) updated by quiz performance.
3. **Knowledge graph first.** Every topic exists as a node in a prerequisite graph. The graph determines what can be taught next.
4. **Behavioral profiling, not questionnaires.** We do NOT ask users to self-report their learning style. We observe their behavior and adapt.
5. **Spaced repetition for retention.** Learned material decays. The system schedules reviews at optimal intervals.
6. **Multi-agent prompt pipeline.** Different tasks use different specialized prompts. There is NO single monolithic prompt.

### 1.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      FRONTEND                           │
│  (Course Map, Lesson View, Quiz UI, Dashboard)          │
└──────────────────────┬──────────────────────────────────┘
                       │ API calls
┌──────────────────────▼──────────────────────────────────┐
│                   BACKEND API                           │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Curriculum  │  │   Teaching   │  │  Assessment   │  │
│  │   Agent      │  │    Agent     │  │    Agent      │  │
│  └──────┬──────┘  └──────┬───────┘  └──────┬────────┘  │
│         │                │                  │           │
│  ┌──────▼──────────────────────────────────▼────────┐  │
│  │              SHARED SERVICES                      │  │
│  │  ┌────────────┐ ┌──────────┐ ┌─────────────────┐ │  │
│  │  │ Knowledge  │ │ Learner  │ │  RAG Retrieval  │ │  │
│  │  │   Graph    │ │ Profile  │ │    Service      │ │  │
│  │  └────────────┘ └──────────┘ └─────────────────┘ │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │          LLM CLIENT (Anthropic API)              │   │
│  │  Claude Haiku → quizzes, feedback, simple Q&A    │   │
│  │  Claude Sonnet → teaching, course gen, complex   │   │
│  └─────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│                    DATABASE                              │
│  PostgreSQL (relational) + pgvector (embeddings)         │
└─────────────────────────────────────────────────────────┘
```

### 1.3 Agent Responsibilities

Each "agent" is NOT a separate service or microservice. An agent is a **function that constructs a specialized prompt, calls the LLM, and parses the response.** They share the same codebase and database.

| Agent | Responsibility | Model to Use |
|-------|---------------|--------------|
| `CurriculumAgent` | Generates course structures, selects next concept to teach, builds learning paths from the knowledge graph | Sonnet |
| `TeachingAgent` | Generates scaffolded lesson content for a specific concept, using the 5-phase protocol | Sonnet |
| `AssessmentAgent` | Generates quiz questions, evaluates answers, generates feedback | Haiku for evaluation, Sonnet for generation |
| `ProfilerAgent` | Analyzes behavioral data, updates learner preferences, detects misconceptions | Haiku |
| `ReviewAgent` | Selects concepts due for spaced repetition review, generates review exercises | Haiku |

### 1.4 Request Flow Example: "User opens next lesson"

```
1. Frontend calls: GET /api/learn/next
2. Backend:
   a. ProfilerAgent.getProfile(userId)
      → Returns learner profile (mastery scores, preferences, pace)
   b. CurriculumAgent.selectNextConcept(userId, courseId)
      → Queries knowledge graph for available concepts (prerequisites met, not yet mastered)
      → Returns the best next concept to teach
   c. RAGService.retrieve(conceptId)
      → Retrieves relevant textbook/reference content chunks
   d. TeachingAgent.generateLesson(concept, profile, ragContext)
      → Constructs the teaching prompt with learner profile + concept metadata + RAG context
      → Calls LLM with the 5-phase teaching protocol
      → Parses structured output
   e. Returns lesson JSON to frontend
3. Frontend renders lesson with interactive sections
```

---

## 2. Knowledge Graph System

### 2.1 What It Is

A directed acyclic graph (DAG) where:
- **Nodes** = concepts (the smallest teachable unit of knowledge)
- **Edges** = prerequisite relationships ("you must understand A before B")

This is the backbone of the entire system. Without it, you cannot determine learning paths, generate courses, identify knowledge gaps, or do meaningful adaptive teaching.

### 2.2 Concept Node Schema

```json
{
  "id": "python_loops_for",
  "name": "For Loops",
  "description": "Iterating over sequences using for loops in Python",
  "domain": "python_programming",
  "prerequisites": ["python_variables", "python_data_types_list"],
  "difficulty": 2,
  "bloom_level": "apply",
  "estimated_minutes": 15,
  "key_terms": ["for", "iteration", "range()", "enumerate()"],
  "learning_objectives": [
    "Write a for loop that iterates over a list",
    "Use range() to loop a specific number of times",
    "Use enumerate() to access both index and value"
  ],
  "common_misconceptions": [
    "Confusing for loops with while loops",
    "Off-by-one errors with range()",
    "Modifying a list while iterating over it"
  ],
  "tags": ["control_flow", "iteration", "fundamentals"]
}
```

### 2.3 Building the Knowledge Graph

#### Option A: LLM-Assisted Generation (recommended for bootstrapping)

Use this prompt to generate the initial graph for a new subject:

```
You are an expert curriculum designer. Generate a knowledge graph for the subject: [SUBJECT].

For each concept, provide:
- id: snake_case unique identifier
- name: human-readable name
- description: 1-2 sentence description
- prerequisites: list of concept ids that must be learned first (empty list for foundational concepts)
- difficulty: 1-5 (1=beginner, 5=advanced)
- bloom_level: one of [remember, understand, apply, analyze, evaluate, create]
- estimated_minutes: estimated time to learn (5-30)
- key_terms: list of important terms
- learning_objectives: list of 2-4 specific, measurable objectives
- common_misconceptions: list of 2-3 things learners commonly get wrong

Rules:
- Start with foundational concepts that have NO prerequisites
- Build up progressively — every concept except the foundations must list at least one prerequisite
- Aim for 30-80 concepts for an introductory course
- The graph must be a DAG (no circular dependencies)
- Group related concepts logically

Return as a JSON array of concept objects.
```

After generation, **manually review the output.** The LLM will get 80-90% right but will sometimes create incorrect prerequisite chains. Check that:
- No circular dependencies exist
- Prerequisite chains make pedagogical sense
- Difficulty progression is logical
- No orphan concepts (unreachable from any starting point)

#### Option B: Manual Curation

For subjects where accuracy is critical, build the graph manually. Start with a mind map, then formalize into the JSON schema above.

### 2.4 Graph Operations

Implement these utility functions:

```python
# These are the essential operations. Implement them as a service/module.

def get_available_concepts(user_id: str, course_id: str) -> list[Concept]:
    """
    Returns concepts the user can learn next.
    A concept is 'available' if:
    1. ALL its prerequisites have mastery_score >= 0.7 for this user
    2. The concept itself has mastery_score < 0.7
    """
    pass

def get_learning_path(user_id: str, target_concept_id: str) -> list[Concept]:
    """
    Returns the ordered sequence of concepts the user needs to learn
    to reach the target concept, excluding already-mastered ones.
    Uses topological sort (Kahn's algorithm) on the subgraph.
    """
    pass

def get_concept_with_context(concept_id: str) -> dict:
    """
    Returns the concept node with its prerequisites and dependents,
    used to give the Teaching Agent context about where this concept
    fits in the bigger picture.
    """
    pass

def validate_graph(course_id: str) -> list[str]:
    """
    Validates the knowledge graph for a course:
    - No cycles (it's a valid DAG)
    - No orphan nodes
    - All referenced prerequisites exist
    - At least one root node (no prerequisites)
    Returns list of error messages (empty = valid).
    """
    pass

def topological_sort(course_id: str) -> list[Concept]:
    """
    Returns all concepts in a valid teaching order.
    Uses Kahn's algorithm.
    """
    pass
```

### 2.5 Storage

Store the knowledge graph in the database (see Section 9 for full schema). Each concept is a row in the `concepts` table. Prerequisites are stored in a `concept_prerequisites` junction table.

For graph traversal queries, use recursive CTEs in PostgreSQL:

```sql
-- Find all prerequisites (transitive) for a concept
WITH RECURSIVE prereqs AS (
  SELECT prerequisite_id FROM concept_prerequisites WHERE concept_id = $1
  UNION
  SELECT cp.prerequisite_id
  FROM concept_prerequisites cp
  JOIN prereqs p ON cp.concept_id = p.prerequisite_id
)
SELECT * FROM concepts WHERE id IN (SELECT prerequisite_id FROM prereqs);
```

---

## 3. Learner Profile System

### 3.1 What to Remove: FSLSM Questionnaire

**Remove the entire FSLSM onboarding questionnaire.** The research consensus is that self-reported learning styles have weak validity and the data becomes stale immediately. Do not ask users "are you a visual learner?" or similar questions.

### 3.2 New Onboarding: Lightweight (3 Questions Max)

When a user signs up, ask only:

```json
{
  "onboarding_questions": [
    {
      "question": "What do you want to learn?",
      "type": "text_input_or_select",
      "purpose": "Determines which knowledge graph / course to load"
    },
    {
      "question": "What's your goal?",
      "type": "select",
      "options": [
        "Learn from scratch (beginner)",
        "Fill in gaps in my knowledge",
        "Prepare for an exam or certification",
        "Quick refresher on topics I've seen before"
      ],
      "purpose": "Sets initial pacing and depth defaults"
    },
    {
      "question": "How much time can you commit daily?",
      "type": "select",
      "options": ["10-15 minutes", "20-30 minutes", "45-60 minutes", "1+ hours"],
      "purpose": "Determines lesson length and daily review load"
    }
  ]
}
```

This gets the user into the app in under 30 seconds.

### 3.3 Learner Profile Schema

```json
{
  "user_id": "uuid",
  
  "static_profile": {
    "goal": "learn_from_scratch | fill_gaps | exam_prep | refresher",
    "daily_time_minutes": 20,
    "created_at": "2026-04-15T10:00:00Z"
  },

  "dynamic_profile": {
    "expertise_level": "beginner | intermediate | advanced",
    "pace": "fast | moderate | careful",
    "explanation_depth": "concise | moderate | detailed",
    "example_preference": "abstract | concrete | mixed",
    "engagement_pattern": "steady | burst | declining",
    "strongest_bloom_level": "apply",
    "weakest_bloom_level": "analyze",
    "updated_at": "2026-04-15T12:30:00Z"
  },

  "mastery_scores": {
    "concept_id_1": {
      "score": 0.85,
      "last_assessed": "2026-04-14T18:00:00Z",
      "assessment_count": 5,
      "srs_interval_days": 7,
      "srs_next_review": "2026-04-21T00:00:00Z",
      "stability": 4.2,
      "difficulty": 0.3
    }
  },

  "misconceptions_detected": [
    {
      "concept_id": "python_loops_for",
      "misconception": "Modifying a list while iterating over it",
      "detected_at": "2026-04-13T14:20:00Z",
      "resolved": false
    }
  ],

  "session_stats": {
    "total_sessions": 12,
    "total_time_minutes": 340,
    "avg_session_length_minutes": 28,
    "current_streak_days": 5,
    "longest_streak_days": 8
  }
}
```

### 3.4 Behavioral Profiling (Implicit — No Questionnaire)

Track these signals during every session and use them to update `dynamic_profile`:

```python
# Signals to track per interaction
behavioral_signals = {
    # Time-based
    "time_on_explanation_seconds": 45,      # How long they spend reading explanations
    "time_on_example_seconds": 120,         # How long they spend on worked examples
    "time_on_quiz_question_seconds": 30,    # Response time on quiz questions
    
    # Interaction-based  
    "clicked_explain_more": True,           # Did they ask for deeper explanation?
    "clicked_show_example": True,           # Did they ask for more examples?
    "clicked_skip_to_quiz": False,          # Did they skip the explanation entirely?
    "revisited_concept": False,             # Did they go back to a previous concept?
    
    # Performance-based
    "quiz_accuracy_by_bloom": {
        "remember": 0.9,
        "understand": 0.8,
        "apply": 0.6,
        "analyze": 0.4
    },
    "first_attempt_accuracy": 0.7,          # % correct on first try (no hints)
    "needed_hint": False                    # Did they use hints?
}
```

**Update rules for dynamic_profile:**

```python
def update_dynamic_profile(profile: dict, signals: dict) -> dict:
    """
    Called after each session. Updates preferences based on behavioral signals.
    Uses exponential moving average so recent behavior weighs more.
    """
    alpha = 0.3  # Learning rate — how quickly to adapt

    # Depth preference
    if signals["clicked_explain_more"]:
        profile["explanation_depth"] = shift_toward("detailed", alpha)
    if signals["clicked_skip_to_quiz"]:
        profile["explanation_depth"] = shift_toward("concise", alpha)
    
    # Pace
    avg_quiz_time = signals["time_on_quiz_question_seconds"]
    if avg_quiz_time < 15 and signals["first_attempt_accuracy"] > 0.8:
        profile["pace"] = shift_toward("fast", alpha)
    elif avg_quiz_time > 60 or signals["first_attempt_accuracy"] < 0.5:
        profile["pace"] = shift_toward("careful", alpha)
    
    # Example preference
    if signals["time_on_example_seconds"] > signals["time_on_explanation_seconds"] * 1.5:
        profile["example_preference"] = shift_toward("concrete", alpha)
    
    # Bloom level strengths/weaknesses
    bloom_scores = signals["quiz_accuracy_by_bloom"]
    profile["weakest_bloom_level"] = min(bloom_scores, key=bloom_scores.get)
    profile["strongest_bloom_level"] = max(bloom_scores, key=bloom_scores.get)
    
    return profile
```

### 3.5 Mastery Score Updates (Bayesian Knowledge Tracing)

After every quiz question, update the mastery score for the relevant concept:

```python
def update_mastery(current_score: float, answered_correctly: bool, 
                   question_difficulty: float) -> float:
    """
    Simplified Bayesian Knowledge Tracing update.
    
    current_score: P(mastery) before this question, 0.0 to 1.0
    answered_correctly: bool
    question_difficulty: 0.0 (easy) to 1.0 (hard)
    
    Returns: updated P(mastery)
    """
    # Probability of correct answer given mastery
    p_correct_if_mastered = 0.95 - (question_difficulty * 0.2)  # 0.75-0.95
    # Probability of correct answer by guessing (no mastery)
    p_correct_if_not_mastered = 0.1 + ((1 - question_difficulty) * 0.15)  # 0.1-0.25
    # Probability of forgetting (slip)
    p_slip = 0.05 + (question_difficulty * 0.1)  # 0.05-0.15
    
    if answered_correctly:
        # Bayesian update: P(mastered | correct)
        numerator = p_correct_if_mastered * current_score
        denominator = numerator + p_correct_if_not_mastered * (1 - current_score)
    else:
        # Bayesian update: P(mastered | incorrect)  
        numerator = p_slip * current_score
        denominator = numerator + (1 - p_correct_if_not_mastered) * (1 - current_score)
    
    updated = numerator / denominator if denominator > 0 else current_score
    
    # Apply learning gain (even wrong answers teach something)
    learning_gain = 0.05 if not answered_correctly else 0.0
    updated = min(1.0, updated + learning_gain)
    
    return round(updated, 4)
```

**Mastery thresholds:**
- `< 0.3` → Not learned (needs teaching)
- `0.3 - 0.69` → In progress (needs more practice)
- `0.7 - 0.89` → Learned (available for progression, enters SRS)
- `>= 0.9` → Mastered (low priority for review)

A concept's prerequisites are considered "met" when mastery_score >= 0.7.

---

## 4. Teaching Engine

### 4.1 The 5-Phase Teaching Protocol

Every lesson MUST follow this structure. This is enforced via the system prompt (see Section 8). The LLM response is parsed into these sections and rendered as separate UI components.

```
Phase 1: ACTIVATE (Connect to prior knowledge)
   → "You already understand [prerequisite]. [Concept] builds on that by..."
   → References the learner's mastery data to personalize the bridge

Phase 2: EXPLAIN (Core concept with analogy first, then formal definition)
   → Starts with a concrete analogy or real-world example
   → Then gives the precise/formal explanation
   → Adjusts depth based on learner profile (concise vs detailed)

Phase 3: DEMONSTRATE (Worked example with step-by-step narration)
   → Full worked example, not just the answer
   → Each step is narrated: "First we do X because Y"
   → For code topics: runnable code with inline comments

Phase 4: CHALLENGE (Socratic question — make the learner THINK)
   → Asks a thought-provoking question that tests understanding
   → NOT a quiz question — it's a "what would happen if..." or "why does this work?"
   → Waits for the learner to respond before revealing the answer
   → This is the most important phase — it's what separates teaching from lecturing

Phase 5: CONNECT (Link to the bigger picture and what comes next)
   → Shows how this concept connects to the next topic
   → Gives a preview of what they'll learn next
   → Reinforces motivation: "Now that you know X, you can do Y"
```

### 4.2 Structured Output Format

The Teaching Agent must return JSON in this exact format. Parse it server-side and send sections to the frontend:

```json
{
  "concept_id": "python_loops_for",
  "phases": {
    "activate": {
      "content": "You already know how to store data in lists...",
      "prerequisites_referenced": ["python_data_types_list"]
    },
    "explain": {
      "analogy": "Think of a for loop like a conveyor belt in a factory...",
      "formal_explanation": "A for loop iterates over each element in a sequence...",
      "key_insight": "The key thing to remember is that the loop variable is reassigned on each iteration."
    },
    "demonstrate": {
      "example_description": "Let's print each fruit in a list:",
      "code": "fruits = ['apple', 'banana', 'cherry']\nfor fruit in fruits:\n    print(fruit)",
      "step_by_step": [
        "First, we define our list of fruits",
        "The for loop takes each item one at a time, assigning it to 'fruit'",
        "On the first pass, fruit = 'apple', and we print it",
        "On the second pass, fruit = 'banana', and so on",
        "After the last item, the loop ends automatically"
      ],
      "output": "apple\nbanana\ncherry"
    },
    "challenge": {
      "question": "What do you think would happen if you tried to modify the list WHILE the loop is running — say, removing an item during iteration? Why might that be a problem?",
      "hint": "Think about what the loop is keeping track of internally...",
      "answer": "Modifying a list during iteration can cause items to be skipped or errors, because the loop's internal counter gets out of sync with the list's changing length."
    },
    "connect": {
      "content": "Now that you can iterate over sequences, you're ready to learn about while loops — which let you repeat code until a condition changes, rather than iterating over a fixed list.",
      "next_concept": "python_loops_while"
    }
  },
  "metadata": {
    "estimated_read_time_minutes": 8,
    "bloom_level_taught": "apply",
    "depth_level": "detailed"
  }
}
```

### 4.3 Depth Adjustment

The prompt includes the learner's `explanation_depth` preference. Here's how each level changes the output:

- **concise:** Analogy is 1 sentence. Formal explanation is 2-3 sentences. One worked example. Challenge question is straightforward.
- **moderate:** (default) Analogy is a short paragraph. Explanation covers edge cases. One primary example + one variant. Challenge requires thought.
- **detailed:** Rich analogy with multiple angles. Explanation includes technical details, edge cases, and "why it works this way." Multiple examples of increasing complexity. Challenge involves synthesis or creative application.

### 4.4 RAG (Retrieval-Augmented Generation)

To prevent hallucination and ensure accuracy, inject relevant reference material into the teaching prompt.

**Setup:**
1. Collect high-quality reference content (textbook chapters, documentation, tutorials) for each subject
2. Chunk content into passages of ~300-500 tokens each
3. Embed each chunk using an embedding model (e.g., `voyage-3` or `text-embedding-3-small`)
4. Store embeddings in pgvector or a vector database

**At query time:**
1. Given the concept to teach, embed the concept name + description + learning objectives
2. Retrieve the top 3-5 most similar chunks
3. Include them in the teaching prompt as `<reference_material>` (see Section 8)

```python
async def retrieve_context(concept: Concept, top_k: int = 4) -> list[str]:
    """Retrieve relevant reference material for a concept."""
    query = f"{concept.name}: {concept.description}. {' '.join(concept.learning_objectives)}"
    embedding = await embed(query)
    results = await vector_db.similarity_search(embedding, top_k=top_k, 
                                                 filter={"domain": concept.domain})
    return [r.text for r in results]
```

### 4.5 Socratic Challenge Interaction Flow

When the learner reaches Phase 4 (Challenge), the frontend should:

1. Display the challenge question
2. Show a text input for the learner's response
3. Also show a "Show hint" button and a "I don't know — explain it" button
4. When the learner submits their response, call the Assessment Agent to evaluate it
5. If their response shows understanding → reveal the answer with praise + "Exactly right because..."
6. If their response shows a misconception → point out the specific error gently, give a hint, let them try again
7. If they click "I don't know" → reveal the answer, then log this concept for extra review

---

## 5. Course Builder System

### 5.1 Course Hierarchy

```
Course
  └── Module (3-8 per course)
        └── Lesson (2-5 per module)
              └── Concept (1-3 per lesson)
                    ├── Teaching content (5-phase lesson)
                    ├── Practice questions (2-3 quick checks)
                    └── Lesson quiz (3-5 graded questions)
        └── Module Assessment (checkpoint quiz covering all concepts in the module)
```

### 5.2 Course Data Structure

```json
{
  "id": "course_python_intro",
  "title": "Introduction to Python Programming",
  "description": "Learn Python from scratch — variables, control flow, functions, and data structures.",
  "domain": "python_programming",
  "estimated_hours": 20,
  "modules": [
    {
      "id": "mod_1_foundations",
      "title": "Python Foundations",
      "description": "Core building blocks: variables, data types, and basic operations.",
      "order": 1,
      "lessons": [
        {
          "id": "lesson_1_1",
          "title": "Variables and Assignment",
          "order": 1,
          "concept_ids": ["python_variables", "python_assignment", "python_naming_conventions"]
        },
        {
          "id": "lesson_1_2",
          "title": "Data Types",
          "order": 2,
          "concept_ids": ["python_data_types_int", "python_data_types_str", "python_data_types_bool"]
        }
      ],
      "assessment": {
        "type": "module_checkpoint",
        "pass_threshold": 0.7,
        "concept_ids": ["all concepts in this module"]
      }
    }
  ]
}
```

### 5.3 Auto-Generation from Knowledge Graph

```python
async def generate_course(domain: str, learning_goal: str, user_profile: dict) -> Course:
    """
    Auto-generates a course structure from the knowledge graph.
    
    Steps:
    1. Identify target concepts (based on learning goal)
    2. Trace prerequisites back to find the starting point (based on user mastery)
    3. Filter out already-mastered concepts
    4. Topologically sort the remaining concepts
    5. Group into modules (by topic cluster / difficulty tier)
    6. Group into lessons within modules (2-3 related concepts per lesson)
    7. Generate module/lesson titles and descriptions via LLM
    """
    
    # Step 1: Get target concepts
    target_concepts = await kg.find_concepts_for_goal(domain, learning_goal)
    
    # Step 2-3: Build personalized subgraph
    all_needed = await kg.get_all_prerequisites(target_concepts)
    mastered = await profile.get_mastered_concepts(user_profile["user_id"])
    remaining = [c for c in all_needed if c.id not in mastered]
    
    # Step 4: Valid teaching order
    ordered = topological_sort(remaining)
    
    # Step 5-6: Group into modules and lessons
    modules = group_into_modules(ordered)  # By difficulty tier or topic cluster
    
    # Step 7: Generate titles/descriptions
    for module in modules:
        module.title, module.description = await llm.generate_module_metadata(module.concepts)
    
    return Course(modules=modules)
```

### 5.4 Progression Rules

1. **Within a lesson:** Concepts are taught in order. The learner can proceed to the next concept after engaging with the lesson (no mastery gate within a lesson — the quiz at the end handles that).
2. **Between lessons:** No gate. Lessons within a module can be accessed freely.
3. **Module checkpoint:** After completing all lessons in a module, the learner must take the module assessment. They must achieve mastery (>= 0.7) on **every concept** tested to unlock the next module.
4. **Failed checkpoint:** If a concept scores below 0.7, mark it for re-teaching. The system should offer a focused review session on the weak concepts, then re-test.

### 5.5 Course Progress Tracking

```json
{
  "user_id": "uuid",
  "course_id": "course_python_intro",
  "status": "in_progress",
  "current_module": "mod_2_control_flow",
  "current_lesson": "lesson_2_1",
  "modules_completed": ["mod_1_foundations"],
  "overall_progress_percent": 35,
  "concepts_mastered": 12,
  "concepts_total": 35,
  "time_spent_minutes": 180,
  "started_at": "2026-04-10T09:00:00Z",
  "last_activity": "2026-04-15T14:30:00Z"
}
```

---

## 6. Quiz & Assessment System

### 6.1 Question Types

Support all of these (not just multiple choice):

```
1. multiple_choice    — 4 options, one correct, distractors based on common misconceptions
2. true_false         — Statement + required explanation of WHY
3. fill_blank         — Sentence with a blank for a key term
4. short_answer       — Open-ended, evaluated by LLM for semantic correctness
5. code_completion    — Fill in missing code (for programming subjects)
6. code_debugging     — Find and fix the bug
7. ordering           — Arrange steps in the correct sequence
8. matching           — Match terms to definitions
```

### 6.2 Bloom's Taxonomy Alignment

Every question targets a specific Bloom's level. Generate questions at multiple levels per concept:

| Bloom's Level | Question Focus | Example Stem |
|---------------|----------------|--------------|
| Remember | Recall facts/definitions | "What is a for loop?" |
| Understand | Explain in own words | "Explain the difference between for and while loops" |
| Apply | Use in a new situation | "Write a for loop that sums all even numbers in a list" |
| Analyze | Break down, compare | "Why does this code produce an infinite loop?" |
| Evaluate | Judge, justify | "Which approach is more efficient and why?" |
| Create | Design, build | "Design a function that..." |

### 6.3 Question Generation Prompt

See Section 8 for the full prompt template. The key is to include:
- The concept metadata (name, description, learning objectives, common misconceptions)
- The target Bloom's level
- The desired question type
- Instructions to generate plausible distractors based on common misconceptions

### 6.4 Question Output Format

```json
{
  "id": "q_uuid",
  "concept_id": "python_loops_for",
  "bloom_level": "apply",
  "question_type": "code_completion",
  "question": "Complete the code below to print each character in the string 'hello' on a separate line:\n\n```python\nword = 'hello'\n___ char ___ word:\n    print(char)\n```",
  "correct_answer": "for, in",
  "distractors": ["while, in", "for, of", "each, in"],
  "explanation_if_correct": "Correct! 'for char in word' iterates over each character in the string.",
  "explanation_if_wrong": "Remember, Python uses 'for X in Y' syntax to iterate over elements of Y.",
  "misconception_targeted": "Confusing Python for-loop syntax with other languages (e.g., JavaScript's 'of')",
  "difficulty": 0.4,
  "estimated_seconds": 30
}
```

### 6.5 Adaptive Difficulty Algorithm

```python
def select_next_question_difficulty(
    concept_mastery: float,
    recent_accuracy: float,  # Last 5 questions on this concept
    bloom_scores: dict       # Accuracy per Bloom's level
) -> tuple[str, float]:
    """
    Returns (bloom_level, difficulty) for the next question.
    
    Strategy:
    - Start at 'apply' level (middle ground)
    - If accuracy > 0.8 → escalate to higher Bloom's level
    - If accuracy < 0.5 → drop to lower Bloom's level
    - Within a level, adjust difficulty (0.0-1.0) based on response time and accuracy
    """
    bloom_order = ["remember", "understand", "apply", "analyze", "evaluate", "create"]
    
    # Find weakest Bloom's level
    weakest = min(bloom_scores, key=bloom_scores.get)
    weakest_score = bloom_scores[weakest]
    
    if weakest_score < 0.5:
        # Focus on the weakest level
        target_bloom = weakest
        target_difficulty = 0.3  # Keep it manageable
    elif recent_accuracy > 0.8:
        # Escalate — find the highest level they haven't mastered
        for level in reversed(bloom_order):
            if bloom_scores.get(level, 0) < 0.8:
                target_bloom = level
                break
        target_difficulty = min(1.0, concept_mastery + 0.1)
    else:
        target_bloom = "apply"  # Default
        target_difficulty = concept_mastery  # Match their level
    
    return target_bloom, round(target_difficulty, 2)
```

### 6.6 Answer Evaluation

For objective questions (MCQ, true/false, fill-blank), evaluate directly via string/option matching.

For subjective questions (short_answer), use the LLM:

```python
async def evaluate_short_answer(question: dict, user_answer: str) -> dict:
    """
    Uses the Assessment Agent to evaluate a free-text answer.
    Returns: { correct: bool, score: 0.0-1.0, feedback: str, misconception_detected: str|null }
    """
    prompt = f"""Evaluate this student's answer.

Question: {question['question']}
Correct answer: {question['correct_answer']}
Student's answer: {user_answer}
Common misconceptions for this concept: {question['misconception_targeted']}

Return JSON:
{{
  "correct": true/false,
  "score": 0.0 to 1.0 (partial credit allowed),
  "feedback": "Specific, encouraging feedback explaining what's right/wrong",
  "misconception_detected": "Name of misconception if detected, or null"
}}"""
    
    response = await llm.call(prompt, model="haiku")
    return parse_json(response)
```

### 6.7 Feedback Generation Rules

**For correct answers:**
- Confirm WHY it's correct (not just "Correct!")
- Add one reinforcement nugget ("Did you know: ...")
- If answered quickly and correctly, show brief praise and move on — don't over-explain

**For wrong answers:**
- NEVER say just "Wrong" or "Incorrect"
- Explain why their specific answer is wrong
- Name the misconception if one was detected
- Re-explain the relevant concept briefly (2-3 sentences)
- Offer a follow-up question targeting the same misconception from a different angle

Template:
```
Not quite — [their answer] would be the case if [explain the misconception]. 
Actually, [brief correct explanation]. 
[Key insight that distinguishes the right answer from their wrong one].

Want to try a similar question to make sure this clicks?
```

---

## 7. Spaced Repetition Engine

### 7.1 Algorithm: FSRS (Free Spaced Repetition Scheduler)

Use the FSRS algorithm (open-source, MIT license). It's significantly better than SM-2 or fixed-interval systems because it models the forgetting curve per-user and per-concept.

Key parameters per concept per user:
- `stability` (S): How many days until recall probability drops to 90%. Higher = better retention.
- `difficulty` (D): 0.0-1.0, how hard this concept is for this user. Learned from response patterns.
- `last_review`: Timestamp of last review.
- `next_review`: Scheduled date for next review.
- `review_count`: Number of times reviewed.
- `lapses`: Number of times the user forgot (got wrong after previously mastering).

### 7.2 Simplified Implementation

If full FSRS is too complex to implement immediately, use this simplified version:

```python
def schedule_next_review(
    current_interval_days: float,
    answered_correctly: bool,
    difficulty: float,  # 0.0-1.0
    consecutive_correct: int
) -> float:
    """
    Returns the next review interval in days.
    """
    if answered_correctly:
        if consecutive_correct == 1:
            return 1.0
        elif consecutive_correct == 2:
            return 3.0
        else:
            # Expanding intervals with difficulty adjustment
            ease_factor = 2.5 - (difficulty * 1.0)  # 1.5 to 2.5
            ease_factor = max(1.3, ease_factor)      # Floor at 1.3
            new_interval = current_interval_days * ease_factor
            return min(new_interval, 180)  # Cap at 6 months
    else:
        # Wrong answer — reset but not fully
        return max(1.0, current_interval_days * 0.3)
```

### 7.3 Daily Review Session

When the user opens the app, before presenting new material, check for due reviews:

```python
async def get_daily_review_queue(user_id: str) -> list[ReviewItem]:
    """
    Returns concepts due for review today, ordered by urgency.
    Mix with interleaving: concepts from different modules are interleaved,
    not grouped by topic.
    """
    due = await db.query("""
        SELECT concept_id, mastery_score, srs_next_review, stability
        FROM user_concept_mastery
        WHERE user_id = $1 
          AND srs_next_review <= NOW()
          AND mastery_score >= 0.3  -- Only review things they've actually learned
        ORDER BY srs_next_review ASC, stability ASC  -- Most overdue and fragile first
        LIMIT 15  -- Cap at 15 reviews per session
    """, user_id)
    
    # Interleave: shuffle so concepts from different modules alternate
    return interleave_by_module(due)
```

### 7.4 Review Session Flow

1. Show a brief review question (1-2 per concept, targeting the concept's weakest Bloom's level)
2. If correct → update mastery, extend the interval, show brief confirmation
3. If wrong → show explanation, mark for re-review in 1 day, optionally offer a mini re-lesson
4. After all reviews, show summary: "You reviewed 8 concepts. 7 correct, 1 needs more practice."
5. Then proceed to new material

### 7.5 Session Composition

Each session should blend:
- **70% new material** (next lesson in the course)
- **30% spaced review** (due reviews from previously learned concepts)

If there are many overdue reviews (> 10), prioritize reviews and reduce new material to 50/50.

---

## 8. Prompt Templates

### 8.1 Teaching Agent System Prompt

```
You are an expert tutor. Your job is to TEACH — not to summarize, not to lecture, not to dump information.

You follow the 5-Phase Teaching Protocol for every lesson:

PHASE 1 — ACTIVATE: Connect this concept to something the learner already knows. Reference their prior knowledge explicitly. Use phrasing like "You already understand X, so this builds on that..."

PHASE 2 — EXPLAIN: Start with a concrete, vivid analogy that makes the concept tangible. THEN give the formal/precise definition. Adjust depth to the learner's preference (see profile below). Never just give a definition without grounding it first.

PHASE 3 — DEMONSTRATE: Walk through a complete worked example. Show every step and explain WHY each step is taken, not just WHAT is done. For code topics, include runnable code with comments.

PHASE 4 — CHALLENGE: Ask a thought-provoking Socratic question. This is NOT a simple recall question. It should make the learner THINK — "What would happen if...?", "Why does this work but that doesn't?", "Can you think of a situation where this would fail?" Include a hint and a full answer.

PHASE 5 — CONNECT: Show how this concept links to the bigger picture and preview what comes next. Reinforce motivation.

RULES:
- DO NOT skip any phase.
- DO NOT give walls of text. Be clear and concise within each phase.
- DO NOT just list facts. Every explanation needs an analogy or concrete example.
- Use encouraging but not patronizing language.
- If the learner's profile says "concise", keep each phase brief. If "detailed", go deeper with edge cases, caveats, and multiple examples.
- Ground your explanations in the reference material provided. Do not fabricate facts.

You MUST return your response as JSON in this exact structure:
{
  "phases": {
    "activate": { "content": "..." },
    "explain": { "analogy": "...", "formal_explanation": "...", "key_insight": "..." },
    "demonstrate": { "example_description": "...", "code": "...", "step_by_step": ["..."], "output": "..." },
    "challenge": { "question": "...", "hint": "...", "answer": "..." },
    "connect": { "content": "...", "next_concept": "..." }
  }
}
```

### 8.2 Teaching Agent User Message Template

```
<learner_profile>
Expertise level: {profile.expertise_level}
Explanation depth: {profile.explanation_depth}
Pace: {profile.pace}
Example preference: {profile.example_preference}
Known misconceptions: {profile.misconceptions_detected}
</learner_profile>

<concept_to_teach>
Name: {concept.name}
Description: {concept.description}
Learning objectives: {concept.learning_objectives}
Key terms: {concept.key_terms}
Common misconceptions: {concept.common_misconceptions}
Prerequisites (already mastered): {concept.prerequisites}
</concept_to_teach>

<reference_material>
{rag_chunks}
</reference_material>

Teach this concept following the 5-Phase Protocol. Tailor the depth and style to the learner profile above.
```

### 8.3 Assessment Agent — Question Generation Prompt

```
You are an assessment expert. Generate quiz questions for the following concept.

<concept>
Name: {concept.name}
Description: {concept.description}
Learning objectives: {concept.learning_objectives}
Common misconceptions: {concept.common_misconceptions}
</concept>

<requirements>
Target Bloom's level: {bloom_level}
Question type: {question_type}
Difficulty: {difficulty} (0.0 = easy, 1.0 = hard)
Number of questions: {count}
</requirements>

<rules>
- For MCQ: Generate 4 options. Make distractors plausible — base them on the common misconceptions listed above. Never include obviously absurd options.
- For true_false: Include a statement that tests understanding, not trivial recall. Require explanation of WHY.
- For code questions: Include realistic, runnable code. Test one concept at a time.
- Every question must have: a clear correct answer, an explanation for why it's correct, an explanation for why each wrong option is wrong, and the misconception it targets.
</rules>

Return as JSON array:
[
  {
    "question_type": "...",
    "bloom_level": "...",
    "question": "...",
    "options": ["..."] (for MCQ only),
    "correct_answer": "...",
    "explanation_correct": "...",
    "explanation_wrong": { "option_a": "...", ... },
    "misconception_targeted": "...",
    "difficulty": 0.0-1.0
  }
]
```

### 8.4 Assessment Agent — Answer Evaluation Prompt

```
You are evaluating a student's answer. Be encouraging but accurate.

Question: {question}
Expected answer: {correct_answer}
Student's answer: {user_answer}
Concept: {concept_name}
Known misconceptions: {misconceptions}

Evaluate and return JSON:
{
  "is_correct": true/false,
  "score": 0.0-1.0,
  "feedback": "Specific feedback. If wrong: explain what's wrong with their specific answer, correct the misconception, briefly re-explain the concept. If right: confirm WHY they're right, add a reinforcement insight.",
  "misconception_detected": "name of misconception or null"
}

RULES:
- Never say just "Correct!" or "Wrong!" — always explain.
- Give partial credit where appropriate (score between 0 and 1).
- If you detect a misconception, name it specifically so the system can track it.
- Keep feedback to 2-4 sentences. Do not write an essay.
```

### 8.5 Curriculum Agent — Course Generation Prompt

```
You are a curriculum designer. Given the following list of concepts (already in valid prerequisite order), group them into a course structure.

<concepts_in_order>
{json_list_of_concepts}
</concepts_in_order>

Create a course with:
- 3-8 modules, each covering a coherent topic area
- 2-5 lessons per module, each containing 1-3 related concepts
- A descriptive title and 1-sentence description for each module and lesson
- Concepts should not be split across modules if they share direct prerequisites

Return JSON:
{
  "title": "Course title",
  "description": "1-2 sentence description",
  "modules": [
    {
      "title": "Module title",
      "description": "...",
      "lessons": [
        {
          "title": "Lesson title",
          "concept_ids": ["...", "..."]
        }
      ]
    }
  ]
}
```

---

## 9. Database Schema

```sql
-- ============================================
-- USERS
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    goal VARCHAR(50), -- learn_from_scratch, fill_gaps, exam_prep, refresher
    daily_time_minutes INTEGER DEFAULT 20,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LEARNER DYNAMIC PROFILE
-- ============================================
CREATE TABLE learner_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    expertise_level VARCHAR(20) DEFAULT 'beginner', -- beginner, intermediate, advanced
    pace VARCHAR(20) DEFAULT 'moderate',            -- fast, moderate, careful
    explanation_depth VARCHAR(20) DEFAULT 'moderate', -- concise, moderate, detailed
    example_preference VARCHAR(20) DEFAULT 'concrete', -- abstract, concrete, mixed
    weakest_bloom_level VARCHAR(20),
    strongest_bloom_level VARCHAR(20),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- KNOWLEDGE GRAPH: CONCEPTS
-- ============================================
CREATE TABLE concepts (
    id VARCHAR(100) PRIMARY KEY,        -- snake_case identifier
    domain VARCHAR(100) NOT NULL,       -- e.g., 'python_programming'
    name VARCHAR(255) NOT NULL,
    description TEXT,
    difficulty SMALLINT CHECK (difficulty BETWEEN 1 AND 5),
    bloom_level VARCHAR(20),
    estimated_minutes SMALLINT,
    key_terms JSONB DEFAULT '[]',
    learning_objectives JSONB DEFAULT '[]',
    common_misconceptions JSONB DEFAULT '[]',
    tags JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE concept_prerequisites (
    concept_id VARCHAR(100) REFERENCES concepts(id) ON DELETE CASCADE,
    prerequisite_id VARCHAR(100) REFERENCES concepts(id) ON DELETE CASCADE,
    PRIMARY KEY (concept_id, prerequisite_id),
    CHECK (concept_id != prerequisite_id)
);

CREATE INDEX idx_concept_domain ON concepts(domain);
CREATE INDEX idx_prereq_concept ON concept_prerequisites(concept_id);
CREATE INDEX idx_prereq_prereq ON concept_prerequisites(prerequisite_id);

-- ============================================
-- COURSES
-- ============================================
CREATE TABLE courses (
    id VARCHAR(100) PRIMARY KEY,
    domain VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    structure JSONB NOT NULL,  -- Full course hierarchy (modules/lessons/concept_ids)
    estimated_hours NUMERIC(5,1),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USER PROGRESS
-- ============================================
CREATE TABLE user_course_progress (
    user_id UUID REFERENCES users(id),
    course_id VARCHAR(100) REFERENCES courses(id),
    status VARCHAR(20) DEFAULT 'in_progress', -- in_progress, completed, paused
    current_module_id VARCHAR(100),
    current_lesson_id VARCHAR(100),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, course_id)
);

CREATE TABLE user_concept_mastery (
    user_id UUID REFERENCES users(id),
    concept_id VARCHAR(100) REFERENCES concepts(id),
    mastery_score NUMERIC(5,4) DEFAULT 0.0, -- 0.0000 to 1.0000
    assessment_count INTEGER DEFAULT 0,
    last_assessed TIMESTAMPTZ,
    -- Spaced repetition fields
    srs_interval_days NUMERIC(8,2) DEFAULT 1.0,
    srs_next_review TIMESTAMPTZ,
    srs_stability NUMERIC(6,2) DEFAULT 1.0,
    srs_difficulty NUMERIC(4,3) DEFAULT 0.5,
    srs_consecutive_correct INTEGER DEFAULT 0,
    srs_lapses INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, concept_id)
);

CREATE INDEX idx_mastery_user ON user_concept_mastery(user_id);
CREATE INDEX idx_mastery_review ON user_concept_mastery(user_id, srs_next_review);

-- ============================================
-- QUIZ HISTORY
-- ============================================
CREATE TABLE quiz_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    concept_id VARCHAR(100) REFERENCES concepts(id),
    question_type VARCHAR(30),
    bloom_level VARCHAR(20),
    question TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    user_answer TEXT,
    is_correct BOOLEAN,
    score NUMERIC(3,2),  -- 0.00 to 1.00 for partial credit
    difficulty NUMERIC(3,2),
    response_time_seconds INTEGER,
    misconception_detected VARCHAR(255),
    feedback_given TEXT,
    context VARCHAR(20) DEFAULT 'lesson', -- lesson, module_checkpoint, review
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quiz_user ON quiz_attempts(user_id);
CREATE INDEX idx_quiz_concept ON quiz_attempts(user_id, concept_id);
CREATE INDEX idx_quiz_bloom ON quiz_attempts(user_id, bloom_level);

-- ============================================
-- MISCONCEPTION TRACKING
-- ============================================
CREATE TABLE user_misconceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    concept_id VARCHAR(100) REFERENCES concepts(id),
    misconception TEXT NOT NULL,
    occurrence_count INTEGER DEFAULT 1,
    first_detected TIMESTAMPTZ DEFAULT NOW(),
    last_detected TIMESTAMPTZ DEFAULT NOW(),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_misconception_user ON user_misconceptions(user_id, resolved);

-- ============================================
-- SESSION BEHAVIORAL LOGS
-- ============================================
CREATE TABLE session_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    session_start TIMESTAMPTZ DEFAULT NOW(),
    session_end TIMESTAMPTZ,
    concepts_viewed JSONB DEFAULT '[]',
    time_on_explanations_seconds INTEGER DEFAULT 0,
    time_on_examples_seconds INTEGER DEFAULT 0,
    time_on_quizzes_seconds INTEGER DEFAULT 0,
    clicked_explain_more INTEGER DEFAULT 0,
    clicked_show_example INTEGER DEFAULT 0,
    clicked_skip_to_quiz INTEGER DEFAULT 0,
    quiz_accuracy NUMERIC(3,2),
    questions_attempted INTEGER DEFAULT 0,
    questions_correct INTEGER DEFAULT 0
);

CREATE INDEX idx_session_user ON session_logs(user_id);

-- ============================================
-- RAG: REFERENCE CONTENT EMBEDDINGS
-- (requires pgvector extension)
-- ============================================
-- CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE reference_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain VARCHAR(100) NOT NULL,
    source_title VARCHAR(255),
    content TEXT NOT NULL,
    embedding vector(1536),  -- Adjust dimension to match your embedding model
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CREATE INDEX idx_chunks_embedding ON reference_chunks USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_chunks_domain ON reference_chunks(domain);
```

---

## 10. API Route Structure

```
# ============================================
# AUTH
# ============================================
POST   /api/auth/register          — Create account
POST   /api/auth/login             — Login
POST   /api/auth/onboarding        — Submit 3 onboarding questions

# ============================================
# COURSES
# ============================================
GET    /api/courses                 — List available courses (for the user's domain)
POST   /api/courses/generate        — Auto-generate a course from knowledge graph + goal
GET    /api/courses/:id             — Get course structure
GET    /api/courses/:id/progress    — Get user's progress in this course

# ============================================
# LEARNING (the core loop)
# ============================================
GET    /api/learn/next              — Get the next thing to do (review session or next lesson)
GET    /api/learn/lesson/:conceptId — Get the 5-phase lesson for a specific concept
POST   /api/learn/challenge         — Submit answer to the Socratic challenge question
POST   /api/learn/complete          — Mark a lesson as viewed (not mastered — that requires quiz)

# ============================================
# QUIZZES
# ============================================
GET    /api/quiz/lesson/:conceptId  — Get quiz questions for a specific concept (post-lesson)
GET    /api/quiz/module/:moduleId   — Get module checkpoint assessment
GET    /api/quiz/review             — Get spaced repetition review questions
POST   /api/quiz/submit             — Submit a single answer, get immediate feedback
POST   /api/quiz/complete           — Submit completed quiz, update mastery scores

# ============================================
# PROFILE & ANALYTICS
# ============================================
GET    /api/profile                 — Get learner profile (dynamic + mastery scores)
GET    /api/profile/analytics       — Get learning analytics (streak, time, strengths/weaknesses)
GET    /api/profile/mastery         — Get mastery scores for all concepts in current course
POST   /api/profile/session         — Log behavioral session data

# ============================================
# KNOWLEDGE GRAPH (admin/dev)
# ============================================
GET    /api/kg/:domain              — Get all concepts for a domain
POST   /api/kg/concept              — Add a concept
PUT    /api/kg/concept/:id          — Update a concept
POST   /api/kg/validate/:domain     — Validate the graph (check for cycles, orphans)
POST   /api/kg/generate/:domain     — LLM-generate a knowledge graph for a new domain
```

---

## 11. Frontend Components

### 11.1 Key Views

```
1. OnboardingView
   - 3-question flow (goal, subject, daily time)
   - Minimal, fast, no FSLSM questionnaire

2. CourseMapView
   - Visual node graph showing all concepts in the course
   - Color-coded: mastered (green), in-progress (yellow), locked (grey), available (blue)
   - Click a node to see its details and prerequisites
   - Shows module boundaries and progress percentages

3. LessonView
   - Renders the 5-phase lesson as distinct visual sections/cards:
     - Activate card (with "bridge" icon or visual)
     - Explain card (analogy highlighted, then formal definition)
     - Demonstrate card (code block with step-by-step annotations)
     - Challenge card (interactive: text input + hint button + reveal button)
     - Connect card (preview of next topic)
   - Bottom: "I'm ready for the quiz" button
   - Side: "Explain more" / "Show another example" buttons

4. QuizView
   - Renders questions one at a time (not all at once)
   - Shows immediate feedback after each question
   - Adaptive: next question difficulty adjusts based on performance
   - Progress bar showing questions remaining
   - At end: summary with mastery score update

5. ReviewView
   - Daily spaced repetition session
   - Mix of concepts from different modules (interleaved)
   - Shorter than lessons — quick recall questions
   - "You remembered 7/8 today!" summary

6. DashboardView
   - Current streak
   - Overall course progress
   - Mastery heatmap (concepts grid, colored by mastery level)
   - Weak areas needing attention
   - Upcoming reviews count
   - Time spent today / this week
```

### 11.2 Interactive Elements in Lessons

The LessonView must support these user interactions:

```
[Explain More]          → Calls TeachingAgent for deeper explanation of the current phase
[Show Another Example]  → Calls TeachingAgent for an additional worked example
[I Already Know This]   → Skips to quiz; if they pass, concept is marked as mastered
[Ask a Question]        → Opens a chat where the user can ask the TeachingAgent for clarification
[Show Hint]             → Reveals the hint for the challenge question
[Submit Answer]         → Submits their challenge response for evaluation
```

---

## 12. Migration Guide: What to Remove

### Things to DELETE from the current codebase:

1. **FSLSM questionnaire** — Remove all onboarding questions related to learning style detection (visual/auditory/reading/kinesthetic, active/reflective, sensing/intuitive, sequential/global). Replace with the 3-question lightweight onboarding (Section 3.2).

2. **Static learning style mapping** — Remove any code that maps FSLSM dimensions to response generation parameters. Replace with the behavioral profiling system (Section 3.4).

3. **Single monolithic teaching prompt** — Remove any system prompt that tries to do everything (teach + quiz + adapt + evaluate) in one call. Replace with the multi-agent pipeline (Section 1.2).

4. **"One-shot" topic explanations** — Remove any code that generates a topic explanation as a single block of text. Replace with the 5-phase structured output (Section 4.2).

5. **Simple right/wrong quiz feedback** — Remove any feedback that's just "Correct!" or "Incorrect." Replace with the detailed feedback system (Section 6.7).

### Things to KEEP and EXTEND:

1. **User authentication** — Keep, extend with onboarding flow
2. **Basic chat/conversation UI** — Keep as the base, refactor into LessonView
3. **Anthropic API integration** — Keep, add model routing (Haiku vs Sonnet)
4. **Any existing course content** — Keep, restructure into knowledge graph format

### Things to ADD (in priority order):

1. Knowledge graph schema + basic CRUD (Section 2) — **FIRST PRIORITY, everything depends on this**
2. Learner profile schema + mastery tracking (Section 3)
3. Teaching Agent with 5-phase protocol (Section 4)
4. Quiz generation + answer evaluation (Section 6)
5. Course builder + progression rules (Section 5)
6. Spaced repetition engine (Section 7)
7. Behavioral profiling (Section 3.4)
8. RAG pipeline (Section 4.4)
9. Analytics dashboard (Section 11)

---

## Quick Reference: Model Selection

| Task | Model | Why |
|------|-------|-----|
| Teaching lessons (5-phase) | Claude Sonnet | Needs depth, creativity, analogies |
| Course structure generation | Claude Sonnet | Complex reasoning about curriculum design |
| Quiz question generation | Claude Sonnet | Needs to create good distractors, varied question types |
| Answer evaluation | Claude Haiku | Structured comparison, fast turnaround |
| Feedback generation | Claude Haiku | Template-driven, fast |
| "Explain more" follow-ups | Claude Haiku | Shorter, focused responses |
| Knowledge graph generation | Claude Sonnet | Complex domain reasoning |
| Behavioral profile updates | No LLM needed | Rule-based computation |
| Mastery score updates | No LLM needed | Bayesian math |
| Spaced repetition scheduling | No LLM needed | Algorithm-based |

---

*End of specification. When in doubt, refer back to this document as the source of truth.*
